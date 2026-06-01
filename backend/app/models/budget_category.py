from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class BudgetCategory(Base):
    __tablename__ = "budget_categories"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    parent_id = Column(Integer, ForeignKey("budget_categories.id"), nullable=True, index=True)
    level = Column(Integer, nullable=False, default=1)
    description = Column(String(500), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    category_type = Column(String(20), nullable=False, default="expense", index=True)
    control_type = Column(String(20), nullable=False, default="department")
    is_leaf = Column(Boolean, default=False)
    tags = Column(String(200), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    children = relationship("BudgetCategory", backref="parent", remote_side=[id], lazy="selectin")
