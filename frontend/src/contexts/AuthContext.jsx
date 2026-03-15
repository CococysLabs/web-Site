import { createContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verificar si hay un usuario logueado al cargar
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await authAPI.getCurrentUser();
          setUser(userData);
        } catch (err) {
          console.error('Error al verificar autenticación:', err);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const register = async (userData) => {
    try {
      setError(null);
      // Enviar datos en el formato que espera el backend
      const backendData = {
        nombre: userData.nombre,
        apellidos: userData.apellidos,
        correo: userData.correo,
        password: userData.password,
        confirm_password: userData.confirm_password
      };
      await authAPI.register(backendData);
      // Registro exitoso - estudiante debe esperar aprobación
      return { 
        success: true, 
        message: 'Registro exitoso. Tu cuenta está pendiente de aprobación por un administrador.',
        needsApproval: true 
      };
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Error al registrar usuario';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const login = async (credentials) => {
    try {
      setError(null);
      // Convertir email a correo si viene con ese campo
      const loginData = {
        correo: credentials.email || credentials.correo,
        password: credentials.password
      };
      await authAPI.login(loginData);
      const userData = await authAPI.getCurrentUser();
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      return { success: true, user: userData };
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Error al iniciar sesión';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
