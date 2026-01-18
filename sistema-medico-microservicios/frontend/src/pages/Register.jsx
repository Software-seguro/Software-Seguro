// frontend/src/pages/Register.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';
import '../css/styles.css';

function Register() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');
  const [isMedico, setIsMedico] = useState(false);
  const [notification, setNotification] = useState({ show: false, title: "", text: "", type: "error", onConfirm: null });

  // Estado para capturar errores mientras se escribe
  const [errors, setErrors] = useState({ password: "", email: "", nombre: "", apellido: "", identificacion: "", telefono: "" });

  const showAlert = (title, text, type = "error", action = null) => {
    setNotification({ show: true, title, text, type, onConfirm: action });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let errorMsg = "";

    // 1. Validación de Nombres y Apellidos (No números)
    if (name === "nombre" || name === "apellido") {
      const regexLetras = /^[a-zA-ZÀ-ÿ\s]*$/;
      if (!regexLetras.test(value)) errorMsg = "Solo se permiten letras.";
    }

    // 2. Validación de Correo (Formato con @)
    if (name === "email") {
      const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value !== "" && !regexEmail.test(value)) errorMsg = "Formato de correo inválido (ejemplo@correo.com).";
    }

    // 3. Validación de Password (Mínimo 6)
    if (name === "password") {
      if (value.length > 0 && value.length < 6) errorMsg = "Mínimo 6 caracteres.";
    }

    // 4. Validación de Identificación y Teléfono (Solo números, no letras)
    if (name === "identificacion" || name === "telefono") {
      const regexNumeros = /^[0-9]*$/;
      if (!regexNumeros.test(value)) errorMsg = "Solo se permiten números.";
    }

    setErrors(prev => ({ ...prev, [name]: errorMsg }));
  };

  const handleRoleChange = (e) => {
    setIsMedico(e.target.value === 'medico');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    const rolId = isMedico ? 1 : 2;

    // --- VALIDACIONES ANTES DE ENVIAR ---
    const fecha = new Date(data.fechaNacimiento);
    const anio = fecha.getFullYear();
    if (anio < 1900 || anio > 2100) {
      return showAlert("Fecha Inválida", "Por favor ingresa una fecha de nacimiento realista.");
    }

    let nuevoUsuarioId = null;
    // Verificar si hay errores visuales en rojo activos
    if (Object.values(errors).some(err => err !== "")) {
      return showAlert("Datos inválidos", "Por favor, corrige los campos marcados en rojo.");
    }

    // Correo obligatorio con formato
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(data.email)) return showAlert("Correo inválido", "Debes ingresar un correo electrónico válido.");

    // Licencia obligatoria para Doctores
    if (isMedico && (!data.numeroLicencia || data.numeroLicencia.trim() === "")) {
      return showAlert("Falta Licencia", "Para registrarse como médico, el número de licencia es obligatorio.");
    }

    try {
      setMsg('Verificando disponibilidad de documentos...');

      // --- PASO 0: VALIDACIÓN DE DUPLICADOS EN CORE ---
      const resVal = await fetch(`${API_URL}/api/core/validate-registry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificacion: data.identificacion,
          licencia: isMedico ? data.numeroLicencia : null
        })
      });

      const bodyVal = await resVal.json();

      if (!resVal.ok) {
        // SI ENTRA AQUÍ, NO SE REGISTRA NADA EN AUTH.
        return showAlert("Documento Duplicado", bodyVal.message);
      }

      // --- PASO 1: REGISTRAR EN AUTH (Solo si el paso 0 fue exitoso) ---
      setMsg('Registrando cuenta de acceso...');
      const resAuth = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password, rolId })
      });

      const bodyAuth = await resAuth.json();
      if (!resAuth.ok) return showAlert("Error de Cuenta", bodyAuth.message || "El correo ya existe.");

      // --- PASO 2: CREAR PERFIL EN CORE ---
      setMsg('Configurando perfil médico/paciente...');
      let profileUrl = rolId === 1 ? `${API_URL}/api/core/medicos` : `${API_URL}/api/core/pacientes`;

      const resProfile = await fetch(profileUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bodyAuth.token}`
        },
        body: JSON.stringify(data)
      });

      if (resProfile.ok) {
        showAlert("¡Éxito!", "Cuenta y perfil creados correctamente.", "success", () => navigate('/'));
      } else {
        // Si llegara a fallar aquí (muy raro), al menos ya sabemos que el Paso 0 falló por algo más
        await fetch(`${API_URL}/api/auth/users/${creadoUsuarioId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${bodyAuth.token}` }
        });
        const errorMsg = await resProfile.text();
        console.error("Error en Perfil:", errorMsg);
        throw new Error("No se pudo completar la configuración del perfil.");
      }
    } catch (err) {
      showAlert("Error Crítico", err.message);
    }
  };

  return (
    <div className="auth-wrapper" style={{ flexDirection: 'column' }}>

      <div className="brand-section" style={{ textAlign: 'center', padding: 0, marginBottom: '20px' }}>
        <h1 className="logo-apolo-unified">APOLO</h1>
      </div>

      <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
        <div className="card" style={{ textAlign: 'left' }}>
          <h2 style={{ textAlign: 'center', fontSize: '24px', marginTop: 0 }}>Crear cuenta nueva</h2>
          <div className="separator"></div>

          {msg && <div className="msg" style={{ textAlign: 'center', color: '#606770', fontSize: '13px' }}>{msg}</div>}

          <form onSubmit={handleSubmit} noValidate>

            <div className="form-row">
              <div className="form-group">
                <label className="field-label">Nombre</label>
                <input type="text" name="nombre" placeholder="Ej: Juan" required onChange={handleInputChange} maxLength="20" />
                {errors.nombre && <span className="error-label">{errors.nombre}</span>}
              </div>
              <div className="form-group">
                <label className="field-label">Apellido</label>
                <input type="text" name="apellido" placeholder="Ej: Pérez" required onChange={handleInputChange} maxLength="20" />
                {errors.apellido && <span className="error-label">{errors.apellido}</span>}
              </div>
            </div>

            <div className="form-group">
              <label className="field-label">Correo electrónico</label>
              <input type="email" name="email" placeholder="ejemplo@correo.com" required onChange={handleInputChange} />
              {errors.email && <span className="error-label">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label className="field-label">Contraseña nueva</label>
              <input type="password" name="password" placeholder="Mínimo 6 caracteres" required onChange={handleInputChange} />
              {errors.password && <span className="error-label">{errors.password}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="field-label">Identificación</label>
                <input type="text" name="identificacion" placeholder="1234567890" required onChange={handleInputChange} maxLength="10" />
                {errors.identificacion && <span className="error-label">{errors.identificacion}</span>}
              </div>
              <div className="form-group">
                <label className="field-label">Teléfono</label>
                <input type="tel" name="telefono" placeholder="0999999999" onChange={handleInputChange} maxLength="10" />
                {errors.telefono && <span className="error-label">{errors.telefono}</span>}
              </div>
            </div>

            {!isMedico && (
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="field-label">Fecha de Nacimiento</label>
                <input type="date" name="fechaNacimiento" required />
              </div>
            )}

            <div className="form-group">
              <label className="field-label">Tipo de cuenta</label>
              <select name="role" onChange={handleRoleChange} className="fb-select">
                <option value="paciente">Soy Paciente</option>
                <option value="medico">Soy Médico / Especialista</option>
              </select>
            </div>

            {isMedico && (
              <div className="medico-extra-box" style={{ animation: 'fadeIn 0.3s' }}>
                <div className="form-group">
                  <label className="field-label">Especialidad</label>
                  <input type="text" name="especialidad" placeholder="Ej: Cardiología" maxLength="20" />
                </div>
                <div className="form-group">
                  <label className="field-label">Número de Licencia</label>
                  <input type="text" name="numeroLicencia" placeholder="Obligatorio para médicos" maxLength="10" />
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-success btn-full btn-thin" style={{ width: '100%', marginTop: '15px' }}>
              Registrarte
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <Link to="/" style={{ color: '#1877f2', textDecoration: 'none', fontSize: '15px' }}>¿Ya tienes una cuenta?</Link>
          </div>
        </div>

        <p className="fb-footer-text">
          <strong>KeiMag</strong> para ti y tu empresa
        </p>
      </div>

      {notification.show && (
        <div className="modal-overlay">
          <div className="modal-card notification-modal">
            <div className={notification.type === "success" ? "success-icon" : "error-icon"}>
              {notification.type === "success" ? "✓" : "✕"}
            </div>
            <h2>{notification.title}</h2>
            <p>{notification.text}</p>
            <button className="btn btn-primary" onClick={() => { setNotification({ ...notification, show: false }); if (notification.onConfirm) notification.onConfirm(); }}>Aceptar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Register;