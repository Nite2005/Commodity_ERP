from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.models.enums import UserRole
from app.schemas.user import LoginRequest, LoginResponse, UserCreate, UserResponse, UserUpdate
from app.utils.ids import db_get, uuid_variants

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user by email and password."""
    clean_email = payload.email.strip().lower()
    user = (
        db.query(User)
        .filter((func.lower(User.email) == clean_email) | (func.lower(User.username) == clean_email))
        .first()
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.is_active:
        raise HTTPException(
            status_code=403, detail="This account has been deactivated. Contact an administrator."
        )

    expected_pwd = user.password or ("admin123" if user.role == UserRole.ADMIN else "employee123")
    if payload.password.strip() != expected_pwd.strip():
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return LoginResponse(
        user=user,
        token=f"session_{user.id}",
        message=f"Welcome back, {user.full_name}!",
    )


@router.get("", response_model=list[UserResponse])
def list_users(
    role: UserRole | None = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if active_only:
        q = q.filter(User.is_active.is_(True))
    if role:
        q = q.filter(User.role == role)
    return q.order_by(User.full_name.asc()).all()


@router.get("/supervisors", response_model=list[UserResponse])
def list_supervisors(db: Session = Depends(get_db)):
    """List all active administrators who have approval authorization rights."""
    return (
        db.query(User)
        .filter(User.role == UserRole.ADMIN, User.is_active.is_(True))
        .order_by(User.full_name.asc())
        .all()
    )


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    variants = uuid_variants(user_id)
    row = (
        db.query(User)
        .filter((User.id.in_(variants)) | (User.username == user_id) | (User.email == user_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row


@router.post("", response_model=UserResponse, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    clean_email = payload.email.strip().lower()
    existing_email = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if existing_email:
        raise HTTPException(
            status_code=400, detail=f"Email '{clean_email}' is already registered."
        )

    clean_username = (
        payload.username.strip().lower()
        if payload.username and payload.username.strip()
        else clean_email.split("@")[0]
    )
    existing_username = db.query(User).filter(User.username == clean_username).first()
    if existing_username:
        clean_username = f"{clean_username}_{db.query(User).count() + 1}"

    user = User(
        username=clean_username,
        full_name=payload.full_name.strip(),
        email=clean_email,
        password=payload.password.strip(),
        role=payload.role,
        designation=payload.designation.strip() if payload.designation else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: str, payload: UserUpdate, db: Session = Depends(get_db)):
    variants = uuid_variants(user_id)
    row = (
        db.query(User)
        .filter((User.id.in_(variants)) | (User.username == user_id) | (User.email == user_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        if field == "email" and val:
            val = val.strip().lower()
        elif field == "full_name" and val:
            val = val.strip()
        elif field == "designation" and val:
            val = val.strip()
        elif field == "password" and val:
            val = val.strip()
        setattr(row, field, val)

    db.commit()
    db.refresh(row)
    return row


@router.delete("/{user_id}", status_code=204)
def deactivate_user(user_id: str, db: Session = Depends(get_db)):
    variants = uuid_variants(user_id)
    row = (
        db.query(User)
        .filter((User.id.in_(variants)) | (User.username == user_id) | (User.email == user_id))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    row.is_active = False
    db.commit()

