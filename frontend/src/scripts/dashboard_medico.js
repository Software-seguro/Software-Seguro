const API_URL = 'http://localhost:3000/api';

// Estado global de la vista
let currentMedicoId = null;
let currentPacienteId = null; // Paciente seleccionado actualmente

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar Sesión de MÉDICO
    currentMedicoId = localStorage.getItem('medicoId');
    const nombre = localStorage.getItem('nombreUsuario');
    const rol = localStorage.getItem('rolId'); // Debería ser 1 (o lo que definas para medico)

    if (!currentMedicoId) {
        alert('Acceso denegado. Debes ser médico.');
        window.location.href = '../pages/login.html';
        return;
    }

    document.getElementById('doctorName').textContent = nombre;
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString();

    // 2. Cargar lista de pacientes
    cargarPacientes();

    // 3. Listeners de Formularios
    document.getElementById('formConsulta').addEventListener('submit', guardarConsulta);
    document.getElementById('formExamen').addEventListener('submit', guardarExamen);
});

// --- LÓGICA DE VISTAS ---
function showView(viewName) {
    document.getElementById('view-pacientes').classList.add('hidden');
    document.getElementById('view-detalle').classList.add('hidden');

    if (viewName === 'pacientes') {
        document.getElementById('view-pacientes').classList.remove('hidden');
        cargarPacientes(); // Refrescar lista
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
    if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) {
        edad--;
    }
    return edad;
}

// --- HISTORIA CLÍNICA (CONSULTAS + EXAMENES) ---
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
        // 1. Traer Consultas
        const resC = await fetch(`${API_URL}/paciente/${id}/consultas`);
        const consultas = await resC.json();

        // 2. Traer Exámenes
        const resE = await fetch(`${API_URL}/paciente/${id}/examenes`);
        const examenes = await resE.json();

        container.innerHTML = '';

        if (consultas.length === 0) {
            container.innerHTML = '<p class="empty-msg">Este paciente no tiene consultas registradas.</p>';
            return;
        }

        // 3. Renderizar (Agrupar exámenes dentro de consultas si coinciden en fecha o ID)
        // Nota: Tu backend actual devuelve consultas y examenes por separado. 
        // Visualmente intentaremos poner los exámenes debajo de la consulta correspondiente si coinciden fechas,
        // o simplemente listar exámenes debajo de la consulta.
        
        consultas.forEach(c => {
            // Filtrar exámenes de esta consulta (si tuvieras ConsultaID en examen sería mejor, 
            // pero usaremos una aproximación visual o mostraremos todos los exámenes asociados al paciente debajo de cada bloque si no hay relación directa en el JSON actual).
            // MEJORA: Tu SQL de Examenes ya hace JOIN con Consulta, asegúrate de devolver ConsultaID en el JSON de examenes.
            
            const examenesDeEstaConsulta = examenes.filter(e => {
                // Comparamos fechas o IDs si estuvieran disponibles. 
                // Asumiendo que agregaste ConsultaID al endpoint de examenes o comparamos fechas aprox
                if(e.FechaConsulta && c.FechaConsulta) {
                    return new Date(e.FechaConsulta).getTime() === new Date(c.FechaConsulta).getTime();
                }
                return false; 
            });

            const div = document.createElement('div');
            div.className = 'exam-card'; // Reusamos estilo de tarjeta
            div.style.marginBottom = "20px";
            
            let htmlExamenes = '';
            if (examenesDeEstaConsulta.length > 0) {
                htmlExamenes = `<div style="margin-top:10px; padding-top:10px; border-top:1px dashed #ccc; background:#f9f9f9; padding:10px;">
                    <strong><i class="fas fa-paperclip"></i> Exámenes adjuntos:</strong>
                    <ul style="padding-left:20px; margin:5px 0;">
                        ${examenesDeEstaConsulta.map(e => `<li>${e.TipoExamen} - <small>${e.ObservacionesResultados}</small></li>`).join('')}
                    </ul>
                </div>`;
            }

            // Botón para agregar examen a ESTA consulta
            const btnAddExam = `<button class="btn-secondary btn-sm" onclick="abrirModalExamen(${c.ConsultaID})" style="float:right; margin-top:-5px;">
                <i class="fas fa-plus"></i> Examen
            </button>`;

            div.innerHTML = `
                ${btnAddExam}
                <small style="color:#666">${new Date(c.FechaConsulta).toLocaleDateString()} - ${c.Medico}</small>
                <h3 style="margin-top:5px; color:var(--primary-color)">${c.MotivoConsulta}</h3>
                <p><strong>Dx:</strong> ${c.Diagnostico}</p>
                <p><strong>Tx:</strong> ${c.Tratamiento}</p>
                ${htmlExamenes}
            `;
            container.appendChild(div);
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="color:red">Error cargando datos.</p>';
    }
}

// --- CREACIÓN (CRUD) ---

function abrirModalConsulta() {
    document.getElementById('formConsulta').reset();
    document.getElementById('modalConsulta').classList.add('active');
}

function abrirModalExamen(consultaId) {
    document.getElementById('formExamen').reset();
    document.getElementById('inputConsultaIdExamen').value = consultaId;
    document.getElementById('modalExamen').classList.add('active');
}

function cerrarModales() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

async function guardarConsulta(e) {
    e.preventDefault();
    
    // Validar que tengamos el ID del médico (revisar localStorage)
    if (!currentMedicoId) {
        alert("Error de sesión: No se identifica al médico. Por favor cierra sesión y vuelve a entrar.");
        return;
    }

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    const payload = {
        motivo: data.motivo,
        sintomas: data.sintomas,
        diagnostico: data.diagnostico,
        tratamiento: data.tratamiento,
        pacienteId: parseInt(currentPacienteId), // Asegurar número
        medicoId: parseInt(currentMedicoId)      // Asegurar número
    };

    console.log("Enviando consulta:", payload); // Para depuración

    try {
        const res = await fetch(`${API_URL}/consultas`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if(res.ok) {
            alert('Consulta registrada correctamente');
            cerrarModales();
            renderHistoria(currentPacienteId);
        } else {
            alert('Error al guardar: ' + (result.error || 'Desconocido'));
        }
    } catch (err) { 
        console.error(err);
        alert("Error de conexión con el servidor");
    }
}

async function guardarExamen(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Obtener consultaId explícitamente del input hidden
    const consultaIdVal = document.getElementById('inputConsultaIdExamen').value;
    
    const payload = {
        tipo: formData.get('tipo'),
        observaciones: formData.get('observaciones'),
        pacienteId: parseInt(currentPacienteId),
        consultaId: parseInt(consultaIdVal) // Asegurar número
    };

    console.log("Enviando examen:", payload);

    try {
        const res = await fetch(`${API_URL}/examenes`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if(res.ok) {
            alert('Examen agregado correctamente');
            cerrarModales();
            renderHistoria(currentPacienteId);
        } else {
            alert('Error al guardar: ' + (result.error || 'Desconocido'));
        }
    } catch (err) { 
        console.error(err);
        alert("Error de conexión");
    }
}

function logout() {
    localStorage.clear();
    window.location.href = '../pages/login.html';
}