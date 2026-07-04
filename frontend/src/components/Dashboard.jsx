import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../services/api';
import DocumentAnalyzer from './admin/DocumentAnalyzer';
import CreateFoldersFromCsv from './CreateFoldersFromCsv';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('overview');

  const [validationSummary, setValidationSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState(null);

  // Personal API keys state
  const [personalKeys, setPersonalKeys]       = useState(null);
  const [newPersonalKey, setNewPersonalKey]   = useState({ gemini: '', deepseek: '', groq: '', openrouter: '' });
  const [keyLoading, setKeyLoading]           = useState({});

  // Historial personal
  const [myHistory, setMyHistory]       = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage]   = useState(0);
  const HISTORY_PAGE_SIZE = 15;

  const [teacherSummary, setTeacherSummary] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);

  const isTeacher = user?.is_teacher;
  const canViewDrive = user?.permissions?.can_view_drive && user?.drive_folder_id;
  const canCreateFolders = user?.role === 'admin' || isTeacher;
  const structureFolderId = '1kKtxjCV9cXxkS_BeQv95Ud5M_Q0S77aA';

  const withRetry = async (requestFn, retries = 1) => {
    try {
      return await requestFn();
    } catch (err) {
      const isTransientNetworkError = err?.code === 'ERR_NETWORK' || err?.message === 'Network Error';
      if (retries > 0 && isTransientNetworkError) {
        return await requestFn();
      }
      throw err;
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    if (user?.is_approved) {
      loadValidationSummary();
      if (isTeacher) loadTeacherSummary();
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, user?.is_approved]);

  const loadTeacherSummary = async () => {
    try {
      setTeacherLoading(true);
      const res = await withRetry(() => api.get('/api/validation/teacher-summary'));
      setTeacherSummary(res.data);
    } catch (err) {
      // Evita ruido en consola por cortes de red breves durante despliegues/restarts.
      if (err?.response?.status !== 401) {
        setTeacherSummary({ has_folder: false, records: [], total: 0, avg_compliance: 0.0, by_week: [] });
      }
    } finally {
      setTeacherLoading(false);
    }
  };

  const loadValidationSummary = async () => {
    try {
      setSummaryLoading(true);
      const response = await api.get('/api/validation/public-summary');
      setValidationSummary(response.data);
    } catch (error) {
      console.error('Error loading validation summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const loadMyHistory = async (page = 0) => {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/api/analysis/history?limit=${HISTORY_PAGE_SIZE}&offset=${page * HISTORY_PAGE_SIZE}`);
      setMyHistory(res.data);
      setHistoryPage(page);
    } catch { /* ignore */ } finally {
      setHistoryLoading(false);
    }
  };

  const loadPersonalKeys = async () => {
    try {
      const res = await withRetry(() => api.get('/api/auth/me/api-keys'));
      setPersonalKeys(res.data);
    } catch {
      setPersonalKeys({ gemini: { key_count: 0, keys: [] }, deepseek: { key_count: 0, keys: [] }, groq: { key_count: 0, keys: [] }, openrouter: { key_count: 0, keys: [] } });
    }
  };

  const addPersonalKey = async (provider) => {
    const keyVal = newPersonalKey[provider]?.trim();
    if (!keyVal) return;
    setKeyLoading(prev => ({ ...prev, [provider]: true }));
    try {
      await api.post(`/api/auth/me/api-keys/${provider}/add`, { key: keyVal });
      setNewPersonalKey(prev => ({ ...prev, [provider]: '' }));
      await loadPersonalKeys();
    } catch (err) {
      console.error('Error adding key:', err);
    } finally {
      setKeyLoading(prev => ({ ...prev, [provider]: false }));
    }
  };

  const removePersonalKey = async (provider, index) => {
    setKeyLoading(prev => ({ ...prev, [`${provider}_${index}`]: true }));
    try {
      await api.delete(`/api/auth/me/api-keys/${provider}/${index}`);
      await loadPersonalKeys();
    } catch (err) {
      console.error('Error removing key:', err);
    } finally {
      setKeyLoading(prev => ({ ...prev, [`${provider}_${index}`]: false }));
    }
  };

  const formatTime = (date) =>
    date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatDate = (date) =>
    date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const navTo = (view) => {
    setActiveView(view);
    setSidebarOpen(false);
    if (view === 'profile' && !personalKeys) loadPersonalKeys();
    if (view === 'history' && !myHistory) loadMyHistory(0);
  };

  const ccls = (v) => v >= 70 ? 'success' : v >= 40 ? 'warning' : 'danger';

  return (
    <div className="dashboard-container">
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* ── Sidebar ── */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="gradient-text">COCOCYS</h1>
          <p className="sidebar-subtitle">Sistema de Análisis IA</p>
        </div>

        <nav className="sidebar-nav">
          <button className={`nav-item ${activeView === 'overview' ? 'active' : ''}`} onClick={() => navTo('overview')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Inicio</span>
          </button>

          {canViewDrive && (
            <button className={`nav-item ${activeView === 'mi-carpeta' ? 'active' : ''}`} onClick={() => navTo('mi-carpeta')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>Mi Carpeta</span>
            </button>
          )}

          {canCreateFolders && (
            <button
              className={`nav-item ${activeView === 'crear-carpetas' ? 'active' : ''}`}
              onClick={() => navTo('crear-carpetas')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Crear carpetas</span>
            </button>
          )}

          <button className={`nav-item ${activeView === 'validations' ? 'active' : ''}`} onClick={() => navTo('validations')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Validaciones</span>
            {validationSummary?.total_validations > 0 && (
              <span className="nav-badge">{validationSummary.total_validations}</span>
            )}
          </button>

          <button className={`nav-item ${activeView === 'history' ? 'active' : ''}`} onClick={() => navTo('history')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Mi Historial</span>
          </button>

          {isTeacher && (
            <button className={`nav-item ${activeView === 'teacher' ? 'active' : ''}`} onClick={() => { navTo('teacher'); if (!teacherSummary) loadTeacherSummary(); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
              <span>Mi Curso</span>
            </button>
          )}

          <button className={`nav-item ${activeView === 'profile' ? 'active' : ''}`} onClick={() => navTo('profile')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Mi Perfil</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">{user?.nombre?.charAt(0)}{user?.apellidos?.charAt(0)}</div>
            <div className="user-info">
              <p className="user-name">{user?.nombre} {user?.apellidos}</p>
              <p className="user-email">{user?.correo}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="dashboard-main">
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Menú">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h2>Hola, {user?.nombre} 👋</h2>
                <p className="header-subtitle">{formatDate(currentTime)}</p>
              </div>
            </div>
            <div className="header-time">
              <div className="time-display">{formatTime(currentTime)}</div>
            </div>
          </div>
        </div>

        <div className="dashboard-content">

          {/* ── Cuenta pendiente ── */}
          {!user?.is_approved && (
            <div className="pending-approval">
              <div className="pending-icon">⏳</div>
              <div>
                <h2 className="pending-title">Cuenta pendiente de aprobación</h2>
                <p className="pending-desc">
                  Un administrador está revisando tu solicitud de acceso. Te notificarán cuando tu cuenta sea activada.
                </p>
              </div>
              <div className="pending-actions">
                <button onClick={() => window.location.reload()} className="btn-verify">
                  🔄 Verificar estado
                </button>
                <button onClick={handleLogout} className="btn-logout-ghost">
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}

          {/* ── Vistas principales (solo aprobados) ── */}
          {user?.is_approved && (
            <>
              {/* ── Inicio ── */}
              {activeView === 'overview' && (
                <div>
                  {/* Cards de acceso rápido */}
                  <p className="quick-access-label">Acceso rápido</p>
                  <div className="feature-cards-grid">
                    {canViewDrive && (
                      <FeatureCard
                        icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" style={{ width: 24, height: 24 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>}
                        colorVariant="orange"
                        title="Mi Carpeta"
                        desc={user.drive_folder_name || 'Explorar carpeta asignada'}
                        onClick={() => navTo('mi-carpeta')}
                      />
                    )}
                    {canCreateFolders && (
                      <FeatureCard
                        icon={
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" style={{ width: 24, height: 24 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        }
                        iconBg="linear-gradient(135deg,#10b981,#059669)"
                        title="Crear carpetas"
                        desc={`Mi Carpeta (${structureFolderId})`}
                        accent="rgba(16,185,129,0.18)"
                        border="rgba(16,185,129,0.35)"
                        onClick={() => navTo('crear-carpetas')}
                      />
                    )}
                    <FeatureCard
                      icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" style={{ width: 24, height: 24 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                      colorVariant="indigo"
                      title="Validaciones"
                      desc={validationSummary ? `${validationSummary.total_validations} validaciones registradas` : 'Estado del material académico'}
                      onClick={() => navTo('validations')}
                    />
                    {isTeacher && (
                      <FeatureCard
                        icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" style={{ width: 24, height: 24 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /></svg>}
                        colorVariant="green"
                        title="Mi Curso"
                        desc="Historial de validaciones de tu materia"
                        onClick={() => { navTo('teacher'); if (!teacherSummary) loadTeacherSummary(); }}
                      />
                    )}
                    <FeatureCard
                      icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" style={{ width: 24, height: 24 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                      colorVariant="red"
                      title="Canal YouTube"
                      desc="Videos y tutoriales de COCOCYS"
                      href="https://www.youtube.com/@COCOCYSECYS"
                    />
                  </div>

                  {/* Perfil */}
                  <div className="profile-strip">
                    <div className="profile-strip-avatar">
                      {user?.nombre?.charAt(0)}{user?.apellidos?.charAt(0)}
                    </div>
                    <div className="profile-strip-info">
                      <p className="profile-strip-name">{user?.nombre} {user?.apellidos}</p>
                      <p className="profile-strip-email">{user?.correo}</p>
                      <div className="profile-strip-badges">
                        <span className="profile-badge active">✓ Activo</span>
                        {isTeacher && <span className="profile-badge teacher">🏫 Docente</span>}
                        {canViewDrive && <span className="profile-badge drive">📁 Drive</span>}
                      </div>
                    </div>
                    <p className="profile-strip-since">
                      Desde {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Mi Carpeta ── */}
              {activeView === 'mi-carpeta' && canViewDrive && (
                <div className="view-carpeta">
                  <div className="view-header">
                    <h2>📁 {user.drive_folder_name || 'Mi Carpeta'}</h2>
                    <p>Tu carpeta de Drive asignada por el administrador</p>
                  </div>
                  <DocumentAnalyzer
                    folderId={user.drive_folder_id}
                    folderName={user.drive_folder_name || 'Mi Carpeta'}
                    userPermissions={user?.permissions || {}}
                    isAdmin={false}
                  />
                </div>
              )}

              {/* ── Crear carpetas desde CSV ── */}
              {activeView === 'crear-carpetas' && canCreateFolders && (
                <CreateFoldersFromCsv />
              )}

              {/* ── Validaciones ── */}
              {activeView === 'validations' && (
                <div>
                  <div className="view-header">
                    <h2>Estado de Validaciones</h2>
                    <p>Cumplimiento del material académico validado por el equipo COCOCYS</p>
                  </div>

                  {summaryLoading ? (
                    <div className="view-loading">
                      <div className="spinner"></div>
                      <p className="m-0">Cargando validaciones...</p>
                    </div>
                  ) : !validationSummary || validationSummary.courses.length === 0 ? (
                    <div className="view-empty">
                      <div className="view-empty-icon">📋</div>
                      <p style={{ margin: 0 }}>Aún no hay validaciones registradas</p>
                    </div>
                  ) : (
                    <div>
                      {/* Summary chips */}
                      <div className="summary-chips">
                        {[
                          { label: 'Total validaciones', value: validationSummary.total_validations, cls: 'chip--info' },
                          { label: 'Cursos', value: validationSummary.courses.length, cls: 'chip--warning' },
                          { label: 'Cumplimiento avg', value: `${Math.round(validationSummary.courses.reduce((s, c) => s + c.avg_compliance, 0) / (validationSummary.courses.length || 1))}%`, cls: 'chip--success' },
                          { label: 'Cursos compliant', value: validationSummary.courses.filter(c => c.status === 'compliant').length, cls: 'chip--ok' },
                        ].map((chip, i) => (
                          <div key={i} className={`summary-chip ${chip.cls}`}>
                            <span className="summary-chip-value">{chip.value}</span>
                            <span className="summary-chip-label">{chip.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Course accordion */}
                      <div className="courses-accordion">
                        {validationSummary.courses.map((course, idx) => (
                          <div key={idx} className="course-card">
                            <button className="course-toggle" onClick={() => setExpandedCourse(expandedCourse === idx ? null : idx)}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="course-name">📚 {course.course_name}</div>
                                <div className="course-meta">
                                  {course.total_weeks} semana(s) · {course.total_validations} validaciones
                                  {course.last_validated && ` · Última: ${new Date(course.last_validated).toLocaleDateString('es-ES')}`}
                                </div>
                              </div>
                              <div className="course-progress">
                                <div className="progress-bar-wrap">
                                  <div className={`progress-bar-fill fill--${ccls(course.avg_compliance)}`} style={{ width: `${course.avg_compliance}%` }} />
                                </div>
                                <span className={`progress-pct text-${ccls(course.avg_compliance)}`}>
                                  {course.avg_compliance}%
                                </span>
                                <svg className={`chevron-icon ${expandedCourse === idx ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </button>

                            {expandedCourse === idx && (
                              <div className="course-weeks">
                                {course.weeks.map((w, widx) => (
                                  <div key={widx} className="week-row">
                                    <div className="week-name">{w.week}</div>
                                    <div className="week-progress">
                                      <div className={`progress-bar-fill fill--${ccls(w.avg_compliance)}`} style={{ width: `${w.avg_compliance}%`, height: '100%', borderRadius: '999px', transition: 'width 0.5s ease' }} />
                                    </div>
                                    <span className={`week-pct text-${ccls(w.avg_compliance)}`}>{w.avg_compliance}%</span>
                                    <span className={`week-status-badge status-badge status-badge--${w.status === 'compliant' ? 'compliant' : w.status === 'partial' ? 'partial' : 'absent'}`}>
                                      {w.status === 'compliant' ? '✓' : w.status === 'partial' ? '~' : '✗'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Mi Curso (docente) ── */}
              {activeView === 'teacher' && isTeacher && (
                <div className="teacher-charts">
                  <div className="view-header">
                    <h2>Mi Curso — Estado de Validaciones</h2>
                    <p>Resultados de validación del material académico de tu carpeta asignada</p>
                  </div>

                  {teacherLoading ? (
                    <div className="view-loading">
                      <div className="spinner"></div>
                      <p className="m-0">Cargando datos de tu curso...</p>
                    </div>
                  ) : !teacherSummary || !teacherSummary.has_folder ? (
                    <div className="view-empty">
                      <div className="view-empty-icon">🏫</div>
                      <p style={{ margin: '0 0 4px' }}>No tienes una carpeta de Drive asignada.</p>
                      <p className="m-0" style={{ fontSize: '0.85rem' }}>Contacta al administrador para configurarla.</p>
                    </div>
                  ) : (
                    <>
                      {/* Resumen chips */}
                      <div className="summary-chips">
                        {[
                          { label: 'Total validaciones', value: teacherSummary.total, cls: 'chip--info' },
                          { label: 'Cumplimiento avg', value: `${teacherSummary.avg_compliance}%`, cls: `chip--${ccls(teacherSummary.avg_compliance)}` },
                          { label: 'Semanas', value: teacherSummary.by_week?.length || 0, cls: 'chip--warning' },
                        ].map((chip, i) => (
                          <div key={i} className={`summary-chip ${chip.cls}`}>
                            <span className="summary-chip-value">{chip.value}</span>
                            <span className="summary-chip-label">{chip.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Semanas */}
                      {teacherSummary.by_week?.length > 0 && (
                        <div className="chart-card">
                          <h3>Cumplimiento por Semana</h3>
                          <div className="flex-col-gap">
                            {teacherSummary.by_week.map((w, i) => (
                              <div key={i} className="week-row">
                                <div className="week-name">{w.week}</div>
                                <div className="week-progress">
                                  <div className={`progress-bar-fill fill--${ccls(w.avg_compliance)}`} style={{ width: `${w.avg_compliance}%`, height: '100%', borderRadius: '999px', transition: 'width 0.5s ease' }} />
                                </div>
                                <span className={`week-pct text-${ccls(w.avg_compliance)}`}>{w.avg_compliance}%</span>
                                <span className={`week-status-badge status-badge status-badge--${w.status === 'compliant' ? 'compliant' : w.status === 'partial' ? 'partial' : 'absent'}`}>
                                  {w.status === 'compliant' ? '✓ Cumple' : w.status === 'partial' ? '~ Parcial' : '✗ Bajo'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recientes */}
                      {teacherSummary.recent?.length > 0 && (
                        <div className="chart-card">
                          <h3>Validaciones Recientes</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {teacherSummary.recent.map((r, i) => (
                              <div key={i} className="recent-row">
                                <span className={`recent-type-badge status-badge ${r.validation_type === 'structure' ? 'status-badge--structure' : 'status-badge--content'}`}>
                                  {r.validation_type === 'structure' ? '📋 Estructura' : '🧠 Contenido'}
                                </span>
                                <span className="recent-name">{r.folder_name}</span>
                                <span className={`recent-pct text-${ccls(r.compliance_percentage)}`}>
                                  {r.compliance_percentage?.toFixed(1)}%
                                </span>
                                <span className="recent-date">
                                  {r.created_at ? new Date(r.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {/* ── Mi Historial ── */}
              {activeView === 'history' && (
                <div className="history-view">
                  <div className="view-header">
                    <h2>Mi Historial de Análisis</h2>
                    <p>Todos los análisis y validaciones que has ejecutado en el sistema</p>
                  </div>

                  {historyLoading && !myHistory && (
                    <div className="loading-state"><div className="spinner"></div><p>Cargando historial...</p></div>
                  )}

                  {myHistory && (
                    <>
                      {myHistory.records?.length === 0 ? (
                        <div className="history-empty">
                          <div className="history-empty-icon">📋</div>
                          <p>Aún no has ejecutado ningún análisis o validación.</p>
                        </div>
                      ) : (
                        <>
                          <div className="history-table-wrap">
                            <table className="history-table">
                              <thead>
                                <tr>
                                  <th>Fecha</th>
                                  <th>Tipo</th>
                                  <th>Analizado</th>
                                  <th>Proveedor</th>
                                  <th>Origen key</th>
                                  <th>Resultado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {myHistory.records.map(r => {
                                  const typeLabels = {
                                    document: { label: 'Documento', cls: 'content', icon: '📄' },
                                    structure: { label: 'Estructura', cls: 'structure', icon: '📋' },
                                    content: { label: 'Contenido', cls: 'content', icon: '🧠' },
                                    course: { label: 'Curso', cls: 'structure', icon: '🏫' },
                                  };
                                  const providerLabels = {
                                    gemini: { label: 'Gemini', color: '#4285f4' },
                                    deepseek: { label: 'DeepSeek', color: '#7c3aed' },
                                    groq: { label: 'Groq', color: '#059669' },
                                    openrouter: { label: 'OpenRouter', color: '#d97706' },
                                    basic: { label: 'Básico', color: '#6b7280' },
                                    none: { label: '—', color: '#6b7280' },
                                  };
                                  const sourceLabels = {
                                    personal: { label: 'Personal', cls: 'success' },
                                    admin: { label: 'Admin', cls: 'warning' },
                                    env: { label: 'Sistema', cls: 'info' },
                                    none: { label: '—', cls: '' },
                                  };
                                  const t = typeLabels[r.analysis_type] || { label: r.analysis_type, cls: '', icon: '🔍' };
                                  const prov = providerLabels[r.provider] || providerLabels.basic;
                                  const src = sourceLabels[r.key_source] || sourceLabels.none;
                                  return (
                                    <tr key={r.id}>
                                      <td className="history-date">
                                        {new Date(r.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </td>
                                      <td>
                                        <span className={`status-badge status-badge--${t.cls}`}>
                                          {t.icon} {t.label}
                                        </span>
                                      </td>
                                      <td className="history-folder">
                                        <span className="history-folder-name">{r.analyzed_what}</span>
                                        {r.course_name && r.analysis_type !== 'course' && (
                                          <span className="history-section">{r.course_name}</span>
                                        )}
                                      </td>
                                      <td>
                                        <span style={{ fontWeight: 600, color: prov.color, fontSize: '0.82rem' }}>
                                          {prov.label}
                                        </span>
                                      </td>
                                      <td>
                                        {src.label !== '—' ? (
                                          <span className={`status-badge ${src.cls}`} style={{ fontSize: '0.75rem' }}>
                                            {src.label}
                                          </span>
                                        ) : <span style={{ color: '#9ca3af' }}>—</span>}
                                      </td>
                                      <td>
                                        {r.analysis_type === 'document' && r.score != null ? (
                                          <span className={`history-pct history-pct--${r.score >= 70 ? 'success' : r.score >= 40 ? 'warning' : 'danger'}`}>
                                            {r.score.toFixed(0)}/100
                                          </span>
                                        ) : (
                                          <span className={`status-badge ${r.status === 'completed' ? 'success' : 'danger'}`}>
                                            {r.status === 'completed' ? '✓' : '✗'}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Paginación */}
                          {myHistory.total > HISTORY_PAGE_SIZE && (
                            <div className="history-pagination">
                              <button
                                className="history-page-btn"
                                disabled={historyPage === 0 || historyLoading}
                                onClick={() => loadMyHistory(historyPage - 1)}
                              >← Anterior</button>
                              <span className="history-page-info">
                                {historyPage + 1} / {Math.ceil(myHistory.total / HISTORY_PAGE_SIZE)}
                              </span>
                              <button
                                className="history-page-btn"
                                disabled={(historyPage + 1) * HISTORY_PAGE_SIZE >= myHistory.total || historyLoading}
                                onClick={() => loadMyHistory(historyPage + 1)}
                              >Siguiente →</button>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Mi Perfil ── */}
              {activeView === 'profile' && (
                <div className="profile-view">
                  <div className="view-header">
                    <h2>Mi Perfil</h2>
                    <p>Información de tu cuenta y permisos asignados</p>
                  </div>

                  {/* Account card */}
                  <div className="profile-account-card">
                    <div className="profile-account-avatar">
                      {user?.nombre?.charAt(0)}{user?.apellidos?.charAt(0)}
                    </div>
                    <div className="profile-account-info">
                      <h3>{user?.nombre} {user?.apellidos}</h3>
                      <p>{user?.correo}</p>
                      <div className="profile-account-badges">
                        <span className="profile-badge active">✓ Cuenta activa</span>
                        {isTeacher && <span className="profile-badge teacher">🏫 Docente</span>}
                        {user?.is_approved && <span className="profile-badge approved">✓ Aprobado</span>}
                      </div>
                    </div>
                    <div className="profile-account-since">
                      <span className="profile-account-since-label">Miembro desde</span>
                      <span className="profile-account-since-value">
                        {user?.created_at
                          ? new Date(user.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Permissions card */}
                  <div className="profile-permissions-card">
                    <h3 className="profile-section-title">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Permisos y Accesos
                    </h3>
                    <div className="profile-permissions-grid">
                      {[
                        {
                          key: 'can_view_drive',
                          icon: '📁',
                          label: 'Explorador de Drive',
                          desc: 'Navegar por la carpeta asignada',
                          granted: !!user?.permissions?.can_view_drive,
                        },
                        {
                          key: 'can_analyze',
                          icon: '🔍',
                          label: 'Analizar Documentos',
                          desc: 'Analizar archivos individuales con IA',
                          granted: !!user?.permissions?.can_analyze,
                        },
                        {
                          key: 'can_validate_structure',
                          icon: '📋',
                          label: 'Validar Estructura',
                          desc: 'Verificar estructura de carpetas y archivos',
                          granted: !!user?.permissions?.can_validate_structure,
                        },
                        {
                          key: 'can_validate_content',
                          icon: '🧠',
                          label: 'Validar Contenido (IA)',
                          desc: 'Análisis profundo con inteligencia artificial',
                          granted: !!user?.permissions?.can_validate_content,
                        },
                      ].map(({ icon, label, desc, granted }) => (
                        <div key={label} className={`permission-item ${granted ? 'granted' : 'denied'}`}>
                          <div className="permission-item-icon">{icon}</div>
                          <div className="permission-item-info">
                            <span className="permission-item-label">{label}</span>
                            <span className="permission-item-desc">{desc}</span>
                          </div>
                          <div className={`permission-item-status ${granted ? 'granted' : 'denied'}`}>
                            {granted ? '✓' : '✗'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {!Object.values(user?.permissions || {}).some(Boolean) && (
                      <p className="profile-no-perms">
                        Aún no tienes permisos asignados. Contacta al administrador para solicitar acceso.
                      </p>
                    )}
                  </div>

                  {/* Drive folder card */}
                  {user?.drive_folder_id && (
                    <div className="profile-drive-card">
                      <h3 className="profile-section-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        Carpeta Asignada
                      </h3>
                      <div className="profile-drive-info">
                        <div className="profile-drive-icon">📁</div>
                        <div>
                          <p className="profile-drive-name">{user.drive_folder_name || 'Carpeta sin nombre'}</p>
                          <p className="profile-drive-id">ID: {user.drive_folder_id}</p>
                        </div>
                        {canViewDrive && (
                          <button className="profile-drive-btn" onClick={() => navTo('mi-carpeta')}>
                            Abrir carpeta →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* API Keys personales */}
                  {user?.permissions?.can_validate_content && (
                    <div className="profile-apikeys-card">
                      <h3 className="profile-section-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        Mis API Keys
                      </h3>
                      <p className="profile-apikeys-desc">
                        Agrega tus propias API keys para que tus análisis usen tu cuota personal.
                        Si tienes keys aquí, tus validaciones <strong>no consumen</strong> las keys del sistema.
                        Solo se muestran los primeros 8 caracteres.
                      </p>
                      <div className="profile-apikeys-grid">
                        {[
                          { provider: 'gemini',      label: 'Gemini',      color: '#4285F4', hint: 'Múltiples keys se rotan automáticamente' },
                          { provider: 'deepseek',    label: 'DeepSeek',    color: '#ff8c42', hint: 'Primera key disponible' },
                          { provider: 'groq',        label: 'Groq',        color: '#F55036', hint: 'Llama 3 — alta velocidad' },
                          { provider: 'openrouter',  label: 'OpenRouter',  color: '#7C3AED', hint: 'Acceso a múltiples modelos gratuitos' },
                        ].map(({ provider, label, color, hint }) => {
                          const info = personalKeys?.[provider];
                          const keys = info?.keys || [];
                          return (
                            <div key={provider} className="profile-apikey-card">
                              <div className="profile-apikey-header" style={{ borderLeftColor: color }}>
                                <span className="profile-apikey-label" style={{ color }}>{label}</span>
                                <span className="profile-apikey-count">{info?.key_count ?? 0} key{(info?.key_count ?? 0) !== 1 ? 's' : ''}</span>
                              </div>
                              <p className="profile-apikey-hint">{hint}</p>
                              {keys.length > 0 && (
                                <div className="profile-apikey-list">
                                  {keys.map((k, i) => (
                                    <div key={i} className="profile-apikey-chip">
                                      <code className="profile-apikey-value">{k}</code>
                                      <button
                                        className="profile-apikey-remove"
                                        disabled={!!keyLoading[`${provider}_${i}`]}
                                        onClick={() => removePersonalKey(provider, i)}
                                        title="Eliminar"
                                      >
                                        {keyLoading[`${provider}_${i}`] ? '⏳' : '×'}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="profile-apikey-add-row">
                                <input
                                  type="password"
                                  className="profile-apikey-input"
                                  placeholder="Pegar API key..."
                                  value={newPersonalKey[provider]}
                                  onChange={e => setNewPersonalKey(prev => ({ ...prev, [provider]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') addPersonalKey(provider); }}
                                />
                                <button
                                  className="profile-apikey-add-btn"
                                  disabled={!newPersonalKey[provider]?.trim() || !!keyLoading[provider]}
                                  onClick={() => addPersonalKey(provider)}
                                  style={{ background: color }}
                                >
                                  {keyLoading[provider] ? '⏳' : '+ Agregar'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

/* Componente interno reutilizable */
const FeatureCard = ({ icon, iconBg, title, desc, accent, border, onClick, href, colorVariant }) => {
  const cardCls = `feature-card${colorVariant ? ` feature-card--${colorVariant}` : ''}`;
  const iconCls = `feature-card-icon${colorVariant ? ` feature-card-icon--${colorVariant}` : ''}`;
  const cardStyle = colorVariant ? {} : {
    ...(accent ? { background: `linear-gradient(135deg, ${accent}, transparent)` } : {}),
    ...(border ? { borderColor: border } : {}),
  };
  const iconStyle = colorVariant ? {} : (iconBg ? { background: iconBg } : {});

  const inner = (
    <>
      <div className={iconCls} style={iconStyle}>{icon}</div>
      <p className="feature-card-title">{title}</p>
      <p className="feature-card-desc">{desc}</p>
    </>
  );

  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={cardCls} style={cardStyle}>{inner}</a>;
  }
  return <button className={cardCls} style={cardStyle} onClick={onClick}>{inner}</button>;
};

export default Dashboard;
