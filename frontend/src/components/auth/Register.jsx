import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    correo: '',
    password: '',
    confirm_password: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    // Limpiar error del campo al escribir
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: '',
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (formData.nombre.length < 2) {
      newErrors.nombre = 'El nombre debe tener al menos 2 caracteres';
    }

    if (formData.apellidos.length < 2) {
      newErrors.apellidos = 'Los apellidos deben tener al menos 2 caracteres';
    }

    if (!/\S+@\S+\.\S+/.test(formData.correo)) {
      newErrors.correo = 'Correo electrónico inválido';
    }

    if (formData.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
    }

    if (!/(?=.*[a-z])/.test(formData.password)) {
      newErrors.password = 'La contraseña debe contener al menos una minúscula';
    }

    if (!/(?=.*[A-Z])/.test(formData.password)) {
      newErrors.password = 'La contraseña debe contener al menos una mayúscula';
    }

    if (!/(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'La contraseña debe contener al menos un número';
    }

    if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = 'Las contraseñas no coinciden';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    const result = await register(formData);

    if (result.success) {
      if (result.needsApproval) {
        // Mostrar modal de éxito
        setShowSuccessModal(true);
        setTimeout(() => {
          navigate('/login');
        }, 5000);
      } else {
        navigate('/dashboard');
      }
    } else {
      setErrors({ general: result.error });
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-back-link">
          <Link to="/" className="back-button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver a inicio
          </Link>
        </div>
        <div className="auth-header">
          <h1 className="gradient-text">Crear Cuenta</h1>
          <p>Únete a la comunidad COCOCYS</p>
        </div>

        {errors.general && (
          <div className={errors.general.startsWith('✅') ? 'success-message' : 'error-message'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nombre">Nombre</label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                required
                autoComplete="given-name"
                placeholder="Juan"
              />
              {errors.nombre && <span className="field-error">{errors.nombre}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="apellidos">Apellidos</label>
              <input
                type="text"
                id="apellidos"
                name="apellidos"
                value={formData.apellidos}
                onChange={handleChange}
                required
                autoComplete="family-name"
                placeholder="Pérez"
              />
              {errors.apellidos && <span className="field-error">{errors.apellidos}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="correo">Correo Electrónico</label>
            <input
              type="email"
              id="correo"
              name="correo"
              value={formData.correo}
              onChange={handleChange}
              required
              autoComplete="email"
              placeholder="tu@email.com"
            />
            {errors.correo && <span className="field-error">{errors.correo}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              placeholder="••••••••"
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
            <span className="field-hint">
              Mínimo 8 caracteres, una mayúscula, una minúscula y un número
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="confirm_password">Confirmar Contraseña</label>
            <input
              type="password"
              id="confirm_password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              placeholder="••••••••"
            />
            {errors.confirm_password && <span className="field-error">{errors.confirm_password}</span>}
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-small"></span>
                Creando cuenta...
              </>
            ) : (
              'Crear Cuenta'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            ¿Ya tienes cuenta? <Link to="/login">Inicia sesión aquí</Link>
          </p>
        </div>
      </div>

      {/* Modal de Éxito */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="success-modal">
            <div className="success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2>¡Registro Exitoso!</h2>
            <p className="success-description">
              Tu cuenta ha sido creada correctamente y está <strong>pendiente de aprobación</strong> por un administrador.
            </p>
            <div className="success-details">
              <div className="detail-item">
                <span className="detail-icon">📧</span>
                <span>Te notificaremos por correo cuando tu cuenta sea aprobada</span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">⏱️</span>
                <span>El proceso suele tomar menos de 24 horas</span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">🔒</span>
                <span>No podrás iniciar sesión hasta que un admin apruebe tu cuenta</span>
              </div>
            </div>
            <p className="redirect-message">
              Serás redirigido al inicio de sesión en unos segundos...
            </p>
            <button 
              onClick={() => navigate('/login')}
              className="modal-button"
            >
              Ir al inicio de sesión ahora
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Register;
