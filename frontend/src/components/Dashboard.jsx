import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../services/api';
import DocumentAnalyzer from './admin/DocumentAnalyzer';
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

  const [teacherSummary, setTeacherSummary] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);

  const isTeacher = user?.is_teacher;
  const canViewDrive = user?.permissions?.can_view_drive && user?.drive_folder_id;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    if (user?.is_approved) {
      loadValidationSummary();
      if (isTeacher) loadTeacherSummary();
    }
    return () => clearInterval(timer);
  }, [isTeacher, user?.is_approved]);

  const loadTeacherSummary = async () => {
    try {
      setTeacherLoading(true);
      const res = await api.get('/api/validation/teacher-summary');
      setTeacherSummary(res.data);
    } catch (err) {
      console.error('Error loading teacher summary:', err);
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

  const formatTime = (date) =>
    date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatDate = (date) =>
    date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const navTo = (view) => { setActiveView(view); setSidebarOpen(false); };

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

          <button className={`nav-item ${activeView === 'validations' ? 'active' : ''}`} onClick={() => navTo('validations')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Validaciones</span>
            {validationSummary?.total_validations > 0 && (
              <span className="nav-badge">{validationSummary.total_validations}</span>
            )}
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
                        iconBg="linear-gradient(135deg,#ff8c42,#e57a32)"
                        title="Mi Carpeta"
                        desc={user.drive_folder_name || 'Explorar carpeta asignada'}
                        accent="rgba(255,140,66,0.18)"
                        border="rgba(255,140,66,0.35)"
                        onClick={() => navTo('mi-carpeta')}
                      />
                    )}
                    <FeatureCard
                      icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" style={{ width: 24, height: 24 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                      iconBg="linear-gradient(135deg,#6366f1,#4f46e5)"
                      title="Validaciones"
                      desc={validationSummary ? `${validationSummary.total_validations} validaciones registradas` : 'Estado del material académico'}
                      onClick={() => navTo('validations')}
                    />
                    {isTeacher && (
                      <FeatureCard
                        icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" style={{ width: 24, height: 24 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" /></svg>}
                        iconBg="linear-gradient(135deg,#10b981,#059669)"
                        title="Mi Curso"
                        desc="Historial de validaciones de tu materia"
                        onClick={() => { navTo('teacher'); if (!teacherSummary) loadTeacherSummary(); }}
                      />
                    )}
                    <FeatureCard
                      icon={<svg viewBox="0 0 24 24" fill="none" stroke="white" style={{ width: 24, height: 24 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                      iconBg="linear-gradient(135deg,#ef4444,#dc2626)"
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
                    userPermissions={user.permissions}
                  />
                </div>
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
                      <div className="spinner" style={{ width: 36, height: 36 }}></div>
                      <p style={{ margin: 0 }}>Cargando validaciones...</p>
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
                          { label: 'Total validaciones', value: validationSummary.total_validations, color: '#6366f1' },
                          { label: 'Cursos', value: validationSummary.courses.length, color: '#f59e0b' },
                          { label: 'Cumplimiento avg', value: `${Math.round(validationSummary.courses.reduce((s, c) => s + c.avg_compliance, 0) / (validationSummary.courses.length || 1))}%`, color: '#10b981' },
                          { label: 'Cursos compliant', value: validationSummary.courses.filter(c => c.status === 'compliant').length, color: '#22c55e' },
                        ].map((chip, i) => (
                          <div key={i} className="summary-chip">
                            <span className="summary-chip-value" style={{ color: chip.color }}>{chip.value}</span>
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
                                  <div className="progress-bar-fill" style={{ width: `${course.avg_compliance}%`, background: course.avg_compliance >= 70 ? '#10b981' : course.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' }} />
                                </div>
                                <span className="progress-pct" style={{ color: course.avg_compliance >= 70 ? '#10b981' : course.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' }}>
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
                                      <div className="progress-bar-fill" style={{ width: `${w.avg_compliance}%`, height: '100%', borderRadius: '999px', background: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.5s ease' }} />
                                    </div>
                                    <span className="week-pct" style={{ color: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' }}>
                                      {w.avg_compliance}%
                                    </span>
                                    <span className="week-status-badge" style={{ background: w.status === 'compliant' ? 'rgba(16,185,129,0.12)' : w.status === 'partial' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', color: w.status === 'compliant' ? '#34d399' : w.status === 'partial' ? '#fbbf24' : '#f87171' }}>
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
                      <div className="spinner" style={{ width: 36, height: 36 }}></div>
                      <p style={{ margin: 0 }}>Cargando datos de tu curso...</p>
                    </div>
                  ) : !teacherSummary || !teacherSummary.has_folder ? (
                    <div className="view-empty">
                      <div className="view-empty-icon">🏫</div>
                      <p style={{ margin: '0 0 4px' }}>No tienes una carpeta de Drive asignada.</p>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>Contacta al administrador para configurarla.</p>
                    </div>
                  ) : (
                    <>
                      {/* Resumen chips */}
                      <div className="summary-chips">
                        {[
                          { label: 'Total validaciones', value: teacherSummary.total, color: '#6366f1' },
                          { label: 'Cumplimiento avg', value: `${teacherSummary.avg_compliance}%`, color: teacherSummary.avg_compliance >= 70 ? '#10b981' : teacherSummary.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' },
                          { label: 'Semanas', value: teacherSummary.by_week?.length || 0, color: '#f59e0b' },
                        ].map((chip, i) => (
                          <div key={i} className="summary-chip">
                            <span className="summary-chip-value" style={{ color: chip.color }}>{chip.value}</span>
                            <span className="summary-chip-label">{chip.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Semanas */}
                      {teacherSummary.by_week?.length > 0 && (
                        <div className="chart-card">
                          <h3>Cumplimiento por Semana</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {teacherSummary.by_week.map((w, i) => (
                              <div key={i} className="week-row">
                                <div className="week-name">{w.week}</div>
                                <div className="week-progress">
                                  <div className="progress-bar-fill" style={{ width: `${w.avg_compliance}%`, height: '100%', borderRadius: '999px', background: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.5s ease' }} />
                                </div>
                                <span className="week-pct" style={{ color: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' }}>
                                  {w.avg_compliance}%
                                </span>
                                <span className="week-status-badge" style={{ background: w.status === 'compliant' ? 'rgba(16,185,129,0.12)' : w.status === 'partial' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', color: w.status === 'compliant' ? '#34d399' : w.status === 'partial' ? '#fbbf24' : '#f87171' }}>
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
                                <span className="recent-type-badge" style={{ background: r.validation_type === 'structure' ? 'rgba(139,92,246,0.15)' : 'rgba(16,185,129,0.15)', color: r.validation_type === 'structure' ? '#a78bfa' : '#34d399' }}>
                                  {r.validation_type === 'structure' ? '📋 Estructura' : '🧠 Contenido'}
                                </span>
                                <span className="recent-name">{r.folder_name}</span>
                                <span className="recent-pct" style={{ color: r.compliance_percentage >= 70 ? '#10b981' : r.compliance_percentage >= 40 ? '#f59e0b' : '#ef4444' }}>
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
            </>
          )}
        </div>
      </main>
    </div>
  );
};

/* Componente interno reutilizable */
const FeatureCard = ({ icon, iconBg, title, desc, accent, border, onClick, href }) => {
  const cardStyle = {
    ...(accent ? { background: `linear-gradient(135deg, ${accent}, transparent)` } : {}),
    ...(border ? { borderColor: border } : {}),
  };

  const inner = (
    <>
      <div className="feature-card-icon" style={{ background: iconBg }}>{icon}</div>
      <p className="feature-card-title">{title}</p>
      <p className="feature-card-desc">{desc}</p>
    </>
  );

  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="feature-card" style={cardStyle}>{inner}</a>;
  }
  return <button className="feature-card" style={cardStyle} onClick={onClick}>{inner}</button>;
};

export default Dashboard;
