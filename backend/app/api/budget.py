from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.budget_item import BudgetItem
from app.models.budget_category import BudgetCategory
from app.models.expense_record import ExpenseRecord
from app.schemas import (
    BudgetItemCreate, BudgetItemUpdate, BudgetItemResponse,
    BudgetSummaryResponse, BudgetSummaryItem,
)
from app.middleware.auth import get_current_user, require_role
from app.utils.audit import create_audit_log

router = APIRouter(prefix="/api/budget", tags=["预算编制"])


@router.get("", response_model=List[BudgetItemResponse])
def list_budget_items(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(BudgetItem)
    query = query.filter(BudgetItem.year == year)
    if month is not None:
        query = query.filter(BudgetItem.month == month)
    if category_id is not None:
        query = query.filter(BudgetItem.category_id == category_id)

    items = query.order_by(BudgetItem.category_id, BudgetItem.month).all()
    result = []
    for item in items:
        result.append(BudgetItemResponse(
            id=item.id,
            category_id=item.category_id,
            category_name=item.category.name if item.category else None,
            category_code=item.category.code if item.category else None,
            year=item.year,
            month=item.month,
            budget_amount=item.budget_amount,
            notes=item.notes,
            created_by=item.created_by,
            creator_name=item.creator.real_name if item.creator else None,
            created_at=item.created_at,
            updated_at=item.updated_at,
        ))
    return result


@router.get("/summary", response_model=BudgetSummaryResponse)
def budget_summary(
    year: int = Query(...),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    categories = db.query(BudgetCategory).filter(BudgetCategory.is_active == True).all()
    summary_items = []

    for cat in categories:
        budget_query = db.query(func.sum(BudgetItem.budget_amount)).filter(
            BudgetItem.category_id == cat.id,
            BudgetItem.year == year,
        )
        expense_query = db.query(func.sum(ExpenseRecord.amount)).filter(
            ExpenseRecord.category_id == cat.id,
            func.extract("year", ExpenseRecord.expense_date) == str(year),
        )
        if month is not None:
            budget_query = budget_query.filter(BudgetItem.month == month)
            expense_query = expense_query.filter(
                func.extract("month", ExpenseRecord.expense_date) == str(month)
            )

        budget_amount = budget_query.scalar() or 0.0
        actual_amount = expense_query.scalar() or 0.0
        variance = budget_amount - actual_amount
        execution_rate = (actual_amount / budget_amount * 100) if budget_amount > 0 else 0.0

        summary_items.append(BudgetSummaryItem(
            category_id=cat.id,
            category_code=cat.code,
            category_name=cat.name,
            budget_amount=budget_amount,
            actual_amount=actual_amount,
            variance=variance,
            execution_rate=round(execution_rate, 2),
        ))

    total_budget = sum(item.budget_amount for item in summary_items)
    total_actual = sum(item.actual_amount for item in summary_items)
    total_variance = total_budget - total_actual

    return BudgetSummaryResponse(
        year=year,
        month=month,
        items=summary_items,
        total_budget=total_budget,
        total_actual=total_actual,
        total_variance=total_variance,
    )


@router.post("")
def create_budget_item(
    data: BudgetItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "budget_manager")),
):
    category = db.query(BudgetCategory).filter(BudgetCategory.id == data.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="预算科目不存在")

    existing = db.query(BudgetItem).filter(
        BudgetItem.category_id == data.category_id,
        BudgetItem.year == data.year,
        BudgetItem.month == data.month,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该科目在当前期间已有预算记录，请使用更新接口")

    item = BudgetItem(
        category_id=data.category_id,
        year=data.year,
        month=data.month,
        budget_amount=data.budget_amount,
        notes=data.notes,
        created_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    create_audit_log(
        db, current_user, "CREATE", "budget_item", item.id,
        details={"category_id": data.category_id, "year": data.year, "month": data.month, "amount": data.budget_amount},
        ip_address=request.client.host if request.client else None,
    )
    return {"id": item.id, "message": "预算编制成功"}


@router.put("/{item_id}")
def update_budget_item(
    item_id: int,
    data: BudgetItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "budget_manager")),
):
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="预算记录不存在")

    if data.budget_amount is not None:
        item.budget_amount = data.budget_amount
    if data.notes is not None:
        item.notes = data.notes

    db.commit()

    create_audit_log(
        db, current_user, "UPDATE", "budget_item", item.id,
        details=data.model_dump(exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "预算更新成功"}


@router.delete("/{item_id}")
def delete_budget_item(
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="预算记录不存在")

    db.delete(item)
    db.commit()
    create_audit_log(
        db, current_user, "DELETE", "budget_item", item_id,
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "预算删除成功"}
