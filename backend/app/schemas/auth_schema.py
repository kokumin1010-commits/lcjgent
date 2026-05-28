from pydantic import BaseModel, EmailStr, constr
from typing import Optional


class RegisterRequest(BaseModel):
    email: EmailStr
    password: constr(min_length=8)
    source: Optional[str] = None  # e.g., "liveboost", "web"

    class Config:
        orm_mode = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: constr(min_length=8)
    confirm_password: constr(min_length=8)
