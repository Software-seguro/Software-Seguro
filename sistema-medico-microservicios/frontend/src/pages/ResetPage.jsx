import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { verifyPasswordResetCode } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { API_URL } from '../config';
import '../css/styles.css';

function ResetPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [email, setEmail] = useState("");
    const [oobCode, setOobCode] = useState("");
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState({ show: false, title: "", text: "", type: "error", onConfirm: null });

    const showAlert = (title, text, type = "error", action = null) => {
        setNotification({ show: true, title, text, type, onConfirm: action });
    };

    useEffect(() => {
        // Extraer parámetros de la URL
        const query = new URLSearchParams(location.search);
        const code = query.get('oobCode');

        if (code) {
            setOobCode(code);
            // Validar el código con Firebase
            verifyPasswordResetCode(auth, code)
                .then((userEmail) => {
                    setEmail(userEmail);
                    setLoading(false); // Deja de cargar y muestra el modal
                })
                .catch((err) => {
                    console.error("Error de Firebase:", err);
                    setLoading(false);
                    showAlert("Enlace inválido", "El enlace ha expirado o ya fue utilizado.", "error", () => navigate('/'));
                });
        } else {
            setLoading(false);
            navigate('/'); // Si no hay código, regresa al login
        }
    }, [location, navigate]);

    const handleUpdate = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());

        if (data.newPassword !== data.confirmPassword) {
            return showAlert("Error", "Las contraseñas no coinciden.");
        }

        if (data.newPassword.length < 6) {
            return showAlert("Error", "La contraseña debe tener al menos 6 caracteres.");
        }

        try {
            const res = await fetch(`${API_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    newPassword: data.newPassword
                })
            });

            if (res.ok) {
                showAlert("¡Éxito!", "Tu contraseña ha sido actualizada. Ya puedes iniciar sesión.", "success", () => navigate('/'));
            } else {
                const body = await res.json();
                showAlert("Error", body.message || "No se pudo actualizar.");
            }
        } catch (err) {
            showAlert("Error", "No hay conexión con el servidor.");
        }
    };

    // Esto evita que la pantalla se quede en blanco si hay un error de carga
    if (loading) {
        return (
            <div className="auth-wrapper">
                <div className="card">
                    <h2>Verificando enlace...</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-wrapper">
            <div className="modal-overlay">
                <div className="modal-card">
                    <h1 className="logo-apolo-unified">APOLO</h1>
                    <h2>Nueva contraseña</h2>
                    <p style={{ marginBottom: '20px' }}>Restableciendo cuenta: <br /> <b>{email}</b></p>

                    <form onSubmit={handleUpdate} noValidate>
                        <div className="form-group">
                            <label className="field-label">Contraseña nueva</label>
                            <input type="password" name="newPassword" placeholder="Mínimo 6 caracteres" required autoFocus />
                        </div>
                        <div className="form-group">
                            <label className="field-label">Confirmar contraseña</label>
                            <input type="password" name="confirmPassword" placeholder="Repite tu contraseña" required />
                        </div>

                        <div className="modal-actions-inline">
                            <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>Actualizar</button>
                            <button className="btn btn-danger" type="button" onClick={() => navigate('/')} style={{ flex: 1 }}>Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Modal de Notificación */}
            {notification.show && (
                <div className="modal-overlay" style={{ zIndex: 5000 }}>
                    <div className="modal-card notification-modal">
                        <div className={notification.type === "success" ? "success-icon" : "error-icon"}>
                            {notification.type === "success" ? "✓" : "✕"}
                        </div>
                        <h2 style={{ color: notification.type === "success" ? "#42b72a" : "#dc2626" }}>{notification.title}</h2>
                        <p>{notification.text}</p>
                        <button className="btn btn-primary" onClick={() => {
                            setNotification({ ...notification, show: false });
                            if (notification.onConfirm) notification.onConfirm();
                        }}>Aceptar</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ResetPage;