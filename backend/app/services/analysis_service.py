"""
Servicio de análisis de documentos con Gemini
"""
from typing import Dict, List, Optional
import google.generativeai as genai
from PyPDF2 import PdfReader
import io

from app.config import settings


class DocumentAnalysisService:
    """Servicio para analizar documentos con Gemini"""
    
    def __init__(self):
        """Inicializar servicio de Gemini"""
        if hasattr(settings, 'GOOGLE_API_KEY') and settings.GOOGLE_API_KEY:
            genai.configure(api_key=settings.GOOGLE_API_KEY)
            self.model = genai.GenerativeModel('gemini-pro')
        else:
            print("⚠️  Gemini API key not configured")
            self.model = None
    
    def extract_text_from_pdf(self, pdf_content: bytes) -> str:
        """Extraer texto de un PDF"""
        try:
            pdf_file = io.BytesIO(pdf_content)
            reader = PdfReader(pdf_file)
            
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            
            return text.strip()
        except Exception as e:
            print(f"Error extracting text from PDF: {e}")
            return ""
    
    def analyze_document_structure(self, pdf_content: bytes, required_sections: List[str]) -> Dict:
        """
        Analizar la estructura de un documento PDF
        
        Args:
            pdf_content: Contenido binario del PDF
            required_sections: Lista de secciones requeridas (ej: ["Bienvenida", "Agenda", "Competencias"])
        
        Returns:
            Dict con el análisis: {
                "found_sections": [...],
                "missing_sections": [...],
                "is_valid": bool,
                "summary": "...",
                "confidence": 0.0-1.0
            }
        """
        if not self.model:
            return {
                "found_sections": [],
                "missing_sections": required_sections,
                "is_valid": False,
                "summary": "Gemini API not configured",
                "confidence": 0.0
            }
        
        try:
            # Extraer texto del PDF
            text = self.extract_text_from_pdf(pdf_content)
            
            if not text:
                return {
                    "found_sections": [],
                    "missing_sections": required_sections,
                    "is_valid": False,
                    "summary": "No se pudo extraer texto del PDF",
                    "confidence": 0.0
                }
            
            # Crear prompt para Gemini
            prompt = f"""
Analiza el siguiente documento educativo y determina si contiene las siguientes secciones requeridas:

SECCIONES REQUERIDAS:
{', '.join(required_sections)}

TEXTO DEL DOCUMENTO:
{text[:5000]}  # Limitar a primeros 5000 caracteres

INSTRUCCIONES:
1. Identifica qué secciones requeridas están presentes en el documento
2. Lista las secciones que faltan
3. Proporciona un resumen breve del contenido
4. Indica tu nivel de confianza en el análisis (0.0 a 1.0)

RESPONDE EN FORMATO JSON:
{{
    "found_sections": ["lista", "de", "secciones", "encontradas"],
    "missing_sections": ["lista", "de", "secciones", "faltantes"],
    "is_valid": true/false,
    "summary": "Resumen breve del documento",
    "confidence": 0.95
}}
"""
            
            # Llamar a Gemini
            response = self.model.generate_content(prompt)
            
            # Parsear respuesta
            # Intentar extraer JSON de la respuesta
            response_text = response.text.strip()
            
            # Buscar JSON en la respuesta
            import json
            import re
            
            # Intentar encontrar JSON en la respuesta
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result
            else:
                # Fallback: análisis manual básico
                return self._basic_analysis(text, required_sections)
                
        except Exception as e:
            print(f"Error analyzing document: {e}")
            return self._basic_analysis(text if 'text' in locals() else "", required_sections)
    
    def _basic_analysis(self, text: str, required_sections: List[str]) -> Dict:
        """Análisis básico sin IA (fallback)"""
        text_lower = text.lower()
        found_sections = []
        
        for section in required_sections:
            # Buscar la sección en el texto (case insensitive)
            if section.lower() in text_lower:
                found_sections.append(section)
        
        missing_sections = [s for s in required_sections if s not in found_sections]
        
        return {
            "found_sections": found_sections,
            "missing_sections": missing_sections,
            "is_valid": len(missing_sections) == 0,
            "summary": f"Análisis básico: {len(found_sections)}/{len(required_sections)} secciones encontradas",
            "confidence": 0.5
        }
    
    def analyze_content_quality(self, pdf_content: bytes) -> Dict:
        """
        Analizar la calidad del contenido de un documento
        
        Returns:
            Dict con métricas de calidad
        """
        if not self.model:
            return {"error": "Gemini API not configured"}
        
        try:
            text = self.extract_text_from_pdf(pdf_content)
            
            prompt = f"""
Analiza la calidad pedagógica del siguiente documento educativo y proporciona:

1. Claridad del contenido (0-10)
2. Estructura y organización (0-10)
3. Completitud del material (0-10)
4. Observaciones y recomendaciones

TEXTO:
{text[:5000]}

RESPONDE EN FORMATO JSON:
{{
    "clarity_score": 8,
    "structure_score": 9,
    "completeness_score": 7,
    "overall_score": 8.0,
    "observations": "El documento...",
    "recommendations": ["Agregar más ejemplos", "Mejorar introducción"]
}}
"""
            
            response = self.model.generate_content(prompt)
            
            # Parsear respuesta JSON
            import json
            import re
            json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            
            return {"error": "No se pudo analizar el contenido"}
            
        except Exception as e:
            print(f"Error analyzing content quality: {e}")
            return {"error": str(e)}


# Instancia singleton del servicio
analysis_service = DocumentAnalysisService()
