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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    loadDocuments();
    return () => clearInterval(timer);
  }, []);

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
          <a href="#" className="nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </a>
          <a href="#" className="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Documentos</span>
          </a>
          <a href="#" className="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span>Criterios</span>
          </a>
          <a href="#" className="nav-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Análisis</span>
          </a>
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
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
