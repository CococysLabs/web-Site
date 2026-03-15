#!/usr/bin/env python3
"""
Script de prueba para verificar la configuración de Google Drive
"""
import os
import sys

# Agregar el directorio app al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app.services.drive_service import GoogleDriveService
from app.config import settings

def main():
    print("=" * 60)
    print("🔍 VERIFICACIÓN DE CONFIGURACIÓN DE GOOGLE DRIVE")
    print("=" * 60)
    print()
    
    # Verificar configuración
    print("📋 Configuración actual:")
    print(f"   GOOGLE_CREDENTIALS_FILE: {settings.GOOGLE_CREDENTIALS_FILE}")
    print(f"   GOOGLE_DRIVE_FOLDER_ID: {settings.GOOGLE_DRIVE_FOLDER_ID or '(no configurado)'}")
    print()
    
    # Verificar archivo de credenciales
    credentials_file = settings.GOOGLE_CREDENTIALS_FILE
    if credentials_file:
        if os.path.exists(credentials_file):
            print(f"✅ Archivo de credenciales encontrado: {credentials_file}")
            
            # Verificar contenido del archivo
            try:
                import json
                with open(credentials_file, 'r') as f:
                    creds = json.load(f)
                    print(f"   Project ID: {creds.get('project_id', 'N/A')}")
                    print(f"   Client Email: {creds.get('client_email', 'N/A')}")
                    print()
                    print("📧 IMPORTANTE: Comparte tu carpeta de Drive con este email:")
                    print(f"   {creds.get('client_email', 'N/A')}")
                    print()
            except Exception as e:
                print(f"⚠️  Error leyendo credenciales: {e}")
                print()
        else:
            print(f"❌ Archivo de credenciales NO encontrado: {credentials_file}")
            print()
            print("📝 Para configurar Google Drive:")
            print("   1. Lee las instrucciones en GOOGLE_DRIVE_SETUP.md")
            print("   2. Crea un proyecto en Google Cloud Console")
            print("   3. Habilita la API de Google Drive")
            print("   4. Crea una cuenta de servicio y descarga credentials.json")
            print("   5. Coloca el archivo en la carpeta backend/")
            print()
            return False
    else:
        print("⚠️  GOOGLE_CREDENTIALS_FILE no está configurado en .env")
        print()
        print("📝 Agrega esta línea a tu archivo .env:")
        print("   GOOGLE_CREDENTIALS_FILE=credentials.json")
        print()
        return False
    
    # Intentar inicializar el servicio
    print("🔌 Intentando conectar con Google Drive...")
    try:
        drive_service = GoogleDriveService()
        
        if drive_service.service:
            print("✅ ¡Conexión exitosa con Google Drive!")
            print()
            
            # Intentar listar carpetas
            print("📁 Intentando listar carpetas...")
            folders = drive_service.list_folders(settings.GOOGLE_DRIVE_FOLDER_ID)
            
            if folders:
                print(f"✅ Se encontraron {len(folders)} carpetas:")
                for folder in folders[:5]:  # Mostrar solo las primeras 5
                    print(f"   - {folder.get('name', 'Sin nombre')} (ID: {folder.get('id', 'N/A')})")
                if len(folders) > 5:
                    print(f"   ... y {len(folders) - 5} más")
            else:
                print("⚠️  No se encontraron carpetas.")
                print()
                print("💡 Posibles razones:")
                print("   1. No has compartido ninguna carpeta con la cuenta de servicio")
                print("   2. GOOGLE_DRIVE_FOLDER_ID está mal configurado")
                print()
                print("📧 Recuerda compartir tu carpeta de Drive con:")
                import json
                with open(credentials_file, 'r') as f:
                    creds = json.load(f)
                    print(f"   {creds.get('client_email', 'N/A')}")
            
            print()
            print("=" * 60)
            print("✅ CONFIGURACIÓN COMPLETA Y FUNCIONAL")
            print("=" * 60)
            return True
            
        else:
            print("❌ No se pudo inicializar el servicio de Drive")
            print("   Revisa los logs anteriores para más detalles")
            print()
            return False
            
    except Exception as e:
        print(f"❌ Error al conectar con Drive: {e}")
        import traceback
        traceback.print_exc()
        print()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
