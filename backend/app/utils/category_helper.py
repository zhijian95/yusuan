from sqlalchemy.orm import Session
from app.models.budget_category import BudgetCategory


def generate_child_code(db: Session, parent_id: int) -> str:
    parent = db.query(BudgetCategory).filter(BudgetCategory.id == parent_id).first()
    if not parent:
        return ""

    siblings = (
        db.query(BudgetCategory)
        .filter(BudgetCategory.parent_id == parent_id)
        .order_by(BudgetCategory.code.desc())
        .all()
    )

    if not siblings:
        return f"{parent.code}.01"

    last_code = siblings[0].code
    parts = last_code.split(".")
    try:
        last_num = int(parts[-1])
        new_num = last_num + 1
        if new_num > 99:
            return ""
        return ".".join(parts[:-1] + [f"{new_num:02d}"])
    except (ValueError, IndexError):
        return f"{parent.code}.01"


def get_category_type_options():
    return [
        {"value": "revenue", "label": "收入类"},
        {"value": "expense", "label": "支出类"},
        {"value": "transfer", "label": "内部结转"},
    ]


def get_control_type_options():
    return [
        {"value": "department", "label": "部门可控"},
        {"value": "company", "label": "公司统筹"},
    ]
