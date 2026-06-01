from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas import LoginRequest, TokenResponse
from app.utils import verify_password, create_access_token
from app.utils.audit import create_audit_log
from app.middleware.auth import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/api/auth", tags=["认证"])
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username, User.is_active == True).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_access_token(data={"user_id": user.id, "role": user.role})
    create_audit_log(
        db, user, "LOGIN", "auth",
        details={"username": user.username},
        ip_address=request.client.host if request.client else None,
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "real_name": current_user.real_name,
        "department": current_user.department,
        "role": current_user.role,
    }
