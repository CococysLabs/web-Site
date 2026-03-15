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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', gap: '1.5rem' }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                ⏳
              </div>
              <div>
                <h2 style={{ margin: '0 0 0.6rem', fontSize: '1.5rem' }}>Cuenta pendiente de aprobación</h2>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', maxWidth: '400px', lineHeight: 1.7, fontSize: '0.95rem' }}>
                  Un administrador está revisando tu solicitud de acceso. Te notificarán cuando tu cuenta sea activada.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => window.location.reload()}
                  style={{ padding: '10px 20px', borderRadius: '10px', background: 'rgba(255,140,66,0.1)', border: '1.5px solid rgba(255,140,66,0.4)', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}
                >
                  🔄 Verificar estado
                </button>
                <button
                  onClick={handleLogout}
                  style={{ padding: '10px 20px', borderRadius: '10px', background: 'transparent', border: '1.5px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontWeight: 500, fontSize: '0.9rem' }}
                >
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
                  <div style={{ marginBottom: '0.75rem' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Acceso rápido</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
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
                  <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '12px', background: 'linear-gradient(135deg,var(--color-primary),var(--color-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.3rem', flexShrink: 0 }}>
                      {user?.nombre?.charAt(0)}{user?.apellidos?.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: '1rem' }}>{user?.nombre} {user?.apellidos}</p>
                      <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>{user?.correo}</p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>✓ Activo</span>
                        {isTeacher && <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>🏫 Docente</span>}
                        {canViewDrive && <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(255,140,66,0.12)', color: '#ff8c42', border: '1px solid rgba(255,140,66,0.25)' }}>📁 Drive</span>}
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.77rem', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                      Desde {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Mi Carpeta ── */}
              {activeView === 'mi-carpeta' && canViewDrive && (
                <div style={{ paddingBottom: '2rem' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0 }}>📁 {user.drive_folder_name || 'Mi Carpeta'}</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                      Tu carpeta de Drive asignada por el administrador
                    </p>
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
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0 }}>Estado de Validaciones</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                      Cumplimiento del material académico validado por el equipo COCOCYS
                    </p>
                  </div>

                  {summaryLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0', gap: '1rem', color: 'var(--color-text-secondary)' }}>
                      <div className="spinner" style={{ width: 36, height: 36 }}></div>
                      <p style={{ margin: 0 }}>Cargando validaciones...</p>
                    </div>
                  ) : !validationSummary || validationSummary.courses.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--color-text-secondary)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                      <p style={{ margin: 0 }}>Aún no hay validaciones registradas</p>
                    </div>
                  ) : (
                    <div>
                      {/* Summary chips */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                        {[
                          { label: 'Total validaciones', value: validationSummary.total_validations, color: '#6366f1' },
                          { label: 'Cursos', value: validationSummary.courses.length, color: '#f59e0b' },
                          { label: 'Cumplimiento avg', value: `${Math.round(validationSummary.courses.reduce((s, c) => s + c.avg_compliance, 0) / (validationSummary.courses.length || 1))}%`, color: '#10b981' },
                          { label: 'Cursos compliant', value: validationSummary.courses.filter(c => c.status === 'compliant').length, color: '#22c55e' },
                        ].map((chip, i) => (
                          <div key={i} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: '120px' }}>
                            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: chip.color }}>{chip.value}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{chip.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Course accordion */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {validationSummary.courses.map((course, idx) => (
                          <div key={idx} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '14px', overflow: 'hidden' }}>
                            <button
                              onClick={() => setExpandedCourse(expandedCourse === idx ? null : idx)}
                              style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  📚 {course.course_name}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                                  {course.total_weeks} semana(s) · {course.total_validations} validaciones
                                  {course.last_validated && ` · Última: ${new Date(course.last_validated).toLocaleDateString('es-ES')}`}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                <div style={{ width: 90, height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                                  <div style={{ width: `${course.avg_compliance}%`, height: '100%', borderRadius: '999px', background: course.avg_compliance >= 70 ? '#10b981' : course.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' }} />
                                </div>
                                <span style={{ fontWeight: 700, minWidth: 38, fontSize: '0.875rem', color: course.avg_compliance >= 70 ? '#10b981' : course.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' }}>
                                  {course.avg_compliance}%
                                </span>
                                <svg style={{ width: 16, height: 16, color: 'var(--color-text-secondary)', transform: expandedCourse === idx ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </button>

                            {expandedCourse === idx && (
                              <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 20px 16px' }}>
                                {course.weeks.map((w, widx) => (
                                  <div key={widx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '7px 0' }}>
                                    <div style={{ width: '110px', fontSize: '0.82rem', fontWeight: 500, color: 'var(--color-text-primary)', flexShrink: 0 }}>{w.week}</div>
                                    <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                                      <div style={{ width: `${w.avg_compliance}%`, height: '100%', borderRadius: '999px', background: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.5s ease' }} />
                                    </div>
                                    <span style={{ minWidth: 38, textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, flexShrink: 0, color: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' }}>
                                      {w.avg_compliance}%
                                    </span>
                                    <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0, background: w.status === 'compliant' ? 'rgba(16,185,129,0.12)' : w.status === 'partial' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', color: w.status === 'compliant' ? '#34d399' : w.status === 'partial' ? '#fbbf24' : '#f87171' }}>
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
                <div style={{ paddingBottom: '2rem' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0 }}>Mi Curso — Estado de Validaciones</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                      Resultados de validación del material académico de tu carpeta asignada
                    </p>
                  </div>

                  {teacherLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0', gap: '1rem', color: 'var(--color-text-secondary)' }}>
                      <div className="spinner" style={{ width: 36, height: 36 }}></div>
                      <p style={{ margin: 0 }}>Cargando datos de tu curso...</p>
                    </div>
                  ) : !teacherSummary || !teacherSummary.has_folder ? (
                    <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--color-text-secondary)' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏫</div>
                      <p style={{ margin: '0 0 4px' }}>No tienes una carpeta de Drive asignada.</p>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>Contacta al administrador para configurarla.</p>
                    </div>
                  ) : (
                    <>
                      {/* Resumen chips */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                        {[
                          { label: 'Total validaciones', value: teacherSummary.total, color: '#6366f1' },
                          { label: 'Cumplimiento avg', value: `${teacherSummary.avg_compliance}%`, color: teacherSummary.avg_compliance >= 70 ? '#10b981' : teacherSummary.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' },
                          { label: 'Semanas', value: teacherSummary.by_week?.length || 0, color: '#f59e0b' },
                        ].map((chip, i) => (
                          <div key={i} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: '120px' }}>
                            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: chip.color }}>{chip.value}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{chip.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Semanas */}
                      {teacherSummary.by_week?.length > 0 && (
                        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 600 }}>Cumplimiento por Semana</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {teacherSummary.by_week.map((w, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '110px', fontSize: '0.82rem', fontWeight: 500, flexShrink: 0 }}>{w.week}</div>
                                <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                                  <div style={{ width: `${w.avg_compliance}%`, height: '100%', borderRadius: '999px', background: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.5s ease' }} />
                                </div>
                                <span style={{ minWidth: 38, textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, flexShrink: 0, color: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' }}>
                                  {w.avg_compliance}%
                                </span>
                                <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0, background: w.status === 'compliant' ? 'rgba(16,185,129,0.12)' : w.status === 'partial' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', color: w.status === 'compliant' ? '#34d399' : w.status === 'partial' ? '#fbbf24' : '#f87171' }}>
                                  {w.status === 'compliant' ? '✓ Cumple' : w.status === 'partial' ? '~ Parcial' : '✗ Bajo'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recientes */}
                      {teacherSummary.recent?.length > 0 && (
                        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '1.25rem' }}>
                          <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 600 }}>Validaciones Recientes</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {teacherSummary.recent.map((r, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: i < teacherSummary.recent.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600, flexShrink: 0, background: r.validation_type === 'structure' ? 'rgba(139,92,246,0.15)' : 'rgba(16,185,129,0.15)', color: r.validation_type === 'structure' ? '#a78bfa' : '#34d399' }}>
                                  {r.validation_type === 'structure' ? '📋 Estructura' : '🧠 Contenido'}
                                </span>
                                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.folder_name}</span>
                                <span style={{ fontWeight: 700, fontSize: '0.875rem', flexShrink: 0, color: r.compliance_percentage >= 70 ? '#10b981' : r.compliance_percentage >= 40 ? '#f59e0b' : '#ef4444' }}>
                                  {r.compliance_percentage?.toFixed(1)}%
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
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
  const [hovered, setHovered] = useState(false);
  const style = {
    background: accent ? `linear-gradient(135deg, ${accent}, transparent)` : 'var(--color-bg-card)',
    border: `1.5px solid ${border || 'var(--color-border)'}`,
    borderRadius: '16px',
    padding: '1.35rem',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'transform 0.22s ease, box-shadow 0.22s ease',
    display: 'block',
    textDecoration: 'none',
    color: 'inherit',
    transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
    boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
    width: '100%',
    fontFamily: 'inherit',
  };

  const inner = (
    <>
      <div style={{ width: 46, height: 46, borderRadius: '12px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
        {icon}
      </div>
      <p style={{ margin: '0 0 5px', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</p>
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{desc}</p>
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" style={style}
        onMouseOver={() => setHovered(true)} onMouseOut={() => setHovered(false)}>
        {inner}
      </a>
    );
  }

  return (
    <button style={style} onClick={onClick}
      onMouseOver={() => setHovered(true)} onMouseOut={() => setHovered(false)}>
      {inner}
    </button>
  );
};

export default Dashboard;
