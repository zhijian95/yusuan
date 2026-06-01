from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.budget_category import BudgetCategory
from app.schemas import CategoryCreate, CategoryUpdate, CategoryTreeResponse, CATEGORY_MAX_LEVEL
from app.middleware.auth import get_current_user, require_role
from app.utils.audit import create_audit_log
from app.utils.category_helper import generate_child_code, get_category_type_options, get_control_type_options

router = APIRouter(prefix="/api/categories", tags=["预算科目"])

MAX_LEVEL = CATEGORY_MAX_LEVEL


def build_tree(categories: List[BudgetCategory], parent_id: int = None) -> List[dict]:
    result = []
    for cat in categories:
        if cat.parent_id == parent_id:
            node = CategoryTreeResponse(
                id=cat.id,
                code=cat.code,
                name=cat.name,
                parent_id=cat.parent_id,
                level=cat.level,
                description=cat.description,
                sort_order=cat.sort_order,
                is_active=cat.is_active,
                category_type=cat.category_type,
                control_type=cat.control_type,
                is_leaf=cat.is_leaf,
                tags=cat.tags,
                children=build_tree(categories, cat.id),
            )
            result.append(node)
    return sorted(result, key=lambda x: x.sort_order)


@router.get("", response_model=List[CategoryTreeResponse])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    categories = db.query(BudgetCategory).filter(BudgetCategory.is_active == True).order_by(
        BudgetCategory.sort_order, BudgetCategory.code
    ).all()
    return build_tree(categories)


@router.get("/all")
def list_all_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    categories = db.query(BudgetCategory).order_by(
        BudgetCategory.sort_order, BudgetCategory.code
    ).all()
    return [
        {
            "id": c.id,
            "code": c.code,
            "name": c.name,
            "parent_id": c.parent_id,
            "level": c.level,
            "description": c.description,
            "sort_order": c.sort_order,
            "is_active": c.is_active,
            "category_type": c.category_type,
            "control_type": c.control_type,
            "is_leaf": c.is_leaf,
            "tags": c.tags,
        }
        for c in categories
    ]


@router.get("/meta")
def category_meta():
    return {
        "category_types": get_category_type_options(),
        "control_types": get_control_type_options(),
        "max_level": MAX_LEVEL,
    }


@router.get("/next-code")
def get_next_code(
    parent_id: int = Query(..., description="父级科目ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "budget_manager")),
):
    parent = db.query(BudgetCategory).filter(BudgetCategory.id == parent_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="父级科目不存在")
    if parent.level >= MAX_LEVEL:
        raise HTTPException(status_code=400, detail=f"已达到最大科目层级（{MAX_LEVEL}级）")

    next_code = generate_child_code(db, parent_id)
    if not next_code:
        raise HTTPException(status_code=400, detail="同级科目已达数量上限（99个）")
    return {"code": next_code, "parent_code": parent.code, "parent_name": parent.name}


@router.post("")
def create_category(
    data: CategoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "budget_manager")),
):
    existing = db.query(BudgetCategory).filter(BudgetCategory.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="科目编码已存在")

    level = 1
    if data.parent_id:
        parent = db.query(BudgetCategory).filter(BudgetCategory.id == data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="父级科目不存在")
        if parent.level >= MAX_LEVEL:
            raise HTTPException(
                status_code=400,
                detail=f"已达到最大科目层级（{MAX_LEVEL}级），无法在「{parent.name}」下继续创建子科目",
            )
        level = parent.level + 1
        parent.is_leaf = False
        db.add(parent)

    is_leaf = True
    if data.category_type == "transfer":
        is_leaf = False

    category = BudgetCategory(
        code=data.code,
        name=data.name,
        parent_id=data.parent_id,
        level=level,
        description=data.description,
        sort_order=data.sort_order,
        category_type=data.category_type,
        control_type=data.control_type,
        is_leaf=is_leaf,
        tags=data.tags,
    )
    db.add(category)
    db.commit()
    db.refresh(category)

    create_audit_log(
        db, current_user, "CREATE", "budget_category", category.id,
        details={"code": data.code, "name": data.name, "category_type": data.category_type},
        ip_address=request.client.host if request.client else None,
    )
    return {"id": category.id, "code": category.code, "message": "科目创建成功"}


@router.put("/{category_id}")
def update_category(
    category_id: int,
    data: CategoryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "budget_manager")),
):
    category = db.query(BudgetCategory).filter(BudgetCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="科目不存在")

    if data.parent_id is not None:
        if data.parent_id == category_id:
            raise HTTPException(status_code=400, detail="不能将自身设为父级科目")
        parent = db.query(BudgetCategory).filter(BudgetCategory.id == data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="父级科目不存在")
        category.parent_id = data.parent_id
        category.level = parent.level + 1

    if data.name is not None:
        category.name = data.name
    if data.description is not None:
        category.description = data.description
    if data.sort_order is not None:
        category.sort_order = data.sort_order
    if data.is_active is not None:
        category.is_active = data.is_active
    if data.category_type is not None:
        category.category_type = data.category_type
    if data.control_type is not None:
        category.control_type = data.control_type
    if data.is_leaf is not None:
        category.is_leaf = data.is_leaf
    if data.tags is not None:
        category.tags = data.tags

    db.commit()
    create_audit_log(
        db, current_user, "UPDATE", "budget_category", category.id,
        details=data.model_dump(exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "科目更新成功"}


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    category = db.query(BudgetCategory).filter(BudgetCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="科目不存在")

    child_count = db.query(BudgetCategory).filter(
        BudgetCategory.parent_id == category_id
    ).count()
    if child_count > 0:
        raise HTTPException(status_code=400, detail="请先删除子级科目")

    parent_id = category.parent_id
    db.delete(category)
    db.commit()

    if parent_id:
        remaining_children = db.query(BudgetCategory).filter(
            BudgetCategory.parent_id == parent_id
        ).count()
        if remaining_children == 0:
            parent = db.query(BudgetCategory).filter(BudgetCategory.id == parent_id).first()
            if parent:
                parent.is_leaf = True
                db.commit()

    create_audit_log(
        db, current_user, "DELETE", "budget_category", category.id,
        details={"code": category.code, "name": category.name},
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "科目删除成功"}
