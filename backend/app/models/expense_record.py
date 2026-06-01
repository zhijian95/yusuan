from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class ExpenseRecord(Base):
    __tablename__ = "expense_records"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("budget_categories.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, nullable=False, index=True)
    description = Column(String(500), nullable=True)
    vendor = Column(String(200), nullable=True)
    document_no = Column(String(100), nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    category = relationship("BudgetCategory", lazy="selectin")
    recorder = relationship("User", lazy="selectin")
