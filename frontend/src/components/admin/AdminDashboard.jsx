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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const [settingsSection, setSettingsSection] = useState('drive'); // sección activa del settings tab
  // API Keys state: { gemini_api_keys: ['AIza...', ...], ... }
  const [apiKeysList, setApiKeysList]       = useState({});
  const [newApiKey, setNewApiKey]           = useState({ gemini: '', deepseek: '', groq: '', openrouter: '' });
  const [apiKeyLoading, setApiKeyLoading]   = useState({});

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

  // Audit log state
  const [auditLog, setAuditLog]         = useState({ entries: [], total: 0 });
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage]       = useState(0);
  const AUDIT_PAGE_SIZE = 50;

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
    } catch (_error) {
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
        } catch (_error) {
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
    } catch (_err) {
      showToast('error', 'Error al cargar configuración');
    }
  };

  const handleSettingChange = (key, value) => {
    setSettingsForm(prev => ({ ...prev, [key]: value }));
  };

  const addApiKey = async (settingKey, providerShort) => {
    const keyVal = newApiKey[providerShort]?.trim();
    if (!keyVal) return;
    setApiKeyLoading(prev => ({ ...prev, [settingKey]: true }));
    try {
      const res = await api.post(`/api/admin/settings/api-keys/${settingKey}/add`, { key: keyVal });
      setNewApiKey(prev => ({ ...prev, [providerShort]: '' }));
      showToast('success', res.data.message);
      await loadSettings();
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Error al agregar API key');
    } finally {
      setApiKeyLoading(prev => ({ ...prev, [settingKey]: false }));
    }
  };

  const removeApiKey = async (settingKey, index) => {
    setApiKeyLoading(prev => ({ ...prev, [`${settingKey}_${index}`]: true }));
    try {
      const res = await api.delete(`/api/admin/settings/api-keys/${settingKey}/${index}`);
      showToast('success', res.data.message);
      await loadSettings();
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Error al eliminar API key');
    } finally {
      setApiKeyLoading(prev => ({ ...prev, [`${settingKey}_${index}`]: false }));
    }
  };

  const API_KEY_SETTINGS = new Set(['gemini_api_keys','deepseek_api_keys','groq_api_keys','openrouter_api_keys']);

  const saveSettings = async (category) => {
    if (!systemSettings) return;
    setSavingSettings(category);
    const keysInCategory = Object.keys(systemSettings[category]?.settings || {});
    const payload = {};
    // Excluir las listas de API keys — se gestionan con endpoints dedicados
    keysInCategory
      .filter(k => !API_KEY_SETTINGS.has(k))
      .forEach(k => { payload[k] = String(settingsForm[k] ?? ''); });
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
    } catch (_err) {
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
    } catch (_err) {
      showToast('error', 'Error al cargar usuarios');
    } finally {
      setUserLoading(false);
    }
  };

  const handleToggleActive = async (userId, _currentActive) => {
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

  // Reset password modal state
  const [resetPasswordModal, setResetPasswordModal] = useState(null); // user object
  const [resetPasswordForm, setResetPasswordForm] = useState({
    new_password: '',
    confirm_password: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const openResetPasswordModal = (u) => {
    setResetPasswordModal(u);
    setResetPasswordForm({ new_password: '', confirm_password: '' });
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleResetPassword = async () => {
    try {
      if (resetPasswordForm.new_password !== resetPasswordForm.confirm_password) {
        showToast('error', 'Las contraseñas no coinciden');
        return;
      }
      if (resetPasswordForm.new_password.length < 8) {
        showToast('error', 'La contraseña debe tener al menos 8 caracteres');
        return;
      }
      if (!/[A-Z]/.test(resetPasswordForm.new_password)) {
        showToast('error', 'La contraseña debe contener al menos una mayúscula');
        return;
      }
      if (!/[a-z]/.test(resetPasswordForm.new_password)) {
        showToast('error', 'La contraseña debe contener al menos una minúscula');
        return;
      }
      if (!/[0-9]/.test(resetPasswordForm.new_password)) {
        showToast('error', 'La contraseña debe contener al menos un número');
        return;
      }

      await api.post(`/api/auth/users/${resetPasswordModal.id}/reset-password`, {
        new_password: resetPasswordForm.new_password,
        confirm_password: resetPasswordForm.confirm_password
      });
      showToast('success', `Contraseña reseteada para ${resetPasswordModal.nombre} ${resetPasswordModal.apellidos}`);
      setResetPasswordModal(null);
      loadAllUsers();
    } catch (err) {
      showToast('error', err.response?.data?.detail || 'Error al resetear contraseña');
    }
  };

  const loadAuditLog = async (page) => {
    const p = page !== undefined ? page : auditPage;
    setAuditLoading(true);
    try {
      const offset = p * AUDIT_PAGE_SIZE;
      const res = await api.get(`/api/admin/settings/audit-log?limit=${AUDIT_PAGE_SIZE}&offset=${offset}`);
      setAuditLog(res.data);
    } catch (_err) {
      showToast('error', 'Error al cargar log de auditoría');
    } finally {
      setAuditLoading(false);
    }
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    params.set('days', reportFilter.days);
    if (reportFilter.type) params.set('type', reportFilter.type);
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
          <div className="admin-confirm-modal user-config-modal" onClick={e => e.stopPropagation()}>
            <div className="user-config-header">
              <div className="user-config-avatar">
                {userConfigModal.nombre?.[0]}{userConfigModal.apellidos?.[0]}
              </div>
              <div>
                <p className="user-config-name">{userConfigModal.nombre} {userConfigModal.apellidos}</p>
                <p className="user-config-email">{userConfigModal.correo}</p>
              </div>
            </div>

            {/* Drive folder */}
            <div className="user-config-section">
              <p className="user-config-section-title">Carpeta de Google Drive asignada</p>
              <label className="user-config-label">ID de carpeta</label>
              <input
                className="settings-input"
                type="text"
                placeholder="Ej: 1ABC...xyz"
                value={userConfigForm.drive_folder_id}
                onChange={e => setUserConfigForm(f => ({ ...f, drive_folder_id: e.target.value }))}
              />
              <label className="user-config-label">Nombre de carpeta (opcional, visible al usuario)</label>
              <input
                className="settings-input"
                type="text"
                placeholder="Ej: Sistemas Operativos 2025"
                value={userConfigForm.drive_folder_name}
                onChange={e => setUserConfigForm(f => ({ ...f, drive_folder_name: e.target.value }))}
              />
            </div>

            {/* is_teacher toggle */}
            <div className="user-config-section user-config-section-divider">
              <label className="user-config-perm-item">
                <input
                  type="checkbox"
                  checked={userConfigForm.is_teacher}
                  onChange={e => setUserConfigForm(f => ({ ...f, is_teacher: e.target.checked }))}
                  className="checkbox-green"
                />
                <span>Habilitar vista de docente (Mi Curso)</span>
              </label>
            </div>

            {/* Permissions */}
            <div>
              <p className="user-config-perms-title">Permisos de funcionalidades</p>
              {[
                { key: 'can_view_drive', label: 'Ver explorador de Drive', desc: 'Puede navegar por su carpeta asignada' },
                { key: 'can_analyze', label: 'Analizar documentos', desc: 'Puede usar el botón Analizar en archivos' },
                { key: 'can_validate_structure', label: 'Validar estructura', desc: 'Puede ejecutar validación de estructura' },
                { key: 'can_validate_content', label: 'Validar contenido (IA)', desc: 'Puede ejecutar validación de contenido con IA' },
              ].map(({ key, label, desc }) => (
                <label key={key} className="user-config-perm-item">
                  <input
                    type="checkbox"
                    checked={userConfigForm.permissions[key]}
                    onChange={e => setUserConfigForm(f => ({ ...f, permissions: { ...f.permissions, [key]: e.target.checked } }))}
                    className="checkbox-orange"
                  />
                  <div>
                    <span className="user-config-perm-label">{label}</span>
                    <p className="user-config-perm-desc">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setUserConfigModal(null)}>Cancelar</button>
              <button className="confirm-ok-orange" onClick={saveUserConfig}>Guardar</button>
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

      {/* Reset password modal */}
      {resetPasswordModal && (
        <div className="admin-modal-overlay" onClick={() => setResetPasswordModal(null)}>
          <div className="admin-confirm-modal user-config-modal" onClick={e => e.stopPropagation()}>
            <div className="user-config-header">
              <div className="user-table-avatar">
                {resetPasswordModal.nombre?.[0]}{resetPasswordModal.apellidos?.[0]}
              </div>
              <div>
                <p className="user-config-name">{resetPasswordModal.nombre} {resetPasswordModal.apellidos}</p>
                <p className="user-config-email">{resetPasswordModal.correo}</p>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Nueva Contraseña
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={resetPasswordForm.new_password}
                  onChange={e => setResetPasswordForm({ ...resetPasswordForm, new_password: e.target.value })}
                  className="settings-input"
                  placeholder="Mínimo 8 caracteres con mayúscula, minúscula y número"
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0',
                    color: 'var(--text-secondary)'
                  }}
                  title={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showNewPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Confirmar Contraseña
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={resetPasswordForm.confirm_password}
                  onChange={e => setResetPasswordForm({ ...resetPasswordForm, confirm_password: e.target.value })}
                  className="settings-input"
                  placeholder="Confirma la contraseña"
                  style={{ width: '100%', paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0',
                    color: 'var(--text-secondary)'
                  }}
                  title={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setResetPasswordModal(null)}>Cancelar</button>
              <button className="confirm-ok" onClick={handleResetPassword} style={{ background: '#3b82f6', borderColor: '#3b82f6' }}>Resetear Contraseña</button>
            </div>
          </div>
        </div>
      )}
      {/* Sidebar overlay */}
      <div className={`admin-sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>COCOCYS</h2>
          <span className="role-badge admin">Admin</span>
        </div>
        
        <nav className="sidebar-nav">
          <button
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => { setActiveTab('overview'); setSidebarOpen(false); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Panel General
          </button>
          
          <button
            className={activeTab === 'drive' ? 'active' : ''}
            onClick={() => { setActiveTab('drive'); loadDriveFolders(); setSidebarOpen(false); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Google Drive
          </button>
          
          <button
            className={activeTab === 'documents' ? 'active' : ''}
            onClick={() => { setActiveTab('documents'); setSidebarOpen(false); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Documentos
          </button>
          
          <button
            className={activeTab === 'reports' ? 'active' : ''}
            onClick={() => { setActiveTab('reports'); if (!reportStats) loadReports(); setSidebarOpen(false); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Reportes
          </button>

          <button
            className={activeTab === 'users' ? 'active' : ''}
            onClick={() => { setActiveTab('users'); setSidebarOpen(false); }}
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
            onClick={() => { setActiveTab('settings'); if (!systemSettings) loadSettings(); setSidebarOpen(false); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configuración
          </button>

          <button
            className={activeTab === 'audit' ? 'active' : ''}
            onClick={() => { setActiveTab('audit'); loadAuditLog(0); setAuditPage(0); setSidebarOpen(false); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Auditoría
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
        {/* Mobile header with hamburger */}
        <div className="admin-content-header">
          <button className="admin-hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Abrir menú">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>

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
                  <p className="subtitle">📁 2025 - Segundo Semestre</p>
                  <div className="drive-info-notice">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
                  <div className="folders-grid">
                    {driveFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="folder-card"
                        onClick={() => setSelectedFolder(folder)}
                      >
                        <div className="folder-icon">
                          <svg viewBox="0 0 24 24" fill="white">
                            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                          </svg>
                        </div>
                        <div className="folder-info">
                          <h3>{folder.name}</h3>
                          <p className="folder-date">
                            📅 {folder.modifiedTime ? new Date(folder.modifiedTime).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            }) : 'Sin fecha'}
                          </p>
                        </div>
                        <div className="folder-actions">
                          <button
                            className="btn-primary folder-explore-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFolder(folder);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            Explorar Contenido
                          </button>
                          {folder.webViewLink && (
                            <a
                              href={folder.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="folder-drive-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
                <button className="drive-back-btn" onClick={() => setSelectedFolder(null)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
            <div style={{ marginBottom: '1.5rem' }}>
              <h1>Configuración del Sistema</h1>
              <p className="subtitle">Controla todos los parámetros operativos sin necesidad de reiniciar el servidor.</p>
            </div>

            {!systemSettings ? (
              <div className="loading-state"><div className="spinner"></div><p>Cargando configuración...</p></div>
            ) : (
              <div className="settings-layout">

                {/* ── Sidebar nav ── */}
                <nav className="settings-sidebar">
                  {[
                    { id: 'drive',      icon: '🗂️',  label: 'Google Drive' },
                    { id: 'ai',         icon: '🤖',  label: 'Proveedores IA' },
                    { id: 'users',      icon: '👥',  label: 'Usuarios' },
                    { id: 'validation', icon: '✅',  label: 'Validación' },
                  ].map(s => (
                    <button
                      key={s.id}
                      className={`settings-sidebar-item${settingsSection === s.id ? ' active' : ''}`}
                      onClick={() => setSettingsSection(s.id)}
                    >
                      <span className="settings-sidebar-icon">{s.icon}</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </nav>

                {/* ── Content ── */}
                <div className="settings-content">

                  {/* ══ DRIVE ══ */}
                  {settingsSection === 'drive' && (
                    <div className="settings-section">
                      <div className="settings-section-header">
                        <div className="settings-card-icon settings-card-icon--drive">
                          <svg style={{ width:22,height:22 }} viewBox="0 0 24 24" fill="none" stroke="white">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="settings-section-title">Google Drive</h2>
                          <p className="settings-section-subtitle">Carpeta raíz del sistema</p>
                        </div>
                      </div>

                      <div className="settings-group">
                        <div className="settings-field">
                          <label className="settings-label">ID de carpeta raíz</label>
                          <p className="settings-hint">Carpeta principal que contiene todos los cursos. Copia el ID desde la URL de Drive.</p>
                          <input
                            className="settings-input"
                            type="text"
                            value={settingsForm.drive_root_folder_id || ''}
                            onChange={e => handleSettingChange('drive_root_folder_id', e.target.value)}
                            placeholder="Ej: 1ABC...xyz"
                          />
                        </div>
                        <div className="drive-info-notice">
                          <svg style={{ width:16,height:16,flexShrink:0,marginTop:1 }} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          <span>La cuenta de servicio <code style={{ fontSize:'0.75rem' }}>cococys-drive-service@cococys-driv.iam.gserviceaccount.com</code> debe tener acceso de Lector a esta carpeta.</span>
                        </div>
                      </div>

                      <div className="settings-actions">
                        <button className="btn-primary settings-save-btn"
                          style={{ opacity: savingSettings==='drive'?0.7:1 }}
                          onClick={() => saveSettings('drive')} disabled={savingSettings === 'drive'}>
                          {savingSettings === 'drive' ? '⏳ Guardando...' : '💾 Guardar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ══ IA ══ */}
                  {settingsSection === 'ai' && (
                    <div className="settings-section">
                      <div className="settings-section-header">
                        <div className="settings-card-icon settings-card-icon--ai">
                          <svg style={{ width:22,height:22 }} viewBox="0 0 24 24" fill="none" stroke="white">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="settings-section-title">Proveedores de IA</h2>
                          <p className="settings-section-subtitle">Cadena de proveedores para análisis de contenido</p>
                        </div>
                      </div>

                      {/* ── Grupo 1: Cadena de proveedores ── */}
                      <div className="settings-group">
                        <p className="settings-group-title">Cadena de proveedores</p>
                        <div className="provider-chain-visual">
                          {[
                            { key:'deepseek_enabled',   label:'DeepSeek',   role:'Principal',  step:1 },
                            { key:'gemini_enabled',     label:'Gemini',     role:'Fallback 1', step:2 },
                            { key:'groq_enabled',       label:'Groq',       role:'Fallback 2', step:3 },
                            { key:'openrouter_enabled', label:'OpenRouter', role:'Fallback 3', step:4 },
                          ].map(p => {
                            const isOn = settingsForm[p.key] !== 'false';
                            return (
                              <div key={p.key} className="provider-chain-item">
                                <div className={`provider-chain-node${isOn ? ' active' : ' inactive'}`}>
                                  <div className="provider-chain-step">{p.step}</div>
                                  <div className="provider-chain-info-col">
                                    <span className="provider-chain-name">{p.label}</span>
                                    <span className="provider-chain-role">{p.role}</span>
                                  </div>
                                  <div className={`provider-chain-status${isOn ? ' on' : ' off'}`}>
                                    {isOn ? '● Activo' : '○ Inactivo'}
                                  </div>
                                  <label className="toggle" style={{ margin: 0 }}>
                                    <input
                                      type="checkbox"
                                      checked={isOn}
                                      onChange={e => handleSettingChange(p.key, e.target.checked ? 'true' : 'false')}
                                    />
                                    <span className="toggle-track"><span className="toggle-thumb"></span></span>
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                          <div className="provider-chain-item">
                            <div className="provider-chain-node inactive" style={{ opacity: 0.6 }}>
                              <div className="provider-chain-step" style={{ background:'var(--text-muted)' }}>5</div>
                              <div className="provider-chain-info-col">
                                <span className="provider-chain-name">Palabras clave</span>
                                <span className="provider-chain-role">Último recurso</span>
                              </div>
                              <div className="provider-chain-status off">● Siempre activo</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── Grupo 2: Modelo y parámetros ── */}
                      <div className="settings-group">
                        <p className="settings-group-title">Modelo y parámetros</p>
                        <div className="settings-field">
                          <label className="settings-label">Modelo de Gemini</label>
                          <p className="settings-hint">Modelo utilizado cuando Gemini actúa como proveedor activo</p>
                          <select
                            className="settings-input"
                            value={settingsForm.gemini_model || 'gemini-2.0-flash'}
                            onChange={e => handleSettingChange('gemini_model', e.target.value)}
                          >
                            <option value="gemini-2.0-flash">gemini-2.0-flash — Recomendado (equilibrio velocidad/calidad)</option>
                            <option value="gemini-2.5-flash">gemini-2.5-flash — Más potente (mayor latencia)</option>
                            <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite — Más rápido (menor detalle)</option>
                          </select>
                        </div>
                        <div className="settings-params-grid">
                          <div className="settings-field">
                            <label className="settings-label">
                              Temperatura: <strong>{parseFloat(settingsForm.ai_temperature || 0.05).toFixed(2)}</strong>
                            </label>
                            <p className="settings-hint">Aleatoriedad de respuestas. 0.0 = determinista · 1.0 = creativo</p>
                            <input
                              className="settings-range"
                              type="range" min="0" max="1" step="0.05"
                              value={parseFloat(settingsForm.ai_temperature || 0.05)}
                              onChange={e => handleSettingChange('ai_temperature', e.target.value)}
                            />
                            <div className="range-labels"><span>0.0 Preciso</span><span>1.0 Creativo</span></div>
                          </div>
                          <div className="settings-field">
                            <label className="settings-label">
                              Tokens máximos: <strong>{settingsForm.ai_max_tokens || 2000}</strong>
                            </label>
                            <p className="settings-hint">Límite de respuesta por llamada. Más tokens = observaciones más detalladas</p>
                            <input
                              className="settings-range"
                              type="range" min="500" max="4000" step="100"
                              value={settingsForm.ai_max_tokens || 2000}
                              onChange={e => handleSettingChange('ai_max_tokens', e.target.value)}
                            />
                            <div className="range-labels"><span>500 (rápido)</span><span>4000 (detallado)</span></div>
                          </div>
                        </div>
                      </div>

                      {/* ── Grupo 3: API Keys ── */}
                      <div className="settings-group">
                        <p className="settings-group-title">API Keys por proveedor</p>
                        <p className="settings-hint" style={{ marginBottom: 16 }}>
                          Las keys agregadas aquí se combinan con las del entorno. Las de Gemini se rotan automáticamente.
                          Los valores se almacenan de forma segura — solo se muestran los primeros 8 caracteres.
                        </p>
                        <div className="api-keys-grid">
                          {[
                            { settingKey: 'gemini_api_keys',      short: 'gemini',      label: 'Gemini',      color: '#4285F4', note: 'Soporta múltiples keys con rotación automática' },
                            { settingKey: 'deepseek_api_keys',    short: 'deepseek',    label: 'DeepSeek',    color: '#ff8c42', note: 'Primer proveedor activo en la cadena' },
                            { settingKey: 'groq_api_keys',        short: 'groq',        label: 'Groq',        color: '#F55036', note: 'Fallback 2 — Llama 3' },
                            { settingKey: 'openrouter_api_keys',  short: 'openrouter',  label: 'OpenRouter',  color: '#7C3AED', note: 'Fallback 3 — múltiples modelos gratuitos' },
                          ].map(p => {
                            const storedKeys = settingsForm[p.settingKey];
                            const keysList = Array.isArray(storedKeys) ? storedKeys : [];
                            return (
                              <div key={p.settingKey} className="api-key-card">
                                <div className="api-key-card-header" style={{ borderColor: p.color }}>
                                  <span className="api-key-card-label" style={{ color: p.color }}>{p.label}</span>
                                  <span className="api-key-count">{keysList.length} key{keysList.length !== 1 ? 's' : ''}</span>
                                </div>
                                <p className="api-key-note">{p.note}</p>
                                {keysList.length > 0 && (
                                  <div className="api-key-list">
                                    {keysList.map((k, i) => (
                                      <div key={i} className="api-key-chip">
                                        <code className="api-key-chip-value">{k}</code>
                                        <button
                                          className="api-key-chip-remove"
                                          disabled={!!apiKeyLoading[`${p.settingKey}_${i}`]}
                                          onClick={() => removeApiKey(p.settingKey, i)}
                                          title="Eliminar esta key"
                                        >
                                          {apiKeyLoading[`${p.settingKey}_${i}`] ? '⏳' : '×'}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="api-key-add-row">
                                  <input
                                    className="settings-input api-key-input"
                                    type="password"
                                    placeholder="Pegar nueva API key..."
                                    value={newApiKey[p.short]}
                                    onChange={e => setNewApiKey(prev => ({ ...prev, [p.short]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') addApiKey(p.settingKey, p.short); }}
                                  />
                                  <button
                                    className="btn-primary api-key-add-btn"
                                    disabled={!newApiKey[p.short]?.trim() || !!apiKeyLoading[p.settingKey]}
                                    onClick={() => addApiKey(p.settingKey, p.short)}
                                  >
                                    {apiKeyLoading[p.settingKey] ? '⏳' : '+ Agregar'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="settings-actions">
                        <button
                          className="btn-primary settings-save-btn"
                          style={{ opacity: savingSettings==='ai'?0.7:1 }}
                          onClick={() => saveSettings('ai')}
                          disabled={savingSettings === 'ai'}
                        >
                          {savingSettings === 'ai' ? '⏳ Guardando...' : '💾 Guardar IA'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ══ USUARIOS ══ */}
                  {settingsSection === 'users' && (
                    <div className="settings-section">
                      <div className="settings-section-header">
                        <div className="settings-card-icon settings-card-icon--users">
                          <svg style={{ width:22,height:22 }} viewBox="0 0 24 24" fill="none" stroke="white">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="settings-section-title">Gestión de Usuarios</h2>
                          <p className="settings-section-subtitle">Registro, aprobación y duración de sesión</p>
                        </div>
                      </div>

                      <div className="settings-group">
                        <div className="settings-field">
                          <label className="settings-label">Auto-aprobar usuarios nuevos</label>
                          <p className="settings-hint">Si está activo, los estudiantes entran al sistema automáticamente sin revisión manual</p>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={settingsForm.auto_approve_users === 'true'}
                              onChange={e => handleSettingChange('auto_approve_users', e.target.checked ? 'true' : 'false')}
                            />
                            <span className="toggle-track"><span className="toggle-thumb"></span></span>
                            <span className="toggle-value">
                              {settingsForm.auto_approve_users === 'true' ? '✓ Automático' : '⏳ Requiere aprobación manual'}
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="settings-group">
                        <div className="settings-field">
                          <label className="settings-label">
                            Duración de sesión: <strong>{settingsForm.jwt_session_minutes || 30} minutos</strong>
                            {(settingsForm.jwt_session_minutes || 30) >= 60 && (
                              <span className="settings-label-sub"> ({Math.round((settingsForm.jwt_session_minutes || 30) / 60 * 10) / 10} h)</span>
                            )}
                          </label>
                          <p className="settings-hint">Tiempo antes de que el token JWT expire y el usuario deba volver a iniciar sesión</p>
                          <input
                            className="settings-range"
                            type="range" min="5" max="480" step="5"
                            value={settingsForm.jwt_session_minutes || 30}
                            onChange={e => handleSettingChange('jwt_session_minutes', e.target.value)}
                          />
                          <div className="range-labels"><span>5 min</span><span>480 min (8 h)</span></div>
                        </div>
                      </div>

                      <div className="settings-actions">
                        <button
                          className="btn-primary settings-save-btn"
                          style={{ opacity: savingSettings==='users'?0.7:1 }}
                          onClick={() => saveSettings('users')}
                          disabled={savingSettings === 'users'}
                        >
                          {savingSettings === 'users' ? '⏳ Guardando...' : '💾 Guardar Usuarios'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ══ VALIDACIÓN ══ */}
                  {settingsSection === 'validation' && (
                    <div className="settings-section">
                      <div className="settings-section-header">
                        <div className="settings-card-icon settings-card-icon--validation">
                          <svg style={{ width:22,height:22 }} viewBox="0 0 24 24" fill="none" stroke="white">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h2 className="settings-section-title">Criterios de Validación</h2>
                          <p className="settings-section-subtitle">Umbrales, tipos de archivo y límites del sistema</p>
                        </div>
                      </div>

                      <div className="settings-group">
                        <div className="settings-field">
                          <label className="settings-label">
                            Umbral mínimo de cumplimiento: <strong style={{ color: (settingsForm.compliance_threshold || 70) >= 70 ? 'var(--color-success)' : (settingsForm.compliance_threshold || 70) >= 40 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                              {settingsForm.compliance_threshold || 70}%
                            </strong>
                          </label>
                          <p className="settings-hint">Porcentaje mínimo de requisitos cubiertos para considerar una sección como aprobada</p>
                          <input
                            className="settings-range"
                            type="range" min="0" max="100" step="5"
                            value={settingsForm.compliance_threshold || 70}
                            onChange={e => handleSettingChange('compliance_threshold', e.target.value)}
                          />
                          <div className="range-labels"><span>0%</span><span>50%</span><span>100%</span></div>
                        </div>
                      </div>

                      <div className="settings-group">
                        <div className="settings-field">
                          <label className="settings-label">
                            Tamaño máximo de archivo: <strong>{settingsForm.max_upload_file_size_mb || 10} MB</strong>
                          </label>
                          <p className="settings-hint">Límite de tamaño para archivos procesados en el análisis de documentos</p>
                          <input
                            className="settings-range"
                            type="range" min="1" max="50" step="1"
                            value={settingsForm.max_upload_file_size_mb || 10}
                            onChange={e => handleSettingChange('max_upload_file_size_mb', e.target.value)}
                          />
                          <div className="range-labels"><span>1 MB</span><span>50 MB</span></div>
                        </div>
                      </div>

                      <div className="settings-group">
                        <div className="settings-field">
                          <label className="settings-label">Extensiones de archivo permitidas</label>
                          <p className="settings-hint">Tipos de documento aceptados para análisis de contenido</p>
                          <div className="ext-list">
                            {['.pdf', '.docx', '.pptx', '.xlsx'].map(ext => {
                              let currentExts = [];
                              try { currentExts = JSON.parse(settingsForm.allowed_file_extensions || '[]'); } catch { /* ignore */ }
                              const checked = currentExts.includes(ext);
                              return (
                                <label key={ext} className="ext-label">
                                  <input
                                    type="checkbox"
                                    className="checkbox-orange"
                                    checked={checked}
                                    onChange={e => {
                                      let exts = [];
                                      try { exts = JSON.parse(settingsForm.allowed_file_extensions || '[]'); } catch { /* ignore */ }
                                      if (e.target.checked) {
                                        if (!exts.includes(ext)) exts.push(ext);
                                      } else {
                                        exts = exts.filter(x => x !== ext);
                                      }
                                      handleSettingChange('allowed_file_extensions', JSON.stringify(exts));
                                    }}
                                  />
                                  <code style={{ background:'var(--bg-primary)', padding:'2px 8px', borderRadius:4, fontSize:'0.85rem' }}>{ext}</code>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="settings-actions">
                        <button
                          className="btn-primary settings-save-btn"
                          style={{ opacity: savingSettings==='validation'?0.7:1 }}
                          onClick={() => saveSettings('validation')}
                          disabled={savingSettings === 'validation'}
                        >
                          {savingSettings === 'validation' ? '⏳ Guardando...' : '💾 Guardar Validación'}
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="reports-tab">
            {/* Header + Filtros */}
            <div className="reports-tab-header">
              <div>
                <h1>Reportes de Validaciones</h1>
                <p className="subtitle">Estadísticas e historial de validaciones del sistema.</p>
              </div>
              <div className="reports-tab-actions">
                <select
                  className="settings-input filter-select"
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
                  className="settings-input filter-select"
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
                  className="btn-primary settings-save-btn"
                  onClick={() => { setHistoryPage(0); loadReports(reportFilter, 0); }}
                  disabled={reportLoading}
                >
                  {reportLoading ? '⏳' : '🔄 Actualizar'}
                </button>
                <button className="btn-success" onClick={handleExportCSV}>
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
                    <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto' }}>
                      <table className="report-table">
                        <thead>
                          <tr>
                            {['Carpeta', 'Curso', 'Validaciones', 'Promedio'].map(h => (
                              <th key={h} style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>{h}</th>
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
                  <div className="reports-tab-header">
                    <h3 style={{ margin: 0 }}>📋 Historial de Validaciones</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {reportHistory.total} registros — pág. {historyPage + 1} / {Math.max(1, Math.ceil(reportHistory.total / HISTORY_PAGE_SIZE))}
                      </span>
                      <button
                        className="pagination-btn"
                        disabled={historyPage === 0 || reportLoading}
                        onClick={() => { const p = historyPage - 1; setHistoryPage(p); loadReports(reportFilter, p); }}
                      >← Anterior</button>
                      <button
                        className="pagination-btn"
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
                    <div className="table-scroll table-scroll--lg">
                      <table className="report-table">
                        <thead>
                          <tr>
                            {['Fecha', 'Carpeta', 'Curso', 'Tipo', 'Cumplimiento', 'Estado', 'Validado por'].map(h => (
                              <th key={h}>{h}</th>
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
                                <span className={`status-badge status-badge--${r.validation_type === 'structure' ? 'structure' : 'content'}`}>
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
                              <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                {r.validated_by_name || '—'}
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
            <div className="user-filters">
              <input
                type="text"
                className="settings-input"
                style={{ flex: '1', minWidth: '200px' }}
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
                        {['Usuario', 'Correo', 'Rol', 'Estado', 'Aprobado', 'Registrado', 'Docente', 'Actividad', 'Acciones'].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.users.length === 0 ? (
                        <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No hay usuarios que coincidan</td></tr>
                      ) : allUsers.users.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="user-table-avatar">
                                {u.nombre?.[0]}{u.apellidos?.[0]}
                              </div>
                              {u.nombre} {u.apellidos}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{u.correo}</td>
                          <td>
                            <span className={`status-badge status-badge--${u.role === 'admin' ? 'structure' : 'content'}`}>
                              {u.role === 'admin' ? '🛡️ Admin' : '🎓 Estudiante'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge status-badge--${u.is_active ? 'compliant' : 'non-compliant'}`}>
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
                            {u.is_teacher
                              ? <span className="status-badge status-badge--compliant">🏫 Docente</span>
                              : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                            }
                          </td>
                          <td style={{ minWidth: 140 }}>
                            {(() => {
                              const act = u.activity;
                              const pct = act?.avg_compliance;
                              const pctColor = pct == null ? 'var(--text-muted)' : pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
                              const timeAgo = (iso) => {
                                if (!iso) return null;
                                const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
                                if (diff < 60) return 'hace un momento';
                                if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
                                if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
                                if (diff < 2592000) return `hace ${Math.floor(diff/86400)} días`;
                                return new Date(iso).toLocaleDateString('es-ES');
                              };
                              if (!act || act.validation_count === 0) return (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sin actividad</span>
                              );
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                      📋 {act.validation_count} validacion{act.validation_count !== 1 ? 'es' : ''}
                                    </span>
                                    {pct != null && (
                                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: `${pctColor}22`, color: pctColor }}>
                                        {pct}%
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                    🕐 {timeAgo(act.last_validation_at)}
                                  </span>
                                </div>
                              );
                            })()}
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
                                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}
                                onClick={() => openResetPasswordModal(u)}
                                title="Resetear contraseña"
                              >
                                🔑
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

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div className="audit-tab">
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1>Log de Auditoría</h1>
                <p className="subtitle">{auditLog.total} acciones registradas</p>
              </div>
              <button
                className="btn-primary"
                onClick={() => { loadAuditLog(0); setAuditPage(0); }}
                disabled={auditLoading}
              >
                {auditLoading ? 'Cargando...' : '↻ Actualizar'}
              </button>
            </div>

            {auditLoading && auditLog.entries.length === 0 ? (
              <div className="empty-state"><p>Cargando log de auditoría...</p></div>
            ) : auditLog.entries.length === 0 ? (
              <div className="empty-state"><p>No hay acciones registradas aún.</p></div>
            ) : (
              <div className="table-container">
                <table className="history-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Usuario</th>
                      <th>Acción</th>
                      <th>Objetivo</th>
                      <th>Detalles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.entries.map(e => {
                      const actionColors = {
                        'user.approve': '#22c55e',
                        'user.reject': '#ef4444',
                        'user.toggle_active': '#f59e0b',
                        'user.update_config': '#6366f1',
                        'settings.update': '#3b82f6',
                        'settings.bulk_update': '#0ea5e9',
                        'api_key.add': '#10b981',
                        'api_key.delete': '#f43f5e',
                      };
                      const color = actionColors[e.action] || '#94a3b8';
                      return (
                        <tr key={e.id}>
                          <td className="history-date" style={{ whiteSpace: 'nowrap' }}>
                            {e.created_at ? new Date(e.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {e.user_email || '—'}
                          </td>
                          <td>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, background: color + '22', color }}>
                              {e.action}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            {e.target_type && <span style={{ marginRight: 4, opacity: 0.7 }}>[{e.target_type}]</span>}
                            {e.target_id ? <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{e.target_id.length > 24 ? e.target_id.slice(0, 24) + '…' : e.target_id}</span> : '—'}
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '260px' }}>
                            {e.details ? (
                              <details>
                                <summary style={{ cursor: 'pointer', color: 'var(--accent-blue)' }}>ver</summary>
                                <pre style={{ margin: '4px 0 0', fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                  {JSON.stringify(e.details, null, 2)}
                                </pre>
                              </details>
                            ) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {auditLog.total > AUDIT_PAGE_SIZE && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {auditPage * AUDIT_PAGE_SIZE + 1}–{Math.min((auditPage + 1) * AUDIT_PAGE_SIZE, auditLog.total)} de {auditLog.total}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', opacity: auditPage === 0 ? 0.4 : 1 }}
                        disabled={auditPage === 0}
                        onClick={() => { const p = auditPage - 1; setAuditPage(p); loadAuditLog(p); }}
                      >← Anterior</button>
                      <button
                        style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', opacity: (auditPage + 1) * AUDIT_PAGE_SIZE >= auditLog.total ? 0.4 : 1 }}
                        disabled={(auditPage + 1) * AUDIT_PAGE_SIZE >= auditLog.total}
                        onClick={() => { const p = auditPage + 1; setAuditPage(p); loadAuditLog(p); }}
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
