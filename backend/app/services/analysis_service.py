"""
Servicio de análisis completo de documentos con Gemini
"""
from typing import Dict, List, Optional, Any
import google.generativeai as genai
from PyPDF2 import PdfReader
import io
import json
import re
from datetime import datetime

from app.config import settings


class DocumentAnalysisService:
    """Servicio para analizar documentos con Gemini"""
    
    def __init__(self):
        """Inicializar servicio de Gemini"""
        if hasattr(settings, 'GEMINI_API_KEY') and settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "kjkj":
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-pro')
            self.enabled = True
        else:
            print("⚠️  Gemini API key not configured - usando modo fallback")
            self.model = None
            self.enabled = False
    
    def extract_text_from_pdf(self, pdf_content: bytes) -> str:
        """Extraer texto de un PDF con numeración de páginas"""
        try:
            pdf_file = io.BytesIO(pdf_content)
            reader = PdfReader(pdf_file)
            
            text = ""
            for page_num, page in enumerate(reader.pages, 1):
                page_text = page.extract_text()
                text += f"\n=== Página {page_num} ===\n{page_text}\n"
            
            return text.strip()
        except Exception as e:
            print(f"Error extracting text from PDF: {e}")
            return ""
    
    # ============================================
    # 1. ANÁLISIS DE EXISTENCIA
    # ============================================
    
    def analyze_existence(self, pdf_content: bytes) -> Dict[str, Any]:
        """
        Verificar si el documento existe y es válido
        
        Returns:
            {
                "exists": bool,
                "readable": bool,
                "pages": int,
                "file_size_kb": float,
                "has_content": bool,
                "has_images": bool,
                "metadata": {...}
            }
        """
        try:
            pdf_file = io.BytesIO(pdf_content)
            reader = PdfReader(pdf_file)
            
            num_pages = len(reader.pages)
            has_text = False
            total_chars = 0
            
            # Verificar contenido en todas las páginas
            for page in reader.pages:
                text = page.extract_text().strip()
                total_chars += len(text)
                if len(text) > 50:
                    has_text = True
            
            # Verificar imágenes (aproximado)
            has_images = False
            for page in reader.pages:
                if '/XObject' in page['/Resources']:
                    xobject = page['/Resources']['/XObject'].get_object()
                    for obj in xobject:
                        if xobject[obj]['/Subtype'] == '/Image':
                            has_images = True
                            break
                if has_images:
                    break
            
            metadata = {}
            if reader.metadata:
                metadata = {
                    "title": reader.metadata.get('/Title', ''),
                    "author": reader.metadata.get('/Author', ''),
                    "subject": reader.metadata.get('/Subject', ''),
                    "creator": reader.metadata.get('/Creator', ''),
                }
            
            return {
                "exists": True,
                "readable": True,
                "pages": num_pages,
                "file_size_kb": round(len(pdf_content) / 1024, 2),
                "has_content": has_text,
                "total_characters": total_chars,
                "has_images": has_images,
                "metadata": metadata,
                "error": None
            }
        except Exception as e:
            return {
                "exists": False,
                "readable": False,
                "pages": 0,
                "file_size_kb": 0,
                "has_content": False,
                "total_characters": 0,
                "has_images": False,
                "metadata": {},
                "error": str(e)
            }
    
    # ============================================
    # 2. ANÁLISIS DE ESTRUCTURA
    # ============================================
    
    def analyze_structure(self, pdf_content: bytes) -> Dict[str, Any]:
        """
        Analizar la estructura del documento
        
        Returns:
            {
                "has_table_of_contents": bool,
                "sections": [...],
                "headings": [...],
                "has_bibliography": bool,
                "has_images": bool,
                "has_tables": bool,
                "page_distribution": {...}
            }
        """
        try:
            text = self.extract_text_from_pdf(pdf_content)
            
            if not text:
                return self._empty_structure()
            
            # Si Gemini está disponible, usar IA
            if self.enabled:
                return self._analyze_structure_with_ai(text)
            else:
                return self._analyze_structure_basic(text)
                
        except Exception as e:
            print(f"Error analyzing structure: {e}")
            return self._empty_structure()
    
    def _analyze_structure_basic(self, text: str) -> Dict[str, Any]:
        """Análisis básico de estructura sin IA"""
        lines = text.split('\n')
        
        # Detectar secciones (líneas cortas en mayúsculas o con números)
        sections = []
        headings = []
        
        for i, line in enumerate(lines):
            line_clean = line.strip()
            if not line_clean or len(line_clean) > 100:
                continue
            
            # Detectar títulos (mayúsculas, números, etc.)
            if line_clean.isupper() and len(line_clean) > 3:
                sections.append({
                    "title": line_clean,
                    "type": "heading",
                    "line": i
                })
            elif re.match(r'^\d+\.?\s+[A-Z]', line_clean):
                sections.append({
                    "title": line_clean,
                    "type": "numbered",
                    "line": i
                })
        
        # Detectar tabla de contenidos
        has_toc = any('contenido' in s['title'].lower() or 'índice' in s['title'].lower() 
                      for s in sections)
        
        # Detectar bibliografía
        text_lower = text.lower()
        has_bibliography = ('bibliografía' in text_lower or 
                          'referencias' in text_lower or
                          'bibliography' in text_lower)
        
        # Detectar imágenes y tablas (por menciones)
        has_images = 'figura' in text_lower or 'imagen' in text_lower or 'fig.' in text_lower
        has_tables = 'tabla' in text_lower or 'table' in text_lower
        
        return {
            "has_table_of_contents": has_toc,
            "sections": sections[:20],  # Limitar a 20
            "headings": [s['title'] for s in sections[:10]],
            "has_bibliography": has_bibliography,
            "has_images": has_images,
            "has_tables": has_tables,
            "total_sections": len(sections),
            "analysis_method": "basic"
        }
    
    def _analyze_structure_with_ai(self, text: str) -> Dict[str, Any]:
        """Análisis de estructura con Gemini"""
        prompt = f"""
Analiza la estructura del siguiente documento académico y responde en formato JSON:

DOCUMENTO (primeros 6000 caracteres):
{text[:6000]}

Identifica:
1. ¿Tiene tabla de contenidos/índice?
2. Lista las secciones principales que encuentres
3. ¿Tiene bibliografía o referencias?
4. ¿Menciona figuras, imágenes o tablas?

RESPONDE SOLO CON JSON VÁLIDO:
{{
    "has_table_of_contents": true/false,
    "sections": ["Sección 1", "Sección 2", ...],
    "headings": ["Título Principal", "Subtítulo", ...],
    "has_bibliography": true/false,
    "has_images": true/false,
    "has_tables": true/false
}}
"""
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Extraer JSON del response
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                result = json.loads(json_match.group())
                result['analysis_method'] = 'ai'
                return result
            else:
                return self._analyze_structure_basic(text)
        except Exception as e:
            print(f"AI analysis failed: {e}")
            return self._analyze_structure_basic(text)
    
    # ============================================
    # 3. ANÁLISIS DE CONTEXTO
    # ============================================
    
    def analyze_context(self, pdf_content: bytes) -> Dict[str, Any]:
        """
        Analizar el contexto y contenido del documento
        
        Returns:
            {
                "summary": str,
                "main_topics": [...],
                "language": str,
                "academic_level": str,
                "document_type": str,
                "keywords": [...]
            }
        """
        try:
            text = self.extract_text_from_pdf(pdf_content)
            
            if not text:
                return self._empty_context()
            
            if self.enabled:
                return self._analyze_context_with_ai(text)
            else:
                return self._analyze_context_basic(text)
                
        except Exception as e:
            print(f"Error analyzing context: {e}")
            return self._empty_context()
    
    def _analyze_context_basic(self, text: str) -> Dict[str, Any]:
        """Análisis básico de contexto sin IA"""
        text_lower = text.lower()
        
        # Detectar idioma
        spanish_words = ['el', 'la', 'de', 'que', 'en', 'y', 'a']
        english_words = ['the', 'of', 'and', 'to', 'a', 'in', 'is']
        
        spanish_count = sum(text_lower.count(word) for word in spanish_words)
        english_count = sum(text_lower.count(word) for word in english_words)
        
        language = 'español' if spanish_count > english_count else 'inglés'
        
        # Detectar tipo de documento
        doc_type = 'documento'
        if 'tesis' in text_lower:
            doc_type = 'tesis'
        elif 'proyecto' in text_lower:
            doc_type = 'proyecto'
        elif 'informe' in text_lower:
            doc_type = 'informe'
        elif 'syllabus' in text_lower or 'programa' in text_lower:
            doc_type = 'syllabus'
        
        # Resumen básico (primeras 500 palabras)
        words = text.split()[:500]
        summary = ' '.join(words) + '...'
        
        return {
            "summary": summary,
            "main_topics": [],
            "language": language,
            "academic_level": "no determinado",
            "document_type": doc_type,
            "keywords": [],
            "word_count": len(text.split()),
            "analysis_method": "basic"
        }
    
    def _analyze_context_with_ai(self, text: str) -> Dict[str, Any]:
        """Análisis de contexto con Gemini"""
        prompt = f"""
Analiza el siguiente documento académico y responde en formato JSON:

DOCUMENTO (primeros 8000 caracteres):
{text[:8000]}

Proporciona:
1. Un resumen breve (2-3 oraciones)
2. Los temas principales tratados
3. El idioma del documento
4. El nivel académico (pregrado, posgrado, técnico, etc.)
5. El tipo de documento (tesis, proyecto, syllabus, etc.)
6. Palabras clave (5-10)

RESPONDE SOLO CON JSON VÁLIDO:
{{
    "summary": "Resumen del documento...",
    "main_topics": ["Tema 1", "Tema 2", ...],
    "language": "español" o "inglés",
    "academic_level": "pregrado/posgrado/técnico",
    "document_type": "tesis/proyecto/syllabus/informe",
    "keywords": ["palabra1", "palabra2", ...]
}}
"""
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                result = json.loads(json_match.group())
                result['analysis_method'] = 'ai'
                result['word_count'] = len(text.split())
                return result
            else:
                return self._analyze_context_basic(text)
        except Exception as e:
            print(f"AI context analysis failed: {e}")
            return self._analyze_context_basic(text)
    
    # ============================================
    # ANÁLISIS COMPLETO
    # ============================================
    
    def analyze_complete(self, pdf_content: bytes) -> Dict[str, Any]:
        """
        Análisis completo del documento: existencia + estructura + contexto
        
        Returns:
            {
                "existence": {...},
                "structure": {...},
                "context": {...},
                "analyzed_at": datetime,
                "gemini_enabled": bool
            }
        """
        return {
            "existence": self.analyze_existence(pdf_content),
            "structure": self.analyze_structure(pdf_content),
            "context": self.analyze_context(pdf_content),
            "analyzed_at": datetime.utcnow().isoformat(),
            "gemini_enabled": self.enabled
        }
    
    # Helper methods
    
    def _empty_structure(self) -> Dict[str, Any]:
        return {
            "has_table_of_contents": False,
            "sections": [],
            "headings": [],
            "has_bibliography": False,
            "has_images": False,
            "has_tables": False,
            "total_sections": 0,
            "analysis_method": "none"
        }
    
    def _empty_context(self) -> Dict[str, Any]:
        return {
            "summary": "No se pudo analizar el contenido",
            "main_topics": [],
            "language": "desconocido",
            "academic_level": "no determinado",
            "document_type": "desconocido",
            "keywords": [],
            "word_count": 0,
            "analysis_method": "none"
        }


# Singleton
analysis_service = DocumentAnalysisService()
