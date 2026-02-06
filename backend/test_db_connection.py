#!/usr/bin/env python3
"""
Script para probar la conexión a la base de datos PostgreSQL
"""
import sys
import os

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.config import settings

def test_database_connection():
    """Probar conexión a la base de datos"""
    
    print("=" * 60)
    print("🔍 PRUEBA DE CONEXIÓN A BASE DE DATOS")
    print("=" * 60)
    print()
    
    # Mostrar configuración (sin credenciales)
    db_url = settings.DATABASE_URL
    if "@" in db_url:
        # Ocultar credenciales
        parts = db_url.split("@")
        protocol = parts[0].split("://")[0]
        host = parts[1] if len(parts) > 1 else "unknown"
        print(f"📍 Host: {host}")
        print(f"🔌 Protocol: {protocol}")
    else:
        print(f"⚠️  URL no tiene formato esperado")
    
    print()
    print("-" * 60)
    print("1️⃣  Probando conexión al servidor PostgreSQL...")
    print("-" * 60)
    
    try:
        # Crear engine con la URL corregida para psycopg3
        engine_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://")
        engine = create_engine(engine_url, pool_pre_ping=True)
        
        # Probar conexión
        with engine.connect() as connection:
            print("✅ Conexión establecida exitosamente!")
            print()
            
            # Obtener versión de PostgreSQL
            print("-" * 60)
            print("2️⃣  Consultando información del servidor...")
            print("-" * 60)
            
            result = connection.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print(f"📦 PostgreSQL Version:\n   {version[:80]}...")
            print()
            
            # Obtener fecha/hora del servidor
            result = connection.execute(text("SELECT NOW()"))
            server_time = result.fetchone()[0]
            print(f"🕐 Server Time: {server_time}")
            print()
            
            # Listar bases de datos
            print("-" * 60)
            print("3️⃣  Verificando base de datos actual...")
            print("-" * 60)
            
            result = connection.execute(text("SELECT current_database()"))
            current_db = result.fetchone()[0]
            print(f"💾 Database: {current_db}")
            print()
            
            # Listar tablas existentes
            print("-" * 60)
            print("4️⃣  Listando tablas existentes...")
            print("-" * 60)
            
            result = connection.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name
            """))
            
            tables = result.fetchall()
            if tables:
                print(f"📊 Tablas encontradas ({len(tables)}):")
                for table in tables:
                    print(f"   ✓ {table[0]}")
            else:
                print("⚠️  No se encontraron tablas en el esquema 'public'")
                print("   Esto es normal si es la primera vez que ejecutas la app.")
            
            print()
            
            # Verificar tabla users
            print("-" * 60)
            print("5️⃣  Verificando tabla 'users'...")
            print("-" * 60)
            
            result = connection.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                )
            """))
            
            users_exists = result.fetchone()[0]
            
            if users_exists:
                print("✅ Tabla 'users' existe")
                
                # Contar usuarios
                result = connection.execute(text("SELECT COUNT(*) FROM users"))
                user_count = result.fetchone()[0]
                print(f"👥 Usuarios registrados: {user_count}")
                
                if user_count > 0:
                    # Mostrar últimos usuarios (sin contraseñas)
                    result = connection.execute(text("""
                        SELECT nombre, apellidos, correo, created_at, is_active
                        FROM users 
                        ORDER BY created_at DESC 
                        LIMIT 3
                    """))
                    
                    print("\n📋 Últimos usuarios registrados:")
                    for user in result.fetchall():
                        status = "✓ Activo" if user[4] else "✗ Inactivo"
                        print(f"   • {user[0]} {user[1]} ({user[2]}) - {status}")
                        print(f"     Registrado: {user[3]}")
            else:
                print("⚠️  Tabla 'users' NO existe")
                print("   Ejecuta el backend para crear las tablas automáticamente:")
                print("   $ cd backend && python -m app.main")
            
            print()
            print("=" * 60)
            print("✅ PRUEBA COMPLETADA EXITOSAMENTE")
            print("=" * 60)
            return True
            
    except Exception as e:
        print()
        print("=" * 60)
        print("❌ ERROR EN LA CONEXIÓN")
        print("=" * 60)
        print(f"\n{type(e).__name__}: {str(e)}\n")
        
        print("🔧 Soluciones posibles:")
        print("   1. Verifica que DATABASE_URL en backend/.env sea correcta")
        print("   2. Asegúrate de que Neon database esté activo")
        print("   3. Verifica la conexión a internet")
        print("   4. Revisa que las credenciales no hayan expirado")
        print()
        return False

if __name__ == "__main__":
    success = test_database_connection()
    sys.exit(0 if success else 1)
