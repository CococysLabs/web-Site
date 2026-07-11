#!/usr/bin/env python3
"""
Script de prueba para OAuth 2.0 con Google Drive
"""
import os
import sys
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Alcances necesarios
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def main():
    print("=" * 60)
    print("🔐 AUTENTICACIÓN OAUTH 2.0 CON GOOGLE DRIVE")
    print("=" * 60)
    print()
    
    creds = None
    token_file = 'token.json'
    client_secret_file = 'client_secret.json'
    
    # Verificar si existe el archivo de credenciales
    if not os.path.exists(client_secret_file):
        print(f"❌ No se encontró el archivo: {client_secret_file}")
        print()
        print("📝 Pasos para obtener client_secret.json:")
        print("   1. Ve a Google Cloud Console")
        print("   2. Crea credenciales OAuth 2.0 (ID de cliente de OAuth)")
        print("   3. Tipo: Aplicación de escritorio")
        print("   4. Descarga el JSON y renómbralo a 'client_secret.json'")
        print("   5. Colócalo en la carpeta backend/")
        print()
        print("📖 Lee GOOGLE_DRIVE_OAUTH_SETUP.md para instrucciones detalladas")
        print()
        return False
    
    # Verificar si ya existe un token guardado
    if os.path.exists(token_file):
        print("🔑 Token de sesión encontrado, cargando...")
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)
    
    # Si no hay credenciales válidas, obtenerlas
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("🔄 Token expirado, renovando...")
            creds.refresh(Request())
        else:
            print("🌐 Abriendo navegador para autorización...")
            print()
            print("👉 Por favor, autoriza la aplicación en tu navegador")
            print()
            flow = InstalledAppFlow.from_client_secrets_file(
                client_secret_file, SCOPES)
            creds = flow.run_local_server(port=0)
            print()
            print("✅ Autorización completada!")
        
        # Guardar las credenciales para la próxima vez
        with open(token_file, 'w') as token:
            token.write(creds.to_json())
        print(f"💾 Token guardado en: {token_file}")
        print()
    
    try:
        # Crear servicio de Drive
        print("🔌 Conectando con Google Drive...")
        service = build('drive', 'v3', credentials=creds)
        
        # Listar archivos de prueba
        print("✅ ¡Conexión exitosa!")
        print()
        print("📁 Listando tus carpetas de Drive...")
        print()
        
        results = service.files().list(
            q="mimeType='application/vnd.google-apps.folder'",
            pageSize=10,
            fields="files(id, name, modifiedTime)"
        ).execute()
        
        items = results.get('files', [])
        
        if not items:
            print("⚠️  No se encontraron carpetas")
        else:
            print(f"📂 Se encontraron {len(items)} carpetas:")
            print()
            for item in items:
                print(f"   📁 {item['name']}")
                print(f"      ID: {item['id']}")
                print(f"      Modificado: {item.get('modifiedTime', 'N/A')}")
                print()
            
            print("💡 Para usar una carpeta específica:")
            print("   1. Copia el ID de la carpeta que desees")
            print("   2. Agrégalo en .env:")
            print("      GOOGLE_DRIVE_FOLDER_ID=el-id-copiado")
        
        print()
        print("=" * 60)
        print("✅ CONFIGURACIÓN OAUTH COMPLETA Y FUNCIONAL")
        print("=" * 60)
        print()
        print("🎉 ¡Ya puedes usar Google Drive en tu aplicación!")
        print()
        return True
        
    except Exception as e:
        print(f"❌ Error al conectar con Drive: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
