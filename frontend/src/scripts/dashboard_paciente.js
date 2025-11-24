const API_URL = 'http://localhost:3000/api'; // Ajusta si tu puerto cambia

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar sesión
    const pacienteId = localStorage.getItem('pacienteId');
    const nombre = localStorage.getItem('nombreUsuario');

    if (!pacienteId) {
        alert('No has iniciado sesión.');
        window.location.href = 'login.html'; // Redirige al login si no hay sesión
        return;
    }

    // 2. Cargar datos del usuario
    document.getElementById('patientName').textContent = nombre || 'Paciente';
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString();

    // 3. Cargar datos iniciales
    cargarConsultas(pacienteId);
    cargarExamenes(pacienteId);
});

async function cargarConsultas(id) {
    try {
        const res = await fetch(`${API_URL}/paciente/${id}/consultas`);
        const data = await res.json();
        
        const tbody = document.getElementById('consultasBody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            document.getElementById('noConsultasMsg').classList.remove('hidden');
            return;
        }

        data.forEach(c => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(c.FechaConsulta).toLocaleDateString()}</td>
                <td>${c.Medico}</td>
                <td>${c.MotivoConsulta}</td>
                <td>${c.Diagnostico}</td>
                <td>${c.Tratamiento}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error cargando consultas:', error);
    }
}

async function cargarExamenes(id) {
    try {
        const res = await fetch(`${API_URL}/paciente/${id}/examenes`);
        const data = await res.json();
        
        const grid = document.getElementById('examenesGrid');
        grid.innerHTML = '';

        if (data.length === 0) {
            document.getElementById('noExamenesMsg').classList.remove('hidden');
            return;
        }

        data.forEach(ex => {
            const card = document.createElement('div');
            card.className = 'exam-card';
            card.innerHTML = `
                <h3>${ex.TipoExamen}</h3>
                <p class="exam-date">${new Date(ex.FechaRealizacion).toLocaleDateString()}</p>
                <p><strong>Obs:</strong> ${ex.ObservacionesResultados || 'Sin observaciones'}</p>
                <a href="${ex.RutaArchivo}" target="_blank" class="btn-download">Ver Archivo</a>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error cargando exámenes:', error);
    }
}

// Navegación entre pestañas (Consultas vs Exámenes)
function showSection(sectionId) {
    // Ocultar todas
    document.getElementById('consultas-section').classList.add('hidden');
    document.getElementById('examenes-section').classList.add('hidden');
    
    // Quitar clase active de botones
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    // Mostrar seleccionada
    document.getElementById(`${sectionId}-section`).classList.remove('hidden');
    
    // Activar botón (simple lógica visual)
    const icon = sectionId === 'consultas' ? 'fa-stethoscope' : 'fa-file-medical';
    // Nota: Para una lógica de clase 'active' más robusta, podrías usar IDs en los botones
}

function logout() {
    localStorage.clear();
    window.location.href = '../login.html'; // Ajusta la ruta a tu login
}