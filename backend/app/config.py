"""
Configuración de la aplicación
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Configuración de la aplicación desde variables de entorno"""
    
    # Base de datos
    DATABASE_URL: str
    
    # Seguridad JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Google Gemini API
    GEMINI_API_KEY: str
    GOOGLE_API_KEY: Optional[str] = None  # Alias para Gemini
    # Claves adicionales de Gemini (separadas por comas) para rotación cuando la principal se agota
    GEMINI_API_KEYS: Optional[str] = None
    # Groq como proveedor de LLM alternativo (gratis, OpenAI-compatible)
    GROQ_API_KEY: Optional[str] = None
    # OpenRouter como proveedor de LLM de respaldo (gratis con modelos :free)
    OPENROUTER_API_KEY: Optional[str] = None
    
    # Google Drive API
    GOOGLE_CREDENTIALS_FILE: Optional[str] = None
    GOOGLE_DRIVE_FOLDER_ID: Optional[str] = None
    
    # Servidor
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Configuración de archivos
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIR: str = "uploads"
    ALLOWED_EXTENSIONS: list = [".pdf", ".docx", ".pptx", ".xlsx"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
