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

  // Validación de contenido con IA
  const [validatingContent, setValidatingContent] = useState(false);
  const [contentValidationResult, setContentValidationResult] = useState(null);

  // Validación de curso completo (lote)
  const [validatingCourse, setValidatingCourse] = useState(false);
  const [courseValidationResult, setCourseValidationResult] = useState(null);
  
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

  // Helpers para detección de carpeta Semana y localización de la carpeta con el Excel
  const isSemanaFolder = (name) => /semana[_\s]\d+/i.test(name || '');
  const getMatrixFolderId = () =>
    breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2].id : breadcrumbs[0]?.id;

  const handleValidateContent = async () => {
    setValidatingContent(true);
    setContentValidationResult(null);
    const currentCrumb = breadcrumbs[breadcrumbs.length - 1];
    // Todos los IDs de la jerarquía excepto la carpeta Semana actual (del más cercano al más lejano)
    const candidateFolderIds = breadcrumbs.slice(0, -1).map(c => c.id).reverse();
    try {
      const response = await api.post('/api/validation/validate-content', {
        semana_folder_id: currentFolderId,
        semana_folder_name: currentCrumb.name,
        matrix_folder_id: getMatrixFolderId(),
        candidate_folder_ids: candidateFolderIds
      });
      setContentValidationResult(response.data);
    } catch (error) {
      console.error('Error validating content:', error);
      alert(`Error al validar contenido: ${error.response?.data?.detail || error.message}`);
    } finally {
      setValidatingContent(false);
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

  const handleValidateCourse = async () => {
    setValidatingCourse(true);
    setCourseValidationResult(null);
    try {
      const response = await api.post('/api/validation/validate-course', {
        course_folder_id: currentFolderId,
        course_name: breadcrumbs[0]?.name || currentFolderId,
        validation_type: 'both'
      });
      setCourseValidationResult(response.data);
    } catch (error) {
      console.error('Error en validación de curso:', error);
      alert(`Error al validar curso: ${error.response?.data?.detail || error.message}`);
    } finally {
      setValidatingCourse(false);
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
                {(() => {
                  const level = compliance_percentage === 100 ? 'compliant' : compliance_percentage >= 70 ? 'partial' : 'low';
                  return (
                    <div className={`compliance-summary ${level}`}>
                      <div className="compliance-header">
                        <h3>📊 Resumen de Cumplimiento</h3>
                        <span className={`compliance-percentage ${level}`}>
                          {compliance_percentage}%
                        </span>
                      </div>
                      <div className="compliance-stats-grid">
                        <div className="validation-stat-card total">
                          <div className="validation-stat-value">{total_required}</div>
                          <div className="validation-stat-label">Requeridos</div>
                        </div>
                        <div className="validation-stat-card found">
                          <div className="validation-stat-value">{total_found}</div>
                          <div className="validation-stat-label">Encontrados</div>
                        </div>
                        <div className="validation-stat-card missing">
                          <div className="validation-stat-value">{total_missing}</div>
                          <div className="validation-stat-label">Faltantes</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

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

  const renderContentValidationModal = () => {
    if (!contentValidationResult) return null;

    const {
      success,
      section,
      total_requirements,
      present_count,
      absent_count,
      compliance_percentage,
      results,
      documents_analyzed,
      excel_updated,
      gemini_enabled,
      error
    } = contentValidationResult;

    const thStyle = {
      padding: '10px 14px',
      textAlign: 'left',
      fontSize: '0.75rem',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: 'var(--text-secondary)',
      fontWeight: 600,
      background: 'var(--bg-secondary)',
      position: 'sticky',
      top: 0,
    };
    const tdStyle = {
      padding: '10px 14px',
      borderBottom: '1px solid var(--border-light)',
      verticalAlign: 'top',
    };

    return (
      <div className="analysis-modal-overlay" onClick={() => setContentValidationResult(null)}>
        <div className="analysis-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1100px' }}>
          {/* Header */}
          <div className="modal-header">
            <div className="modal-title-wrapper">
              <h2 className="modal-title">🧠 Validación de Contenido</h2>
              <p className="modal-subtitle">
                {section || breadcrumbs[breadcrumbs.length - 1]?.name}
                {documents_analyzed?.length > 0 && ` · ${documents_analyzed.length} documento(s) analizados`}
                {excel_updated && ' · Excel actualizado ✓'}
                {gemini_enabled === false && ' · Modo básico (sin Gemini)'}
              </p>
            </div>
            <button className="modal-close" onClick={() => setContentValidationResult(null)}>✕</button>
          </div>

          <div className="modal-content">
            {!success ? (
              <div className="analysis-section" style={{ borderLeftColor: '#ef4444' }}>
                <h3>❌ Error en Validación de Contenido</h3>
                <p>{error || 'No se pudo completar la validación de contenido.'}</p>
              </div>
            ) : (
              <>
                {/* Resumen de cumplimiento */}
                {(() => {
                  const level = compliance_percentage === 100 ? 'compliant' : compliance_percentage >= 70 ? 'partial' : 'low';
                  return (
                    <div className={`compliance-summary ${level}`}>
                      <div className="compliance-header">
                        <h3>📊 Cumplimiento de Contenido</h3>
                        <span className={`compliance-percentage ${level}`}>
                          {compliance_percentage?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="compliance-stats-grid">
                        <div className="validation-stat-card total">
                          <div className="validation-stat-value">{total_requirements}</div>
                          <div className="validation-stat-label">Requisitos</div>
                        </div>
                        <div className="validation-stat-card found">
                          <div className="validation-stat-value">{present_count}</div>
                          <div className="validation-stat-label">Presentes</div>
                        </div>
                        <div className="validation-stat-card missing">
                          <div className="validation-stat-value">{absent_count}</div>
                          <div className="validation-stat-label">Ausentes</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Tabla detallada por requisito */}
                {results && results.length > 0 && (
                  <div className="analysis-section">
                    <h3>📋 Detalle por Sub-sección</h3>
                    <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                      <table className="cv-table">
                        <thead>
                          <tr>
                            <th style={thStyle}>Sub-sección / Requisito</th>
                            <th style={{ ...thStyle, width: '120px' }}>Autor</th>
                            <th style={{ ...thStyle, width: '90px' }}>Presente</th>
                            <th style={thStyle}>Observación IA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r, idx) => (
                            <tr key={idx}>
                              <td style={tdStyle}>{r.sub_seccion}</td>
                              <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {r.autor || '—'}
                              </td>
                              <td style={tdStyle}>
                                <span className={`status-badge ${r.presente === 'Si' ? 'success' : 'error'}`}>
                                  {r.presente === 'Si' ? '✓ Si' : '✗ No'}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.875rem' }}>
                                {r.observacion}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Documentos analizados */}
                {documents_analyzed && documents_analyzed.length > 0 && (
                  <div className="analysis-section">
                    <h3>📄 Documentos Analizados ({documents_analyzed.length})</h3>
                    <ul className="analysis-list">
                      {documents_analyzed.map((name, i) => (
                        <li key={i}>{name}</li>
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

  const renderCourseValidationModal = () => {
    if (!courseValidationResult) return null;

    const {
      success, course_name, total_weeks, completed, failed,
      average_compliance, weeks, error
    } = courseValidationResult;

    const pctColor = (pct) =>
      pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';

    const thStyle = {
      padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      color: 'var(--text-secondary)', fontWeight: 600,
      background: 'var(--bg-secondary)', position: 'sticky', top: 0,
    };

    return (
      <div className="analysis-modal-overlay" onClick={() => setCourseValidationResult(null)}>
        <div className="analysis-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1100px' }}>
          <div className="modal-header">
            <div className="modal-title-wrapper">
              <h2 className="modal-title">📦 Validación de Curso Completo</h2>
              <p className="modal-subtitle">
                {course_name || breadcrumbs[0]?.name}
                {total_weeks > 0 && ` · ${total_weeks} semana(s) · Promedio: ${average_compliance}%`}
              </p>
            </div>
            <button className="modal-close" onClick={() => setCourseValidationResult(null)}>✕</button>
          </div>

          <div className="modal-content">
            {!success ? (
              <div className="analysis-section" style={{ borderLeftColor: '#ef4444' }}>
                <h3>❌ Error en Validación</h3>
                <p>{error || 'No se pudo completar la validación del curso.'}</p>
              </div>
            ) : (
              <>
                {(() => {
                  const level = average_compliance >= 70 ? 'compliant' : average_compliance >= 40 ? 'partial' : 'low';
                  return (
                    <div className={`compliance-summary ${level}`}>
                      <div className="compliance-header">
                        <h3>📊 Resumen del Curso</h3>
                        <span className={`compliance-percentage ${level}`}>{average_compliance}%</span>
                      </div>
                      <div className="compliance-stats-grid">
                        <div className="validation-stat-card total">
                          <div className="validation-stat-value">{total_weeks}</div>
                          <div className="validation-stat-label">Semanas</div>
                        </div>
                        <div className="validation-stat-card found">
                          <div className="validation-stat-value">{completed}</div>
                          <div className="validation-stat-label">Validadas</div>
                        </div>
                        {failed > 0 && (
                          <div className="validation-stat-card missing">
                            <div className="validation-stat-value">{failed}</div>
                            <div className="validation-stat-label">Con error</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {weeks && weeks.length > 0 && (
                  <div className="analysis-section">
                    <h3>📋 Resultados por Semana</h3>
                    <div style={{ overflowX: 'auto', maxHeight: '440px', overflowY: 'auto' }}>
                      <table className="cv-table">
                        <thead>
                          <tr>
                            <th style={thStyle}>Semana</th>
                            <th style={{ ...thStyle, width: '120px', textAlign: 'center' }}>Estructura</th>
                            <th style={{ ...thStyle, width: '120px', textAlign: 'center' }}>Contenido</th>
                            <th style={{ ...thStyle, width: '130px', textAlign: 'center' }}>Promedio</th>
                            <th style={{ ...thStyle, width: '110px', textAlign: 'center' }}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weeks.map((w, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
                                <strong>{w.folder_name}</strong>
                                {w.error && (
                                  <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '4px' }}>⚠️ {w.error}</div>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>
                                {w.structure
                                  ? <span style={{ fontWeight: 600, color: pctColor(w.structure.compliance_percentage) }}>{w.structure.compliance_percentage}%</span>
                                  : <span style={{ color: 'var(--text-light)' }}>—</span>}
                              </td>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>
                                {w.content && !w.content.error
                                  ? <span style={{ fontWeight: 600, color: pctColor(w.content.compliance_percentage) }}>{w.content.compliance_percentage}%</span>
                                  : <span style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>{w.content?.error ? '⚠️ Sin datos' : '—'}</span>}
                              </td>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ fontWeight: 700, color: pctColor(w.compliance_percentage) }}>
                                    {w.compliance_percentage}%
                                  </span>
                                  <div style={{ width: '80px', height: '6px', background: 'var(--border-light)', borderRadius: '999px', overflow: 'hidden' }}>
                                    <div style={{ width: `${w.compliance_percentage}%`, height: '100%', background: pctColor(w.compliance_percentage), borderRadius: '999px', transition: 'width 0.5s ease' }} />
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)', textAlign: 'center' }}>
                                <span className={`status-badge ${w.status === 'compliant' ? 'success' : w.status === 'partial' ? 'warning' : 'error'}`} style={{ fontSize: '0.75rem' }}>
                                  {w.status === 'compliant' ? '✓ Cumple' : w.status === 'partial' ? '~ Parcial' : '✗ Bajo'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
        
        {/* Botones de validación */}
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginLeft: 'var(--spacing-md)' }}>
          {/* Botón Validar Estructura */}
          <button
            className="btn-analyze"
            onClick={handleValidateStructure}
            disabled={validating}
            style={{
              background: validating
                ? 'linear-gradient(135deg, #9ca3af, #6b7280)'
                : 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              whiteSpace: 'nowrap'
            }}
          >
            {validating ? '⏳ Validando...' : '📋 Validar Estructura'}
          </button>

          {/* Botón Validar Contenido — solo visible en carpetas Semana_X */}
          {isSemanaFolder(breadcrumbs[breadcrumbs.length - 1]?.name) && (
            <button
              className="btn-analyze"
              onClick={handleValidateContent}
              disabled={validatingContent}
              style={{
                background: validatingContent
                  ? 'linear-gradient(135deg, #9ca3af, #6b7280)'
                  : 'linear-gradient(135deg, #10b981, #059669)',
                whiteSpace: 'nowrap'
              }}
            >
              {validatingContent ? '⏳ Analizando con IA...' : '🧠 Validar Contenido'}
            </button>
          )}

          {/* Botón Validar Curso Completo — solo visible en la raíz del curso */}
          {breadcrumbs.length === 1 && (
            <button
              className="btn-analyze"
              onClick={handleValidateCourse}
              disabled={validatingCourse}
              style={{
                background: validatingCourse
                  ? 'linear-gradient(135deg, #9ca3af, #6b7280)'
                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
                whiteSpace: 'nowrap'
              }}
            >
              {validatingCourse ? '⏳ Validando curso...' : '📦 Validar Curso Completo'}
            </button>
          )}
        </div>
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
      {renderContentValidationModal()}
      {renderCourseValidationModal()}
    </div>
  );
};

export default DocumentAnalyzer;
