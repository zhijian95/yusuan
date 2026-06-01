from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.models.user import User
import json


def create_audit_log(
    db: Session,
    user: User,
    action: str,
    resource: str,
    resource_id: str = None,
    details: dict = None,
    ip_address: str = None,
):
    log = AuditLog(
        user_id=user.id,
        username=user.username,
        action=action,
        resource=resource,
        resource_id=str(resource_id) if resource_id else None,
        details=json.dumps(details, ensure_ascii=False) if details else None,
        ip_address=ip_address,
    )
    db.add(log)
    db.commit()
