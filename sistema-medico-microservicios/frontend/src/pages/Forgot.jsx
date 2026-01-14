import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Para navegar sin recargar
import { API_URL } from '../config';

function Forgot() {
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('#606770');
  const [isDisabled, setIsDisabled] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('Procesando...');
    setMsgColor('#606770');

    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const confirm = formData.get('confirm');

    // 1. Validaciones Frontend
    if (password !== confirm) {
        setMsg('Las contraseñas no coinciden.');
        setMsgColor('#dc2626');
        return;
    }

    if (password.length < 6) {
        setMsg('La contraseña debe tener al menos 6 caracteres.');
        setMsgColor('#dc2626');
        return;
    }

    try {
        // Llamada al Auth Service a través del Gateway
        const res = await fetch(`${API_URL}/api/auth/forgot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const body = await res.json();

        if (res.ok) {
            setMsg(body.message || 'Contraseña cambiada con éxito.');
            setMsgColor('#42b72a'); // Verde éxito
            setIsDisabled(true); // Deshabilitar formulario

            // Redirigir al Login después de 2 segundos
            setTimeout(() => {
                navigate('/');
            }, 2000);
        } else {
            setMsg(body.message || 'Error al cambiar la contraseña.');
            setMsgColor('#dc2626');
        }

    } catch (err) {
        console.error(err);
        setMsg('Error de conexión con el servidor.');
        setMsgColor('#dc2626');
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
        
        <h1 style={{ textAlign: 'center', color: 'var(--primary)', marginBottom: '20px' }}>APOLO</h1>

        <div className="card">
            <h2 style={{ marginTop: 0, fontSize: '24px' }}>Restablecer contraseña</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.4 }}>
                Ingresa tu correo electrónico asociado y define tu nueva contraseña para recuperar el acceso.
            </p>

            <div className="msg" style={{ color: msgColor, fontWeight: 'bold' }}>{msg}</div>

            <form onSubmit={handleSubmit}>
                <fieldset disabled={isDisabled} style={{ border: 'none', padding: 0, margin: 0 }}>
                    <div className="form-group">
                        <input type="email" name="email" required placeholder="Correo electrónico" />
                    </div>

                    <div className="form-group">
                        <input type="password" name="password" required placeholder="Nueva contraseña" />
                    </div>

                    <div className="form-group">
                        <input type="password" name="confirm" required placeholder="Confirmar nueva contraseña" />
                    </div>

                    <div className="form-group" style={{ marginTop: '20px' }}>
                        <button type="submit" className="btn btn-primary">Cambiar contraseña</button>
                    </div>
                </fieldset>
            </form>

            <div className="separator"></div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
                <Link to="/" style={{ textDecoration: 'none', color: 'var(--text-main)', padding: '8px 16px', background: '#e4e6eb', borderRadius: '6px', fontWeight: 600, fontSize: '15px' }}>
                    Cancelar
                </Link>
            </div>
        </div>
    </div>
  );
}

export default Forgot;