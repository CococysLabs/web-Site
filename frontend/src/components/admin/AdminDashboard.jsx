import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalDocuments: 0,
    validDocuments: 0,
    pendingAnalysis: 0,
    pendingUsers: 0
  });
  
  const [driveFolders, setDriveFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Cargar estadísticas
      const [docsRes, usersRes] = await Promise.all([
        api.get('/api/documents/'),
        api.get('/api/auth/pending-users')
      ]);
      
      const docs = docsRes.data;
      setDocuments(docs);
      
      setStats({
        totalDocuments: docs.length,
        validDocuments: docs.filter(d => d.is_valid).length,
        pendingAnalysis: docs.filter(d => d.status === 'pending').length,
        pendingUsers: usersRes.data.length
      });
      
      setPendingUsers(usersRes.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
    setLoading(false);
  };

  const loadDriveFolders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/drive/folders');
      setDriveFolders(response.data);
    } catch (error) {
      console.error('Error loading Drive folders:', error);
      alert('Error al cargar carpetas de Drive');
    }
    setLoading(false);
  };

  const handleApproveUser = async (userId) => {
    try {
      await api.post(`/api/auth/approve-user/${userId}`);
      loadDashboardData();
      alert('Usuario aprobado exitosamente');
    } catch (error) {
      alert('Error al aprobar usuario');
    }
  };

  const handleRejectUser = async (userId) => {
    if (!confirm('¿Estás seguro de rechazar este usuario?')) return;
    
    try {
      await api.delete(`/api/auth/reject-user/${userId}`);
      loadDashboardData();
      alert('Usuario rechazado');
    } catch (error) {
      alert('Error al rechazar usuario');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <h2>COCOCYS</h2>
          <span className="role-badge admin">Admin</span>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Panel General
          </button>
          
          <button 
            className={activeTab === 'drive' ? 'active' : ''}
            onClick={() => { setActiveTab('drive'); loadDriveFolders(); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Google Drive
          </button>
          
          <button 
            className={activeTab === 'documents' ? 'active' : ''}
            onClick={() => setActiveTab('documents')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Documentos
          </button>
          
          <button 
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => setActiveTab('users')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Usuarios
            {stats.pendingUsers > 0 && (
              <span className="badge">{stats.pendingUsers}</span>
            )}
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{user?.nombre?.[0]}{user?.apellidos?.[0]}</div>
            <div>
              <div className="user-name">{user?.nombre} {user?.apellidos}</div>
              <div className="user-email">{user?.correo}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Salir
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <h1>Panel de Administración</h1>
            
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon documents">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalDocuments}</div>
                  <div className="stat-label">Total Documentos</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon valid">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{stats.validDocuments}</div>
                  <div className="stat-label">Documentos Válidos</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon pending">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{stats.pendingAnalysis}</div>
                  <div className="stat-label">Pendientes de Análisis</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon users">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="stat-info">
                  <div className="stat-value">{stats.pendingUsers}</div>
                  <div className="stat-label">Usuarios Pendientes</div>
                </div>
              </div>
            </div>

            {stats.pendingUsers > 0 && (
              <div className="alert-section">
                <div className="alert warning">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>Tienes {stats.pendingUsers} usuario(s) esperando aprobación</span>
                  <button onClick={() => setActiveTab('users')}>Ver usuarios</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Drive Tab */}
        {activeTab === 'drive' && (
          <div className="drive-tab">
            <h1>Google Drive</h1>
            <p className="subtitle">Carpetas disponibles en tu Drive</p>
            
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Cargando carpetas...</p>
              </div>
            ) : driveFolders.length === 0 ? (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <h3>No se encontraron carpetas</h3>
                <p>Verifica que hayas compartido carpetas con la cuenta de servicio</p>
              </div>
            ) : (
              <div className="folders-grid">
                {driveFolders.map((folder) => (
                  <div key={folder.id} className="folder-card">
                    <div className="folder-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div className="folder-info">
                      <h3>{folder.name}</h3>
                      <p className="folder-date">
                        {folder.modifiedTime ? new Date(folder.modifiedTime).toLocaleDateString('es-ES') : 'Sin fecha'}
                      </p>
                    </div>
                    <div className="folder-actions">
                      <a 
                        href={folder.webViewLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-secondary"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Abrir en Drive
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="documents-tab">
            <h1>Gestión de Documentos</h1>
            <div className="documents-list">
              {documents.length === 0 ? (
                <div className="empty-state">
                  <p>No hay documentos todavía</p>
                </div>
              ) : (
                documents.map(doc => (
                  <div key={doc.id} className="document-item">
                    <div className="doc-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="doc-info">
                      <h3>{doc.name}</h3>
                      <p>{doc.description || 'Sin descripción'}</p>
                    </div>
                    <div className={`doc-status ${doc.status}`}>
                      {doc.status === 'completed' ? '✓ Analizado' : '⏳ Pendiente'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="users-tab">
            <h1>Usuarios Pendientes de Aprobación</h1>
            {pendingUsers.length === 0 ? (
              <div className="empty-state">
                <p>No hay usuarios pendientes</p>
              </div>
            ) : (
              <div className="users-list">
                {pendingUsers.map(u => (
                  <div key={u.id} className="user-item">
                    <div className="user-avatar">{u.nombre[0]}{u.apellidos[0]}</div>
                    <div className="user-details">
                      <h3>{u.nombre} {u.apellidos}</h3>
                      <p>{u.correo}</p>
                      <span className="user-date">
                        Registrado: {new Date(u.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="user-actions">
                      <button 
                        className="approve-btn"
                        onClick={() => handleApproveUser(u.id)}
                      >
                        ✓ Aprobar
                      </button>
                      <button 
                        className="reject-btn"
                        onClick={() => handleRejectUser(u.id)}
                      >
                        ✕ Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
