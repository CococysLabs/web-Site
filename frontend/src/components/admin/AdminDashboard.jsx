import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import DocumentAnalyzer from './DocumentAnalyzer';
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
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    // Cargar carpetas de Drive solo cuando se abre la tab
    if (activeTab === 'drive' && driveFolders.length === 0) {
      loadDriveFolders();
    }
  }, [activeTab]);

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
      // Usar endpoint de carpetas principales (BD, Computación, Sistemas, Software)
      const response = await api.get('/api/drive/main-folders');
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
            {!selectedFolder ? (
              <>
                <div style={{ marginBottom: '2rem' }}>
                  <h1>📚 Recursos Educativos COCOCYS</h1>
                  <p className="subtitle">
                    📁 2025 - Segundo Semestre
                  </p>
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    alignItems: 'center',
                    marginTop: '12px',
                    padding: '12px',
                    background: 'var(--cococys-orange-subtle, rgba(255, 140, 66, 0.08))',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary, #6b7280)'
                  }}>
                    <svg style={{ width: '20px', height: '20px', flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Selecciona una materia para explorar y analizar sus documentos</span>
                  </div>
                </div>
                
                {loading ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Cargando carpetas principales...</p>
                  </div>
                ) : driveFolders.length === 0 ? (
                  <div className="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <h3>No se encontraron carpetas</h3>
                    <p>Verifica la configuración de GOOGLE_DRIVE_FOLDER_ID</p>
                  </div>
                ) : (
                  <div className="folders-grid"  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {driveFolders.map((folder) => (
                      <div 
                        key={folder.id} 
                        className="folder-card"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255, 140, 66, 0.03) 0%, rgba(255, 140, 66, 0.08) 100%)',
                          border: '2px solid var(--border-light, #e5e7eb)',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedFolder(folder)}
                      >
                        <div className="folder-icon" style={{
                          width: '64px',
                          height: '64px',
                          background: 'linear-gradient(135deg, var(--cococys-orange, #ff8c42), var(--cococys-orange-dark, #e57a32))',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '16px'
                        }}>
                          <svg style={{ width: '40px', height: '40px' }} viewBox="0 0 24 24" fill="white">
                            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                          </svg>
                        </div>
                        <div className="folder-info">
                          <h3 style={{ 
                            fontSize: '1.125rem', 
                            fontWeight: '600',
                            color: 'var(--text-primary, #1a1a1a)',
                            marginBottom: '8px'
                          }}>
                            {folder.name}
                          </h3>
                          <p className="folder-date" style={{
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary, #6b7280)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            📅 {folder.modifiedTime ? new Date(folder.modifiedTime).toLocaleDateString('es-ES', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            }) : 'Sin fecha'}
                          </p>
                        </div>
                        <div className="folder-actions" style={{ marginTop: '16px' }}>
                          <button
                            className="btn-primary"
                            style={{
                              width: '100%',
                              padding: '12px',
                              background: 'linear-gradient(135deg, var(--cococys-orange, #ff8c42), var(--cococys-orange-dark, #e57a32))',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              transition: 'all 0.2s'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFolder(folder);
                            }}
                          >
                            <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            Explorar Contenido
                          </button>
                          {folder.webViewLink && (
                            <a 
                              href={folder.webViewLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                marginTop: '8px',
                                padding: '10px',
                                background: 'transparent',
                                color: 'var(--cococys-orange, #ff8c42)',
                                border: '2px solid var(--cococys-orange, #ff8c42)',
                                borderRadius: '8px',
                                fontWeight: '600',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                textDecoration: 'none',
                                transition: 'all 0.2s'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              Abrir en Drive
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <button 
                  onClick={() => setSelectedFolder(null)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    marginBottom: '24px',
                    background: 'white',
                    color: 'var(--cococys-orange, #ff8c42)',
                    border: '2px solid var(--cococys-orange, #ff8c42)',
                    borderRadius: '10px',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--cococys-orange, #ff8c42)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateX(-4px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = 'var(--cococys-orange, #ff8c42)';
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                  }}
                >
                  <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Volver a Materias
                </button>
                <DocumentAnalyzer 
                  folderId={selectedFolder.id}
                  folderName={selectedFolder.name}
                />
              </>
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
