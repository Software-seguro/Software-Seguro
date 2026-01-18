// src/pages/DashboardMedico.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import '../css/dashboard.css';

function DashboardPaciente() {
    const navigate = useNavigate();

    // ESTADOS
    const [view, setView] = useState('consultas');
    const [paciente, setPaciente] = useState({ nombre: '', id: null });
    const [consultas, setConsultas] = useState([]);
    const [examenes, setExamenes] = useState([]);
    const [medicoAsignado, setMedicoAsignado] = useState({ id: null, nombre: '' });

    // CHAT
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const ws = useRef(null);


    useEffect(() => {
        const token = sessionStorage.getItem('token');
        const rol = parseInt(sessionStorage.getItem('rolId'));

        if (!token || rol !== 2) { navigate('/'); return; }

        // NUEVA LÓGICA: Obtener nombre real
        const fetchProfile = async () => {
            try {
                const res = await fetch(`${API_URL}/api/core/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setPaciente({
                        nombre: `${data.Nombre} ${data.Apellido}`,
                        id: sessionStorage.getItem('usuarioId')
                    });

                    // Aprovechamos para setear el médico asignado que ya viene en la consulta
                    setMedicoAsignado({
                        id: data.MedicoUsuarioID,
                        nombre: data.NombreMedico || 'Su Médico'
                    });
                }
            } catch (error) { console.error(error); }
        };

        fetchProfile();
        // Aquí puedes quitar la llamada a cargarDatos() si ya integraste lo anterior
    }, [navigate]);

    const cargarDatos = async (id, token) => {
        try {
            // 1. Cargar perfil del paciente para obtener médico asignado
            const resProfile = await fetch(`${API_URL}/api/core/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resProfile.ok) {
                const profileData = await resProfile.json();
                setMedicoAsignado({
                    id: profileData.MedicoUsuarioID, // UsuarioID de la tabla Auth del médico
                    nombre: profileData.NombreMedico || 'Su Médico'
                });
            }

            // 2. Cargar consultas y exámenes
            const [resC, resE] = await Promise.all([
                fetch(`${API_URL}/api/clinical/paciente/${id}/consultas`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/api/clinical/paciente/${id}/examenes`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (resC.ok) setConsultas(await resC.json());
            if (resE.ok) setExamenes(await resE.json());
        } catch (error) { console.error("Error cargando datos:", error); }
    };


    // --- LÓGICA DEL CHAT ---
    useEffect(() => {
        if (view === 'chat' && medicoAsignado.id) {
            const myId = sessionStorage.getItem('usuarioId');

            // 1. Cargar historial del chat-service (puerto 3004)
            fetch(`${API_URL}/api/chat/historial/${myId}/${medicoAsignado.id}`)
                .then(res => res.json())
                .then(data => setChatMessages(data));

            // 2. Conectar WebSocket
            ws.current = new WebSocket(`ws://localhost:3004?userId=${myId}`);
            ws.current.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                setChatMessages(prev => [...prev, msg]);
            };
        }
        return () => { if (ws.current) ws.current.close(); };
    }, [view, medicoAsignado.id]);

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

    return (
        <div className="container">
            <aside className="sidebar">
                <div className="profile-section">
                    <div className="avatar"><i className="fas fa-user" style={{ fontSize: '40px', marginTop: '10px' }}></i></div>
                    <h3>{paciente.nombre}</h3>
                    <p>Paciente</p>
                </div>
                <nav>
                    <button className={`nav-btn ${view === 'consultas' ? 'active' : ''}`} onClick={() => setView('consultas')}><i className="fas fa-stethoscope"></i> Mis Consultas</button>
                    <button className={`nav-btn ${view === 'examenes' ? 'active' : ''}`} onClick={() => setView('examenes')}><i className="fas fa-file-medical"></i> Mis Exámenes</button>
                    <button className={`nav-btn ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}><i className="fas fa-comments"></i> Chat Global</button>
                    <button className="nav-btn logout" onClick={() => { sessionStorage.clear(); navigate('/'); }}><i className="fas fa-sign-out-alt"></i> Salir</button>
                </nav>
            </aside>

            <main className="main-content">
                <header>
                    <h1>Mi Historial Médico</h1>
                    <span>{new Date().toLocaleDateString()}</span>
                </header>

                {view === 'consultas' && (
                    <section className="content-section">
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead><tr><th>Fecha</th><th>Motivo</th><th>Diagnóstico</th><th>Tratamiento</th></tr></thead>
                                <tbody>
                                    {consultas.map(c => (
                                        <tr key={c.ConsultaID}>
                                            <td>{new Date(c.FechaConsulta).toLocaleDateString()}</td>
                                            <td>{c.MotivoConsulta}</td>
                                            <td>{c.Diagnostico}</td>
                                            <td>{c.Tratamiento}</td>
                                        </tr>
                                    ))}
                                    {consultas.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center' }}>No hay consultas.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {view === 'examenes' && (
                    <section className="content-section">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                            {examenes.map(e => (
                                <div key={e.ExamenID} className="exam-card">
                                    <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>{e.TipoExamen}</h3>
                                    <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>Fecha:</strong> {new Date(e.FechaRealizacion).toLocaleDateString()}</p>
                                    <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>{e.ObservacionesResultados}</p>
                                    <a href="#" style={{ display: 'block', marginTop: '15px', color: 'var(--primary)', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>Ver Archivo</a>
                                </div>
                            ))}
                        </div>
                        {examenes.length === 0 && <p>No hay exámenes registrados.</p>}
                    </section>
                )}

                {view === 'chat' && (
                    <section className="content-section">
                        <div className="chat-layout" style={{ height: 'calc(100vh - 200px)' }}>
                            <div className="chat-main">
                                <div className="chat-messages">
                                    {chatMessages.map((msg, i) => (
                                        <div key={i} className={`message-bubble ${msg.userId === medicoAsignado.id ? 'incoming' : 'outgoing'}`}>
                                            <span style={{ fontSize: '10px', display: 'block', opacity: 0.7 }}>
                                                {msg.userId === medicoAsignado.id ? `Dr. ${medicoAsignado.nombre}` : 'Yo'}
                                            </span>
                                            {msg.text}
                                        </div>
                                    ))}
                                    {chatMessages.length === 0 && <p style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>Inicia una conversación con tu médico.</p>}
                                </div>
                                <div style={{ padding: '15px', display: 'flex', gap: '10px', background: '#fff', borderTop: '1px solid #eee' }}>
                                    <input
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Escribe un mensaje al doctor..."
                                        style={{ flex: 1, padding: '12px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' }}
                                        onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()}
                                    />
                                    <button className="btn btn-primary" onClick={enviarMensaje}>
                                        <i className="fas fa-paper-plane"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

export default DashboardPaciente;