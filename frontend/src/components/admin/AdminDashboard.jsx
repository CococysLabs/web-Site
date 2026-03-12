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
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message }
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }

  // Settings state
  const [systemSettings, setSystemSettings] = useState(null);
  const [settingsForm, setSettingsForm]     = useState({});
  const [savingSettings, setSavingSettings] = useState(null); // categoría que se está guardando

  // Reports state
  const [reportStats, setReportStats]     = useState(null);
  const [reportHistory, setReportHistory] = useState({ records: [], total: 0 });
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilter, setReportFilter]   = useState({ type: '', days: 30 });
  const [historyPage, setHistoryPage]     = useState(0);
  const HISTORY_PAGE_SIZE = 20;

  // Users state
  const [allUsers, setAllUsers]         = useState({ users: [], total: 0 });
  const [userLoading, setUserLoading]   = useState(false);
  const [userFilter, setUserFilter]     = useState({ search: '', role: '', is_active: '' });
  const [userPage, setUserPage]         = useState(0);
  const USER_PAGE_SIZE = 25;

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'drive' && driveFolders.length === 0) {
      loadDriveFolders();
    }
    if (activeTab === 'users') {
      loadAllUsers(userFilter, 0);
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
      const response = await api.get('/api/drive/main-folders');
      setDriveFolders(response.data);
    } catch (error) {
      console.error('Error loading Drive folders:', error);
      showToast('error', 'Error al cargar carpetas de Drive');
    }
    setLoading(false);
  };

  const handleApproveUser = async (userId) => {
    try {
      await api.post(`/api/auth/approve-user/${userId}`);
      loadDashboardData();
      showToast('success', 'Usuario aprobado exitosamente');
    } catch (error) {
      showToast('error', 'Error al aprobar usuario');
    }
  };

  const handleRejectUser = (userId) => {
    setConfirmModal({
      message: '¿Estás seguro de rechazar este usuario? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await api.delete(`/api/auth/reject-user/${userId}`);
          loadDashboardData();
          showToast('success', 'Usuario rechazado');
        } catch (error) {
          showToast('error', 'Error al rechazar usuario');
        }
      }
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ── Settings handlers ────────────────────────────────────────────────────
  const loadSettings = async () => {
    try {
      const res = await api.get('/api/admin/settings');
      setSystemSettings(res.data.data);
      // Aplanar en form
      const flat = {};
      Object.values(res.data.data).forEach(cat => {
        Object.entries(cat.settings).forEach(([k, s]) => {
          flat[k] = s.value;
        });
      });
      setSettingsForm(flat);
    } catch (err) {
      showToast('error', 'Error al cargar configuración');
    }
  };

  const handleSettingChange = (key, value) => {
    setSettingsForm(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async (category) => {
    if (!systemSettings) return;
    setSavingSettings(category);
    const keysInCategory = Object.keys(systemSettings[category]?.settings || {});
    const payload = {};
    keysInCategory.forEach(k => { payload[k] = String(settingsForm[k] ?? ''); });
    try {
      await api.post('/api/admin/settings/bulk', { settings: payload });
      showToast('success', 'Configuración guardada correctamente');
      await loadSettings();
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Error al guardar configuración');
    } finally {
      setSavingSettings(null);
    }
  };

  const loadReports = async (filter, page) => {
    const f = filter || reportFilter;
    const p = page !== undefined ? page : historyPage;
    setReportLoading(true);
    try {
      const offset = p * HISTORY_PAGE_SIZE;
      const [statsRes, historyRes] = await Promise.all([
        api.get(`/api/validation/stats?days=${f.days}`),
        api.get(`/api/validation/history?limit=${HISTORY_PAGE_SIZE}&offset=${offset}${f.type ? `&type=${f.type}` : ''}`)
      ]);
      setReportStats(statsRes.data);
      setReportHistory(historyRes.data);
    } catch (err) {
      showToast('error', 'Error al cargar reportes');
    } finally {
      setReportLoading(false);
    }
  };

  const loadAllUsers = async (filter, page) => {
    const f = filter || userFilter;
    const p = page !== undefined ? page : userPage;
    setUserLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', USER_PAGE_SIZE);
      params.set('offset', p * USER_PAGE_SIZE);
      if (f.search) params.set('search', f.search);
      if (f.role) params.set('role', f.role);
      if (f.is_active !== '') params.set('is_active', f.is_active);
      const res = await api.get(`/api/auth/users?${params.toString()}`);
      setAllUsers(res.data);
    } catch (err) {
      showToast('error', 'Error al cargar usuarios');
    } finally {
      setUserLoading(false);
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    try {
      const res = await api.patch(`/api/auth/users/${userId}/toggle-active`);
      showToast('success', res.data.message);
      loadAllUsers();
      loadDashboardData();
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Error al cambiar estado');
    }
  };

  // User config modal state
  const [userConfigModal, setUserConfigModal] = useState(null); // user object
  const [userConfigForm, setUserConfigForm] = useState({
    drive_folder_id: '',
    drive_folder_name: '',
    is_teacher: false,
    permissions: { can_view_drive: false, can_analyze: false, can_validate_structure: false, can_validate_content: false }
  });

  const openUserConfigModal = (u) => {
    setUserConfigModal(u);
    setUserConfigForm({
      drive_folder_id: u.drive_folder_id || '',
      drive_folder_name: u.drive_folder_name || '',
      is_teacher: !!u.is_teacher,
      permissions: {
        can_view_drive: u.permissions?.can_view_drive ?? false,
        can_analyze: u.permissions?.can_analyze ?? false,
        can_validate_structure: u.permissions?.can_validate_structure ?? false,
        can_validate_content: u.permissions?.can_validate_content ?? false,
      }
    });
  };

  const saveUserConfig = async () => {
    try {
      await api.patch(`/api/auth/users/${userConfigModal.id}/update-config`, userConfigForm);
      showToast('success', 'Configuración del usuario guardada');
      setUserConfigModal(null);
      loadAllUsers();
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Error al guardar');
    }
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    params.set('days', reportFilter.days);
    if (reportFilter.type) params.set('type', reportFilter.type);
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    // Open in new tab with auth header via anchor trick via fetch + blob
    api.get(`/api/validation/export?${params.toString()}`, { responseType: 'blob' })
      .then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `validaciones_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => showToast('error', 'Error al exportar CSV'));
  };

  return (
    <div className="admin-dashboard">
      {/* Toast notification */}
      {toast && (
        <div className={`admin-toast admin-toast-${toast.type}`}>
          {toast.type === 'success' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* User config modal */}
      {userConfigModal && (
        <div className="admin-modal-overlay" onClick={() => setUserConfigModal(null)}>
          <div className="admin-confirm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,var(--cococys-orange),var(--cococys-orange-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                {userConfigModal.nombre?.[0]}{userConfigModal.apellidos?.[0]}
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{userConfigModal.nombre} {userConfigModal.apellidos}</p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{userConfigModal.correo}</p>
              </div>
            </div>

            {/* Drive folder */}
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Carpeta de Google Drive asignada</p>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>ID de carpeta</label>
              <input
                className="settings-input"
                type="text"
                placeholder="Ej: 1ABC...xyz"
                value={userConfigForm.drive_folder_id}
                onChange={e => setUserConfigForm(f => ({ ...f, drive_folder_id: e.target.value }))}
                style={{ width: '100%', fontSize: '0.875rem', marginBottom: '8px', boxSizing: 'border-box' }}
              />
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nombre de carpeta (opcional, visible al usuario)</label>
              <input
                className="settings-input"
                type="text"
                placeholder="Ej: Sistemas Operativos 2025"
                value={userConfigForm.drive_folder_name}
                onChange={e => setUserConfigForm(f => ({ ...f, drive_folder_name: e.target.value }))}
                style={{ width: '100%', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>

            {/* is_teacher toggle */}
            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={userConfigForm.is_teacher}
                  onChange={e => setUserConfigForm(f => ({ ...f, is_teacher: e.target.checked }))}
                  style={{ accentColor: '#10b981', width: 16, height: 16 }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Habilitar vista de docente (Mi Curso)</span>
              </label>
            </div>

            {/* Permissions */}
            <div style={{ marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Permisos de funcionalidades</p>
              {[
                { key: 'can_view_drive', label: 'Ver explorador de Drive', desc: 'Puede navegar por su carpeta asignada' },
                { key: 'can_analyze', label: 'Analizar documentos', desc: 'Puede usar el botón Analizar en archivos' },
                { key: 'can_validate_structure', label: 'Validar estructura', desc: 'Puede ejecutar validación de estructura' },
                { key: 'can_validate_content', label: 'Validar contenido (IA)', desc: 'Puede ejecutar validación de contenido con Gemini' },
              ].map(({ key, label, desc }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={userConfigForm.permissions[key]}
                    onChange={e => setUserConfigForm(f => ({ ...f, permissions: { ...f.permissions, [key]: e.target.checked } }))}
                    style={{ accentColor: 'var(--cococys-orange)', width: 15, height: 15, marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{label}</span>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setUserConfigModal(null)}>Cancelar</button>
              <button className="confirm-ok" style={{ background: 'var(--cococys-orange)', borderColor: 'var(--cococys-orange)' }} onClick={saveUserConfig}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmModal && (
        <div className="admin-modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="admin-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p>{confirmModal.message}</p>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setConfirmModal(null)}>Cancelar</button>
              <button className="confirm-ok" onClick={confirmModal.onConfirm}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
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
            className={activeTab === 'reports' ? 'active' : ''}
            onClick={() => { setActiveTab('reports'); if (!reportStats) loadReports(); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Reportes
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

          <button
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => { setActiveTab('settings'); if (!systemSettings) loadSettings(); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configuración
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
                    background: 'transparent',
                    color: 'var(--cococys-orange, #ff8c42)',
                    border: '2px solid var(--cococys-orange, #ff8c42)',
                    borderRadius: '10px',
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.2)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--cococys-orange, #ff8c42)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.transform = 'translateX(-4px)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--cococys-orange, #ff8c42)';
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.2)';
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

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="settings-tab">
            <div style={{ marginBottom: '2rem' }}>
              <h1>Configuración del Sistema</h1>
              <p className="subtitle">Ajusta los parámetros del sistema sin necesidad de reiniciar el servidor.</p>
            </div>

            {!systemSettings ? (
              <div className="loading-state"><div className="spinner"></div><p>Cargando configuración...</p></div>
            ) : (
              <div className="settings-grid">

                {/* ── Google Drive ── */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div className="settings-card-icon" style={{ background: 'linear-gradient(135deg,#4285F4,#34A853)' }}>
                      <svg style={{ width:22,height:22 }} viewBox="0 0 24 24" fill="none" stroke="white">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ margin:0, fontSize:'1rem', fontWeight:600 }}>Google Drive</h3>
                      <p style={{ margin:0, fontSize:'0.75rem', color:'var(--text-muted)' }}>Carpeta raíz del sistema</p>
                    </div>
                  </div>

                  <div className="settings-field">
                    <label className="settings-label">Carpeta raíz de Google Drive</label>
                    <p className="settings-hint">ID de la carpeta principal que contiene los cursos</p>
                    <input
                      className="settings-input"
                      type="text"
                      value={settingsForm.drive_root_folder_id || ''}
                      onChange={e => handleSettingChange('drive_root_folder_id', e.target.value)}
                      placeholder="Ej: 1ABC...xyz"
                    />
                  </div>

                  <button
                    className="btn-primary"
                    style={{ marginTop:8, padding:'10px 20px', fontSize:'0.875rem', opacity: savingSettings==='drive'?0.7:1 }}
                    onClick={() => saveSettings('drive')}
                    disabled={savingSettings === 'drive'}
                  >
                    {savingSettings === 'drive' ? '⏳ Guardando...' : '💾 Guardar Drive'}
                  </button>
                </div>

                {/* ── Gemini AI ── */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div className="settings-card-icon" style={{ background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)' }}>
                      <svg style={{ width:22,height:22 }} viewBox="0 0 24 24" fill="none" stroke="white">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ margin:0, fontSize:'1rem', fontWeight:600 }}>Gemini AI</h3>
                      <p style={{ margin:0, fontSize:'0.75rem', color:'var(--text-muted)' }}>Motor de análisis de contenido</p>
                    </div>
                  </div>

                  <div className="settings-field">
                    <label className="settings-label">Modelo de Gemini</label>
                    <p className="settings-hint">Modelo a usar para la validación de contenido con IA</p>
                    <select
                      className="settings-input"
                      value={settingsForm.gemini_model || 'gemini-2.0-flash'}
                      onChange={e => handleSettingChange('gemini_model', e.target.value)}
                    >
                      <option value="gemini-2.0-flash">gemini-2.0-flash (Recomendado)</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Más potente)</option>
                      <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite (Más rápido)</option>
                    </select>
                  </div>

                  <div className="settings-field">
                    <label className="settings-label">Habilitar análisis con IA</label>
                    <p className="settings-hint">Si está desactivado, se usa coincidencia de palabras clave</p>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settingsForm.gemini_enabled === 'true'}
                        onChange={e => handleSettingChange('gemini_enabled', e.target.checked ? 'true' : 'false')}
                      />
                      <span className="toggle-track"><span className="toggle-thumb"></span></span>
                      <span style={{ fontSize:'0.875rem', color:'var(--text-primary)' }}>
                        {settingsForm.gemini_enabled === 'true' ? 'Habilitado' : 'Deshabilitado'}
                      </span>
                    </label>
                  </div>

                  <button
                    className="btn-primary"
                    style={{ marginTop:8, padding:'10px 20px', fontSize:'0.875rem', opacity: savingSettings==='ai'?0.7:1 }}
                    onClick={() => saveSettings('ai')}
                    disabled={savingSettings === 'ai'}
                  >
                    {savingSettings === 'ai' ? '⏳ Guardando...' : '💾 Guardar IA'}
                  </button>
                </div>

                {/* ── Usuarios ── */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div className="settings-card-icon" style={{ background: 'linear-gradient(135deg,#F59E0B,#D97706)' }}>
                      <svg style={{ width:22,height:22 }} viewBox="0 0 24 24" fill="none" stroke="white">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ margin:0, fontSize:'1rem', fontWeight:600 }}>Gestión de Usuarios</h3>
                      <p style={{ margin:0, fontSize:'0.75rem', color:'var(--text-muted)' }}>Registro y sesiones</p>
                    </div>
                  </div>

                  <div className="settings-field">
                    <label className="settings-label">Auto-aprobar usuarios nuevos</label>
                    <p className="settings-hint">Si está activo, los estudiantes se aprueban automáticamente al registrarse</p>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settingsForm.auto_approve_users === 'true'}
                        onChange={e => handleSettingChange('auto_approve_users', e.target.checked ? 'true' : 'false')}
                      />
                      <span className="toggle-track"><span className="toggle-thumb"></span></span>
                      <span style={{ fontSize:'0.875rem', color:'var(--text-primary)' }}>
                        {settingsForm.auto_approve_users === 'true' ? 'Automático' : 'Requiere aprobación manual'}
                      </span>
                    </label>
                  </div>

                  <div className="settings-field">
                    <label className="settings-label">Duración de sesión: <strong>{settingsForm.jwt_session_minutes || 30} min</strong></label>
                    <p className="settings-hint">Tiempo antes de que el token JWT expire (5–480 minutos)</p>
                    <input
                      className="settings-range"
                      type="range" min="5" max="480" step="5"
                      value={settingsForm.jwt_session_minutes || 30}
                      onChange={e => handleSettingChange('jwt_session_minutes', e.target.value)}
                    />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>
                      <span>5 min</span><span>480 min (8h)</span>
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    style={{ marginTop:8, padding:'10px 20px', fontSize:'0.875rem', opacity: savingSettings==='users'?0.7:1 }}
                    onClick={() => saveSettings('users')}
                    disabled={savingSettings === 'users'}
                  >
                    {savingSettings === 'users' ? '⏳ Guardando...' : '💾 Guardar Usuarios'}
                  </button>
                </div>

                {/* ── Validación ── */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div className="settings-card-icon" style={{ background: 'linear-gradient(135deg,var(--cococys-orange),var(--cococys-orange-dark))' }}>
                      <svg style={{ width:22,height:22 }} viewBox="0 0 24 24" fill="none" stroke="white">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ margin:0, fontSize:'1rem', fontWeight:600 }}>Criterios de Validación</h3>
                      <p style={{ margin:0, fontSize:'0.75rem', color:'var(--text-muted)' }}>Umbrales y tipos de archivo</p>
                    </div>
                  </div>

                  <div className="settings-field">
                    <label className="settings-label">Umbral mínimo de cumplimiento: <strong>{settingsForm.compliance_threshold || 70}%</strong></label>
                    <p className="settings-hint">Porcentaje mínimo de requisitos cubiertos para aprobar</p>
                    <input
                      className="settings-range"
                      type="range" min="0" max="100" step="5"
                      value={settingsForm.compliance_threshold || 70}
                      onChange={e => handleSettingChange('compliance_threshold', e.target.value)}
                    />
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>
                      <span>0%</span><span>100%</span>
                    </div>
                  </div>

                  <div className="settings-field">
                    <label className="settings-label">Extensiones de archivo permitidas</label>
                    <p className="settings-hint">Tipos de documento aceptados para análisis</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'12px', marginTop:8 }}>
                      {['.pdf', '.docx', '.pptx', '.xlsx'].map(ext => {
                        let currentExts = [];
                        try { currentExts = JSON.parse(settingsForm.allowed_file_extensions || '[]'); } catch {}
                        const checked = currentExts.includes(ext);
                        return (
                          <label key={ext} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:'0.875rem' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              style={{ accentColor:'var(--cococys-orange)', width:16, height:16 }}
                              onChange={e => {
                                let exts = [];
                                try { exts = JSON.parse(settingsForm.allowed_file_extensions || '[]'); } catch {}
                                if (e.target.checked) {
                                  if (!exts.includes(ext)) exts.push(ext);
                                } else {
                                  exts = exts.filter(x => x !== ext);
                                }
                                handleSettingChange('allowed_file_extensions', JSON.stringify(exts));
                              }}
                            />
                            <code style={{ background:'var(--bg-secondary)', padding:'2px 8px', borderRadius:4 }}>{ext}</code>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    className="btn-primary"
                    style={{ marginTop:8, padding:'10px 20px', fontSize:'0.875rem', opacity: savingSettings==='validation'?0.7:1 }}
                    onClick={() => saveSettings('validation')}
                    disabled={savingSettings === 'validation'}
                  >
                    {savingSettings === 'validation' ? '⏳ Guardando...' : '💾 Guardar Validación'}
                  </button>
                </div>

              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="reports-tab">
            {/* Header + Filtros */}
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1>Reportes de Validaciones</h1>
                <p className="subtitle">Estadísticas e historial de validaciones del sistema.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="settings-input"
                  style={{ width: 'auto', padding: '8px 12px', fontSize: '0.875rem' }}
                  value={reportFilter.type}
                  onChange={e => {
                    const f = { ...reportFilter, type: e.target.value };
                    setReportFilter(f);
                    setHistoryPage(0);
                    loadReports(f, 0);
                  }}
                >
                  <option value="">Todos los tipos</option>
                  <option value="structure">Solo Estructura</option>
                  <option value="content">Solo Contenido</option>
                </select>
                <select
                  className="settings-input"
                  style={{ width: 'auto', padding: '8px 12px', fontSize: '0.875rem' }}
                  value={reportFilter.days}
                  onChange={e => {
                    const f = { ...reportFilter, days: parseInt(e.target.value) };
                    setReportFilter(f);
                    setHistoryPage(0);
                    loadReports(f, 0);
                  }}
                >
                  <option value="7">Últimos 7 días</option>
                  <option value="30">Últimos 30 días</option>
                  <option value="90">Últimos 90 días</option>
                  <option value="365">Último año</option>
                </select>
                <button
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.875rem' }}
                  onClick={() => { setHistoryPage(0); loadReports(reportFilter, 0); }}
                  disabled={reportLoading}
                >
                  {reportLoading ? '⏳' : '🔄 Actualizar'}
                </button>
                <button
                  style={{ padding: '8px 16px', fontSize: '0.875rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                  onClick={handleExportCSV}
                >
                  ⬇️ Exportar CSV
                </button>
              </div>
            </div>

            {reportLoading && !reportStats ? (
              <div className="loading-state"><div className="spinner"></div><p>Cargando reportes...</p></div>
            ) : reportStats ? (
              <>
                {/* Stat cards */}
                <div className="reports-stats-grid">
                  {[
                    { icon: '📊', value: reportStats.total_validations, label: 'Total Validaciones', color: '#6366f1,#4f46e5' },
                    { icon: '📈', value: `${reportStats.average_compliance}%`, label: 'Promedio Cumplimiento', color: '#10b981,#059669' },
                    { icon: '✅', value: reportStats.by_status?.compliant || 0, label: 'Compliant (≥70%)', color: '#22c55e,#16a34a' },
                    { icon: '⚠️', value: reportStats.by_status?.partial || 0, label: 'Parcial (40–69%)', color: '#f59e0b,#d97706' },
                  ].map((card, i) => (
                    <div key={i} className="report-stat-card">
                      <div className="report-stat-icon" style={{ background: `linear-gradient(135deg,${card.color})` }}>
                        {card.icon}
                      </div>
                      <div>
                        <div className="report-stat-value">{card.value}</div>
                        <div className="report-stat-label">{card.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Cumplimiento por semana */}
                {reportStats.by_week?.length > 0 && (
                  <div className="report-table-card">
                    <h3>📚 Cumplimiento por Semana/Carpeta</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="report-table">
                        <thead>
                          <tr>
                            {['Carpeta', 'Curso', 'Validaciones', 'Promedio'].map(h => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportStats.by_week.map((row, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 500 }}>{row.week}</td>
                              <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{row.course || '—'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="report-count-badge">{row.count}</span>
                              </td>
                              <td>
                                <div className="report-compliance-bar-row">
                                  <div className="report-compliance-bar">
                                    <div style={{
                                      width: `${row.avg_compliance}%`, height: '100%',
                                      background: row.avg_compliance >= 70 ? '#10b981' : row.avg_compliance >= 40 ? '#f59e0b' : '#ef4444',
                                      borderRadius: '999px'
                                    }} />
                                  </div>
                                  <span style={{
                                    fontSize: '0.875rem', fontWeight: 600, minWidth: '42px',
                                    color: row.avg_compliance >= 70 ? '#10b981' : row.avg_compliance >= 40 ? '#f59e0b' : '#ef4444'
                                  }}>
                                    {row.avg_compliance}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Historial */}
                <div className="report-table-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>📋 Historial de Validaciones</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {reportHistory.total} registros — pág. {historyPage + 1} / {Math.max(1, Math.ceil(reportHistory.total / HISTORY_PAGE_SIZE))}
                      </span>
                      <button
                        style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', opacity: historyPage === 0 ? 0.4 : 1 }}
                        disabled={historyPage === 0 || reportLoading}
                        onClick={() => { const p = historyPage - 1; setHistoryPage(p); loadReports(reportFilter, p); }}
                      >← Anterior</button>
                      <button
                        style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', opacity: (historyPage + 1) * HISTORY_PAGE_SIZE >= reportHistory.total ? 0.4 : 1 }}
                        disabled={(historyPage + 1) * HISTORY_PAGE_SIZE >= reportHistory.total || reportLoading}
                        onClick={() => { const p = historyPage + 1; setHistoryPage(p); loadReports(reportFilter, p); }}
                      >Siguiente →</button>
                    </div>
                  </div>
                  {reportHistory.records.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem 0' }}>
                      <p>No hay validaciones en el período seleccionado</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                      <table className="report-table">
                        <thead>
                          <tr>
                            {['Fecha', 'Carpeta', 'Curso', 'Tipo', 'Cumplimiento', 'Estado'].map(h => (
                              <th key={h} style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportHistory.records.map((r, idx) => (
                            <tr key={idx}>
                              <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                {r.created_at
                                  ? new Date(r.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                  : '—'}
                              </td>
                              <td style={{ fontWeight: 500 }}>{r.folder_name}</td>
                              <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{r.course_name || '—'}</td>
                              <td>
                                <span style={{
                                  padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                                  background: r.validation_type === 'structure' ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)',
                                  color: r.validation_type === 'structure' ? '#a78bfa' : '#34d399'
                                }}>
                                  {r.validation_type === 'structure' ? '📋 Estructura' : '🧠 Contenido'}
                                </span>
                              </td>
                              <td>
                                <div className="report-compliance-bar-row">
                                  <div className="report-compliance-bar" style={{ width: '60px' }}>
                                    <div style={{
                                      width: `${r.compliance_percentage}%`, height: '100%',
                                      background: r.compliance_percentage >= 70 ? '#10b981' : r.compliance_percentage >= 40 ? '#f59e0b' : '#ef4444',
                                      borderRadius: '999px'
                                    }} />
                                  </div>
                                  <span style={{
                                    fontSize: '0.875rem', fontWeight: 600,
                                    color: r.compliance_percentage >= 70 ? '#10b981' : r.compliance_percentage >= 40 ? '#f59e0b' : '#ef4444'
                                  }}>
                                    {r.compliance_percentage?.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className={`report-status-badge ${r.status === 'compliant' ? 'compliant' : r.status === 'partial' ? 'partial' : 'low'}`}>
                                  {r.status === 'compliant' ? '✓ Cumple' : r.status === 'partial' ? '~ Parcial' : '✗ Bajo'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>No hay datos de reportes disponibles</p>
                <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => loadReports()}>
                  Cargar Reportes
                </button>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="users-tab">
            {/* Header */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1>Gestión de Usuarios</h1>
                <p className="subtitle">{allUsers.total} usuarios registrados en el sistema</p>
              </div>
            </div>

            {/* Pending approval section */}
            {pendingUsers.length > 0 && (
              <div style={{ marginBottom: '2rem', padding: '1.25rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px' }}>
                <h3 style={{ margin: '0 0 1rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⏳ Pendientes de Aprobación ({pendingUsers.length})
                </h3>
                <div className="users-list">
                  {pendingUsers.map(u => (
                    <div key={u.id} className="user-item">
                      <div className="user-avatar">{u.nombre[0]}{u.apellidos[0]}</div>
                      <div className="user-details">
                        <h3>{u.nombre} {u.apellidos}</h3>
                        <p>{u.correo}</p>
                        <span className="user-date">Registrado: {new Date(u.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="user-actions">
                        <button className="approve-btn" onClick={() => handleApproveUser(u.id)}>✓ Aprobar</button>
                        <button className="reject-btn" onClick={() => handleRejectUser(u.id)}>✕ Rechazar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                className="settings-input"
                style={{ flex: '1', minWidth: '200px', padding: '8px 12px', fontSize: '0.875rem' }}
                placeholder="Buscar por nombre o correo..."
                value={userFilter.search}
                onChange={e => {
                  const f = { ...userFilter, search: e.target.value };
                  setUserFilter(f);
                  setUserPage(0);
                  loadAllUsers(f, 0);
                }}
              />
              <select
                className="settings-input"
                style={{ width: 'auto', padding: '8px 12px', fontSize: '0.875rem' }}
                value={userFilter.role}
                onChange={e => {
                  const f = { ...userFilter, role: e.target.value };
                  setUserFilter(f);
                  setUserPage(0);
                  loadAllUsers(f, 0);
                }}
              >
                <option value="">Todos los roles</option>
                <option value="admin">Administrador</option>
                <option value="student">Estudiante</option>
              </select>
              <select
                className="settings-input"
                style={{ width: 'auto', padding: '8px 12px', fontSize: '0.875rem' }}
                value={userFilter.is_active}
                onChange={e => {
                  const f = { ...userFilter, is_active: e.target.value };
                  setUserFilter(f);
                  setUserPage(0);
                  loadAllUsers(f, 0);
                }}
              >
                <option value="">Todos los estados</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>

            {/* All users table */}
            {userLoading ? (
              <div className="loading-state"><div className="spinner"></div><p>Cargando usuarios...</p></div>
            ) : (
              <div className="report-table-card">
                <div style={{ overflowX: 'auto' }}>
                  <table className="report-table">
                    <thead>
                      <tr>
                        {['Usuario', 'Correo', 'Rol', 'Estado', 'Aprobado', 'Registrado', 'Docente', 'Acciones'].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.users.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No hay usuarios que coincidan</td></tr>
                      ) : allUsers.users.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,var(--cococys-orange),var(--cococys-orange-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                                {u.nombre?.[0]}{u.apellidos?.[0]}
                              </div>
                              {u.nombre} {u.apellidos}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{u.correo}</td>
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: u.role === 'admin' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)', color: u.role === 'admin' ? '#818cf8' : '#34d399' }}>
                              {u.role === 'admin' ? '🛡️ Admin' : '🎓 Estudiante'}
                            </span>
                          </td>
                          <td>
                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: u.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: u.is_active ? '#10b981' : '#ef4444' }}>
                              {u.is_active ? '✓ Activo' : '✗ Inactivo'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: u.is_approved ? '#10b981' : '#f59e0b' }}>
                            {u.is_approved ? '✓ Sí' : '⏳ Pendiente'}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {u.created_at ? new Date(u.created_at).toLocaleDateString('es-ES') : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {u.is_teacher ? (
                              <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                                🏫 Docente
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
                                onClick={() => openUserConfigModal(u)}
                                title="Configurar usuario (Drive + permisos)"
                              >
                                🏫
                              </button>
                              <button
                                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, background: u.is_active ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: u.is_active ? '#ef4444' : '#10b981' }}
                                onClick={() => setConfirmModal({
                                  message: `¿${u.is_active ? 'Desactivar' : 'Activar'} al usuario ${u.nombre} ${u.apellidos}?`,
                                  onConfirm: () => { setConfirmModal(null); handleToggleActive(u.id, u.is_active); }
                                })}
                              >
                                {u.is_active ? '🚫' : '✓'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {allUsers.total > USER_PAGE_SIZE && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.5rem 0' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Mostrando {userPage * USER_PAGE_SIZE + 1}–{Math.min((userPage + 1) * USER_PAGE_SIZE, allUsers.total)} de {allUsers.total}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', opacity: userPage === 0 ? 0.4 : 1 }}
                        disabled={userPage === 0}
                        onClick={() => { const p = userPage - 1; setUserPage(p); loadAllUsers(userFilter, p); }}
                      >← Anterior</button>
                      <button
                        style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', opacity: (userPage + 1) * USER_PAGE_SIZE >= allUsers.total ? 0.4 : 1 }}
                        disabled={(userPage + 1) * USER_PAGE_SIZE >= allUsers.total}
                        onClick={() => { const p = userPage + 1; setUserPage(p); loadAllUsers(userFilter, p); }}
                      >Siguiente →</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
