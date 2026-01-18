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
    // Modificado: Agregamos internalId para la validación de transferencia
    const [medico, setMedico] = useState({ nombre: '', id: null, internalId: null });

    // Nuevo Estado para lista de médicos (para reasignar)
    const [medicosList, setMedicosList] = useState([]);

    // MODALES
    const [modalConsulta, setModalConsulta] = useState({ isOpen: false, data: null });
    const [modalExamen, setModalExamen] = useState({ isOpen: false, data: null, consultaId: null });
    // Nuevo Modal Paciente
    const [modalPaciente, setModalPaciente] = useState({ isOpen: false, data: null });

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
        if (!dateString) return ''; // Fix para evitar error si viene null
        return new Date(dateString).toISOString().split('T')[0];
    };

    // Nuevo Helper para Alergias
    const renderAlergias = (alergiasString) => {
        if (!alergiasString) return <span style={{ color: '#ccc', fontSize: '12px' }}>Ninguna</span>;
        return alergiasString.split(',').map((alergia, index) => (
            <div key={index} style={{ whiteSpace: 'nowrap' }}>• {alergia.trim()}</div>
        ));
    };

    // --- CARGA INICIAL ---
    useEffect(() => {
        const token = sessionStorage.getItem('token');
        const rol = parseInt(sessionStorage.getItem('rolId'));

        if (!token || rol !== 1) { navigate('/'); return; }

        // NUEVA LÓGICA: Obtener nombre real
        const fetchProfile = async () => {
            try {
                const res = await fetch(`${API_URL}/api/core/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    // Seteamos nombre, apellido y especialidad reales
                    setMedico({
                        nombre: `${data.Nombre} ${data.Apellido}`,
                        id: sessionStorage.getItem('usuarioId'),
                        especialidad: data.Especialidad
                    });
                }
            } catch (error) { console.error(error); }
        };

        fetchProfile();
        cargarPacientes();
        cargarListaMedicos();
    }, [navigate]);

    const cargarPacientes = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/core/pacientes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPacientes(data);
                // Guardamos el ID interno del médico si hay pacientes para comparar luego
                if (data.length > 0) {
                    setMedico(prev => ({ ...prev, internalId: data[0].MedicoID }));
                }
            }
        } catch (error) { console.error(error); }
    };

    // Nueva función para cargar médicos
    const cargarListaMedicos = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/core/lista-medicos`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) setMedicosList(await res.json());
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

    // --- GESTIÓN DE PACIENTE ---
    const handleUpdatePaciente = async (e) => {
        e.preventDefault();
        const form = e.target;
        const nuevoMedicoId = parseInt(form.medicoId.value);

        // Advertencia de transferencia
        if (medico.internalId && nuevoMedicoId !== medico.internalId) {
            const confirmTransfer = confirm("⚠️ ADVERTENCIA: Estás a punto de asignar este paciente a otro médico.\n\nSi continúas, dejarás de tener acceso a este paciente y desaparecerá de tu lista.\n\n¿Estás seguro?");
            if (!confirmTransfer) return;
        }

        const payload = {
            medicoId: nuevoMedicoId,
            nombre: form.nombre.value,
            apellido: form.apellido.value,
            identificacion: form.identificacion.value,
            fechaNacimiento: form.fechaNacimiento.value,
            tipoSangre: form.tipoSangre.value,
            direccion: form.direccion.value,
            telefono: form.telefono.value,
            alergias: form.alergias.value
        };

        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/core/pacientes/${modalPaciente.data.PacienteID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Datos del paciente actualizados.");
                setModalPaciente({ isOpen: false, data: null });
                cargarPacientes();
            } else {
                alert("Error al actualizar paciente.");
            }
        } catch (err) { console.error(err); }
    };

    // --- CRUD CONSULTAS ---
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

    // --- CHAT (Lógica original intacta) ---
    const [activeChat, setActiveChat] = useState(null);

    useEffect(() => {
        if (activeChat && view === 'chat') {
            const myId = sessionStorage.getItem('usuarioId');
            // 1. Cargar mensajes viejos
            fetch(`${API_URL}/api/chat/historial/${myId}/${activeChat.UsuarioID}`)
                .then(res => res.json())
                .then(data => setChatMessages(data));

            // 2. Conectar WebSocket
            ws.current = new WebSocket(`ws://localhost:3004?userId=${myId}`);
            ws.current.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                if (msg.userId === activeChat.UsuarioID || msg.receptorId === activeChat.UsuarioID) {
                    setChatMessages(prev => [...prev, msg]);
                }
            };
        }
        return () => ws.current?.close();
    }, [activeChat, view]);

    const enviarMensaje = () => {
        if (!chatInput.trim() || !activeChat || !ws.current) return;

        const mensaje = {
            receptorId: activeChat.UsuarioID,
            username: medico.nombre,
            text: chatInput,
            rol: 1
        };

        ws.current.send(JSON.stringify(mensaje));
        setChatInput('');
    };

    return (
        <div className="container">
            {/* SIDEBAR */}
            <aside className="sidebar">
                <div className="profile-section">
                    <div className="avatar"><i className="fas fa-user-md"></i></div>
                    <h3>{medico.nombre}</h3>
                    <p>{medico.especialidad || 'Médico General'}</p>
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
                    <div style={{ display: 'flex', gap: '10px' }}>
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
                                <thead>
                                    <tr>
                                        <th>Identificación</th>
                                        <th>Paciente</th>
                                        <th>Edad</th>
                                        <th>Sangre</th>
                                        <th>Dirección</th>
                                        <th>Celular</th>
                                        <th>Alergias</th>
                                        <th style={{ textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pacientes.map(p => (
                                        <tr key={p.UsuarioID}>
                                            <td style={{ fontWeight: 'bold', color: '#666' }}>{p.Identificacion || '--'}</td>
                                            <td style={{ fontWeight: 'bold' }}>{p.Nombre} {p.Apellido}</td>
                                            <td>{calcularEdad(p.FechaNacimiento)} años</td>

                                            {/* Columnas Nuevas */}
                                            <td>{p.TipoSangre || '--'}</td>
                                            <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.Direccion}>{p.Direccion || '--'}</td>
                                            <td>{p.TelefonoContacto || '--'}</td>
                                            {/* Alergias Verticales */}
                                            <td style={{ fontSize: '12px', lineHeight: '1.4' }}>{renderAlergias(p.Alergias)}</td>

                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                                                    {/* Botón Editar (Nuevo) */}
                                                    <button className="btn-secondary btn-sm" title="Editar Datos" onClick={() => setModalPaciente({ isOpen: true, data: p })}>
                                                        <i className="fas fa-user-edit"></i>
                                                    </button>

                                                    {/* Botón Historia */}
                                                    <button className="btn btn-primary btn-sm" onClick={() => verHistoria(p)}>
                                                        <i className="fas fa-eye"></i> Historia
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {pacientes.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>No hay pacientes asignados.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* VISTA DETALLE HISTORIA */}
                {view === 'detalle' && selectedPaciente && (
                    <section className="content-section">
                        <button className="btn-secondary" onClick={() => setView('pacientes')} style={{ marginBottom: '20px' }}>
                            <i className="fas fa-arrow-left"></i> Regresar
                        </button>

                        <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', borderLeft: '4px solid var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: 0, color: 'var(--text-main)' }}>{selectedPaciente.Nombre} {selectedPaciente.Apellido}</h2>
                                <p style={{ margin: '5px 0 0', color: 'var(--text-muted)' }}>ID: {selectedPaciente.Identificacion} | {calcularEdad(selectedPaciente.FechaNacimiento)} años</p>
                            </div>
                            <button className="btn btn-primary" onClick={() => setModalConsulta({ isOpen: true, data: null })}>
                                <i className="fas fa-plus"></i> Nueva Consulta
                            </button>
                        </div>

                        <h3 style={{ color: 'var(--text-muted)', fontSize: '16px', marginTop: '25px', textTransform: 'uppercase' }}>Historia Clínica</h3>

                        {historia.consultas.map(c => (
                            <div key={c.ConsultaID} className="exam-card">
                                <div className="card-actions">
                                    <button className="btn-secondary btn-sm" title="Adjuntar Examen" onClick={() => setModalExamen({ isOpen: true, data: null, consultaId: c.ConsultaID })}>
                                        <i className="fas fa-file-medical"></i> Agregar Examen
                                    </button>
                                    <button className="btn-icon" title="Editar" onClick={() => setModalConsulta({ isOpen: true, data: c })}><i className="fas fa-edit"></i></button>
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
                                    <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}><i className="fas fa-paperclip"></i> Exámenes adjuntos:</strong>
                                    {historia.examenes.filter(e => e.ConsultaID === c.ConsultaID).map(e => (
                                        <div key={e.ExamenID} className="exam-item">
                                            <div>
                                                <strong>{e.TipoExamen}</strong> <span style={{ color: '#999' }}>({new Date(e.FechaRealizacion).toLocaleDateString()})</span>
                                                {e.RutaArchivo && e.RutaArchivo !== '#' && <a href={e.RutaArchivo} target="_blank" rel="noreferrer" style={{ marginLeft: '10px', fontSize: '12px' }}>Ver archivo</a>}
                                                <p style={{ margin: '2px 0 0', color: '#666', fontSize: '13px' }}>{e.ObservacionesResultados}</p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button className="btn-icon" onClick={() => setModalExamen({ isOpen: true, data: e, consultaId: c.ConsultaID })}><i className="fas fa-edit"></i></button>
                                                <button className="btn-danger-icon" onClick={() => handleEliminarExamen(e.ExamenID)}><i className="fas fa-trash"></i></button>
                                            </div>
                                        </div>
                                    ))}
                                    {historia.examenes.filter(e => e.ConsultaID === c.ConsultaID).length === 0 && <div style={{ fontSize: '13px', color: '#999', marginTop: '5px', fontStyle: 'italic' }}>Sin exámenes.</div>}
                                </div>
                            </div>
                        ))}
                    </section>
                )}

                {/* VISTA CHAT (Sin cambios visuales grandes, pero ajustado a la estructura) */}
                {view === 'chat' && (
                    <section className="content-section">
                        <div className="chat-layout">
                            <div className="chat-sidebar">
                                <div style={{ padding: '15px', fontWeight: 'bold', borderBottom: '1px solid #eee' }}>Mis Pacientes</div>
                                {pacientes.map(p => (
                                    <div key={p.UsuarioID}
                                        className={`patient-item ${activeChat?.UsuarioID === p.UsuarioID ? 'active' : ''}`}
                                        onClick={() => { setActiveChat(p); setChatMessages([]); }}>
                                        {p.Nombre} {p.Apellido}
                                    </div>
                                ))}
                            </div>
                            <div className="chat-main">
                                {activeChat ? (
                                    <>
                                        <div className="chat-messages">
                                            {chatMessages.filter(m => m.userId === activeChat.UsuarioID || m.receptorId === activeChat.UsuarioID).map((msg, i) => (
                                                <div key={i} className={`message-bubble ${msg.userId === activeChat.UsuarioID ? 'incoming' : 'outgoing'}`}>
                                                    <span style={{ fontSize: '10px', display: 'block', opacity: 0.7, marginBottom: '2px' }}>
                                                        {msg.userId === activeChat.UsuarioID ? `${activeChat.Nombre}` : 'Yo'}
                                                    </span>
                                                    {msg.text}
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ padding: '15px', display: 'flex', gap: '10px', background: '#fff', borderTop: '1px solid #eee' }}>
                                            <input
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                placeholder={`Escribir a ${activeChat.Nombre}...`}
                                                style={{ flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' }}
                                                onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()}
                                            />
                                            <button className="btn btn-primary" onClick={enviarMensaje}>
                                                <i className="fas fa-paper-plane"></i>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ margin: 'auto', color: '#999' }}>Selecciona un paciente para chatear</div>
                                )}
                            </div>
                        </div>
                    </section>
                )}
            </main>

            {/* MODAL EDICIÓN PACIENTE */}
            {modalPaciente.isOpen && (
                <div className="modal">
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <span className="close-modal" onClick={() => setModalPaciente({ isOpen: false, data: null })}>&times;</span>
                        <h2>Editar Datos del Paciente</h2>
                        <form onSubmit={handleUpdatePaciente}>
                            <div style={{ background: '#fff3cd', padding: '10px', borderRadius: '5px', marginBottom: '15px', fontSize: '13px', color: '#856404', border: '1px solid #ffeeba' }}>
                                <i className="fas fa-exclamation-triangle"></i> Si cambias el <strong>Médico Asignado</strong>, el paciente desaparecerá de tu lista.
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Médico Asignado</label>
                                    <select name="medicoId" required defaultValue={modalPaciente.data?.MedicoID}>
                                        {medicosList.map(m => (
                                            <option key={m.MedicoID} value={m.MedicoID}>Dr. {m.Nombre} {m.Apellido} ({m.Especialidad})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group"><label>Nombre</label><input name="nombre" required defaultValue={modalPaciente.data?.Nombre} /></div>
                                <div className="form-group"><label>Apellido</label><input name="apellido" required defaultValue={modalPaciente.data?.Apellido} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Identificación</label><input name="identificacion" required defaultValue={modalPaciente.data?.Identificacion} /></div>
                                <div className="form-group"><label>F. Nacimiento</label><input type="date" name="fechaNacimiento" required defaultValue={formatDateForInput(modalPaciente.data?.FechaNacimiento)} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Celular</label><input name="telefono" defaultValue={modalPaciente.data?.TelefonoContacto} /></div>
                                <div className="form-group"><label>Tipo Sangre</label><input name="tipoSangre" style={{ width: '80px' }} defaultValue={modalPaciente.data?.TipoSangre} /></div>
                            </div>
                            <div className="form-group"><label>Dirección</label><input name="direccion" defaultValue={modalPaciente.data?.Direccion} /></div>

                            <div className="form-group">
                                <label>Alergias</label>
                                <textarea name="alergias" rows="3" defaultValue={modalPaciente.data?.Alergias}></textarea>
                                <small style={{ color: '#606770', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                    <i className="fas fa-info-circle"></i> Separa las alergias con <strong>comas (,)</strong> para visualizarlas correctamente.
                                </small>
                            </div>

                            <button type="submit" className="btn btn-primary">Guardar Cambios</button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL CONSULTA */}
            {modalConsulta.isOpen && (
                <div className="modal">
                    <div className="modal-content">
                        <span className="close-modal" onClick={() => setModalConsulta({ isOpen: false, data: null })}>&times;</span>
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
                                <button type="submit" className="btn btn-primary">Guardar</button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL EXAMEN */}
            {modalExamen.isOpen && (
                <div className="modal">
                    <div className="modal-content">
                        <span className="close-modal" onClick={() => setModalExamen({ isOpen: false, data: null, consultaId: null })}>&times;</span>
                        <h2>{modalExamen.data ? 'Editar Examen' : 'Adjuntar Examen'}</h2>
                        <form onSubmit={handleGuardarExamen}>
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
                            <button type="submit" className="btn btn-primary">Guardar</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DashboardMedico;