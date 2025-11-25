const API_URL = 'http://localhost:3000/api';

// Estado global
let currentMedicoId = null;
let currentPacienteId = null;

// Almacenamos datos en memoria para poder rellenar los formularios al editar
let listaConsultas = [];
let listaExamenes = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar Sesión
    currentMedicoId = localStorage.getItem('medicoId');
    const nombre = localStorage.getItem('nombreUsuario');

    if (!currentMedicoId) {
        alert('Acceso denegado. Debes ser médico.');
        window.location.href = '../pages/login.html';
        return;
    }

    document.getElementById('doctorName').textContent = nombre;
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString();

    // 2. Cargar Pacientes
    cargarPacientes();

    // 3. Listeners de Formularios
    document.getElementById('formConsulta').addEventListener('submit', guardarConsulta);
    document.getElementById('formExamen').addEventListener('submit', guardarExamen);
});

// --- NAVEGACIÓN DE VISTAS ---
function showView(viewName) {
    document.getElementById('view-pacientes').classList.add('hidden');
    document.getElementById('view-detalle').classList.add('hidden');

    if (viewName === 'pacientes') {
        document.getElementById('view-pacientes').classList.remove('hidden');
        cargarPacientes();
    } else if (viewName === 'detalle') {
        document.getElementById('view-detalle').classList.remove('hidden');
    }
}

