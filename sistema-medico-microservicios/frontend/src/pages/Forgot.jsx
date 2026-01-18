// frontend/src/pages/Forgot.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../css/styles.css';
import { auth } from "../firebaseConfig";
import { sendPasswordResetEmail } from "firebase/auth";
import { useNavigate } from 'react-router-dom';

function Forgot() {
    const [msg, setMsg] = useState('');
    const [msgColor, setMsgColor] = useState('#606770');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg('Buscando cuenta...');
        setMsgColor('#606770');
        setLoading(true);

        const formData = new FormData(e.target);
        const email = formData.get('email');

        const actionCodeSettings = {
            // Esta URL es a donde irá el usuario al hacer clic en el correo
            url: 'http://localhost:5173/reset-password',
            handleCodeInApp: true,
        };

        try {
            // Enviamos el correo a través de Firebase
            await sendPasswordResetEmail(auth, email, actionCodeSettings);

            setMsg('¡Enlace enviado! Revisa tu bandeja de entrada para continuar.');
            setMsgColor('#42b72a'); // Verde éxito
            setSent(true); // Ocultar el botón para evitar reenvíos
        } catch (error) {
            console.error("Error Firebase:", error.code);
            if (error.code === 'auth/user-not-found') {
                setMsg('No encontramos ninguna cuenta con ese correo.');
            } else {
                setMsg('Hubo un error al enviar el correo. Inténtalo más tarde.');
            }
            setMsgColor('#dc2626');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
                <h1 className="logo-apolo-unified">APOLO</h1>
                <div className="card">
                    <h2 style={{ marginTop: 0, fontSize: '20px', textAlign: 'left' }}>Encuentra tu cuenta</h2>
                    <div className="separator" style={{ margin: '10px 0 20px 0' }}></div>

                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.4, textAlign: 'left', fontSize: '17px' }}>
                        Introduce tu correo electrónico para buscar tu cuenta y enviarte un enlace de recuperación.
                    </p>

                    {msg && <div className="msg" style={{ color: msgColor, fontWeight: 'bold', marginBottom: '15px' }}>{msg}</div>}

                    {!sent && (
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    placeholder="Correo electrónico"
                                    autoFocus
                                    style={{ padding: '14px' }}
                                />
                            </div>

                            <div className="modal-actions-inline" style={{ marginTop: '20px', borderTop: '1px solid #dddfe2', paddingTop: '20px' }}>

                                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                                    {loading ? 'Buscando...' : 'Continuar'}
                                </button>
                                <button className="btn btn-danger" type="button" onClick={() => navigate('/')} style={{ flex: 1 }}>Cancelar</button>
                            </div>
                        </form>
                    )}

                    {sent && (
                        <div style={{ marginTop: '20px', borderTop: '1px solid #dddfe2', paddingTop: '20px' }}>
                            <Link to="/" className="btn btn-primary">
                                Regresar al inicio
                            </Link>
                        </div>
                    )}
                </div>

                <p style={{ marginTop: '20px', fontSize: '13px', color: '#666', textAlign: 'center' }}>
                    <strong>KeiMag</strong> para ti y tu empresa
                </p>
            </div>
        </div>
    );
}

export default Forgot;