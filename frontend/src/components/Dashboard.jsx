import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('overview');

  // Validación pública
  const [validationSummary, setValidationSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState(null);

  // Vista docente
  const [teacherSummary, setTeacherSummary] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);

  const isTeacher = user?.is_teacher;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadDocuments();
    loadValidationSummary();
    if (isTeacher) loadTeacherSummary();
    return () => clearInterval(timer);
  }, [isTeacher]);

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

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/documents/');
      setDocuments(response.data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
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

  const formatDate = (date) => {
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const stats = [
    { 
      id: 1, 
      label: 'Documentos Disponibles', 
      value: documents.length.toString(), 
      icon: '📄',
      color: '#6366f1',
      trend: `${documents.length} total`
    },
    { 
      id: 2, 
      label: 'Documentos Válidos', 
      value: documents.filter(d => d.is_valid).length.toString(), 
      icon: '✅',
      color: '#22c55e',
      trend: 'Aprobados'
    },
    { 
      id: 3, 
      label: 'En Análisis', 
      value: documents.filter(d => d.status === 'analyzing').length.toString(), 
      icon: '🔍',
      color: '#f59e0b',
      trend: 'Procesando'
    },
    { 
      id: 4, 
      label: 'Mi Estado', 
      value: user?.is_approved ? 'Aprobado' : 'Pendiente', 
      icon: user?.is_approved ? '✓' : '⏳',
      color: user?.is_approved ? '#22c55e' : '#f59e0b',
      trend: user?.role === 'student' ? 'Estudiante' : 'Usuario'
    }
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'welcome',
      title: user?.is_approved ? '¡Cuenta Aprobada!' : 'Cuenta Pendiente de Aprobación',
      description: user?.is_approved 
        ? 'Tu cuenta ha sido aprobada. Puedes acceder a todos los documentos disponibles.'
        : 'Un administrador está revisando tu solicitud. Te notificaremos cuando sea aprobada.',
      time: 'Hoy',
      icon: user?.is_approved ? '✅' : '⏳',
    },
    ...documents.slice(0, 3).map((doc, idx) => ({
      id: idx + 2,
      type: 'document',
      title: doc.name,
      description: doc.is_valid ? 'Documento validado' : 'Pendiente de validación',
      time: new Date(doc.created_at).toLocaleDateString(),
      icon: doc.is_valid ? '✓' : '📄',
    }))
  ];

  const quickActions = [
    {
      id: 1,
      title: 'Ver Recursos',
      description: 'Explorar materiales',
      icon: '📚',
      color: '#f97316',
      action: () => navigate('/'),
    },
    {
      id: 2,
      title: 'Canal YouTube',
      description: 'Videos y tutoriales',
      icon: '▶️',
      color: '#f59e0b',
      action: () => window.open('https://www.youtube.com/@COCOCYSECYS', '_blank'),
    },
    {
      id: 3,
      title: 'GitHub COCOCYS',
      description: 'Código fuente',
      icon: '💻',
      color: '#fbbf24',
      action: () => window.open('https://github.com/CococysLabs', '_blank'),
    },
  ];

  return (
    <div className="dashboard-container">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="gradient-text">COCOCYS</h1>
          <p className="sidebar-subtitle">Sistema de Análisis IA</p>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveView('overview')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </button>
          <button
            className={`nav-item ${activeView === 'validations' ? 'active' : ''}`}
            onClick={() => setActiveView('validations')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Validaciones</span>
            {validationSummary?.total_validations > 0 && (
              <span className="nav-badge">{validationSummary.total_validations}</span>
            )}
          </button>
          {isTeacher && (
            <button
              className={`nav-item ${activeView === 'teacher' ? 'active' : ''}`}
              onClick={() => { setActiveView('teacher'); if (!teacherSummary) loadTeacherSummary(); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
              <span>Mi Curso</span>
            </button>
          )}
          <button className="nav-item" onClick={() => window.open('https://www.youtube.com/@COCOCYSECYS', '_blank')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>YouTube</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {user?.nombre?.charAt(0)}{user?.apellidos?.charAt(0)}
            </div>
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

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-header">
          <div className="header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                className="hamburger-btn"
                onClick={() => setSidebarOpen(o => !o)}
                aria-label="Abrir menú"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h2>Bienvenido, {user?.nombre}! 👋</h2>
                <p className="header-subtitle">{formatDate(currentTime)}</p>
              </div>
            </div>
            <div className="header-time">
              <div className="time-display">{formatTime(currentTime)}</div>
            </div>
          </div>
        </div>

        <div className="dashboard-content">
          {/* ── Vista Validaciones ── */}
          {activeView === 'validations' && (
            <div className="validations-view">
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Estado de Validaciones</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Cumplimiento del material académico validado por el equipo COCOCYS
                </p>
              </div>

              {summaryLoading ? (
                <div className="loading-spinner" style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                  <p>Cargando validaciones...</p>
                </div>
              ) : !validationSummary || validationSummary.courses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                  <p>Aún no hay validaciones registradas</p>
                </div>
              ) : (
                <div>
                  {/* Summary cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
                    {[
                      { label: 'Total Validaciones', value: validationSummary.total_validations, color: '#6366f1' },
                      { label: 'Cursos', value: validationSummary.courses.length, color: '#f59e0b' },
                      { label: 'Cumplimiento Avg', value: `${Math.round(validationSummary.courses.reduce((s, c) => s + c.avg_compliance, 0) / (validationSummary.courses.length || 1))}%`, color: '#10b981' },
                      { label: 'Cursos Compliant', value: validationSummary.courses.filter(c => c.status === 'compliant').length, color: '#22c55e' },
                    ].map((card, i) => (
                      <div key={i} style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{card.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Course accordion */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {validationSummary.courses.map((course, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '12px', overflow: 'hidden' }}>
                        {/* Course header */}
                        <button
                          onClick={() => setExpandedCourse(expandedCourse === idx ? null : idx)}
                          style={{ width: '100%', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                              📚 {course.course_name}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {course.total_weeks} semana(s) · {course.total_validations} validaciones
                              {course.last_validated && ` · Última: ${new Date(course.last_validated).toLocaleDateString('es-ES')}`}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '100px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${course.avg_compliance}%`, height: '100%', borderRadius: '999px',
                                background: course.avg_compliance >= 70 ? '#10b981' : course.avg_compliance >= 40 ? '#f59e0b' : '#ef4444'
                              }} />
                            </div>
                            <span style={{
                              fontWeight: 700, minWidth: '42px',
                              color: course.avg_compliance >= 70 ? '#10b981' : course.avg_compliance >= 40 ? '#f59e0b' : '#ef4444'
                            }}>
                              {course.avg_compliance}%
                            </span>
                            <svg style={{ width: 18, height: 18, color: 'var(--text-secondary)', transform: expandedCourse === idx ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>

                        {/* Week details */}
                        {expandedCourse === idx && (
                          <div style={{ borderTop: '1px solid var(--border-color, #334155)', padding: '0 20px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                              {course.weeks.map((w, widx) => (
                                <div key={widx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
                                  <div style={{ width: '120px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                    {w.week}
                                  </div>
                                  <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                                    <div style={{
                                      width: `${w.avg_compliance}%`, height: '100%', borderRadius: '999px',
                                      background: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444',
                                      transition: 'width 0.5s ease'
                                    }} />
                                  </div>
                                  <span style={{
                                    minWidth: '42px', textAlign: 'right', fontSize: '0.875rem', fontWeight: 700,
                                    color: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444'
                                  }}>
                                    {w.avg_compliance}%
                                  </span>
                                  <span style={{
                                    padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600,
                                    background: w.status === 'compliant' ? 'rgba(16,185,129,0.15)' : w.status === 'partial' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                    color: w.status === 'compliant' ? '#34d399' : w.status === 'partial' ? '#fbbf24' : '#f87171'
                                  }}>
                                    {w.status === 'compliant' ? '✓' : w.status === 'partial' ? '~' : '✗'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Vista Docente ── */}
          {activeView === 'teacher' && isTeacher && (
            <div style={{ paddingBottom: '2rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Mi Curso — Estado de Validaciones</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Resultados de validación del material académico de tu carpeta asignada
                </p>
              </div>

              {teacherLoading ? (
                <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                  <p style={{ color: 'var(--text-secondary)' }}>Cargando datos de tu curso...</p>
                </div>
              ) : !teacherSummary || !teacherSummary.has_folder ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏫</div>
                  <p>No tienes una carpeta de Drive asignada.</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Contacta al administrador para que la configure.</p>
                </div>
              ) : (
                <>
                  {/* Resumen */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
                    {[
                      { label: 'Total Validaciones', value: teacherSummary.total, color: '#6366f1' },
                      { label: 'Cumplimiento Promedio', value: `${teacherSummary.avg_compliance}%`, color: teacherSummary.avg_compliance >= 70 ? '#10b981' : teacherSummary.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' },
                      { label: 'Semanas Registradas', value: teacherSummary.by_week?.length || 0, color: '#f59e0b' },
                    ].map((card, i) => (
                      <div key={i} style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{card.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Semanas */}
                  {teacherSummary.by_week?.length > 0 && (
                    <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.25rem' }}>
                      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>Cumplimiento por Semana</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {teacherSummary.by_week.map((w, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '120px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', flexShrink: 0 }}>{w.week}</div>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                              <div style={{ width: `${w.avg_compliance}%`, height: '100%', borderRadius: '999px', background: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.5s ease' }} />
                            </div>
                            <span style={{ minWidth: '42px', textAlign: 'right', fontSize: '0.875rem', fontWeight: 700, color: w.avg_compliance >= 70 ? '#10b981' : w.avg_compliance >= 40 ? '#f59e0b' : '#ef4444' }}>
                              {w.avg_compliance}%
                            </span>
                            <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 600, background: w.status === 'compliant' ? 'rgba(16,185,129,0.15)' : w.status === 'partial' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)', color: w.status === 'compliant' ? '#34d399' : w.status === 'partial' ? '#fbbf24' : '#f87171' }}>
                              {w.status === 'compliant' ? '✓ Cumple' : w.status === 'partial' ? '~ Parcial' : '✗ Bajo'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Validaciones recientes */}
                  {teacherSummary.recent?.length > 0 && (
                    <div style={{ background: 'var(--bg-card, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '12px', padding: '1.25rem' }}>
                      <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600 }}>Validaciones Recientes</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {teacherSummary.recent.map((r, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < teacherSummary.recent.length - 1 ? '1px solid var(--border-color, #334155)' : 'none' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, background: r.validation_type === 'structure' ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)', color: r.validation_type === 'structure' ? '#a78bfa' : '#34d399', flexShrink: 0 }}>
                              {r.validation_type === 'structure' ? '📋 Estructura' : '🧠 Contenido'}
                            </span>
                            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{r.folder_name}</span>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: r.compliance_percentage >= 70 ? '#10b981' : r.compliance_percentage >= 40 ? '#f59e0b' : '#ef4444' }}>
                              {r.compliance_percentage?.toFixed(1)}%
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
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

          {/* ── Vista General ── */}
          {activeView === 'overview' && <>
          {/* Stats Grid */}
          <div className="stats-grid">
            {stats.map((stat) => (
              <div key={stat.id} className="stat-card" style={{ borderColor: stat.color }}>
                <div className="stat-icon" style={{ background: `${stat.color}15` }}>
                  <span style={{ fontSize: '2rem' }}>{stat.icon}</span>
                </div>
                <div className="stat-info">
                  <p className="stat-label">{stat.label}</p>
                  <h3 className="stat-value">{stat.value}</h3>
                  <span className="stat-trend" style={{ color: stat.color }}>
                    {stat.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="section">
            <h3 className="section-title">Acciones Rápidas</h3>
            <div className="quick-actions-grid">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  className="quick-action-card"
                  onClick={action.action}
                  style={{ borderColor: action.color }}
                >
                  <div className="action-icon" style={{ background: `${action.color}15` }}>
                    <span style={{ fontSize: '1.5rem' }}>{action.icon}</span>
                  </div>
                  <div className="action-content">
                    <h4>{action.title}</h4>
                    <p>{action.description}</p>
                  </div>
                  <svg className="action-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity & User Info */}
          <div className="bottom-grid">
            <div className="section">
              <h3 className="section-title">Actividad Reciente</h3>
              <div className="activity-list">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="activity-item">
                    <div className="activity-icon">{activity.icon}</div>
                    <div className="activity-content">
                      <h4>{activity.title}</h4>
                      <p>{activity.description}</p>
                      <span className="activity-time">{activity.time}</span>
                    </div>
                  </div>
                ))}
                <div className="empty-state-small">
                  <p>Aquí aparecerá tu actividad reciente</p>
                </div>
              </div>
            </div>

            <div className="section">
              <h3 className="section-title">Tu Perfil</h3>
              <div className="profile-card">
                <div className="profile-avatar-large">
                  {user?.nombre?.charAt(0)}{user?.apellidos?.charAt(0)}
                </div>
                <div className="profile-details">
                  <div className="detail-row">
                    <span className="detail-label">Nombre Completo</span>
                    <span className="detail-value">{user?.nombre} {user?.apellidos}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Correo Electrónico</span>
                    <span className="detail-value">{user?.correo}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Estado</span>
                    <span className={`status-badge ${user?.is_active ? 'active' : 'inactive'}`}>
                      {user?.is_active ? '✓ Activo' : '✗ Inactivo'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Miembro desde</span>
                    <span className="detail-value">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES') : 'Hoy'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </>}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