// --- PACIENTES ---
async function cargarPacientes() {
    try {
        const res = await fetch(`${API_URL}/pacientes`);
        const pacientes = await res.json();
        
        const tbody = document.getElementById('listaPacientesBody');
        tbody.innerHTML = '';

        pacientes.forEach(p => {
            const edad = calcularEdad(p.FechaNacimiento);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${p.Identificacion}</td>
                <td>${p.Nombre} ${p.Apellido}</td>
                <td>${edad} años</td>
                <td>
                    <button class="btn-primary btn-sm" onclick="verHistoriaClinica(${p.PacienteID}, '${p.Nombre} ${p.Apellido}')">
                        <i class="fas fa-eye"></i> Historia
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) { console.error(error); }
}

function calcularEdad(fecha) {
    const hoy = new Date();
    const cumple = new Date(fecha);
    let edad = hoy.getFullYear() - cumple.getFullYear();
    const m = hoy.getMonth() - cumple.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) edad--;
    return edad;
}

// --- HISTORIA CLÍNICA (RENDERIZADO CON BOTONES CRUD) ---

async function verHistoriaClinica(id, nombre) {
    currentPacienteId = id;
    document.getElementById('detallePacienteNombre').textContent = nombre;
    document.getElementById('detallePacienteId').textContent = `ID Sistema: ${id}`;
    
    showView('detalle');
    renderHistoria(id);
}

async function renderHistoria(id) {
    const container = document.getElementById('historiaClinicaContainer');
    container.innerHTML = '<p>Cargando historia...</p>';

    try {
        // Obtenemos Consultas y Exámenes en paralelo
        const [resC, resE] = await Promise.all([
            fetch(`${API_URL}/paciente/${id}/consultas`),
            fetch(`${API_URL}/paciente/${id}/examenes`)
        ]);

        // Guardamos en variables globales para usarlos al editar
        listaConsultas = await resC.json();
        listaExamenes = await resE.json();

        container.innerHTML = '';

        if (listaConsultas.length === 0) {
            container.innerHTML = '<p class="empty-msg">Este paciente no tiene consultas registradas.</p>';
            return;
        }

        listaConsultas.forEach(c => {
            // Filtrar exámenes de esta consulta específica
            const examenesDeEstaConsulta = listaExamenes.filter(e => {
                // Si el backend devuelve ConsultaID en el examen, usamos eso. Si no, comparamos fechas.
                if(e.ConsultaID && c.ConsultaID) return e.ConsultaID === c.ConsultaID;
                if(e.FechaConsulta && c.FechaConsulta) return new Date(e.FechaConsulta).getTime() === new Date(c.FechaConsulta).getTime();
                return false; 
            });

            const div = document.createElement('div');
            div.className = 'exam-card';
            div.style.marginBottom = "20px";
            div.style.position = "relative"; // Para posicionar los botones absolutos

            // Generar HTML de los Exámenes (con botones editar/eliminar)
            let htmlExamenes = '';
            if (examenesDeEstaConsulta.length > 0) {
                const listaItems = examenesDeEstaConsulta.map(e => `
                    <li style="margin-bottom: 5px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:5px;">
                        <span>
                            <strong>${e.TipoExamen}</strong> 
                            <span style="color:#666; font-size:0.9em;">- ${e.ObservacionesResultados || ''}</span>
                        </span>
                        <div>
                            <button class="btn-warning" onclick="editarExamen(${e.ExamenID})" title="Editar Examen"><i class="fas fa-edit"></i></button>
                            <button class="btn-danger" onclick="eliminarExamen(${e.ExamenID})" title="Eliminar Examen"><i class="fas fa-trash"></i></button>
                        </div>
                    </li>
                `).join('');
                
                htmlExamenes = `
                <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #ccc; background:#f9f9f9; padding:10px;">
                    <strong><i class="fas fa-paperclip"></i> Exámenes adjuntos:</strong>
                    <ul style="padding-left:0; list-style:none; margin:5px 0;">${listaItems}</ul>
                </div>`;
            }

            // Botones de acción para la CONSULTA (arriba a la derecha)
            const botonesConsulta = `
                <div style="position: absolute; top: 15px; right: 15px;">
                    <button class="btn-secondary btn-sm" onclick="abrirModalExamen(${c.ConsultaID})" title="Agregar Examen"><i class="fas fa-plus"></i> Examen</button>
                    <button class="btn-warning" onclick="editarConsulta(${c.ConsultaID})" title="Editar Consulta"><i class="fas fa-edit"></i></button>
                    <button class="btn-danger" onclick="eliminarConsulta(${c.ConsultaID})" title="Eliminar Consulta"><i class="fas fa-trash"></i></button>
                </div>
            `;

            div.innerHTML = `
                ${botonesConsulta}
                <small style="color:#666">${new Date(c.FechaConsulta).toLocaleDateString()} - ${c.Medico}</small>
                <h3 style="margin-top:5px; color:var(--primary-color); padding-right: 140px;">${c.MotivoConsulta}</h3>
                <p><strong>Dx:</strong> ${c.Diagnostico}</p>
                <p><strong>Tx:</strong> ${c.Tratamiento}</p>
                ${c.Sintomas ? `<p><strong>Síntomas:</strong> ${c.Sintomas}</p>` : ''}
                ${htmlExamenes}
            `;
            container.appendChild(div);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="color:red">Error cargando datos.</p>';
    }
}

// --- FUNCIONES DE FORMULARIOS (CREAR / EDITAR) ---

function cerrarModales() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// 1. GESTIÓN DE CONSULTAS

function abrirModalConsulta() {
    document.getElementById('formConsulta').reset();
    document.getElementById('editConsultaId').value = ""; // Vaciamos ID para indicar CREACIÓN
    document.querySelector('#modalConsulta h2').textContent = "Registrar Consulta";
    document.getElementById('modalConsulta').classList.add('active');
}

function editarConsulta(id) {
    // Buscamos la consulta en la memoria
    const consulta = listaConsultas.find(c => c.ConsultaID === id);
    if(!consulta) return;

    // Llenamos el formulario con los datos existentes
    const form = document.getElementById('formConsulta');
    form.motivo.value = consulta.MotivoConsulta;
    form.diagnostico.value = consulta.Diagnostico;
    form.tratamiento.value = consulta.Tratamiento;
    // Nota: Asegúrate de que tu backend devuelva 'Sintomas' en el GET de consultas para que esto funcione
    form.sintomas.value = consulta.Sintomas || ''; 
    
    // Ponemos el ID en el campo oculto
    document.getElementById('editConsultaId').value = consulta.ConsultaID;

    // Cambiamos el título y mostramos
    document.querySelector('#modalConsulta h2').textContent = "Editar Consulta";
    document.getElementById('modalConsulta').classList.add('active');
}

async function guardarConsulta(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    const id = data.id; // Leemos el campo oculto

    const payload = {
        ...data,
        pacienteId: parseInt(currentPacienteId),
        medicoId: parseInt(currentMedicoId)
    };

    // Si hay ID usamos PUT (Editar), si no POST (Crear)
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/consultas/${id}` : `${API_URL}/consultas`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if(res.ok) {
            alert(id ? 'Consulta actualizada' : 'Consulta registrada');
            cerrarModales();
            renderHistoria(currentPacienteId); // Recargar lista
        } else {
            alert('Error al guardar');
        }
    } catch (err) { console.error(err); }
}

async function eliminarConsulta(id) {
    if(!confirm("¿Estás seguro de eliminar esta consulta? Se borrarán también sus exámenes asociados.")) return;
    
    try {
        const res = await fetch(`${API_URL}/consultas/${id}`, { method: 'DELETE' });
        if(res.ok) {
            renderHistoria(currentPacienteId);
        } else {
            alert('Error al eliminar');
        }
    } catch (err) { console.error(err); }
}

// 2. GESTIÓN DE EXÁMENES

function abrirModalExamen(consultaId) {
    document.getElementById('formExamen').reset();
    document.getElementById('inputConsultaIdExamen').value = consultaId;
    document.getElementById('editExamenId').value = ""; // Vaciamos ID
    document.querySelector('#modalExamen h2').textContent = "Solicitar/Subir Examen";
    document.getElementById('modalExamen').classList.add('active');
}

function editarExamen(id) {
    const examen = listaExamenes.find(e => e.ExamenID === id);
    if(!examen) return;

    const form = document.getElementById('formExamen');
    form.tipo.value = examen.TipoExamen;
    form.observaciones.value = examen.ObservacionesResultados || '';
    
    // Mantenemos el ID de consulta original y el ID del examen
    document.getElementById('inputConsultaIdExamen').value = examen.ConsultaID;
    document.getElementById('editExamenId').value = examen.ExamenID;

    document.querySelector('#modalExamen h2').textContent = "Editar Examen";
    document.getElementById('modalExamen').classList.add('active');
}

async function guardarExamen(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    const id = data.id;

    const payload = {
        ...data,
        pacienteId: parseInt(currentPacienteId),
        consultaId: parseInt(data.consultaId)
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/examenes/${id}` : `${API_URL}/examenes`;

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if(res.ok) {
            alert(id ? 'Examen actualizado' : 'Examen agregado');
            cerrarModales();
            renderHistoria(currentPacienteId);
        } else {
            alert('Error al guardar');
        }
    } catch (err) { console.error(err); }
}

async function eliminarExamen(id) {
    if(!confirm("¿Eliminar este examen?")) return;
    try {
        const res = await fetch(`${API_URL}/examenes/${id}`, { method: 'DELETE' });
        if(res.ok) renderHistoria(currentPacienteId);
        else alert('Error al eliminar');
    } catch (err) { console.error(err); }
}

function logout() {
    localStorage.clear();
    window.location.href = '../pages/login.html';
}