#!/usr/bin/env python3
"""
Script para crear usuario administrador inicial
"""
import sys
import os

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.database import SessionLocal, init_db
from app.models.user import User, UserRole
from app.utils.auth import get_password_hash

def create_admin_user():
    """Crear usuario administrador si no existe"""
    
    print("=" * 60)
    print("🔧 INICIALIZACIÓN DE USUARIO ADMINISTRADOR")
    print("=" * 60)
    print()
    
    # Inicializar base de datos (crear tablas si no existen)
    print("📊 Inicializando base de datos...")
    init_db()
    print("✅ Base de datos inicializada")
    print()
    
    # Crear sesión
    db: Session = SessionLocal()
    
    try:
        # Verificar si ya existe un admin
        existing_admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        
        if existing_admin:
            print("⚠️  Ya existe un usuario administrador:")
            print(f"   📧 Email: {existing_admin.correo}")
            print(f"   👤 Nombre: {existing_admin.nombre} {existing_admin.apellidos}")
            print(f"   📅 Creado: {existing_admin.created_at}")
            print()
            
            response = input("¿Deseas crear otro administrador? (s/N): ").lower()
            if response != 's':
                print("\n✅ Operación cancelada")
                return
            print()
        
        # Solicitar datos del administrador
        print("📝 Ingresa los datos del nuevo administrador:")
        print()
        
        nombre = input("Nombre: ").strip()
        while not nombre or len(nombre) < 2:
            print("❌ El nombre debe tener al menos 2 caracteres")
            nombre = input("Nombre: ").strip()
        
        apellidos = input("Apellidos: ").strip()
        while not apellidos or len(apellidos) < 2:
            print("❌ Los apellidos deben tener al menos 2 caracteres")
            apellidos = input("Apellidos: ").strip()
        
        correo = input("Correo electrónico: ").strip().lower()
        while not correo or '@' not in correo:
            print("❌ Ingresa un correo válido")
            correo = input("Correo electrónico: ").strip().lower()
        
        # Verificar que el correo no exista
        existing_user = db.query(User).filter(User.correo == correo).first()
        if existing_user:
            print(f"\n❌ Error: Ya existe un usuario con el correo {correo}")
            return
        
        password = input("Contraseña (mín. 8 caracteres): ").strip()
        while len(password) < 8:
            print("❌ La contraseña debe tener al menos 8 caracteres")
            password = input("Contraseña (mín. 8 caracteres): ").strip()
        
        confirm_password = input("Confirmar contraseña: ").strip()
        while password != confirm_password:
            print("❌ Las contraseñas no coinciden")
            confirm_password = input("Confirmar contraseña: ").strip()
        
        print()
        print("-" * 60)
        print("🔐 Creando usuario administrador...")
        print("-" * 60)
        
        # Crear usuario administrador
        admin_user = User(
            nombre=nombre,
            apellidos=apellidos,
            correo=correo,
            password_hash=get_password_hash(password),
            role=UserRole.ADMIN,
            is_active=True,
            is_approved=True  # Los admins están auto-aprobados
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print()
        print("=" * 60)
        print("✅ ADMINISTRADOR CREADO EXITOSAMENTE")
        print("=" * 60)
        print()
        print(f"👤 Nombre: {admin_user.nombre} {admin_user.apellidos}")
        print(f"📧 Correo: {admin_user.correo}")
        print(f"🔑 Rol: {admin_user.role.value}")
        print(f"✓  Estado: Activo y Aprobado")
        print(f"🆔 ID: {admin_user.id}")
        print()
        print("🔒 Credenciales de acceso:")
        print(f"   Usuario: {admin_user.correo}")
        print(f"   Contraseña: [la que ingresaste]")
        print()
        print("📝 Próximos pasos:")
        print("   1. Inicia sesión en http://localhost:8000/docs")
        print("   2. Usa estas credenciales para acceder")
        print("   3. Podrás aprobar estudiantes desde el dashboard")
        print()
        
    except Exception as e:
        print()
        print("=" * 60)
        print("❌ ERROR AL CREAR ADMINISTRADOR")
        print("=" * 60)
        print(f"\n{type(e).__name__}: {str(e)}\n")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin_user()
