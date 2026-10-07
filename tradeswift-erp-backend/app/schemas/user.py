from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.enums import UserRole


class UserBase(BaseModel):
    full_name: str
    email: str
    username: str | None = None
    role: UserRole = UserRole.EMPLOYEE
    designation: str | None = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    password: str | None = None
    role: UserRole | None = None
    designation: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: str
    username: str
    full_name: str
    email: str | None = None
    role: UserRole
    designation: str | None = None
    is_active: bool
    created_at: datetime | None = None
    modified_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    user: UserResponse
    token: str
    message: str = "Login successful"
