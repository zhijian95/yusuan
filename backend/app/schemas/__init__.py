from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6)
    real_name: Optional[str] = None
    department: Optional[str] = None
    role: str = "viewer"


class UserUpdate(BaseModel):
    real_name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    username: str
    real_name: Optional[str]
    department: Optional[str]
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


CATEGORY_CODE_PATTERN = r"^\d{4}(\.\d{2}){0,5}$"
CATEGORY_MAX_LEVEL = 6


class CategoryCreate(BaseModel):
    code: str = Field(
        min_length=4,
        max_length=35,
        description="分段编码，格式: XXXX 或 XXXX.XX 或 XXXX.XX.XX ... 最多6级",
        examples=["6001", "6001.01", "6001.01.01", "6001.01.01.01"],
    )
    name: str = Field(min_length=1, max_length=100)
    parent_id: Optional[int] = None
    description: Optional[str] = None
    sort_order: int = 0
    category_type: str = Field(default="expense", pattern=r"^(revenue|expense|transfer)$")
    control_type: str = Field(default="department", pattern=r"^(department|company)$")
    tags: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    category_type: Optional[str] = Field(default=None, pattern=r"^(revenue|expense|transfer)$")
    control_type: Optional[str] = Field(default=None, pattern=r"^(department|company)$")
    is_leaf: Optional[bool] = None
    tags: Optional[str] = None


class CategoryResponse(BaseModel):
    id: int
    code: str
    name: str
    parent_id: Optional[int]
    level: int
    description: Optional[str]
    sort_order: int
    is_active: bool
    category_type: str
    control_type: str
    is_leaf: bool
    tags: Optional[str]
    children: List["CategoryResponse"] = []

    class Config:
        from_attributes = True


class CategoryTreeResponse(BaseModel):
    id: int
    code: str
    name: str
    parent_id: Optional[int]
    level: int
    description: Optional[str]
    sort_order: int
    is_active: bool
    category_type: str
    control_type: str
    is_leaf: bool
    tags: Optional[str]
    children: List["CategoryTreeResponse"] = []

    class Config:
        from_attributes = True


class BudgetItemCreate(BaseModel):
    category_id: int
    year: int
    month: Optional[int] = None
    budget_amount: float = Field(ge=0)
    notes: Optional[str] = None


class BudgetItemUpdate(BaseModel):
    budget_amount: Optional[float] = Field(default=None, ge=0)
    notes: Optional[str] = None


class BudgetItemResponse(BaseModel):
    id: int
    category_id: int
    category_name: Optional[str] = None
    category_code: Optional[str] = None
    year: int
    month: Optional[int]
    budget_amount: float
    notes: Optional[str]
    created_by: int
    creator_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BudgetSummaryItem(BaseModel):
    category_id: int
    category_code: str
    category_name: str
    budget_amount: float
    actual_amount: float
    variance: float
    execution_rate: float


class BudgetSummaryResponse(BaseModel):
    year: int
    month: Optional[int]
    items: List[BudgetSummaryItem]
    total_budget: float
    total_actual: float
    total_variance: float


class ExpenseCreate(BaseModel):
    category_id: int
    amount: float = Field(gt=0)
    expense_date: date
    description: Optional[str] = None
    vendor: Optional[str] = None
    document_no: Optional[str] = None


class ExpenseUpdate(BaseModel):
    category_id: Optional[int] = None
    amount: Optional[float] = Field(default=None, gt=0)
    expense_date: Optional[date] = None
    description: Optional[str] = None
    vendor: Optional[str] = None
    document_no: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: int
    category_id: int
    category_name: Optional[str] = None
    category_code: Optional[str] = None
    amount: float
    expense_date: date
    description: Optional[str]
    vendor: Optional[str]
    document_no: Optional[str]
    recorded_by: int
    recorder_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str]
    action: str
    resource: str
    resource_id: Optional[str]
    details: Optional[str]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ReportQuery(BaseModel):
    year: int
    month: Optional[int] = None
    category_id: Optional[int] = None
    parent_category_id: Optional[int] = None


class DashboardStats(BaseModel):
    total_categories: int
    total_budget_amount: float
    total_expense_amount: float
    overall_execution_rate: float
    monthly_trend: List[dict]
    top_expense_categories: List[dict]
