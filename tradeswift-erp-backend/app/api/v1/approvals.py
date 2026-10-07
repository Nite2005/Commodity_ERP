from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.enums import ApprovalStatus, EntityType
from app.schemas.approval import ApprovalActionPayload, ApprovalRequestResponse
from app.services.approval_service import ApprovalService

router = APIRouter(prefix="/approvals", tags=["Approvals"])


@router.get("", response_model=list[ApprovalRequestResponse])
def list_approval_requests(
    status: ApprovalStatus | None = None,
    entity_id: str | None = None,
    entity_type: EntityType | None = None,
    db: Session = Depends(get_db),
):
    return ApprovalService.list_requests(
        db, status=status, entity_id=entity_id, entity_type=entity_type
    )


@router.get("/entity/{entity_id}/history", response_model=list[ApprovalRequestResponse])
def get_entity_change_history(
    entity_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve full audit/change history for a given entity (all statuses)."""
    return ApprovalService.list_requests(db, entity_id=entity_id)


@router.get("/pending-count")
def get_pending_count(db: Session = Depends(get_db)):
    count = ApprovalService.get_pending_count(db)
    return {"pending_count": count}


@router.post("/{item_id}/approve", response_model=ApprovalRequestResponse)
def approve_request(
    item_id: str,
    payload: ApprovalActionPayload,
    db: Session = Depends(get_db),
):
    reviewer = payload.reviewer_name or "Kannu"
    return ApprovalService.approve_request(db, item_id, reviewer_name=reviewer)


@router.post("/{item_id}/reject", response_model=ApprovalRequestResponse)
def reject_request(
    item_id: str,
    payload: ApprovalActionPayload,
    db: Session = Depends(get_db),
):
    reviewer = payload.reviewer_name or "Kannu"
    return ApprovalService.reject_request(
        db, item_id, reviewer_name=reviewer, reason=payload.rejection_reason
    )
