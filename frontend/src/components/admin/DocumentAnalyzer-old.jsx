import { useState, useEffect } from 'react';
import api from '../../services/api';
import './DocumentAnalyzer.css';

const DocumentAnalyzer = ({ folderId, folderName }) => {
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // Navegación jerárquica
  const [currentFolderId, setCurrentFolderId] = useState(folderId);
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: folderId, name: folderName }]);

  useEffect(() => {
    if (currentFolderId) {
      loadContents();
    }
  }, [currentFolderId]);

  const loadContents = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/drive/contents/${currentFolderId}`);
      setFolders(response.data.folders || []);
      setFiles(response.data.files || []);
    } catch (error) {
      console.error('Error loading contents:', error);
      alert('Error al cargar contenido');
    }
    setLoading(false);
  };

  const navigateToFolder = (folder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
  };

  const handleAnalyze = async (file) => {
    setAnalyzing(file.id);
    setSelectedFile(file);
    setAnalysisResult(null);

    try {
      const response = await api.post('/api/analysis/analyze-drive-file', {
        file_id: file.id,
        folder_id: currentFolderId
      });

      setAnalysisResult(response.data);
      alert(`✅ Análisis completado: ${file.name}`);
    } catch (error) {
      console.error('Error analyzing file:', error);
      alert(`Error al analizar: ${error.response?.data?.detail || error.message}`);
    } finally {
      setAnalyzing(null);
    }
  };

  const renderAnalysisResult = () => {
    if (!analysisResult) return null;

    const { analysis } = analysisResult;
    const { existence, structure, context } = analysis;

    return (
      <div className="analysis-modal">
        <div className="modal-content">
          <div className="modal-header">
            <h2>📊 Resultado del Análisis</h2>
            <button onClick={() => setAnalysisResult(null)} className="close-btn">
              ✕
            </button>
          </div>

          <div className="modal-body">
            {/* Archivo Info */}
            <div className="analysis-section">
              <h3>📄 Información del Archivo</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="label">Nombre:</span>
                  <span className="value">{selectedFile?.name}</span>
                </div>
                <div className="info-item">
                  <span className="label">Páginas:</span>
                  <span className="value">{existence.pages}</span>
                </div>
                <div className="info-item">
                  <span className="label">Tamaño:</span>
                  <span className="value">{existence.file_size_kb} KB</span>
                </div>
                <div className="info-item">
                  <span className="label">Legible:</span>
                  <span className={`value ${existence.readable ? 'success' : 'error'}`}>
                    {existence.readable ? '✅ Sí' : '❌ No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Estructura */}
            <div className="analysis-section">
              <h3>🏗️ Estructura del Documento</h3>
              <div className="structure-grid">
                <div className={`structure-item ${structure.has_table_of_contents ? 'present' : 'missing'}`}>
                  <span className="icon">{structure.has_table_of_contents ? '✅' : '❌'}</span>
                  <span>Tabla de Contenidos</span>
                </div>
                <div className={`structure-item ${structure.has_bibliography ? 'present' : 'missing'}`}>
                  <span className="icon">{structure.has_bibliography ? '✅' : '❌'}</span>
                  <span>Bibliografía</span>
                </div>
                <div className={`structure-item ${structure.has_images ? 'present' : 'missing'}`}>
                  <span className="icon">{structure.has_images ? '✅' : '📷'}</span>
                  <span>Imágenes/Figuras</span>
                </div>
                <div className={`structure-item ${structure.has_tables ? 'present' : 'missing'}`}>
                  <span className="icon">{structure.has_tables ? '✅' : '📊'}</span>
                  <span>Tablas</span>
                </div>
              </div>

              {structure.sections && structure.sections.length > 0 && (
                <div className="sections-list">
                  <h4>Secciones Encontradas ({structure.total_sections || structure.sections.length}):</h4>
                  <ul>
                    {structure.sections.slice(0, 10).map((section, idx) => (
                      <li key={idx}>
                        {typeof section === 'string' ? section : section.title}
                      </li>
                    ))}
                    {structure.sections.length > 10 && (
                      <li className="more-items">... y {structure.sections.length - 10} más</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Contexto */}
            <div className="analysis-section">
              <h3>📝 Contexto y Contenido</h3>
              
              <div className="context-info">
                <div className="info-row">
                  <span className="label">Idioma:</span>
                  <span className="value badge">{context.language}</span>
                </div>
                <div className="info-row">
                  <span className="label">Tipo:</span>
                  <span className="value badge">{context.document_type}</span>
                </div>
                <div className="info-row">
                  <span className="label">Nivel:</span>
                  <span className="value badge">{context.academic_level}</span>
                </div>
                {context.word_count > 0 && (
                  <div className="info-row">
                    <span className="label">Palabras:</span>
                    <span className="value">{context.word_count.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {context.summary && (
                <div className="summary-box">
                  <h4>Resumen:</h4>
                  <p>{context.summary}</p>
                </div>
              )}

              {context.main_topics && context.main_topics.length > 0 && (
                <div className="topics-box">
                  <h4>Temas Principales:</h4>
                  <div className="topics-tags">
                    {context.main_topics.map((topic, idx) => (
                      <span key={idx} className="topic-tag">{topic}</span>
                    ))}
                  </div>
                </div>
              )}

              {context.keywords && context.keywords.length > 0 && (
                <div className="keywords-box">
                  <h4>Palabras Clave:</h4>
                  <div className="keywords-tags">
                    {context.keywords.map((keyword, idx) => (
                      <span key={idx} className="keyword-tag">{keyword}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer con método */}
            <div className="analysis-footer">
              <small>
                Análisis realizado con: <strong>{analysis.gemini_enabled ? '🤖 Gemini AI' : '📊 Análisis Básico'}</strong>
              </small>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Cargando contenido...</p>
      </div>
    );
  }

  return (
    <div className="document-analyzer">
      {/* Breadcrumbs */}
      <div className="breadcrumbs">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.id}>
            {index > 0 && <span className="separator"> / </span>}
            <button
              onClick={() => navigateToBreadcrumb(index)}
              className={index === breadcrumbs.length - 1 ? 'active' : ''}
              disabled={index === breadcrumbs.length - 1}
            >
              📁 {crumb.name}
            </button>
          </span>
        ))}
      </div>

      <div className="analyzer-header">
        <h2>Contenido de la carpeta</h2>
        <p className="subtitle">
          {folders.length} carpeta(s) • {files.length} archivo(s)
        </p>
      </div>

      {/* Carpetas */}
      {folders.length > 0 && (
        <div className="folders-section">
          <h3>📂 Subcarpetas</h3>
          <div className="folders-grid">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="folder-card"
                onClick={() => navigateToFolder(folder)}
              >
                <div className="folder-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                </div>
                <h4>{folder.name}</h4>
                <p className="folder-meta">
                  {folder.modified_time && new Date(folder.modified_time).toLocaleDateString('es-ES')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archivos PDF */}
      {files.length === 0 && folders.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3>Carpeta vacía</h3>
          <p>Esta carpeta no contiene archivos ni subcarpetas</p>
        </div>
      ) : files.length > 0 ? (
        <div className="files-section">
          <h3>📄 Archivos PDF</h3>
          <div className="files-list">
          {files.map((file) => (
            <div key={file.id} className="file-item">
              <div className="file-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="file-info">
                <h4>{file.name}</h4>
                <p className="file-meta">
                  {file.size && `${(file.size / 1024).toFixed(2)} KB`}
                  {file.modified_time && ` • ${new Date(file.modified_time).toLocaleDateString('es-ES')}`}
                </p>
              </div>
              <div className="file-actions">
                <button
                  onClick={() => handleAnalyze(file)}
                  disabled={analyzing === file.id}
                  className="btn-primary"
                >
                  {analyzing === file.id ? (
                    <>
                      <span className="spinner-sm"></span>
                      Analizando...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Analizar
                    </>
                  )}
                </button>
                <a
                  href={file.web_view_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary btn-icon"
                  title="Abrir en Drive"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
        </div>
      ) : null}

      {/* Modal de resultados */}
      {analysisResult && renderAnalysisResult()}
    </div>
  );
};

export default DocumentAnalyzer;
