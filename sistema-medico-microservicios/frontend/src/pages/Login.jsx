// src/pages/Login.jsx
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';
import '../css/styles.css';

function Login() {
  const navigate = useNavigate();

  // Estados generales
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('#606770');
  const [loading, setLoading] = useState(false);

  // Estados para 2FA y Modales
  const [showModal, setShowModal] = useState(false);
  const [otp, setOtp] = useState(new Array(6).fill(""));
  const [tempData, setTempData] = useState(null);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutos
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  // Lógica del cronómetro
  useEffect(() => {
    let timer;
    if (showModal && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && showModal) {
      clearInterval(timer);
      setShowModal(false);
      setShowTimeoutModal(true);
    }
    return () => clearInterval(timer);
  }, [showModal, timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('Verificando...');
    setLoading(true);
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const body = await res.json();

      if (res.ok && body.require2FA) {
        setTempData({ userId: body.userId, email: body.email });
        setTimeLeft(600);
        setShowModal(true);
        setMsg('');
      } else if (!res.ok) {
        setMsg(body.message || 'Credenciales incorrectas.');
        setMsgColor('#dc2626');
      }
    } catch (err) {
      setMsg('Error de conexión.');
      setMsgColor('#dc2626');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (element, index) => {
    if (isNaN(element.value)) return false;
    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);
    if (element.value !== "" && element.nextSibling) element.nextSibling.focus();
  };

  const handleVerify2FA = async () => {
    if (timeLeft === 0) {
      setErrorText("El tiempo ha expirado. Por favor, intenta iniciar sesión de nuevo.");
      setShowErrorModal(true);
      setShowModal(false);
      return;
    }

    const code = otp.join("");
    if (code.length < 6) {
      setErrorText("Por favor, ingresa el código completo de 6 dígitos.");
      setShowErrorModal(true);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: tempData.userId, code: code })
      });
      const body = await res.json();

      if (res.ok) {
        sessionStorage.setItem('token', body.token);
        sessionStorage.setItem('usuarioId', body.user.id);
        sessionStorage.setItem('rolId', body.user.rol);
        if (body.user.rol === 1) navigate('/dashboard-medico');
        else if (body.user.rol === 3) navigate('/dashboard-admin');
        else navigate('/dashboard-paciente');
      } else {
        setErrorText(body.message || "Código incorrecto o expirado.");
        setShowErrorModal(true);
        setOtp(new Array(6).fill(""));
      }
    } catch (err) {
      setErrorText("Ocurrió un error al conectar con el servidor.");
      setShowErrorModal(true);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="main-container">
        {/* Lado Izquierdo: Branding */}
        <div className="brand-section">
          <h1 className="logo-apolo-unified">APOLO</h1>
          <p>Gestiona tu historial clínico de forma segura.</p>
        </div>

        {/* Lado Derecho: Login Card */}
        <div className="login-section">
          <div className="card">
            <div className="msg" style={{ color: msgColor }}>{msg}</div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <input type="email" name="email" placeholder="Correo electrónico" required autoFocus />
              </div>
              <div className="form-group">
                <input type="password" name="password" placeholder="Contraseña" required />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Cargando...' : 'Iniciar sesión'}
              </button>
            </form>

            <Link to="/forgot" className="forgot-link">¿Olvidaste tu contraseña?</Link>

            <div className="separator"></div>

            <div>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => navigate('/register')}
              >
                Crear cuenta nueva
              </button>
            </div>
          </div>

          <p className="fb-footer-text">
            <strong>KeiMag</strong> para ti y tu empresa
          </p>
        </div>
      </div>

      {/* --- MODAL DE 2FA --- */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Verificación de seguridad</h2>
            <p>Introduce el código enviado a <strong>{tempData?.email}</strong></p>

            <div style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '15px', fontSize: '18px' }}>
              El código expira en: {formatTime(timeLeft)}
            </div>

            <div className="otp-container">
              {otp.map((data, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength="1"
                  value={data}
                  onChange={e => handleOtpChange(e.target, index)}
                  onFocus={e => e.target.select()}
                  className="otp-input"
                  disabled={timeLeft === 0}
                />
              ))}
            </div>

            <div className="modal-actions-inline">
              <button className="btn btn-primary" onClick={handleVerify2FA} disabled={timeLeft === 0} style={{ flex: 1 }}>
                Continuar
              </button>
              <button className="btn btn-danger" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE ERROR --- */}
      {showErrorModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-card error-modal">
            <div className="error-icon">✕</div>
            <h2>Error de validación</h2>
            <p>{errorText}</p>
            <button className="btn btn-primary" onClick={() => setShowErrorModal(false)}>Aceptar</button>
          </div>
        </div>
      )}

      {/* --- MODAL DE TIEMPO AGOTADO --- */}
      {showTimeoutModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-card error-modal">
            <div className="error-icon" style={{ backgroundColor: '#fff4e5', color: '#ff9800', borderColor: '#ff9800' }}>
              🕒
            </div>
            <h2 style={{ color: '#ff9800' }}>Tiempo Agotado</h2>
            <p>El código de seguridad ha expirado. Por favor, vuelve a iniciar sesión.</p>
            <button className="btn btn-primary" onClick={() => setShowTimeoutModal(false)}>Regresar</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;