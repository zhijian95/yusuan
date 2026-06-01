from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.config import get_settings
from app.api import auth, categories, budget, expenses, reports, admin
from app.models.user import User
from app.utils import hash_password

settings = get_settings()

Base.metadata.create_all(bind=engine)


def init_super_admin():
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == settings.SUPER_ADMIN_USERNAME).first()
        if not admin_user:
            admin_user = User(
                username=settings.SUPER_ADMIN_USERNAME,
                password_hash=hash_password(settings.SUPER_ADMIN_PASSWORD),
                real_name="系统管理员（纯绿用户）",
                department="开挂部门",
                role="admin",
            )
            db.add(admin_user)
            db.commit()
            print(f"超级管理员已创建: {settings.SUPER_ADMIN_USERNAME}")
    finally:
        db.close()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(budget.router)
app.include_router(expenses.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.on_event("startup")
def on_startup():
    init_super_admin()


@app.get("/api/health")
def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}
