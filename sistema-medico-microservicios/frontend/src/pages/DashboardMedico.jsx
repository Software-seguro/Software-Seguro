import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import '../css/dashboard.css';

function DashboardMedico() {
    const navigate = useNavigate();
    
    // ESTADOS
    const [view, setView] = useState('pacientes');
    const [pacientes, setPacientes] = useState([]);
    const [selectedPaciente, setSelectedPaciente] = useState(null);
    const [historia, setHistoria] = useState({ consultas: [], examenes: [] });
    const [medico, setMedico] = useState({ nombre: '', id: null });

    // MODALES
    const [modalConsulta, setModalConsulta] = useState({ isOpen: false, data: null });
    const [modalExamen, setModalExamen] = useState({ isOpen: false, data: null, consultaId: null });

    // CHAT
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const ws = useRef(null);

    // --- HELPERS ---
    const calcularEdad = (fecha) => {
        if (!fecha) return '--';
        const hoy = new Date();
        const cumple = new Date(fecha);
        let edad = hoy.getFullYear() - cumple.getFullYear();
        if (hoy.getMonth() < cumple.getMonth() || (hoy.getMonth() === cumple.getMonth() && hoy.getDate() < cumple.getDate())) edad--;
        return edad;
    };

    const formatDateForInput = (dateString) => {
        if (!dateString) return new Date().toISOString().split('T')[0];
        return new Date(dateString).toISOString().split('T')[0];
    };

    // --- CARGA INICIAL ---
    useEffect(() => {
        const token = sessionStorage.getItem('token');
        const rol = parseInt(sessionStorage.getItem('rolId'));
        const nombre = sessionStorage.getItem('email');
        const id = sessionStorage.getItem('usuarioId');

        if (!token || rol !== 1) { navigate('/'); return; }

        setMedico({ nombre: nombre?.split('@')[0], id });
        cargarPacientes();
    }, [navigate]);

    const cargarPacientes = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/core/pacientes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setPacientes(await res.json());
        } catch (error) { console.error(error); }
    };

    const verHistoria = async (paciente) => {
        setSelectedPaciente(paciente);
        setView('detalle');
        recargarHistoria(paciente.UsuarioID);
    };

    const recargarHistoria = async (pacienteId) => {
        try {
            const token = sessionStorage.getItem('token');
            const [resC, resE] = await Promise.all([
                fetch(`${API_URL}/api/clinical/paciente/${pacienteId}/consultas`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/api/clinical/paciente/${pacienteId}/examenes`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            setHistoria({ consultas: await resC.json(), examenes: await resE.json() });
        } catch (error) { console.error(error); }
    };

    // --- CRUD ---
    const handleGuardarConsulta = async (e) => {
        e.preventDefault();
        const form = e.target;
        const payload = {
            pacienteId: selectedPaciente.UsuarioID,
            medicoId: medico.id,
            fecha: form.fecha.value,
            motivo: form.motivo.value,
            sintomas: form.sintomas.value,
            diagnostico: form.diagnostico.value,
            tratamiento: form.tratamiento.value,
            notas: form.notas.value
        };
        const token = sessionStorage.getItem('token');
        const isEdit = modalConsulta.data !== null;
        const url = isEdit ? `${API_URL}/api/clinical/consultas/${modalConsulta.data.ConsultaID}` : `${API_URL}/api/clinical/consultas`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            setModalConsulta({ isOpen: false, data: null });
            recargarHistoria(selectedPaciente.UsuarioID);
        } else { alert("Error al guardar"); }
    };

    const handleEliminarConsulta = async (id) => {
        if (!confirm("¿Eliminar consulta?")) return;
        const token = sessionStorage.getItem('token');
        await fetch(`${API_URL}/api/clinical/consultas/${id}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        recargarHistoria(selectedPaciente.UsuarioID);
    };

    const handleGuardarExamen = async (e) => {
        e.preventDefault();
        const form = e.target;
        const payload = {
            pacienteId: selectedPaciente.UsuarioID,
            consultaId: modalExamen.consultaId,
            tipo: form.tipo.value,
            fecha: form.fecha.value,
            rutaArchivo: form.ruta.value,
            observaciones: form.observaciones.value
        };
        const token = sessionStorage.getItem('token');
        const isEdit = modalExamen.data !== null;
        const url = isEdit ? `${API_URL}/api/clinical/examenes/${modalExamen.data.ExamenID}` : `${API_URL}/api/clinical/examenes`;
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            setModalExamen({ isOpen: false, data: null, consultaId: null });
            recargarHistoria(selectedPaciente.UsuarioID);
        } else { alert("Error al guardar"); }
    };

    const handleEliminarExamen = async (id) => {
        if (!confirm("¿Eliminar examen?")) return;
        const token = sessionStorage.getItem('token');
        await fetch(`${API_URL}/api/clinical/examenes/${id}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        recargarHistoria(selectedPaciente.UsuarioID);
    };

    // --- CHAT ---
    useEffect(() => {
        if (view === 'chat') {
            ws.current = new WebSocket(`ws://localhost:3004`);
            ws.current.onmessage = (e) => setChatMessages(prev => [...prev, JSON.parse(e.data)]);
        } else { if (ws.current) ws.current.close(); }
    }, [view]);

    const enviarMensaje = () => {
        if (!chatInput.trim() || !ws.current) return;
        ws.current.send(JSON.stringify({ username: medico.nombre, text: chatInput, rol: 1 }));
        setChatInput('');
    };

    return (
        <div className="container">
            {/* SIDEBAR */}
            <aside className="sidebar">
                <div className="profile-section">
                    <div className="avatar"><i className="fas fa-user-md"></i></div>
                    <h3>Dr. {medico.nombre}</h3>
                    <p>Médico General</p>
                </div>
                <nav>
                    <button className={`nav-btn ${view !== 'chat' ? 'active' : ''}`} onClick={() => setView('pacientes')}>
                        <i className="fas fa-user-injured"></i> Pacientes
                    </button>
                    <button className={`nav-btn ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>
                        <i className="fas fa-comments"></i> Chat Global
                    </button>
                    <button className="nav-btn logout" onClick={() => { sessionStorage.clear(); navigate('/'); }}>
                        <i className="fas fa-sign-out-alt"></i> Cerrar Sesión
                    </button>
                </nav>
            </aside>

            {/* CONTENIDO PRINCIPAL */}
            <main className="main-content">
                <header>
                    <div>
                        <h1>Dashboard Médico</h1>
                        <span>{new Date().toLocaleDateString()}</span>
                    </div>
                    <div style={{display:'flex', gap:'10px'}}>
                        <button className="btn-secondary">ES</button>
                        <button className="btn-secondary"><i className="fas fa-bell"></i></button>
                    </div>
                </header>

                {/* VISTA PACIENTES */}
                {view === 'pacientes' && (
                    <section className="content-section">
                        <div className="section-header">
                            <h2>Listado de Pacientes</h2>
                            <input type="text" placeholder="Buscar paciente..." className="search-input" />
                        </div>
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead><tr><th>Identificación</th><th>Paciente</th><th>Edad</th><th style={{textAlign:'right'}}>Acciones</th></tr></thead>
                                <tbody>
                                    {pacientes.map(p => (
                                        <tr key={p.UsuarioID}>
                                            <td>{p.Identificacion || '--'}</td>
                                            <td>{p.Nombre} {p.Apellido}</td>
                                            <td>{calcularEdad(p.FechaNacimiento)} años</td>
                                            <td style={{textAlign:'right'}}>
                                                {/* Botón ajustado: btn-sm y sin estirarse */}
                                                <button className="btn-primary btn-sm" onClick={() => verHistoria(p)}>
                                                    <i className="fas fa-eye"></i> Historia
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {pacientes.length === 0 && <tr><td colSpan="4" style={{textAlign:'center', padding:'20px'}}>No hay pacientes asignados.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* VISTA DETALLE HISTORIA */}
                {view === 'detalle' && selectedPaciente && (
                    <section className="content-section">
                        <button className="btn-secondary" onClick={() => setView('pacientes')} style={{marginBottom: '20px'}}>
                            <i className="fas fa-arrow-left"></i> Regresar
                        </button>
                        
                        <div style={{background:'#fff', padding:'20px', borderRadius:'8px', boxShadow:'0 1px 2px rgba(0,0,0,0.1)', borderLeft:'4px solid var(--primary)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div>
                                <h2 style={{margin:0, color: 'var(--text-main)'}}>{selectedPaciente.Nombre} {selectedPaciente.Apellido}</h2>
                                <p style={{margin:'5px 0 0', color: 'var(--text-muted)'}}>ID: {selectedPaciente.Identificacion} | {calcularEdad(selectedPaciente.FechaNacimiento)} años</p>
                            </div>
                            {/* Botón ajustado */}
                            <button className="btn-primary" onClick={() => setModalConsulta({isOpen: true, data: null})}>
                                <i className="fas fa-plus"></i> Nueva Consulta
                            </button>
                        </div>

                        <h3 style={{color: 'var(--text-muted)', fontSize: '16px', marginTop: '25px', textTransform:'uppercase'}}>Historia Clínica</h3>
                        
                        {historia.consultas.map(c => (
                            <div key={c.ConsultaID} className="exam-card">
                                <div className="card-actions">
                                    {/* CAMBIO AQUÍ: Botón explícito con texto */}
                                    <button className="btn-secondary btn-sm" title="Adjuntar Examen" onClick={() => setModalExamen({isOpen: true, data: null, consultaId: c.ConsultaID})}>
                                        <i className="fas fa-file-medical"></i> Agregar Examen
                                    </button>
                                    
                                    {/* Botones de iconos solo para editar/borrar */}
                                    <button className="btn-icon" title="Editar" onClick={() => setModalConsulta({isOpen: true, data: c})}><i className="fas fa-edit"></i></button>
                                    <button className="btn-danger-icon" title="Eliminar" onClick={() => handleEliminarConsulta(c.ConsultaID)}><i className="fas fa-trash"></i></button>
                                </div>

                                <div className="card-meta">{new Date(c.FechaConsulta).toLocaleDateString()} - Dr. {medico.nombre}</div>
                                <h3 className="card-title">{c.MotivoConsulta}</h3>
                                
                                <div className="card-body">
                                    <p><strong>Dx:</strong> {c.Diagnostico}</p>
                                    <p><strong>Tx:</strong> {c.Tratamiento}</p>
                                    {c.Sintomas && <p><strong>Síntomas:</strong> {c.Sintomas}</p>}
                                    {c.NotasAdicionales && <p><strong>Notas:</strong> {c.NotasAdicionales}</p>}
                                </div>

                                <div className="exam-list">
                                    <strong style={{fontSize:'13px', color: 'var(--text-main)'}}><i className="fas fa-paperclip"></i> Exámenes adjuntos:</strong>
                                    {historia.examenes.filter(e => e.ConsultaID === c.ConsultaID).map(e => (
                                        <div key={e.ExamenID} className="exam-item">
                                            <div>
                                                <strong>{e.TipoExamen}</strong> <span style={{color: '#999'}}>({new Date(e.FechaRealizacion).toLocaleDateString()})</span>
                                                {e.RutaArchivo && e.RutaArchivo !== '#' && <a href={e.RutaArchivo} target="_blank" rel="noreferrer" style={{marginLeft:'10px', fontSize:'12px'}}>Ver archivo</a>}
                                                <p style={{margin:'2px 0 0', color:'#666', fontSize:'13px'}}>{e.ObservacionesResultados}</p>
                                            </div>
                                            <div style={{display:'flex', gap:'5px'}}>
                                                <button className="btn-icon" onClick={() => setModalExamen({isOpen: true, data: e, consultaId: c.ConsultaID})}><i className="fas fa-edit"></i></button>
                                                <button className="btn-danger-icon" onClick={() => handleEliminarExamen(e.ExamenID)}><i className="fas fa-trash"></i></button>
                                            </div>
                                        </div>
                                    ))}
                                    {historia.examenes.filter(e => e.ConsultaID === c.ConsultaID).length === 0 && <div style={{fontSize:'13px', color:'#999', marginTop:'5px', fontStyle:'italic'}}>Sin exámenes.</div>}
                                </div>
                            </div>
                        ))}
                        {historia.consultas.length === 0 && <p style={{textAlign:'center', color: '#666', marginTop: '40px'}}>No hay historial registrado.</p>}
                    </section>
                )}

                {/* VISTA CHAT (Sin cambios visuales grandes, pero ajustado a la estructura) */}
                {view === 'chat' && (
                    <section className="content-section" style={{height:'100%', display:'flex', flexDirection:'column'}}>
                        <h2>Chat Global</h2>
                        <div style={{flex:1, background:'#fff', border:'1px solid #ddd', borderRadius:'8px', display:'flex', flexDirection:'column', overflow:'hidden'}}>
                            <div style={{flex:1, padding:'20px', overflowY:'auto', background:'#f0f2f5'}}>
                                {chatMessages.map((msg, i) => (
                                    <div key={i} style={{marginBottom:'10px', alignSelf: msg.username === medico.nombre ? 'flex-end' : 'flex-start', maxWidth:'70%', background: msg.username === medico.nombre ? '#e7f3ff' : '#fff', padding:'10px', borderRadius:'10px', boxShadow:'0 1px 1px rgba(0,0,0,0.1)'}}>
                                        <strong style={{fontSize:'11px', color:'#666', display:'block'}}>{msg.username}</strong>
                                        {msg.text}
                                    </div>
                                ))}
                            </div>
                            <div style={{padding:'15px', background:'#fff', borderTop:'1px solid #eee', display:'flex', gap:'10px'}}>
                                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Escribe..." style={{flex:1, padding:'10px', borderRadius:'20px', border:'1px solid #ddd', outline:'none'}} onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()} />
                                <button className="btn-primary" onClick={enviarMensaje}><i className="fas fa-paper-plane"></i></button>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {/* MODALES REUTILIZABLES (Usan btn-full para los submit) */}
            {(modalConsulta.isOpen || modalExamen.isOpen) && (
                <div className="modal">
                    <div className="modal-content">
                        <span className="close-modal" onClick={() => { setModalConsulta({isOpen: false}); setModalExamen({isOpen: false}); }}>&times;</span>
                        {modalConsulta.isOpen && (
                            <form onSubmit={handleGuardarConsulta}>
                                <h2>{modalConsulta.data ? 'Editar Consulta' : 'Registrar Consulta'}</h2>
                                <div className="form-group"><label>Fecha</label><input type="date" name="fecha" required defaultValue={formatDateForInput(modalConsulta.data?.FechaConsulta)} /></div>
                                <div className="form-group"><label>Motivo</label><input name="motivo" required defaultValue={modalConsulta.data?.MotivoConsulta} /></div>
                                <div className="form-row">
                                    <div className="form-group"><label>Diagnóstico</label><input name="diagnostico" required defaultValue={modalConsulta.data?.Diagnostico} /></div>
                                    <div className="form-group"><label>Tratamiento</label><input name="tratamiento" required defaultValue={modalConsulta.data?.Tratamiento} /></div>
                                </div>
                                <div className="form-group"><label>Síntomas</label><textarea name="sintomas" rows="2" defaultValue={modalConsulta.data?.Sintomas}></textarea></div>
                                <div className="form-group"><label>Notas Adicionales</label><textarea name="notas" rows="2" defaultValue={modalConsulta.data?.NotasAdicionales}></textarea></div>
                                <button type="submit" className="btn-primary btn-full" style={{marginTop:'10px'}}>Guardar</button>
                            </form>
                        )}
                        {modalExamen.isOpen && (
                            <form onSubmit={handleGuardarExamen}>
                                <h2>{modalExamen.data ? 'Editar Examen' : 'Adjuntar Examen'}</h2>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Tipo</label>
                                        <select name="tipo" required defaultValue={modalExamen.data?.TipoExamen}>
                                            <option>Laboratorio</option><option>Rayos X</option><option>Ecografía</option><option>Otro</option>
                                        </select>
                                    </div>
                                    <div className="form-group"><label>Fecha Realización</label><input type="date" name="fecha" required defaultValue={formatDateForInput(modalExamen.data?.FechaRealizacion)} /></div>
                                </div>
                                <div className="form-group"><label>URL del Archivo (Opcional)</label><input type="text" name="ruta" placeholder="https://..." defaultValue={modalExamen.data?.RutaArchivo !== '#' ? modalExamen.data?.RutaArchivo : ''} /></div>
                                <div className="form-group"><label>Observaciones/Resultados</label><textarea name="observaciones" rows="3" defaultValue={modalExamen.data?.ObservacionesResultados}></textarea></div>
                                <button type="submit" className="btn-primary btn-full" style={{marginTop:'10px'}}>Guardar</button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default DashboardMedico;