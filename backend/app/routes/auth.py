"""
Rutas de autenticación
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
from typing import Optional
import uuid

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token
from app.utils.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_active_user
)
from app.config import settings

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Registrar nuevo usuario
    """
    # Verificar si el correo ya existe
    existing_user = db.query(User).filter(User.correo == user_data.correo).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo ya está registrado"
        )
    
    # Verificar si auto-aprobación está activa
    from app.services.settings_service import settings_service
    auto_approve = settings_service.get_bool("auto_approve_users", db)

    # Crear usuario
    new_user = User(
        nombre=user_data.nombre,
        apellidos=user_data.apellidos,
        correo=user_data.correo,
        password_hash=get_password_hash(user_data.password),
        is_approved=auto_approve,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    Iniciar sesión y obtener token JWT
    """
    # Buscar usuario
    user = db.query(User).filter(User.correo == user_data.correo).first()
    
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inactivo"
        )
    
    # Verificar aprobación solo para estudiantes
    if user.role.value == "student" and not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está pendiente de aprobación por un administrador. Por favor, espera a que tu cuenta sea activada."
        )
    
    # Crear token — duración desde BD o env
    from app.services.settings_service import settings_service
    session_minutes = settings_service.get_int("jwt_session_minutes", db,
                                               default=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token_expires = timedelta(minutes=session_minutes)
    access_token = create_access_token(
        data={"sub": str(user.id), "correo": user.correo, "role": user.role.value},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login/form", response_model=Token)
async def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login compatible con OAuth2PasswordRequestForm (para Swagger UI)
    """
    user = db.query(User).filter(User.correo == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inactivo"
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "correo": user.correo},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    """
    Obtener información del usuario actual
    """
    return current_user


@router.get("/pending-users", response_model=list[UserResponse])
async def get_pending_users(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtener lista de usuarios pendientes de aprobación (solo admin)
    """
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para realizar esta acción"
        )
    
    pending_users = db.query(User).filter(
        User.is_approved == False,
        User.role == "student"
    ).order_by(User.created_at.desc()).all()
    
    return pending_users


@router.post("/approve-user/{user_id}")
async def approve_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Aprobar un usuario (solo admin)
    """
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para realizar esta acción"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    if user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este usuario ya está aprobado"
        )
    
    user.is_approved = True
    user.approved_by = current_user.id
    user.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    return {
        "message": "Usuario aprobado exitosamente",
        "user": {
            "id": str(user.id),
            "nombre": user.nombre,
            "apellidos": user.apellidos,
            "correo": user.correo
        }
    }


@router.get("/users")
async def get_all_users(
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Obtener todos los usuarios con filtros opcionales (solo admin)
    """
    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para realizar esta acción")

    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        term = f"%{search}%"
        query = query.filter(
            User.nombre.ilike(term) | User.apellidos.ilike(term) | User.correo.ilike(term)
        )

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "users": [
            {
                "id": str(u.id),
                "nombre": u.nombre,
                "apellidos": u.apellidos,
                "correo": u.correo,
                "role": u.role.value,
                "is_active": u.is_active,
                "is_approved": u.is_approved,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Activar/desactivar un usuario (solo admin)
    """
    if current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para realizar esta acción")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes desactivarte a ti mismo")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return {"message": f"Usuario {'activado' if user.is_active else 'desactivado'} exitosamente", "is_active": user.is_active}


@router.delete("/reject-user/{user_id}")
async def reject_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Rechazar/eliminar un usuario (solo admin)
    """
    if current_user.role.value != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para realizar esta acción"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    if user.role.value == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar un administrador"
        )
    
    db.delete(user)
    db.commit()
    
    return {"message": "Usuario rechazado y eliminado exitosamente"}
