from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas import UserCreate, UserUpdate, UserResponse, AuditLogResponse
from app.utils import hash_password
from app.utils.audit import create_audit_log
from app.middleware.auth import get_current_user, require_role

router = APIRouter(prefix="/api/admin", tags=["系统管理"])


@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    users = db.query(User).order_by(User.id).all()
    return users


@router.post("/users")
def create_user(
    data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        real_name=data.real_name,
        department=data.department,
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    create_audit_log(
        db, current_user, "CREATE", "user", user.id,
        details={"username": data.username, "role": data.role},
        ip_address=request.client.host if request.client else None,
    )
    return {"id": user.id, "message": "用户创建成功"}


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    if user.id == current_user.id and data.is_active == False:
        raise HTTPException(status_code=400, detail="不能禁用自己的账户")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)

    db.commit()
    create_audit_log(
        db, current_user, "UPDATE", "user", user.id,
        details=data.model_dump(exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "用户更新成功"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己的账户")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    db.delete(user)
    db.commit()
    create_audit_log(
        db, current_user, "DELETE", "user", user_id,
        details={"username": user.username},
        ip_address=request.client.host if request.client else None,
    )
    return {"message": "用户删除成功"}


@router.get("/logs", response_model=List[AuditLogResponse])
def list_audit_logs(
    user_id: int = Query(None),
    action: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    query = db.query(AuditLog)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)

    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return logs
