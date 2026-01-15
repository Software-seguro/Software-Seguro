import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import '../css/dashboard.css';

function DashboardPaciente() {
    const navigate = useNavigate();
    const [view, setView] = useState('consultas'); 
    const [paciente, setPaciente] = useState({ nombre: '', id: null });
    const [consultas, setConsultas] = useState([]);
    const [examenes, setExamenes] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const ws = useRef(null);

    useEffect(() => {
        const token = sessionStorage.getItem('token');
        const rol = parseInt(sessionStorage.getItem('rolId'));
        const nombre = sessionStorage.getItem('email');
        const id = sessionStorage.getItem('usuarioId'); 

        if (!token || rol !== 2) { navigate('/'); return; }

        setPaciente({ nombre: nombre?.split('@')[0], id });
        cargarDatos(id, token);
    }, [navigate]);

    const cargarDatos = async (id, token) => {
        try {
            const [resC, resE] = await Promise.all([
                fetch(`${API_URL}/api/clinical/paciente/${id}/consultas`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/api/clinical/paciente/${id}/examenes`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (resC.ok) setConsultas(await resC.json());
            if (resE.ok) setExamenes(await resE.json());
        } catch (error) { console.error(error); }
    };

    useEffect(() => {
        if (view === 'chat') {
            ws.current = new WebSocket(`ws://localhost:3004`); 
            ws.current.onmessage = (e) => setChatMessages(prev => [...prev, JSON.parse(e.data)]);
        } else { if (ws.current) ws.current.close(); }
    }, [view]);

    const enviarMensaje = () => {
        if (!chatInput.trim() || !ws.current) return;
        ws.current.send(JSON.stringify({ username: paciente.nombre, text: chatInput, rol: 2 }));
        setChatInput('');
    };

    return (
        <div className="container">
            <aside className="sidebar">
                <div className="profile-section">
                    <div className="avatar"><i className="fas fa-user" style={{fontSize:'40px', marginTop:'10px'}}></i></div>
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
                                    {consultas.length === 0 && <tr><td colSpan="4" style={{textAlign:'center'}}>No hay consultas.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {view === 'examenes' && (
                    <section className="content-section">
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
                            {examenes.map(e => (
                                <div key={e.ExamenID} className="exam-card">
                                    <h3 style={{margin: '0 0 10px 0', color: 'var(--text-main)'}}>{e.TipoExamen}</h3>
                                    <p style={{margin: '5px 0', fontSize: '13px'}}><strong>Fecha:</strong> {new Date(e.FechaRealizacion).toLocaleDateString()}</p>
                                    <p style={{margin: '5px 0', fontSize: '14px', color: '#666'}}>{e.ObservacionesResultados}</p>
                                    <a href="#" style={{display:'block', marginTop:'15px', color:'var(--primary)', textDecoration:'none', fontSize:'13px', fontWeight:'600'}}>Ver Archivo</a>
                                </div>
                            ))}
                        </div>
                        {examenes.length === 0 && <p>No hay exámenes registrados.</p>}
                    </section>
                )}

                {view === 'chat' && (
                    <section className="content-section">
                        <div className="chat-container">
                            <div id="chatMessages">
                                {chatMessages.map((msg, i) => (<div key={i} className={`message-bubble ${msg.username === paciente.nombre ? 'outgoing' : 'incoming'}`}><span className="msg-sender">{msg.username}</span>{msg.text}</div>))}
                            </div>
                            <div className="chat-input-area">
                                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Escribe..." onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()} />
                                <button className="btn-primary" onClick={enviarMensaje}><i className="fas fa-paper-plane"></i></button>
                            </div>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

export default DashboardPaciente;