from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.budget_item import BudgetItem
from app.models.expense_record import ExpenseRecord
from app.models.budget_category import BudgetCategory
from app.schemas import DashboardStats
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/reports", tags=["报表"])


@router.get("/dashboard", response_model=DashboardStats)
def dashboard_stats(
    year: int = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if year is None:
        year = datetime.now().year

    total_categories = db.query(BudgetCategory).filter(BudgetCategory.is_active == True).count()

    total_budget = db.query(func.sum(BudgetItem.budget_amount)).filter(
        BudgetItem.year == year
    ).scalar() or 0.0

    total_expense = db.query(func.sum(ExpenseRecord.amount)).filter(
        extract("year", ExpenseRecord.expense_date) == year
    ).scalar() or 0.0

    overall_rate = round((total_expense / total_budget * 100) if total_budget > 0 else 0, 2)

    monthly_budget = (
        db.query(BudgetItem.month, func.sum(BudgetItem.budget_amount))
        .filter(BudgetItem.year == year)
        .group_by(BudgetItem.month)
        .order_by(BudgetItem.month)
        .all()
    )
    monthly_expense = (
        db.query(extract("month", ExpenseRecord.expense_date).label("m"), func.sum(ExpenseRecord.amount))
        .filter(extract("year", ExpenseRecord.expense_date) == year)
        .group_by("m")
        .order_by("m")
        .all()
    )

    expense_map = {int(m): amt for m, amt in monthly_expense}
    monthly_trend = []
    for m, budget_amt in monthly_budget:
        actual = expense_map.get(m, 0.0)
        monthly_trend.append({
            "month": int(m),
            "budget": round(budget_amt, 2),
            "actual": round(actual, 2),
            "rate": round((actual / budget_amt * 100) if budget_amt > 0 else 0, 2),
        })

    top_expenses = (
        db.query(
            ExpenseRecord.category_id,
            BudgetCategory.name,
            func.sum(ExpenseRecord.amount).label("total")
        )
        .join(BudgetCategory, ExpenseRecord.category_id == BudgetCategory.id)
        .filter(extract("year", ExpenseRecord.expense_date) == year)
        .group_by(ExpenseRecord.category_id, BudgetCategory.name)
        .order_by(func.sum(ExpenseRecord.amount).desc())
        .limit(10)
        .all()
    )
    top_expense_categories = [
        {"category_id": cid, "name": name, "amount": round(total, 2)}
        for cid, name, total in top_expenses
    ]

    return DashboardStats(
        total_categories=total_categories,
        total_budget_amount=round(total_budget, 2),
        total_expense_amount=round(total_expense, 2),
        overall_execution_rate=overall_rate,
        monthly_trend=monthly_trend,
        top_expense_categories=top_expense_categories,
    )
