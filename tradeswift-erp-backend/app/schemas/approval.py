from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import ApprovalStatus, EntityType


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class FieldDiff(BaseModel):
    field_name: str
    field_label: str
    old_value: str | None = None
    new_value: str | None = None


class ApprovalRequestResponse(ORMModel):
    id: UUID
    entity_type: EntityType
    entity_id: UUID
    entity_name: str
    change_summary: str
    changes_json: str
    status: ApprovalStatus
    requested_by: str
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    rejection_reason: str | None = None
    created_at: datetime


class ApprovalActionPayload(BaseModel):
    reviewer_name: str = "Kannu"  # Supervisor: Kannu or Kanha
    rejection_reason: str | None = None
