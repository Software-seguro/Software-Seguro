// frontend/src/pages/DashboardMedico.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import '../css/dashboard.css';

function DashboardMedico() {
    const navigate = useNavigate();

    // --- ESTADOS DE VISTA Y DATOS ---
    const [view, setView] = useState('pacientes'); // 'pacientes' | 'detalle' | 'chat'
    const [pacientes, setPacientes] = useState([]);
    const [selectedPaciente, setSelectedPaciente] = useState(null);
    const [historia, setHistoria] = useState({ consultas: [], examenes: [] });
    const [medico, setMedico] = useState({ nombre: '', id: null, internalId: null, especialidad: '' });
    const [medicosList, setMedicosList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [modalReAuth, setModalReAuth] = useState({ isOpen: false, password: '', pendingAction: null });

    const [showExpireModal, setShowExpireModal] = useState(false);
    const timerRef = useRef(null);

    // --- MODALES ---
    const [modalUser, setModalUser] = useState({ isOpen: false, data: null });
    const [modalConsulta, setModalConsulta] = useState({ isOpen: false, data: null });
    const [modalExamen, setModalExamen] = useState({ isOpen: false, data: null, consultaId: null });

    // --- ALERTAS PERSONALIZADAS ---
    const [alertConfig, setAlertConfig] = useState({
        isOpen: false, title: '', message: '', type: 'info', confirmText: 'Aceptar', onConfirm: null, showCancel: false
    });

    const showAlert = (title, message, type = 'info', onConfirm = null, showCancel = false, confirmText = 'Aceptar') => {
        setAlertConfig({ isOpen: true, title, message, type, onConfirm, showCancel, confirmText });
    };

    const closeAlert = () => setAlertConfig({ ...alertConfig, isOpen: false });

    // --- CHAT ---
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [activeChat, setActiveChat] = useState(null);
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
        if (!dateString) return '';
        return new Date(dateString).toISOString().split('T')[0];
    };

    const renderAlergias = (alergiasString) => {
        if (!alergiasString) return <span style={{ color: '#ccc', fontSize: '11px' }}>Ninguna</span>;
        return alergiasString.split(',').map((alergia, index) => (
            <div key={index} style={{ whiteSpace: 'nowrap' }}>• {alergia.trim()}</div>
        ));
    };
    const filteredPacientes = pacientes.filter(p => {
        const term = searchTerm.toLowerCase();
        const nombreCompleto = `${p.Nombre} ${p.Apellido}`.toLowerCase();
        const identificacion = (p.Identificacion || '').toLowerCase();
        return nombreCompleto.includes(term) || identificacion.includes(term);
    });

    // --- CARGA DE DATOS ---
    useEffect(() => {
        const token = sessionStorage.getItem('token');
        const rol = parseInt(sessionStorage.getItem('rolId'));
        if (!token || rol !== 1) { navigate('/'); return; }

        const fetchProfile = async () => {
            try {
                const res = await fetch(`${API_URL}/api/core/me`, { headers: { 'Authorization': `Bearer ${token}` } });

                if (res.status === 401) {
                    setShowExpireModal(true);
                    throw new Error("Sesión expirada");
                }
                if (res.ok) {
                    const data = await res.json();
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
            const res = await fetch(`${API_URL}/api/core/pacientes`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.status === 401) {
                setShowExpireModal(true);
                throw new Error("Sesión expirada");
            }
            if (res.ok) {
                const data = await res.json();
                setPacientes(data);
                if (data.length > 0) setMedico(prev => ({ ...prev, internalId: data[0].MedicoID }));
            }
        } catch (error) { console.error(error); }
    };

    const cargarListaMedicos = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/core/lista-medicos`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.status === 401) {
                setShowExpireModal(true);
                throw new Error("Sesión expirada");
            }
            if (res.ok) setMedicosList(await res.json());
        } catch (error) { console.error(error); }
    };

    const verHistoria = (paciente) => {
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
            if (resC.status === 401 || resE.status === 401) return setShowExpireModal(true);
            setHistoria({ consultas: await resC.json(), examenes: await resE.json() });
        } catch (error) { console.error(error); }
    };

    // --- ACCIONES ---

    const handleUpdatePaciente = async (e) => {
        e.preventDefault();
        const form = e.target;
        const nuevoMedicoId = parseInt(form.medicoId.value);

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
        const ejecutarUpdateReal = async () => {
            const token = sessionStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/core/pacientes/${modalUser.data.PacienteID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (res.status === 401) {
                setShowExpireModal(true);
                throw new Error("Sesión expirada");
            }
            if (res.ok) {
                setModalUser({ isOpen: false, data: null });
                cargarPacientes();
                showAlert("Éxito", "Ficha actualizada", "success");
            }
        };

        const solicitarConfirmacion = () => {
            setModalReAuth({
                isOpen: true,
                password: '',
                pendingAction: ejecutarUpdateReal
            });
        };
        if (medico.internalId && nuevoMedicoId !== medico.internalId) {
            showAlert("Transferencia", "¿Confirmas el cambio de médico?", "warning", solicitarConfirmacion, true);
        } else { solicitarConfirmacion(); }
    };

    const handleGuardarConsulta = async (e) => {
        e.preventDefault();
        const form = e.target;
        const payload = {
            pacienteId: selectedPaciente.UsuarioID,
            medicoId: medico.id,
            fecha: form.fecha.value,
            motivo: form.motivo.value,
            diagnostico: form.diagnostico.value,
            tratamiento: form.tratamiento.value,
            sintomas: form.sintomas.value,
            notas: form.notas.value
        };
        const guardarReal = async () => {
            const token = sessionStorage.getItem('token');
            const isEdit = modalConsulta.data !== null;
            const url = isEdit ? `${API_URL}/api/clinical/consultas/${modalConsulta.data.ConsultaID}` : `${API_URL}/api/clinical/consultas`;

            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (res.status === 401) {
                setShowExpireModal(true);
                throw new Error("Sesión expirada");
            }
            if (res.ok) {
                setModalConsulta({ isOpen: false, data: null });
                recargarHistoria(selectedPaciente.UsuarioID);
                showAlert("Éxito", "Consulta guardada", "success");
            }

        };
        setModalReAuth({
            isOpen: true,
            password: '',
            pendingAction: guardarReal
        });
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

        const guardarReal = async () => {
            const token = sessionStorage.getItem('token');
            const isEdit = modalExamen.data !== null;
            const url = isEdit ? `${API_URL}/api/clinical/examenes/${modalExamen.data.ExamenID}` : `${API_URL}/api/clinical/examenes`;

            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (res.status === 401) {
                setShowExpireModal(true);
                throw new Error("Sesión expirada");
            }

            if (res.ok) {
                setModalExamen({ isOpen: false, data: null, consultaId: null });
                showAlert("Éxito", "Examen guardado", "success");
                recargarHistoria(selectedPaciente.UsuarioID);
            }

        };

        // DISPARAMOS EL MODAL DE RE-AUTENTICACIÓN
        setModalReAuth({
            isOpen: true,
            password: '',
            pendingAction: guardarReal
        });
    };

    // --- LÓGICA CHAT SEGURO ---
    useEffect(() => {
        const token = sessionStorage.getItem('token');
        const myId = sessionStorage.getItem('usuarioId');

        if (activeChat && view === 'chat' && token) {
            // 1. Cargar historial de forma SEGURA (HTTP con Header Authorization)
            fetch(`${API_URL}/api/chat/historial/${myId}/${activeChat.UsuarioID}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            })
                .then(res => {
                    if (!res.ok) throw new Error("No autorizado");
                    return res.json();
                })
                .then(data => setChatMessages(data))
                .catch(err => console.error("Error historial:", err));

            // 2. Conectar WebSocket de forma SEGURA (Enviando TOKEN, no el ID)
            // El servidor ahora decodifica el token para saber quién eres (FIA)
            ws.current = new WebSocket(`ws://apolo-chat-fffdazc3dwehc8hx.canadacentral-01.azurewebsites.net?token=${token}`);

            ws.current.onopen = () => {
                console.log("Conexión WebSocket establecida y autenticada");
            };

            ws.current.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                // Solo añadir si es de la persona con la que estoy hablando
                if (msg.userId === activeChat.UsuarioID || msg.receptorId === activeChat.UsuarioID) {
                    setChatMessages(prev => [...prev, msg]);
                }
            };

            ws.current.onclose = () => {
                console.log("Conexión WebSocket cerrada");
            };
        }

        return () => {
            if (ws.current) ws.current.close();
        };
    }, [activeChat, view]);

    const enviarMensaje = () => {
        if (!chatInput.trim() || !activeChat || !ws.current) return;
        const mensaje = { receptorId: activeChat.UsuarioID, username: medico.nombre, text: chatInput, rol: 1 };
        ws.current.send(JSON.stringify(mensaje));
        setChatInput('');
    };

    const ejecutarReAutenticacion = async (e) => {
        e.preventDefault();
        const token = sessionStorage.getItem('token');

        try {
            const res = await fetch(`${API_URL}/api/auth/verify-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ password: modalReAuth.password })
            });

            if (res.status === 401) {
                setShowExpireModal(true);
                throw new Error("Sesión expirada");
            }
            if (res.ok) {
                const actionToExecute = modalReAuth.pendingAction;
                setModalReAuth({ isOpen: false, password: '', pendingAction: null });
                actionToExecute(); // Ejecuta la acción que quedó pausada
            } else {
                showAlert("Error de Seguridad", "Contraseña incorrecta. Confirmación rechazada.", "danger");
                setModalReAuth({ ...modalReAuth, password: '' });
            }
        } catch (error) {
            showAlert("Error", "No se pudo conectar con el servicio de seguridad.", "danger");
        }
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
            <aside className="admin-sidebar">
                <div className="admin-brand">
                    <h1 className="logo-text">APOLO</h1>
                    <span className="brand-badge">MÉDICO</span>
                </div>
                <div className="admin-profile">
                    <div className="avatar-circle"><i className="fas fa-user-md"></i></div>
                    <div className="profile-info">
                        <h3>{medico.nombre}</h3>
                        <p>{medico.especialidad || 'Cargando...'}</p>
                    </div>
                </div>
                <nav className="admin-nav">
                    <button className={`nav-item ${view === 'pacientes' || view === 'detalle' ? 'active' : ''}`} onClick={() => setView('pacientes')}>
                        <i className="fas fa-user-injured"></i> <span>Pacientes</span>
                    </button>
                    <button className={`nav-item ${view === 'chat' ? 'active' : ''}`} onClick={() => setView('chat')}>
                        <i className="fas fa-comments"></i> <span>Chat Global</span>
                    </button>
                    <div className="nav-spacer" style={{ flex: 1 }}></div>
                    <button className="nav-item logout" onClick={() => { sessionStorage.clear(); navigate('/'); }}>
                        <i className="fas fa-sign-out-alt"></i> <span>Cerrar Sesión</span>
                    </button>
                </nav>
            </aside>

            <main className="admin-main">
                <header className="admin-header">
                    <div className="header-title">
                        <h1>{view === 'pacientes' ? 'Mis Pacientes' : view === 'detalle' ? 'Historia Clínica' : 'Chat Directo'}</h1>
                        <p>{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>

                    {/* BUSCADOR ESTILO ADMIN (Solo se muestra en la vista de pacientes) */}
                    {view === 'pacientes' && (
                        <div className="header-search">
                            <i className="fas fa-search"></i>
                            <input
                                type="text"
                                placeholder="Buscar por nombre o cédula..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}
                </header>

                <section className="admin-content">
                    {view === 'pacientes' && (
                        <div className="content-card">
                            <table className="modern-table">
                                <thead>
                                    <tr>
                                        <th>Identificación</th>
                                        <th>Paciente</th>
                                        <th>Edad</th>
                                        <th>Sangre</th>
                                        <th>Celular</th>
                                        <th>Alergias</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* USAMOS SOLO filteredPacientes PARA EVITAR DUPLICADOS */}
                                    {filteredPacientes.map(p => (
                                        <tr key={p.UsuarioID}>
                                            <td className="col-id">{p.Identificacion || '--'}</td>
                                            <td className="col-name">{p.Nombre} {p.Apellido}</td>
                                            <td>{calcularEdad(p.FechaNacimiento)} años</td>
                                            <td>
                                                {/* Badge dinámico para el tipo de sangre */}
                                                <span className={`badge ${p.TipoSangre ? 'badge-success' : ''}`}
                                                    style={{ background: p.TipoSangre ? '#eafbe7' : '#f0f2f5', color: p.TipoSangre ? '#42b72a' : '#65676b' }}>
                                                    {p.TipoSangre || '--'}
                                                </span>
                                            </td>
                                            <td>{p.TelefonoContacto || '--'}</td>
                                            <td style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600' }}>
                                                {renderAlergias(p.Alergias)}
                                            </td>
                                            <td className="col-actions">
                                                <button className="action-btn edit" title="Editar Ficha" onClick={() => setModalUser({ isOpen: true, data: p })}>
                                                    <i className="fas fa-user-edit"></i>
                                                </button>
                                                <button className="action-btn edit" title="Ver Historia" onClick={() => verHistoria(p)}>
                                                    <i className="fas fa-file-medical"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Mensaje de "No encontrado" dentro del mismo tbody */}
                                    {filteredPacientes.length === 0 && (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#65676b' }}>
                                                {pacientes.length === 0
                                                    ? "No hay pacientes asignados."
                                                    : `No se encontraron pacientes que coincidan con "${searchTerm}"`}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* VISTA DETALLE HISTORIA - Sección de Consultas y Exámenes */}
                    {view === 'detalle' && selectedPaciente && (
                        <div className="history-container">
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                                <button className="btn btn-danger" onClick={() => setView('pacientes')} style={{ width: 'auto' }}>
                                    <i className="fas fa-arrow-left"></i> Regresar
                                </button>
                            </div>

                            {/* Card del Paciente */}
                            <div className="content-card" style={{ padding: '20px', marginBottom: '25px', borderLeft: '5px solid var(--primary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h2 style={{ margin: 0 }}>{selectedPaciente.Nombre} {selectedPaciente.Apellido}</h2>
                                        <p style={{ color: 'var(--text-secondary)', margin: '5px 0' }}>Cédula: {selectedPaciente.Identificacion}</p>
                                    </div>
                                    <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setModalConsulta({ isOpen: true, data: null })}>
                                        <i className="fas fa-plus"></i> Nueva Consulta
                                    </button>
                                </div>
                            </div>

                            {historia.consultas.map(c => (
                                <div key={c.ConsultaID} className="content-card" style={{ padding: '20px', marginBottom: '15px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span className="badge badge-success">{new Date(c.FechaConsulta).toLocaleDateString()}</span>

                                        <div className="col-actions">
                                            <button className="action-btn edit" title="Adjuntar Examen" onClick={() => setModalExamen({ isOpen: true, data: null, consultaId: c.ConsultaID })}>
                                                <i className="fas fa-file-medical"></i>
                                            </button>
                                            <button className="action-btn edit" title="Editar Consulta" onClick={() => setModalConsulta({ isOpen: true, data: c })}>
                                                <i className="fas fa-pen"></i>
                                            </button>
                                            <button className="action-btn delete" title="Eliminar Consulta" onClick={() => {
                                                const eliminarReal = async () => {
                                                    showAlert(
                                                        "Eliminar Consulta",
                                                        "¿Borrar registro permanentemente?",
                                                        "danger",
                                                        async () => {
                                                            const token = sessionStorage.getItem('token');
                                                            const res = await fetch(`${API_URL}/api/clinical/consultas/${c.ConsultaID}`, {
                                                                method: 'DELETE',
                                                                headers: { 'Authorization': `Bearer ${token}` }
                                                            });
                                                            if (res.status === 401) {
                                                                setShowExpireModal(true);
                                                                throw new Error("Sesión expirada");
                                                            }

                                                            if (res.ok) {
                                                                recargarHistoria(selectedPaciente.UsuarioID);
                                                                showAlert("Éxito", "Consulta eliminada", "success");
                                                            } else if (res.status === 409) {
                                                                // AQUÍ CAPTURAMOS EL ERROR DE EXÁMENES ASOCIADOS
                                                                const errorData = await res.json();
                                                                showAlert("No se puede eliminar", errorData.message, "warning");
                                                            } else {
                                                                showAlert("Error", "Ocurrió un error al intentar eliminar.", "danger");
                                                            }
                                                        },
                                                        true // Mostrar botón cancelar

                                                    );
                                                };

                                                setModalReAuth({
                                                    isOpen: true,
                                                    password: '',
                                                    pendingAction: eliminarReal
                                                });
                                            }}>
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </div>
                                    </div>

                                    <h3 style={{ margin: '10px 0', color: 'var(--primary)', textAlign: 'left' }}>{c.MotivoConsulta}</h3>
                                    <p style={{ textAlign: 'left' }}><strong>Diagnóstico:</strong> {c.Diagnostico}</p>
                                    <p style={{ textAlign: 'left' }}><strong>Tratamiento:</strong> {c.Tratamiento}</p>

                                    <div className="separator"></div>

                                    {/* LISTADO DE EXÁMENES CON DISEÑO DE BOTONES CIRCULARES */}
                                    <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', textAlign: 'left' }}>
                                        <strong style={{ fontSize: '13px', display: 'block', marginBottom: '10px' }}>
                                            <i className="fas fa-paperclip"></i> Exámenes adjuntos:
                                        </strong>

                                        {historia.examenes.filter(e => e.ConsultaID === c.ConsultaID).map(e => (
                                            <div key={e.ExamenID} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '8px 0',
                                                borderBottom: '1px solid #eee'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: '700', fontSize: '14px', lineHeight: '1.2' }}>{e.TipoExamen}</span>
                                                    <span style={{ fontSize: '12px', color: '#888' }}>({new Date(e.FechaRealizacion).toLocaleDateString()})</span>

                                                    {/* --- CORRECCIÓN 1: MOSTRAR OBSERVACIONES --- */}
                                                    {e.ObservacionesResultados && (
                                                        <p style={{ fontSize: '12px', color: '#555', margin: '4px 0 0 0', fontStyle: 'italic', background: '#fff', padding: '5px', borderLeft: '3px solid #ccc' }}>
                                                            {e.ObservacionesResultados}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* CONTENEDOR DE ACCIONES */}
                                                <div className="col-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {e.RutaArchivo && e.RutaArchivo !== '#' && (
                                                        <a href={e.RutaArchivo} target="_blank" rel="noreferrer" className="action-btn edit" title="Ver archivo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '0' }}>
                                                            <i className="fas fa-eye" style={{ fontSize: '16px' }}></i>
                                                        </a>
                                                    )}

                                                    {/* --- CORRECCIÓN 2: BOTÓN EDITAR EXAMEN --- */}
                                                    <button className="action-btn edit" title="Editar examen"
                                                        onClick={() => setModalExamen({ isOpen: true, data: e, consultaId: c.ConsultaID })}
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '0' }}>
                                                        <i className="fas fa-pen" style={{ fontSize: '16px' }}></i>
                                                    </button>

                                                    <button className="action-btn delete" title="Eliminar examen"
                                                        onClick={() => {
                                                            const eliminarReal = () => {
                                                                showAlert("Eliminar Examen", "¿Borrar este examen?", "danger", async () => {
                                                                    const token = sessionStorage.getItem('token');
                                                                    await fetch(`${API_URL}/api/clinical/examenes/${e.ExamenID}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                                                                    recargarHistoria(selectedPaciente.UsuarioID);
                                                                }, true);
                                                            };

                                                            setModalReAuth({ isOpen: true, password: '', pendingAction: eliminarReal });
                                                        }}
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '0' }}>
                                                        <i className="fas fa-trash-alt" style={{ fontSize: '16px' }}></i>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {historia.examenes.filter(e => e.ConsultaID === c.ConsultaID).length === 0 && (
                                            <p style={{ fontSize: '12px', color: '#999', margin: 0, fontStyle: 'italic' }}>No hay exámenes adjuntos.</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {view === 'chat' && (
                        <div className="content-card" style={{ height: '75vh', display: 'flex', overflow: 'hidden' }}>
                            {/* Sidebar de Pacientes */}
                            <div style={{ width: '250px', borderRight: '1px solid var(--border)', background: '#f8f9fa' }}>
                                <div style={{ padding: '15px', fontWeight: '800', fontSize: '12px', color: 'var(--text-secondary)' }}>MIS PACIENTES</div>
                                <div style={{ overflowY: 'auto', height: 'calc(100% - 45px)' }}>
                                    {pacientes.map(p => (
                                        <div key={p.UsuarioID}
                                            onClick={() => setActiveChat(p)}
                                            style={{
                                                padding: '12px 15px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #eee',
                                                background: activeChat?.UsuarioID === p.UsuarioID ? '#e7f3ff' : 'transparent',
                                                color: activeChat?.UsuarioID === p.UsuarioID ? 'var(--primary)' : 'inherit',
                                                fontWeight: activeChat?.UsuarioID === p.UsuarioID ? '700' : 'normal',
                                                textAlign: 'left'
                                            }}>
                                            {p.Nombre} {p.Apellido}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Área Principal de Chat */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
                                {activeChat ? (
                                    <>
                                        {/* Header del chat activo */}
                                        <div style={{ padding: '10px 20px', borderBottom: '1px solid #eee', background: '#f8f9fa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div className="avatar-circle" style={{ width: '30px', height: '30px', fontSize: '14px' }}><i className="fas fa-user"></i></div>
                                            <span style={{ fontWeight: '700' }}>{activeChat.Nombre} {activeChat.Apellido}</span>
                                        </div>

                                        {/* Mensajes */}
                                        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {chatMessages.map((msg, i) => {
                                                const esDelPaciente = msg.userId === activeChat.UsuarioID;
                                                return (
                                                    <div key={i} style={{
                                                        alignSelf: esDelPaciente ? 'flex-start' : 'flex-end',
                                                        background: esDelPaciente ? '#f0f2f5' : 'var(--primary)',
                                                        color: esDelPaciente ? 'black' : 'white',
                                                        padding: '10px 15px',
                                                        borderRadius: '18px',
                                                        maxWidth: '70%',
                                                        fontSize: '14px',
                                                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                    }}>
                                                        {/* ETIQUETA SOBRE EL MENSAJE */}
                                                        <span style={{
                                                            fontSize: '9px',
                                                            display: 'block',
                                                            opacity: 0.7,
                                                            marginBottom: '3px',
                                                            fontWeight: 'bold',
                                                            textAlign: esDelPaciente ? 'left' : 'right'
                                                        }}>
                                                            {esDelPaciente ? activeChat.Nombre : 'Yo'}
                                                        </span>
                                                        {msg.text}
                                                    </div>
                                                );
                                            })}
                                            {chatMessages.length === 0 && <div style={{ margin: 'auto', color: '#999' }}>No hay mensajes anteriores.</div>}
                                        </div>

                                        {/* Input */}
                                        <div style={{ padding: '15px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px' }}>
                                            <input
                                                className="small-input"
                                                style={{ flex: 1, borderRadius: '20px', paddingLeft: '15px' }}
                                                value={chatInput}
                                                onChange={e => setChatInput(e.target.value)}
                                                placeholder={`Escribir a ${activeChat.Nombre}...`}
                                                onKeyDown={e => e.key === 'Enter' && enviarMensaje()}
                                            />
                                            <button className="btn btn-primary" style={{ width: '45px', borderRadius: '50%', height: '45px', padding: 0, margin: 0 }} onClick={enviarMensaje}>
                                                <i className="fas fa-paper-plane"></i>
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ margin: 'auto', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                        <i className="fas fa-comments" style={{ fontSize: '40px', display: 'block', marginBottom: '10px', opacity: 0.3 }}></i>
                                        <p>Selecciona un paciente para iniciar el chat directo</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            </main>

            {modalConsulta.isOpen && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <button className="cerrar" onClick={() => setModalConsulta({ isOpen: false })}><i className="fas fa-times"></i></button>
                        <h2 style={{ color: 'var(--primary)' }}>{modalConsulta.data ? 'Editar Consulta' : 'Nueva Consulta'}</h2>
                        <div className="separator"></div>
                        <form onSubmit={handleGuardarConsulta}>
                            <div className="field-container">
                                <label className="field-label">Fecha</label>
                                <input type="date" name="fecha" className="small-input" defaultValue={formatDateForInput(modalConsulta.data?.FechaConsulta || new Date())} required />
                            </div>
                            <div className="field-container">
                                <label className="field-label">Motivo</label>
                                <input name="motivo" className="small-input" defaultValue={modalConsulta.data?.MotivoConsulta} required maxLength="200" />
                            </div>
                            <div className="form-row">
                                <div className="field-container"><label className="field-label">Diagnóstico</label><input name="diagnostico" className="small-input" defaultValue={modalConsulta.data?.Diagnostico} required maxLength="200" /></div>
                                <div className="field-container"><label className="field-label">Tratamiento</label><input name="tratamiento" className="small-input" defaultValue={modalConsulta.data?.Tratamiento} required maxLength="200" /></div>
                            </div>
                            <div className="field-container"><label className="field-label">Síntomas</label><textarea name="sintomas" className="small-input" defaultValue={modalConsulta.data?.Sintomas} rows="2" maxLength="200"></textarea></div>
                            <div className="field-container"><label className="field-label">Notas Adicionales</label><textarea name="notas" className="small-input" defaultValue={modalConsulta.data?.NotasAdicionales} rows="2" maxLength="200"></textarea></div>
                            <div className="modal-actions-inline">
                                <button type="submit" className="btn btn-primary">Guardar</button>
                                <button type="button" className="btn btn-danger" onClick={() => setModalConsulta({ isOpen: false })}>Cerrar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalUser.isOpen && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <button className="cerrar" onClick={() => setModalUser({ isOpen: false })}><i className="fas fa-times"></i></button>
                        <h2 style={{ color: 'var(--primary)' }}>Ficha del Paciente</h2>
                        <div className="separator"></div>
                        <form onSubmit={handleUpdatePaciente}>
                            <div className="field-container">
                                <label className="field-label">Médico Asignado</label>
                                <select name="medicoId" className="small-input" defaultValue={modalUser.data?.MedicoID}>
                                    {medicosList.map(m => <option key={m.MedicoID} value={m.MedicoID}>Dr. {m.Nombre} {m.Apellido}</option>)}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="field-container"><label className="field-label">Nombre</label><input name="nombre" className="small-input" defaultValue={modalUser.data?.Nombre} required /></div>
                                <div className="field-container"><label className="field-label">Apellido</label><input name="apellido" className="small-input" defaultValue={modalUser.data?.Apellido} required /></div>
                            </div>
                            <div className="form-row">
                                <div className="field-container"><label className="field-label">Cédula</label><input name="identificacion" className="small-input" defaultValue={modalUser.data?.Identificacion} required /></div>
                                <div className="field-container"><label className="field-label">F. Nacimiento</label><input type="date" name="fechaNacimiento" className="small-input" defaultValue={formatDateForInput(modalUser.data?.FechaNacimiento)} required /></div>
                            </div>
                            <div className="form-row">
                                <div className="field-container"><label className="field-label">Teléfono</label><input name="telefono" className="small-input" defaultValue={modalUser.data?.TelefonoContacto} /></div>
                                <div className="field-container">
                                    <label className="field-label">Sangre</label>
                                    <select name="tipoSangre" className="small-input" defaultValue={modalUser.data?.TipoSangre}>
                                        <option value="">Seleccione...</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                    </select>
                                </div>
                            </div>
                            <div className="field-container"><label className="field-label">Dirección</label><input name="direccion" className="small-input" defaultValue={modalUser.data?.Direccion} /></div>

                            {/* --- CORRECCIÓN 3: MENSAJE DE AYUDA EN ALERGIAS --- */}
                            <div className="field-container">
                                <label className="field-label">
                                    Alergias
                                    <span style={{ fontSize: '11px', color: '#666', fontWeight: 'normal', marginLeft: '5px' }}>
                                        (Separar con comas: ej. Penicilina, Polvo)
                                    </span>
                                </label>
                                <textarea name="alergias" className="small-input" defaultValue={modalUser.data?.Alergias} rows="2"></textarea>
                            </div>

                            <div className="modal-actions-inline">
                                <button type="submit" className="btn btn-primary">Guardar cambios</button>
                                <button type="button" className="btn btn-danger" onClick={() => setModalUser({ isOpen: false })}>Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL EXAMEN */}
            {modalExamen.isOpen && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <button className="cerrar" onClick={() => setModalExamen({ isOpen: false })}><i className="fas fa-times"></i></button>
                        <h2 style={{ color: 'var(--primary)' }}>{modalExamen.data ? 'Editar Examen' : 'Adjuntar Examen'}</h2>
                        <div className="separator"></div>
                        <form onSubmit={handleGuardarExamen}>
                            <div className="form-row">
                                <div className="field-container">
                                    <label className="field-label">Tipo</label>
                                    <select name="tipo" className="small-input" required defaultValue={modalExamen.data?.TipoExamen}>
                                        <option>Laboratorio</option><option>Rayos X</option><option>Ecografía</option><option>Otro</option>
                                    </select>
                                </div>
                                <div className="field-container">
                                    <label className="field-label">Fecha</label>
                                    <input type="date" name="fecha" className="small-input" required defaultValue={formatDateForInput(modalExamen.data?.FechaRealizacion || new Date())} />
                                </div>
                            </div>
                            <div className="field-container">
                                <label className="field-label">URL Archivo</label>
                                <input name="ruta" className="small-input" defaultValue={modalExamen.data?.RutaArchivo} placeholder="https://..." />
                            </div>
                            <div className="field-container">
                                <label className="field-label">Observaciones</label>
                                <textarea name="observaciones" className="small-input" defaultValue={modalExamen.data?.ObservacionesResultados} rows="3"></textarea>
                            </div>
                            <div className="modal-actions-inline">
                                <button type="submit" className="btn btn-primary">Guardar</button>
                                <button type="button" className="btn btn-danger" onClick={() => setModalExamen({ isOpen: false })}>Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL ALERTA */}
            {alertConfig.isOpen && (
                <div className="modal-overlay" style={{ zIndex: 5000 }}>
                    <div className="modal-card notification-modal">
                        <div className={`${alertConfig.type}-icon`}>{alertConfig.type === 'success' ? '✓' : alertConfig.type === 'danger' ? '✕' : '!'}</div>
                        <h2 className={alertConfig.type === 'danger' ? 'text-danger' : ''}>{alertConfig.title}</h2>
                        <p>{alertConfig.message}</p>
                        <div className="modal-actions-inline">
                            <button className="btn btn-primary" onClick={() => { alertConfig.onConfirm?.(); closeAlert(); }}>{alertConfig.confirmText}</button>
                            {alertConfig.showCancel && <button className="btn btn-danger" onClick={closeAlert}>Cancelar</button>}
                        </div>
                    </div>
                </div>
            )}
            {modalReAuth.isOpen && (
                <div className="modal-overlay" style={{ zIndex: 4000 }}>
                    <div className="modal-card" style={{ maxWidth: '350px', textAlign: 'center' }}>
                        <div className="danger-icon" style={{ marginBottom: '15px' }}>
                            <i className="fas fa-lock"></i>
                        </div>
                        <h2 className="text-danger" style={{ marginTop: 0 }}>Confirmar Acción</h2>
                        <p style={{ fontSize: '14px', marginBottom: '20px', color: '#65676b' }}>
                            Estás realizando una modificación sensible en la historia clínica. <br />
                            <b>Por seguridad, ingresa tu contraseña:</b>
                        </p>
                        <form onSubmit={ejecutarReAutenticacion}>
                            <div className="field-container" style={{ marginBottom: '20px' }}>
                                <input
                                    type="password"
                                    className="small-input"
                                    placeholder="Contraseña del Médico"
                                    style={{ textAlign: 'center', fontSize: '18px' }}
                                    value={modalReAuth.password}
                                    onChange={e => setModalReAuth({ ...modalReAuth, password: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="modal-actions-inline">
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirmar</button>
                                <button type="button" className="btn btn-danger" style={{ flex: 1 }}
                                    onClick={() => setModalReAuth({ isOpen: false, password: '', pendingAction: null })}>
                                    Cancelar
                                </button>
                            </div>
                        </form>
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
        </div>
    );
}

export default DashboardMedico;