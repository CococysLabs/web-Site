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
  
  // Validación de estructura
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  
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
    } catch (error) {
      console.error('Error analyzing file:', error);
      alert(`Error al analizar: ${error.response?.data?.detail || error.message}`);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleValidateStructure = async () => {
    setValidating(true);
    setValidationResult(null);

    try {
      const response = await api.post('/api/validation/validate-folder', {
        folder_id: currentFolderId
      });

      setValidationResult(response.data);
    } catch (error) {
      console.error('Error validating structure:', error);
      alert(`Error al validar: ${error.response?.data?.detail || error.message}`);
    } finally {
      setValidating(false);
    }
  };

  // Utilidades para formateo
  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const isFileNew = (createdTime) => {
    if (!createdTime) return false;
    const fileDate = new Date(createdTime);
    const daysSinceCreation = (new Date() - fileDate) / (1000 * 60 * 60 * 24);
    return daysSinceCreation <= 7; // Nuevo si tiene menos de 7 días
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderAnalysisModal = () => {
    if (!analysisResult) return null;

    const { analysis } = analysisResult;
    const { existence, structure, context } = analysis;

    return (
      <div className="analysis-modal-overlay" onClick={() => setAnalysisResult(null)}>
        <div className="analysis-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="modal-header">
            <div className="modal-title-wrapper">
              <h2 className="modal-title">Análisis de Documento</h2>
              <p className="modal-subtitle">{selectedFile?.name}</p>
            </div>
            <button className="modal-close" onClick={() => setAnalysisResult(null)}>
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="modal-content">
            {/* Sección: Existencia */}
            <div className="analysis-section">
              <h3>📄 Información General</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {existence.readable && (
                  <span className="status-badge success">
                    ✓ Legible
                  </span>
                )}
                {existence.has_images && (
                  <span className="status-badge success">
                    🖼️ Con Imágenes
                  </span>
                )}
                {existence.has_metadata && (
                  <span className="status-badge success">
                    📋 Con Metadatos
                  </span>
                )}
              </div>
              <ul className="analysis-list">
                <li><strong>Páginas:</strong> {existence.pages}</li>
                <li><strong>Tamaño:</strong> {existence.file_size_kb} KB</li>
                {existence.images_count > 0 && (
                  <li><strong>Imágenes detectadas:</strong> {existence.images_count}</li>
                )}
              </ul>
            </div>

            {/* Sección: Estructura */}
            <div className="analysis-section">
              <h3>🏗️ Estructura del Documento</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {structure.has_table_of_contents && (
                  <span className="status-badge success">
                    ✓ Tabla de Contenidos
                  </span>
                )}
                {structure.has_bibliography && (
                  <span className="status-badge success">
                    ✓ Bibliografía
                  </span>
                )}
                {structure.has_tables && (
                  <span className="status-badge success">
                    📊 Tablas
                  </span>
                )}
              </div>

              {structure.sections && structure.sections.length > 0 && (
                <div>
                  <p><strong>Secciones encontradas:</strong> {structure.total_sections || structure.sections.length}</p>
                  <ul className="analysis-list">
                    {structure.sections.slice(0, 8).map((section, idx) => (
                      <li key={idx}>
                        {typeof section === 'string' ? section : section.title}
                      </li>
                    ))}
                    {structure.sections.length > 8 && (
                      <li style={{ opacity: 0.7 }}>... y {structure.sections.length - 8} secciones más</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Sección: Contexto */}
            <div className="analysis-section">
              <h3>💡 Análisis de Contenido</h3>
              
              {context.summary && (
                <div style={{ marginBottom: '16px' }}>
                  <p><strong>Resumen:</strong></p>
                  <p style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    {context.summary}
                  </p>
                </div>
              )}

              {context.language && (
                <p><strong>Idioma detectado:</strong> {context.language}</p>
              )}

              {context.keywords && context.keywords.length > 0 && (
                <div>
                  <p><strong>Palabras clave:</strong></p>
                  <div className="keywords-container">
                    {context.keywords.map((keyword, idx) => (
                      <span key={idx} className="keyword-tag">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {context.main_topics && context.main_topics.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <p><strong>Temas principales:</strong></p>
                  <ul className="analysis-list">
                    {context.main_topics.map((topic, idx) => (
                      <li key={idx}>{topic}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderValidationModal = () => {
    if (!validationResult) return null;

    const { 
      success, 
      has_matrix, 
      total_required, 
      total_found, 
      total_missing, 
      compliance_percentage, 
      found_documents, 
      missing_documents,
      status,
      error 
    } = validationResult;

    return (
      <div className="analysis-modal-overlay" onClick={() => setValidationResult(null)}>
        <div className="analysis-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px' }}>
          {/* Header */}
          <div className="modal-header">
            <div className="modal-title-wrapper">
              <h2 className="modal-title">📋 Validación de Estructura</h2>
              <p className="modal-subtitle">{breadcrumbs[breadcrumbs.length - 1]?.name}</p>
            </div>
            <button className="modal-close" onClick={() => setValidationResult(null)}>
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="modal-content">
            {!success ? (
              <div className="analysis-section" style={{ borderLeftColor: '#ef4444' }}>
                <h3>❌ Error en Validación</h3>
                <p>{error || 'No se pudo validar la estructura'}</p>
                {!has_matrix && (
                  <p style={{ marginTop: '12px', fontStyle: 'italic' }}>
                    💡 Asegúrate de que la carpeta contenga el archivo "Matriz observaciones estructura.xlsx"
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* Resumen de cumplimiento */}
                <div className="analysis-section" style={{
                  background: compliance_percentage === 100 
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))' 
                    : 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.05))',
                  borderLeftColor: compliance_percentage === 100 ? '#22c55e' : '#f59e0b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3>📊 Resumen de Cumplimiento</h3>
                    <div style={{
                      fontSize: '2rem',
                      fontWeight: '700',
                      color: compliance_percentage === 100 ? '#22c55e' : compliance_percentage >= 70 ? '#f59e0b' : '#ef4444'
                    }}>
                      {compliance_percentage}%
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                    <div style={{ padding: '12px', background: 'white', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>{total_required}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Requeridos</div>
                    </div>
                    <div style={{ padding: '12px', background: 'white', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#22c55e' }}>{total_found}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Encontrados</div>
                    </div>
                    <div style={{ padding: '12px', background: 'white', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#ef4444' }}>{total_missing}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Faltantes</div>
                    </div>
                  </div>
                </div>

                {/* Documentos encontrados */}
                {found_documents && found_documents.length > 0 && (
                  <div className="analysis-section">
                    <h3>✅ Documentos Encontrados ({found_documents.length})</h3>
                    <ul className="analysis-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {found_documents.map((doc, idx) => (
                        <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{doc.name}</strong>
                            {doc.matched_file && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px' }}>
                                📄 {doc.matched_file.name}
                              </div>
                            )}
                          </div>
                          <span className="status-badge success">✓</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Documentos faltantes */}
                {missing_documents && missing_documents.length > 0 && (
                  <div className="analysis-section" style={{ borderLeftColor: '#ef4444' }}>
                    <h3>❌ Documentos Faltantes ({missing_documents.length})</h3>
                    <ul className="analysis-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {missing_documents.map((doc, idx) => (
                        <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8 }}>
                          <div>
                            <strong>{doc.name}</strong>
                            {doc.type && doc.type !== 'Desconocido' && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '4px' }}>
                                📌 {doc.type}
                              </div>
                            )}
                          </div>
                          <span className="status-badge error">✗</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading && folders.length === 0 && files.length === 0) {
    return (
      <div className="document-analyzer">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p className="loading-text">Cargando contenido...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="document-analyzer">
      {/* Breadcrumbs y botón de validación */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-lg)' }}>
        <div className="breadcrumbs" style={{ flex: 1, marginBottom: 0 }}>
          {breadcrumbs.map((crumb, index) => (
            <button
              key={crumb.id}
              onClick={() => navigateToBreadcrumb(index)}
              disabled={index === breadcrumbs.length - 1}
            >
              {index === 0 ? '🏠' : ''} {crumb.name}
            </button>
          ))}
        </div>
        
        {/* Botón Validar Estructura */}
        <button
          className="btn-analyze"
          onClick={handleValidateStructure}
          disabled={validating}
          style={{
            marginLeft: 'var(--spacing-md)',
            background: validating 
              ? 'linear-gradient(135deg, #9ca3af, #6b7280)' 
              : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            whiteSpace: 'nowrap'
          }}
        >
          {validating ? (
            <>
              <svg className="btn-analyze-icon" style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="white">
                <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
              </svg>
              Validando...
            </>
          ) : (
            <>
              📋 Validar Estructura
            </>
          )}
        </button>
      </div>

      <div className="analyzer-content">
        {/* Sección de Carpetas */}
        {folders.length > 0 && (
          <div className="folders-section">
            <h3>Carpetas ({folders.length})</h3>
            <div className="folders-grid">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="folder-card"
                  onClick={() => navigateToFolder(folder)}
                  role="button"
                  tabIndex={0}
                  onKeyPress={(e) => e.key === 'Enter' && navigateToFolder(folder)}
                >
                  <div className="folder-icon-wrapper">
                    <svg className="folder-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                    </svg>
                  </div>
                  <div className="folder-name">{folder.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sección de Archivos */}
        {files.length > 0 && (
          <div className="files-section">
            <h3>Documentos ({files.length})</h3>
            <div className="files-list">
              {files.map((file) => (
                <div key={file.id} className="file-item">
                  <div className="file-info">
                    <div className="file-icon-wrapper">
                      <svg className="file-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                      </svg>
                    </div>
                    <div className="file-details">
                      <div className="file-name">{file.name}</div>
                      <div className="file-meta">
                        <span className="file-size">
                          📦 {formatFileSize(file.size)}
                        </span>
                        <span>📅 {formatDate(file.modifiedTime)}</span>
                        {isFileNew(file.createdTime) && (
                          <span className="badge-new">Nuevo</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn-analyze"
                    onClick={() => handleAnalyze(file)}
                    disabled={analyzing === file.id}
                  >
                    {analyzing === file.id ? (
                      <>
                        <svg className="btn-analyze-icon" viewBox="0 0 24 24" fill="white">
                          <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/>
                        </svg>
                        Analizando...
                      </>
                    ) : (
                      <>
                        🔍 Analizar
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {folders.length === 0 && files.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <p className="empty-state-text">Esta carpeta está vacía</p>
            <p className="empty-state-subtext">No se encontraron carpetas ni documentos</p>
          </div>
        )}
      </div>

      {/* Modales */}
      {renderAnalysisModal()}
      {renderValidationModal()}
    </div>
  );
};

export default DocumentAnalyzer;
