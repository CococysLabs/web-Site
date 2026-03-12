"""
Schemas de Usuario
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class UserRole(str, Enum):
    """Roles de usuario"""
    ADMIN = "admin"
    STUDENT = "student"


class UserBase(BaseModel):
    """Schema base de usuario"""
    correo: EmailStr


class UserCreate(UserBase):
    """Schema para crear usuario"""
    nombre: str = Field(..., min_length=2, max_length=100)
    apellidos: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100)

    @field_validator('confirm_password')
    @classmethod
    def passwords_match(cls, v, info):
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Las contraseñas no coinciden')
        return v

    @field_validator('password')
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('La contraseña debe tener al menos 8 caracteres')
        if not any(c.isupper() for c in v):
            raise ValueError('La contraseña debe contener al menos una mayúscula')
        if not any(c.islower() for c in v):
            raise ValueError('La contraseña debe contener al menos una minúscula')
        if not any(c.isdigit() for c in v):
            raise ValueError('La contraseña debe contener al menos un número')
        return v


class UserLogin(BaseModel):
    """Schema para login"""
    correo: EmailStr
    password: str


class UserResponse(UserBase):
    """Schema para respuesta de usuario"""
    id: uuid.UUID
    nombre: str
    apellidos: str
    role: UserRole
    is_active: bool
    is_approved: bool
    approved_at: Optional[datetime] = None
    created_at: datetime
    is_teacher: Optional[bool] = False
    drive_folder_id: Optional[str] = None
    drive_folder_name: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Schema para token JWT"""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema para datos del token"""
    user_id: Optional[str] = None
    correo: Optional[str] = None
