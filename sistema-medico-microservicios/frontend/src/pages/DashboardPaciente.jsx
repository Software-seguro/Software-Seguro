// src/pages/DashboardPaciente.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import '../css/dashboard.css';

function DashboardPaciente() {
    const navigate = useNavigate();

    // --- ESTADOS ---
    const [view, setView] = useState('consultas'); // 'consultas' | 'examenes' | 'chat'
    const [paciente, setPaciente] = useState({ nombre: '', id: null, especialidad: '' });
    const [consultas, setConsultas] = useState([]);
    const [examenes, setExamenes] = useState([]);
    const [medicoAsignado, setMedicoAsignado] = useState({ id: null, nombre: '', especialidad: '' });

    const [showExpireModal, setShowExpireModal] = useState(false);
    const timerRef = useRef(null);

    // --- CHAT ---
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const ws = useRef(null);

    // --- CARGA INICIAL ---
    useEffect(() => {
        const token = sessionStorage.getItem('token');
        const rol = parseInt(sessionStorage.getItem('rolId'));
        const usuarioId = sessionStorage.getItem('usuarioId');

        if (!token || rol !== 2) { navigate('/'); return; }

        const fetchDatos = async () => {
            try {
                // 1. Obtener perfil para nombre y médico asignado
                const resProfile = await fetch(`${API_URL}/api/core/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resProfile.status === 401) {
                    setShowExpireModal(true);
                    throw new Error("Sesión expirada");
                }
                if (resProfile.ok) {
                    const data = await resProfile.json();
                    setPaciente({
                        nombre: `${data.Nombre} ${data.Apellido}`,
                        id: usuarioId
                    });
                    setMedicoAsignado({
                        id: data.MedicoUsuarioID,
                        nombre: data.NombreMedico || 'Médico Asignado',
                        especialidad: data.EspecialidadMedico || 'Especialista'
                    });

                    // 2. Cargar historial clínico
                    cargarHistorial(usuarioId, token);
                }
            } catch (error) { console.error(error); }
        };

        fetchDatos();
    }, [navigate]);

    const cargarHistorial = async (id, token) => {
        try {
            const [resC, resE] = await Promise.all([
                fetch(`${API_URL}/api/clinical/paciente/${id}/consultas`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/api/clinical/paciente/${id}/examenes`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (resC.status === 401) {
                setShowExpireModal(true);
                throw new Error("Sesión expirada");
            }
            if (resE.status === 401) {
                setShowExpireModal(true);
                throw new Error("Sesión expirada");
            }
            if (resC.ok) setConsultas(await resC.json());
            if (resE.ok) setExamenes(await resE.json());
        } catch (error) { console.error(error); }
    };

    // --- LÓGICA DEL CHAT ---
    useEffect(() => {
        const token = sessionStorage.getItem('token');
        const myId = sessionStorage.getItem('usuarioId');

        // IMPORTANTE: Aquí cambiamos activeChat por medicoAsignado.id
        if (view === 'chat' && medicoAsignado.id && token) {

            // 1. Cargar historial mediante la API segura
            fetch(`${API_URL}/api/chat/historial/${myId}/${medicoAsignado.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
                .then(res => {
                    if (res.status === 401) {
                        setShowExpireModal(true);
                        throw new Error("Sesión expirada");
                    }
                    if (!res.ok) throw new Error("No autorizado");
                    return res.json();
                })
                .then(data => setChatMessages(data))
                .catch(err => console.error("Error historial:", err));

            // 2. Conectar WebSocket seguro
            ws.current = new WebSocket(`ws://apolo-chat-fffdazc3dwehc8hx.canadacentral-01.azurewebsites.net?token=${token}`);

            ws.current.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                // Si el mensaje es del médico o mío, lo agrego
                if (msg.userId === medicoAsignado.id || msg.receptorId === medicoAsignado.id) {
                    setChatMessages(prev => [...prev, msg]);
                }
            };
        }

        return () => {
            if (ws.current) ws.current.close();
        };
    }, [view, medicoAsignado.id]); // El efecto se dispara cuando entras al chat o el médico carga

    const enviarMensaje = () => {
        if (!chatInput.trim() || !ws.current || !medicoAsignado.id) return;
        const msg = {
            receptorId: medicoAsignado.id,
            username: paciente.nombre,
            text: chatInput,
            rol: 2
        };
        ws.current.send(JSON.stringify(msg));
        setChatInput('');
    };

    // --- LÓGICA DE EXPIRACIÓN DE SESIÓN ---
    useEffect(() => {
        const tiempoLimite = 5 * 60 * 1000; // 5 minutos en milisegundos

        const resetTimer = () => {
            if (timerRef.current) clearTimeout(timerRef.current);

            timerRef.current = setTimeout(() => {
                // Acción cuando se agota el tiempo
                cerrarSesionPorInactividad();
            }, tiempoLimite);
        };

        const cerrarSesionPorInactividad = () => {
            // No borramos el storage de inmediato para que el modal sepa que hubo una sesión
            setShowExpireModal(true);
        };

        // Escuchar eventos de actividad del usuario
        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('click', resetTimer);
        window.addEventListener('scroll', resetTimer);

        // Iniciar el temporizador al cargar
        resetTimer();

        // Limpieza al desmontar el componente
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            window.removeEventListener('mousemove', resetTimer);
            window.removeEventListener('keydown', resetTimer);
            window.removeEventListener('click', resetTimer);
            window.removeEventListener('scroll', resetTimer);
        };
    }, []);

    const handleFinalizarExpiracion = () => {
        sessionStorage.clear();
        navigate('/');
    };

    return (
        <div className="admin-layout">
            {/* SIDEBAR */}
            <aside className="admin-sidebar">
                <div className="admin-brand">
                    <h1 className="logo-text">APOLO</h1>
                    <span className="brand-badge">PACIENTE</span>
                </div>

                <div className="admin-profile">
                    <div className="avatar-circle">
                        <i className="fas fa-user"></i>
                    </div>
                    <div className="profile-info">
                        <h3>{paciente.nombre}</h3>
                    </div>
                </div>

                <nav className="admin-nav">
                    <button className={`nav-item ${view === 'consultas' ? 'active' : ''}`} onClick={() => setView('consultas')}>
                        <i className="fas fa-notes-medical"></i> <span>Mis Consultas</span>
                    </button>
                    <button className={`nav-item ${view === 'examenes' ? 'active' : ''}`} onClick={() => setView('examenes')}>
                        <i className="fas fa-file-prescription"></i> <span>Mis Exámenes</span>
                    </button>
                    <button className={`nav-item ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>
                        <i className="fas fa-comment-medical"></i> <span>Chat con Médico</span>
                    </button>
                    <div className="nav-spacer" style={{ flex: 1 }}></div>
                    <button className="nav-item logout" onClick={() => { sessionStorage.clear(); navigate('/'); }}>
                        <i className="fas fa-sign-out-alt"></i> <span>Cerrar Sesión</span>
                    </button>
                </nav>
            </aside>

            {/* CONTENIDO PRINCIPAL */}
            <main className="admin-main">
                <header className="admin-header">
                    <div className="header-title">
                        <h1>{view === 'consultas' ? 'Historial de Consultas' : view === 'examenes' ? 'Mis Exámenes y Resultados' : 'Mensajería Médica'}</h1>
                        <p>{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                </header>

                <section className="admin-content">
                    {/* VISTA CONSULTAS */}
                    {view === 'consultas' && (
                        <div className="content-card">
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Motivo</th>
                                        <th>Diagnóstico</th>
                                        <th>Tratamiento</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {consultas.map(c => (
                                        <tr key={c.ConsultaID}>
                                            <td style={{ fontWeight: 'bold' }}>
                                                <span className="badge badge-success">
                                                    {new Date(c.FechaConsulta).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="col-name">{c.MotivoConsulta}</td>
                                            <td>{c.Diagnostico}</td>
                                            <td>{c.Tratamiento}</td>
                                        </tr>
                                    ))}
                                    {consultas.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px' }}>No tienes consultas registradas.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* VISTA EXÁMENES */}
                    {view === 'examenes' && (
                        <div className="history-container">
                            <div className="table-wrapper content-card">
                                <table className="modern-table">
                                    <thead>
                                        <tr>
                                            <th>Tipo de Examen</th>
                                            <th>Fecha</th>
                                            <th>Observaciones / Resultados</th>
                                            <th style={{ textAlign: 'center' }}>Archivo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {examenes.map(e => (
                                            <tr key={e.ExamenID}>
                                                <td className="col-name">{e.TipoExamen}</td>
                                                <td>{new Date(e.FechaRealizacion).toLocaleDateString()}</td>
                                                <td style={{ fontSize: '13px', color: '#65676b', maxWidth: '300px' }}>{e.ObservacionesResultados}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {e.RutaArchivo && e.RutaArchivo !== '#' ? (
                                                        <a href={e.RutaArchivo} target="_blank" rel="noreferrer" className="action-btn edit" style={{ margin: '0 auto', display: 'flex' }}>
                                                            <i className="fas fa-eye"></i>
                                                        </a>
                                                    ) : '--'}
                                                </td>
                                            </tr>
                                        ))}
                                        {examenes.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px' }}>No hay exámenes disponibles.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* VISTA CHAT */}
                    {view === 'chat' && (
                        <div className="content-card" style={{ height: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div style={{ padding: '15px 20px', background: '#f8f9fa', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div className="avatar-circle" style={{ width: '35px', height: '35px', fontSize: '15px' }}><i className="fas fa-user-md"></i></div>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '14px' }}>Dr. {medicoAsignado.nombre}</h4>
                                    <p style={{ margin: 0, fontSize: '11px', color: 'var(--success)', fontWeight: 'bold' }}>Médico Asignado</p>
                                </div>
                            </div>

                            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: '#ffffff' }}>
                                {chatMessages.map((msg, i) => (
                                    <div key={i} style={{
                                        alignSelf: msg.userId === medicoAsignado.id ? 'flex-start' : 'flex-end',
                                        background: msg.userId === medicoAsignado.id ? '#f0f2f5' : 'var(--primary)',
                                        color: msg.userId === medicoAsignado.id ? 'black' : 'white',
                                        padding: '10px 15px',
                                        borderRadius: '18px',
                                        maxWidth: '70%',
                                        fontSize: '14px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                    }}>
                                        <span style={{ fontSize: '9px', display: 'block', opacity: 0.7, marginBottom: '2px', fontWeight: 'bold' }}>
                                            {msg.userId === medicoAsignado.id ? `Dr. ${medicoAsignado.nombre}` : 'Yo'}
                                        </span>
                                        {msg.text}
                                    </div>
                                ))}
                                {chatMessages.length === 0 && <div style={{ margin: 'auto', color: '#999', textAlign: 'center' }}><i className="fas fa-comments" style={{ fontSize: '30px', display: 'block', marginBottom: '10px' }}></i>Inicia una conversación con tu médico.</div>}
                            </div>

                            <div style={{ padding: '15px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', background: 'white' }}>
                                <input
                                    className="small-input"
                                    style={{ flex: 1, borderRadius: '20px', paddingLeft: '20px' }}
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    placeholder="Escribe un mensaje al doctor..."
                                    onKeyDown={e => e.key === 'Enter' && enviarMensaje()}
                                />
                                <button className="btn btn-primary" style={{ width: '50px', borderRadius: '50%', height: '40px', margin: 0 }} onClick={enviarMensaje}>
                                    <i className="fas fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                    )}
                    {showExpireModal && (
                        <div className="modal-overlay" style={{ zIndex: 6000 }}>
                            <div className="modal-card notification-modal">
                                <div className="warning-icon">🕒</div>
                                <h2 className="text-warning">Sesión Expirada</h2>
                                <p>Tu sesión ha finalizado por inactividad para proteger la información del paciente.</p>
                                <button className="btn btn-primary" onClick={handleFinalizarExpiracion}>
                                    Regresar al Inicio
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default DashboardPaciente;