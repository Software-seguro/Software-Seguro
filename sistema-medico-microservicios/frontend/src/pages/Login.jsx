// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Link reemplaza a <a href>
import { API_URL } from '../config';
import '../css/styles.css';

function Login() {
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('#606770');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('Verificando...');
    setMsgColor('#606770');

    // Capturamos datos del formulario
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
      // OJO: Apuntamos al Gateway -> Auth Service
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const body = await res.json();

      if (res.ok) {
        setMsg('¡Bienvenido a Apolo!');
        setMsgColor('green');

        // Guardamos sesión igual que antes
        sessionStorage.setItem('token', body.token);
        sessionStorage.setItem('usuarioId', body.user.id);
        sessionStorage.setItem('email', body.user.email);
        sessionStorage.setItem('rolId', body.user.rol); // Asegúrate que el backend devuelva 'rol' o 'rolId'

        // Redirección (Usamos navigate de React en lugar de window.location)
        setTimeout(() => {
          if (body.user.rol === 1) { // 1 = Medico
            navigate('/dashboard-medico');
          } else {
            navigate('/dashboard-paciente');
          }
        }, 1000);

      } else {
        setMsg(body.message || 'Correo o contraseña incorrectos.');
        setMsgColor('#dc2626');
      }
    } catch (err) {
      console.error(err);
      setMsg('No se pudo conectar con el servidor.');
      setMsgColor('#dc2626');
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="main-container">
        {/* Branding */}
        <div className="brand-section">
          <h1>APOLO</h1>
          <p>Gestiona tu historial clínico, consultas y conéctate con especialistas de forma segura.</p>
        </div>

        {/* Login Card */}
        <div className="login-section">
          <div className="card">
            <div className="msg" style={{ color: msgColor }}>{msg}</div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <input type="email" name="email" placeholder="Correo electrónico o usuario" required autoFocus />
              </div>
              <div className="form-group">
                <input type="password" name="password" placeholder="Contraseña" required />
              </div>
              <button type="submit" className="btn btn-primary">Iniciar sesión</button>
            </form>

            <Link to="/forgot" className="forgot-link">¿Olvidaste tu contraseña?</Link>
            <div className="separator"></div>
            <Link to="/register" className="btn btn-success">Crear cuenta nueva</Link>
          </div>
          
          <div style={{ marginTop: '20px', fontSize: '13px', color: '#666', textAlign: 'center' }}>
            <p><strong>KeiMag</strong> para ti y tu empresa</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;