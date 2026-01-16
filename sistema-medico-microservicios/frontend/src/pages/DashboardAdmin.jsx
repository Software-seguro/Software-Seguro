import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import '../css/dashboard.css';

function DashboardAdmin() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('medicos'); // 'medicos' | 'pacientes'
    
    // Datos crudos del backend
    const [medicos, setMedicos] = useState([]);
    const [pacientes, setPacientes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modales
    const [modalUser, setModalUser] = useState({ isOpen: false, type: '', data: null });
    const [modalPass, setModalPass] = useState({ isOpen: false, userId: null });
    const [modalReassign, setModalReassign] = useState({ isOpen: false, pacientes: [], doctorIdToDelete: null });

    // --- CARGA DE DATOS ---
    useEffect(() => {
        const rol = parseInt(sessionStorage.getItem('rolId'));
        if (rol !== 3) { navigate('/'); return; } 
        cargarDatos();
    }, [navigate]);

    const cargarDatos = async () => {
        const token = sessionStorage.getItem('token');
        try {
            const res = await fetch(`${API_URL}/api/core/admin/all`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                // Aseguramos que siempre sean arreglos para evitar pantallazos blancos
                setMedicos(Array.isArray(data.medicos) ? data.medicos : []);
                setPacientes(Array.isArray(data.pacientes) ? data.pacientes : []);
            }
        } catch (err) { console.error(err); }
    };

    // --- LÓGICA DE FILTRADO (ESTADO DERIVADO) ---
    // Esto se recalcula automáticamente en cada render. Cero bugs de sincronización.
    const source = tab === 'medicos' ? medicos : pacientes;
    const filteredData = source.filter(item => {
        const term = searchTerm.toLowerCase();
        const nombreCompleto = `${item.Nombre} ${item.Apellido}`.toLowerCase();
        
        // Buscamos por campos comunes
        if (nombreCompleto.includes(term)) return true;
        if (item.Email && item.Email.toLowerCase().includes(term)) return true;

        // Buscamos por campos específicos
        if (tab === 'medicos') {
            return (item.NumeroLicencia && item.NumeroLicencia.toLowerCase().includes(term)) ||
                   (item.Especialidad && item.Especialidad.toLowerCase().includes(term));
        } else {
            return item.Identificacion && item.Identificacion.toLowerCase().includes(term);
        }
    });

    // --- ACCIONES DE USUARIO ---

    const handleSaveUser = async (e) => {
        e.preventDefault();
        const form = e.target;
        const token = sessionStorage.getItem('token');
        const isMedico = modalUser.type === 'medico';
        const id = isMedico ? modalUser.data.MedicoID : modalUser.data.PacienteID;
        const usuarioId = modalUser.data.UsuarioID;

        // Obtenemos los valores del formulario
        const identificacionVal = form.identificacion.value;
        const licenciaVal = isMedico ? form.licencia.value : null;

        try {
            const resVal = await fetch(`${API_URL}/api/core/validate-registry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    identificacion: identificacionVal, 
                    licencia: licenciaVal,
                    excludeUserId: usuarioId // ¡CLAVE! Enviamos el ID para que no se choque consigo mismo
                })
            });

            if (!resVal.ok) {
                const errVal = await resVal.json();
                alert("⚠️ Error de validación: " + errVal.message);
                return; // DETENEMOS EL GUARDADO
            }
        } catch (error) {
            console.error(error);
            alert("Error al conectar con el servicio de validación");
            return;
        }

        // 1. Actualizar Email (Auth Service)
        const email = form.email.value;
        if (email && email !== modalUser.data.Email) {
            await fetch(`${API_URL}/api/auth/users/${usuarioId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
        }

        // 2. Actualizar Perfil (Core Service)
        const endpoint = isMedico ? `/api/core/admin/medicos/${id}` : `/api/core/pacientes/${id}`;
        const payload = isMedico ? {
            nombre: form.nombre.value,
            apellido: form.apellido.value,
            identificacion: form.identificacion.value,
            especialidad: form.especialidad.value,
            licencia: form.licencia.value,
            telefono: form.telefono.value
        } : {
            nombre: form.nombre.value,
            apellido: form.apellido.value,
            identificacion: form.identificacion.value,
            fechaNacimiento: form.fechaNacimiento.value,
            direccion: form.direccion.value,
            telefono: form.telefono.value,
            medicoId: form.medicoId.value,
            alergias: modalUser.data.Alergias 
        };

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert('Usuario actualizado correctamente');
            setModalUser({ isOpen: false, type: '', data: null });
            cargarDatos();
        } else {
            const err = await res.json();
            alert('Error al guardar: ' + err.message);
        }
    };

    const handleChangePass = async (e) => {
        e.preventDefault();
        const newPass = e.target.password.value;
        const token = sessionStorage.getItem('token'); // <--- 1. OBTENER TOKEN

        const res = await fetch(`${API_URL}/api/auth/users/${modalPass.userId}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // <--- 2. ENVIAR TOKEN
            },
            body: JSON.stringify({ password: newPass })
        });
        
        if (res.ok) {
            alert('Contraseña actualizada correctamente');
            setModalPass({ isOpen: false, userId: null });
        } else {
            const err = await res.json();
            alert('Error: ' + (err.message || 'No se pudo actualizar'));
        }
    };

    const handleDeleteMedico = async (id) => {
        if (!confirm("¿Eliminar médico? Esta acción es irreversible.")) return;
        const token = sessionStorage.getItem('token');
        
        const res = await fetch(`${API_URL}/api/core/admin/medicos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.status === 409) { 
            const data = await res.json();
            setModalReassign({ isOpen: true, pacientes: data.pacientes, doctorIdToDelete: id });
        } else if (res.ok) {
            const medico = medicos.find(m => m.MedicoID === id);
            await fetch(`${API_URL}/api/auth/users/${medico.UsuarioID}`, { method: 'DELETE' });
            alert("Médico eliminado.");
            cargarDatos();
        }
    };

    const handleDeletePaciente = async (p) => {
        if (!confirm(`⚠️ PELIGRO: Al eliminar a ${p.Nombre} ${p.Apellido}, se BORRARÁ TODO SU HISTORIAL MÉDICO.\n\n¿Estás seguro?`)) return;
        const token = sessionStorage.getItem('token');
        
        const res = await fetch(`${API_URL}/api/core/admin/pacientes/${p.PacienteID}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            await fetch(`${API_URL}/api/auth/users/${p.UsuarioID}`, { method: 'DELETE' });
            alert("Paciente eliminado.");
            cargarDatos();
        }
    };

    const handleUnlock = async (usuarioId) => {
        if (!confirm("¿Deseas desbloquear esta cuenta y reiniciar sus intentos fallidos?")) return;
        
        const token = sessionStorage.getItem('token');
        try {
            const res = await fetch(`${API_URL}/api/core/admin/users/${usuarioId}/unlock`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                alert("Cuenta desbloqueada.");
                cargarDatos(); // Recargar la tabla para ver el cambio a verde
            } else {
                alert("Error al desbloquear.");
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="container">
            <aside className="sidebar">
                <div className="profile-section">
                    <div className="avatar"><i className="fas fa-user-shield"></i></div>
                    <h3>Administrador</h3>
                    <p>Gestión del Sistema</p>
                </div>
                <nav>
                    <button className={`nav-btn ${tab === 'medicos' ? 'active' : ''}`} onClick={() => { setTab('medicos'); setSearchTerm(''); }}><i className="fas fa-user-md"></i> Médicos</button>
                    <button className={`nav-btn ${tab === 'pacientes' ? 'active' : ''}`} onClick={() => { setTab('pacientes'); setSearchTerm(''); }}><i className="fas fa-user-injured"></i> Pacientes</button>
                    <button className="nav-btn logout" onClick={() => { sessionStorage.clear(); navigate('/'); }}><i className="fas fa-sign-out-alt"></i> Salir</button>
                </nav>
            </aside>

            <main className="main-content">
                <header><h1>Panel de Administración</h1></header>

                <section className="content-section">
                    <div className="section-header">
                        <h2>{tab === 'medicos' ? 'Gestión de Médicos' : 'Gestión de Pacientes'}</h2>
                        <input 
                            type="text" 
                            placeholder={tab === 'medicos' ? "Buscar por nombre, licencia o email..." : "Buscar por nombre, cédula o email..."}
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Estado</th>
                                    <th>Nombre Completo</th>
                                    <th>Email</th>
                                    {tab === 'medicos' ? (
                                        <><th>Identificación</th><th>Lincencia</th><th>Especialidad</th><th>Teléfono</th></>
                                    ) : (
                                        <><th>Identificación</th><th>Médico Asignado</th><th>Teléfono</th></>
                                    )}
                                    <th style={{textAlign:'right'}}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map(u => (
                                    <tr key={tab === 'medicos' ? u.MedicoID : u.PacienteID}>
                                        <td>{tab === 'medicos' ? u.MedicoID : u.PacienteID}</td>
                                        <td style={{textAlign: 'center'}}>
                                            {u.Activo ? (
                                                <span style={{color: 'green', fontWeight:'bold', fontSize:'12px'}}>
                                                    <i className="fas fa-check-circle"></i> Activo
                                                </span>
                                            ) : (
                                                <button 
                                                    className="btn-danger-icon" 
                                                    style={{fontSize:'12px', padding:'2px 8px', borderRadius:'10px', border:'1px solid red'}}
                                                    onClick={() => handleUnlock(u.UsuarioID)} // Usamos UsuarioID, que es la FK común
                                                    title="Click para Desbloquear"
                                                >
                                                    <i className="fas fa-lock"></i> Bloqueado
                                                </button>
                                            )}
                                        </td>
                                        <td style={{fontWeight:'bold'}}>{u.Nombre} {u.Apellido}</td>
                                        <td>{u.Email || <span style={{color:'#999'}}>No disponible</span>}</td> 
                                        
                                        {tab === 'medicos' ? (
                                            <>
                                                <td>{u.Identificacion}</td>
                                                <td>{u.NumeroLicencia}</td>
                                                <td>{u.Especialidad}</td>
                                                <td>{u.Telefono}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td>{u.Identificacion}</td>
                                                <td style={{color: '#1877f2', fontWeight:'500'}}>
                                                    {u.NombreMedico ? `Dr/a. ${u.NombreMedico} ${u.ApellidoMedico}` : <span style={{color:'red'}}>Sin asignar</span>}
                                                </td>
                                                <td>{u.TelefonoContacto}</td>
                                            </>
                                        )}
                                        
                                        <td style={{textAlign:'right'}}>
                                            <div style={{display:'flex', gap:'5px', justifyContent:'flex-end'}}>
                                                <button className="btn-icon" title="Editar Datos" onClick={() => setModalUser({isOpen: true, type: tab === 'medicos' ? 'medico' : 'paciente', data: u})}><i className="fas fa-edit"></i></button>
                                                <button className="btn-icon" title="Cambiar Contraseña" onClick={() => setModalPass({isOpen: true, userId: u.UsuarioID})}><i className="fas fa-key"></i></button>
                                                <button className="btn-danger-icon" title="Eliminar Usuario" onClick={() => tab === 'medicos' ? handleDeleteMedico(u.MedicoID) : handleDeletePaciente(u)}><i className="fas fa-trash"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredData.length === 0 && <tr><td colSpan="7" style={{textAlign:'center', padding:'20px'}}>No se encontraron resultados.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>

            {/* MODAL EDICIÓN USUARIO */}
            {modalUser.isOpen && (
                <div className="modal">
                    <div className="modal-content">
                        <span className="close-modal" onClick={() => setModalUser({isOpen:false, type:'', data:null})}>&times;</span>
                        <h2>Editar {modalUser.type === 'medico' ? 'Médico' : 'Paciente'}</h2>
                        <form onSubmit={handleSaveUser}>
                            <div className="form-group">
                                <label>Email (Login)</label>
                                <input type="email" name="email" defaultValue={modalUser.data.Email} placeholder="Nuevo correo" />
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Nombre</label><input name="nombre" required defaultValue={modalUser.data.Nombre} /></div>
                                <div className="form-group"><label>Apellido</label><input name="apellido" required defaultValue={modalUser.data.Apellido} /></div>
                            </div>
                            
                            {modalUser.type === 'medico' ? (
                                <>
                                    <div className="form-group"><label>Identificación</label><input name="identificacion" required defaultValue={modalUser.data.Identificacion} /></div>
                                    <div className="form-group"><label>Especialidad</label><input name="especialidad" required defaultValue={modalUser.data.Especialidad} /></div>
                                    <div className="form-group"><label>Licencia</label><input name="licencia" required defaultValue={modalUser.data.NumeroLicencia} /></div>
                                    <div className="form-group"><label>Teléfono</label><input name="telefono" defaultValue={modalUser.data.Telefono} /></div>
                                </>
                            ) : (
                                <>
                                    <div className="form-group"><label>Identificación</label><input name="identificacion" required defaultValue={modalUser.data.Identificacion} /></div>
                                    <div className="form-group"><label>F. Nacimiento</label><input type="date" name="fechaNacimiento" defaultValue={modalUser.data.FechaNacimiento ? modalUser.data.FechaNacimiento.split('T')[0] : ''} /></div>
                                    <div className="form-group"><label>Dirección</label><input name="direccion" defaultValue={modalUser.data.Direccion} /></div>
                                    <div className="form-group"><label>Teléfono</label><input name="telefono" defaultValue={modalUser.data.TelefonoContacto} /></div>
                                    
                                    <div className="form-group" style={{background:'#e7f3ff', padding:'10px', borderRadius:'6px'}}>
                                        <label style={{color:'#1877f2'}}>Reasignar Médico</label>
                                        <select name="medicoId" defaultValue={modalUser.data.MedicoID} style={{border:'1px solid #1877f2'}}>
                                            {medicos.map(m => <option key={m.MedicoID} value={m.MedicoID}>Dr. {m.Nombre} {m.Apellido}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}
                            <button className="btn-primary btn-full" style={{marginTop:'10px'}}>Guardar Cambios</button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL PASSWORD */}
            {modalPass.isOpen && (
                <div className="modal">
                    <div className="modal-content" style={{maxWidth:'400px'}}>
                        <span className="close-modal" onClick={() => setModalPass({isOpen:false, userId:null})}>&times;</span>
                        <h2>Cambiar Contraseña</h2>
                        <form onSubmit={handleChangePass}>
                            <div className="form-group">
                                <label>Nueva Contraseña</label>
                                <input type="password" name="password" required minLength="6" placeholder="******" autoFocus />
                            </div>
                            <button className="btn-primary btn-full">Actualizar</button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL REASIGNACIÓN FORZOSA */}
            {modalReassign.isOpen && (
                <div className="modal">
                    <div className="modal-content">
                        <span className="close-modal" onClick={() => setModalReassign({isOpen:false, pacientes:[], doctorIdToDelete:null})}>&times;</span>
                        <h2 style={{color:'#dc2626'}}>Acción Requerida</h2>
                        <p>No se puede eliminar al médico porque tiene pacientes activos. Debes reasignarlos primero:</p>
                        <ul style={{background:'#f9f9f9', padding:'10px 20px', borderRadius:'8px', maxHeight:'150px', overflowY:'auto'}}>
                            {modalReassign.pacientes.map(p => <li key={p.PacienteID}>{p.Nombre} {p.Apellido}</li>)}
                        </ul>
                        <button className="btn-secondary btn-full" onClick={() => setModalReassign({isOpen:false, pacientes:[], doctorIdToDelete:null})}>Entendido</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DashboardAdmin;