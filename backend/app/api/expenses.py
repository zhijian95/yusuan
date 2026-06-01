from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from app.database import get_db
from app.models.user import User
from app.models.expense_record import ExpenseRecord
from app.models.budget_category import BudgetCategory
from app.schemas import ExpenseCreate, ExpenseUpdate, ExpenseResponse
from app.middleware.auth import get_current_user, require_role
from app.utils.audit import create_audit_log

router = APIRouter(prefix="/api/expenses", tags=["支出记录"])


@router.get("", response_model=List[ExpenseResponse])
def list_expenses(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(ExpenseRecord)

    if year is not None:
        query = query.filter(func.extract("year", ExpenseRecord.expense_date) == str(year))
    if month is not None:
        query = query.filter(func.extract("month", ExpenseRecord.expense_date) == str(month))
    if category_id is not None:
        query = query.filter(ExpenseRecord.category_id == category_id)
    if start_date:
        query = query.filter(ExpenseRecord.expense_date >= start_date)
    if end_date:
        query = query.filter(ExpenseRecord.expense_date <= end_date)

    items = query.order_by(ExpenseRecord.expense_date.desc()).offset(skip).limit(limit).all()
    result = []
    for item in items:
        result.append(ExpenseResponse(
            id=item.id,
            category_id=item.category_id,
            category_name=item.category.name if item.category else None,
            category_code=item.category.code if item.category else None,
            amount=item.amount,
            expense_date=item.expense_date,
            description=item.description,
            vendor=item.vendor,
            document_no=item.document_no,
            recorded_by=item.recorded_by,
            recorder_name=item.recorder.real_name if item.recorder else None,
            created_at=item.created_at,
        ))
    return result


@router.post("")
def create_expense(
    data: ExpenseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "budget_manager")),
):
    category = db.query(BudgetCategory).filter(
        BudgetCategory.id == data.category_id, BudgetCategory.is_active == True
    ).first()
    if not category:
        raise HTTPException(status_code=404, detail="预算科目不存在或已禁用")

    expense = ExpenseRecord(
        category_id=data.category_id,
        amount=data.amount,
        expense_date=data.expense_date,
        description=data.description,
        vendor=data.vendor,
        document_no=data.document_no,
        recorded_by=current_user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    create_audit_log(
        db, current_user, "CREATE", "expense_record", expense.id,
        details={"category_id": data.category_id, "amount": data.amount, "date": str(data.expense_date)},
        ip_address=request.client.host if request.client else None,
    )
    return {"id": expense.id, "message": "支出记录创建成功"}


@router.put("/{expense_id}")
def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "budget_manager")),
):
    expense = db.query(ExpenseRecord).filter(ExpenseRecord.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="支出记录不存在")

    if data.category_id is not None:
        expense.category_id = data.category_id
    if data.amount is not None:
        expense.amount = data.amount
    if data.expense_date is not None:
        expense.expense_date = data.expense_date
    if data.description is not None:
        expense.description = data.description
    if data.vendor is not None:
        expense.vendor = data.vendor
    if data.document_no is not None:
        expense.document_no = data.document_no

    db.commit()

    create_audit_log(
        db, current_user, "UPDATE", "expense_record", expense.id,
        details=data.model_dump(exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "支出记录更新成功"}


@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    expense = db.query(ExpenseRecord).filter(ExpenseRecord.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="支出记录不存在")

    db.delete(expense)
    db.commit()
    create_audit_log(
        db, current_user, "DELETE", "expense_record", expense_id,
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "支出记录删除成功"}
