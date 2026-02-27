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

  // Error inline (reemplaza alert())
  const [error, setError] = useState(null);

  // Historial de validaciones por folder_id → { compliance, status, type }
  const [folderHistory, setFolderHistory] = useState({});

  // Navegación jerárquica
  const [currentFolderId, setCurrentFolderId] = useState(folderId);
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: folderId, name: folderName }]);

  useEffect(() => {
    if (currentFolderId) {
      setError(null);
      loadContents();
    }
  }, [currentFolderId]);

  const loadContents = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/drive/contents/${currentFolderId}`);
      const newFolders = response.data.folders || [];
      setFolders(newFolders);
      setFiles(response.data.files || []);
      // Cargar estado de validación de subcarpetas en background
      if (newFolders.length > 0) loadFolderHistory();
    } catch (err) {
      setError('Error al cargar contenido de la carpeta');
    }
    setLoading(false);
  };

  const loadFolderHistory = async () => {
    try {
      const res = await api.get('/api/validation/history?limit=300');
      const records = res.data.records || [];
      // Tomar el registro más reciente por folder_id
      const statuses = {};
      for (const rec of records) {
        if (!statuses[rec.folder_id]) {
          statuses[rec.folder_id] = {
            compliance: rec.compliance_percentage,
            status: rec.status,
            type: rec.validation_type,
          };
        }
      }
      setFolderHistory(statuses);
    } catch {
      // Silencioso — los badges son opcionales
    }
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
    } catch (err) {
      setError(`Error al analizar documento: ${err.response?.data?.detail || err.message}`);
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
      loadFolderHistory();
    } catch (err) {
      setError(`Error al validar contenido: ${err.response?.data?.detail || err.message}`);
    } finally {
      setValidatingContent(false);
    }
  };

  const handleValidateStructure = async () => {
    setValidating(true);
    setValidationResult(null);
    setError(null);
    try {
      const response = await api.post('/api/validation/validate-folder', {
        folder_id: currentFolderId,
        folder_name: breadcrumbs[breadcrumbs.length - 1]?.name,
        course_name: breadcrumbs[0]?.name,
      });
      setValidationResult(response.data);
      // Refrescar badges
      loadFolderHistory();
    } catch (err) {
      setError(`Error al validar estructura: ${err.response?.data?.detail || err.message}`);
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
      loadFolderHistory();
    } catch (err) {
      setError(`Error al validar curso: ${err.response?.data?.detail || err.message}`);
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
    const { existence, structure, context, quality } = analysis;

    // Color del score de calidad
    const scoreColor = (s) =>
      s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : s >= 40 ? '#f97316' : '#ef4444';
    const scoreBg = (s) =>
      s >= 80 ? 'rgba(16,185,129,0.1)' : s >= 60 ? 'rgba(245,158,11,0.1)' : s >= 40 ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)';

    const score = quality?.score ?? 0;

    return (
      <div className="analysis-modal-overlay" onClick={() => setAnalysisResult(null)}>
        <div className="analysis-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '860px' }}>
          {/* Header */}
          <div className="modal-header">
            <div className="modal-title-wrapper">
              <h2 className="modal-title">🔍 Análisis de Documento</h2>
              <p className="modal-subtitle">{selectedFile?.name}</p>
              {analysis.gemini_enabled === false && (
                <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '4px', display: 'block' }}>
                  ⚠️ Análisis básico (Gemini no disponible)
                </span>
              )}
            </div>
            <button className="modal-close" onClick={() => setAnalysisResult(null)}>✕</button>
          </div>

          <div className="modal-content">

            {/* ── 1. Calidad académica (score destacado) ── */}
            {quality && (
              <div style={{ background: scoreBg(score), border: `1px solid ${scoreColor(score)}30`, borderRadius: '10px', padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Score circular */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: `conic-gradient(${scoreColor(score)} ${score}%, var(--border-light) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: scoreColor(score) }}>{score}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', marginTop: '4px', fontWeight: 600, color: scoreColor(score), textTransform: 'uppercase' }}>{quality.level}</span>
                </div>

                {/* Fortalezas y debilidades */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontWeight: 700, marginBottom: '8px', fontSize: '0.875rem' }}>📊 Evaluación de Calidad Académica</p>
                  {quality.strengths?.length > 0 && (
                    <div style={{ marginBottom: '6px' }}>
                      {quality.strengths.map((s, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', gap: '5px', marginBottom: '3px' }}>
                          <span>✓</span><span>{s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {quality.weaknesses?.length > 0 && (
                    <div>
                      {quality.weaknesses.map((w, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: '#ef4444', display: 'flex', gap: '5px', marginBottom: '3px' }}>
                          <span>✗</span><span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recomendaciones */}
                {quality.recommendations?.length > 0 && (
                  <div style={{ minWidth: 200, flex: 1 }}>
                    <p style={{ fontWeight: 700, marginBottom: '8px', fontSize: '0.875rem' }}>💡 Recomendaciones</p>
                    {quality.recommendations.map((r, i) => (
                      <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '5px', marginBottom: '3px' }}>
                        <span style={{ color: '#8b5cf6' }}>→</span><span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── 2. Información General ── */}
            <div className="analysis-section">
              <h3>📄 Información General</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {existence.readable && <span className="status-badge success">✓ Legible</span>}
                {existence.has_images && <span className="status-badge success">🖼️ Con imágenes</span>}
                {context?.document_type && context.document_type !== 'desconocido' && (
                  <span className="status-badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed' }}>
                    📑 {context.document_type}
                  </span>
                )}
                {context?.language && context.language !== 'desconocido' && (
                  <span className="status-badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#2563eb' }}>
                    🌐 {context.language}
                  </span>
                )}
                {context?.academic_level && context.academic_level !== 'no determinado' && (
                  <span className="status-badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#065f46' }}>
                    🎓 {context.academic_level}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                {[
                  existence.pages != null && { label: 'Páginas/Slides', value: existence.pages },
                  existence.slides != null && { label: 'Diapositivas', value: existence.slides },
                  existence.sheet_count != null && { label: 'Hojas', value: existence.sheet_count },
                  existence.word_count > 0 && { label: 'Palabras', value: existence.word_count?.toLocaleString() },
                  existence.reading_time_min > 0 && { label: 'Lectura aprox.', value: `${existence.reading_time_min} min` },
                  existence.file_size_kb && { label: 'Tamaño', value: `${existence.file_size_kb} KB` },
                  existence.paragraph_count != null && { label: 'Párrafos', value: existence.paragraph_count },
                  existence.table_count != null && { label: 'Tablas', value: existence.table_count },
                ].filter(Boolean).map((item, i) => (
                  <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 14px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {/* Hojas de Excel */}
              {existence.sheet_summaries?.length > 0 && (
                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <strong>Hojas:</strong> {existence.sheet_summaries.join(' · ')}
                </div>
              )}
            </div>

            {/* ── 3. Resumen de contenido ── */}
            {context?.summary && (
              <div className="analysis-section">
                <h3>💡 Contenido</h3>
                <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: '14px' }}>{context.summary}</p>

                {context.main_topics?.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.875rem' }}>Temas principales:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {context.main_topics.map((topic, i) => (
                        <span key={i} style={{ padding: '3px 10px', background: 'rgba(59,130,246,0.1)', color: '#2563eb', borderRadius: '999px', fontSize: '0.8rem' }}>{topic}</span>
                      ))}
                    </div>
                  </div>
                )}

                {context.keywords?.length > 0 && (
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.875rem' }}>Palabras clave:</p>
                    <div className="keywords-container">
                      {context.keywords.map((kw, i) => <span key={i} className="keyword-tag">{kw}</span>)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 4. Estructura ── */}
            <div className="analysis-section">
              <h3>🏗️ Estructura</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {[
                  structure.has_table_of_contents && '✓ Tabla de contenidos',
                  structure.has_bibliography && '✓ Bibliografía',
                  structure.has_tables && '📊 Tablas',
                  structure.has_images && '🖼️ Imágenes',
                ].filter(Boolean).map((label, i) => (
                  <span key={i} className="status-badge success">{label}</span>
                ))}
                {[
                  !structure.has_table_of_contents && '✗ Sin tabla de contenidos',
                  !structure.has_bibliography && '✗ Sin bibliografía',
                ].filter(Boolean).map((label, i) => (
                  <span key={i} className="status-badge error">{label}</span>
                ))}
              </div>
              {structure.sections?.length > 0 && (
                <div>
                  <p style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.875rem' }}>
                    Secciones detectadas ({structure.total_sections || structure.sections.length}):
                  </p>
                  <ul className="analysis-list" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    {structure.sections.slice(0, 12).map((s, i) => (
                      <li key={i}>{typeof s === 'string' ? s : s.title}</li>
                    ))}
                    {structure.sections.length > 12 && (
                      <li style={{ opacity: 0.6 }}>... y {structure.sections.length - 12} más</li>
                    )}
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
      report_generated,
      report_name,
      report_link,
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
                {gemini_enabled === false && ' · Modo básico (sin Gemini)'}
              </p>
              {report_generated && report_link && (
                <a
                  href={report_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '6px', fontSize: '0.8rem', color: '#10b981', textDecoration: 'none', fontWeight: 600 }}
                >
                  📄 Ver reporte Excel generado
                  <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
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
      average_compliance, course_structure, weeks, validation_type,
      error: courseError
    } = courseValidationResult;

    const pctColor = (pct) =>
      pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';

    const thStyle = {
      padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      color: 'var(--text-secondary)', fontWeight: 600,
      background: 'var(--bg-secondary)', position: 'sticky', top: 0,
    };
    const tdStyle = { padding: '10px 14px', borderBottom: '1px solid var(--border-light)' };

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
                <p>{courseError || 'No se pudo completar la validación del curso.'}</p>
              </div>
            ) : (
              <>
                {/* Resumen global */}
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

                {/* Estructura del curso (validada una vez en el root) */}
                {course_structure && (
                  <div className="analysis-section" style={{ borderLeftColor: course_structure.success ? (course_structure.compliance_percentage >= 70 ? '#10b981' : course_structure.compliance_percentage >= 40 ? '#f59e0b' : '#ef4444') : '#ef4444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0 }}>📋 Estructura del Curso</h3>
                      {course_structure.success && (
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: pctColor(course_structure.compliance_percentage) }}>
                          {course_structure.compliance_percentage}%
                        </span>
                      )}
                    </div>
                    {!course_structure.success ? (
                      <p style={{ color: '#ef4444', margin: 0 }}>
                        {course_structure.error || 'No se pudo validar la estructura del curso'}
                      </p>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', fontSize: '0.875rem' }}>
                          <span>✅ <strong>{course_structure.total_found}</strong> encontrados</span>
                          <span>❌ <strong>{course_structure.total_missing}</strong> faltantes</span>
                          <span>📄 <strong>{course_structure.total_required}</strong> requeridos</span>
                        </div>
                        {course_structure.missing_documents?.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <p style={{ margin: '0 0 6px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Documentos/carpetas faltantes:</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {course_structure.missing_documents.map((name, i) => (
                                <span key={i} style={{ padding: '2px 8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '4px', fontSize: '0.8rem' }}>
                                  {name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Contenido por semana */}
                {weeks && weeks.length > 0 && validation_type !== 'structure' && (
                  <div className="analysis-section">
                    <h3>🧠 Contenido por Semana</h3>
                    <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                      <table className="cv-table">
                        <thead>
                          <tr>
                            <th style={thStyle}>Semana</th>
                            <th style={{ ...thStyle, width: '130px', textAlign: 'center' }}>Cumplimiento</th>
                            <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Presentes</th>
                            <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>Faltantes</th>
                            <th style={{ ...thStyle, width: '110px', textAlign: 'center' }}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weeks.map((w, idx) => (
                            <tr key={idx}>
                              <td style={tdStyle}>
                                <strong>{w.folder_name}</strong>
                                {w.error && <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '4px' }}>⚠️ {w.error}</div>}
                                {w.content?.error && !w.error && <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '4px' }}>⚠️ {w.content.error}</div>}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                {w.content && !w.content.error ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontWeight: 700, color: pctColor(w.content.compliance_percentage) }}>
                                      {w.content.compliance_percentage}%
                                    </span>
                                    <div style={{ width: '80px', height: '5px', background: 'var(--border-light)', borderRadius: '999px', overflow: 'hidden' }}>
                                      <div style={{ width: `${w.content.compliance_percentage}%`, height: '100%', background: pctColor(w.content.compliance_percentage), borderRadius: '999px' }} />
                                    </div>
                                  </div>
                                ) : <span style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>—</span>}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', color: '#10b981', fontWeight: 600 }}>
                                {w.content?.present_count ?? '—'}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center', color: w.content?.absent_count > 0 ? '#ef4444' : 'var(--text-secondary)', fontWeight: 600 }}>
                                {w.content?.absent_count ?? '—'}
                              </td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>
                                {w.content && !w.content.error ? (
                                  <span className={`status-badge ${w.status === 'compliant' ? 'success' : w.status === 'partial' ? 'warning' : 'error'}`} style={{ fontSize: '0.75rem' }}>
                                    {w.status === 'compliant' ? '✓ Cumple' : w.status === 'partial' ? '~ Parcial' : '✗ Bajo'}
                                  </span>
                                ) : <span style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>sin datos</span>}
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
      {/* Error banner inline */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', marginBottom: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', color: '#ef4444' }}>
          <svg style={{ width: 18, height: 18, flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span style={{ flex: 1, fontSize: '0.875rem' }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem', padding: '0 4px', lineHeight: 1 }}>✕</button>
        </div>
      )}

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
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginLeft: 'var(--spacing-md)', flexWrap: 'wrap' }}>
          {/* Validar Estructura — solo en carpetas que NO sean Semana_X
              (el Excel de matriz vive en el root del curso, no en cada Semana) */}
          {!isSemanaFolder(breadcrumbs[breadcrumbs.length - 1]?.name) && (
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
          )}

          {/* Validar Contenido — solo dentro de carpetas Semana_X */}
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

          {/* Validar Curso Completo — solo en la raíz del curso */}
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
                  style={{ position: 'relative' }}
                >
                  {/* Badge de última validación */}
                  {folderHistory[folder.id] && (() => {
                    const h = folderHistory[folder.id];
                    const color = h.status === 'compliant' ? '#10b981' : h.status === 'partial' ? '#f59e0b' : '#ef4444';
                    const bg   = h.status === 'compliant' ? 'rgba(16,185,129,0.15)' : h.status === 'partial' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
                    return (
                      <div style={{ position: 'absolute', top: 6, right: 6, padding: '2px 7px', borderRadius: '999px', background: bg, color, fontSize: '0.7rem', fontWeight: 700, pointerEvents: 'none' }}>
                        {h.compliance?.toFixed(0)}%
                      </div>
                    );
                  })()}
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
