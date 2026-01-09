const API_URL = 'http://localhost:3000/api'; // Ajusta si tu puerto cambia

// --- FUNCIÓN DE SEGURIDAD MEJORADA ---
function verificarSesion() {
    const pacienteId = sessionStorage.getItem('pacienteId');
    
    if (!pacienteId) {
        // NO MOSTRAR NADA, REDIRIGIR INMEDIATAMENTE
        // Quitamos el alert() porque detiene la ejecución y deja ver el fondo
        window.location.replace('../pages/login.html'); 
        return false;
    }
    
    // SI HAY SESIÓN, MOSTRAMOS LA PÁGINA
    document.body.style.display = 'block'; 
    return true;
}

// 1. Esto protege contra el botón "Atrás" (BFCache)
window.addEventListener('pageshow', (event) => {
    // Si el usuario vuelve atrás y no tiene sesión, verificarSesion lo saca de ahí
    verificarSesion();
});

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar sesión
    const pacienteId = sessionStorage.getItem('pacienteId');
    const nombre = sessionStorage.getItem('nombreUsuario');
    if (!verificarSesion()) return;

    if (!pacienteId) {
        alert('No has iniciado sesión.');
        window.location.href = '../pages/login.html'; // Redirige al login si no hay sesión
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

                <p><strong>Fecha Consulta:</strong> 
                    ${ex.FechaConsulta ? new Date(ex.FechaConsulta).toLocaleDateString() : '—'}
                </p>

                <p><strong>Fecha Examen:</strong> 
                    ${new Date(ex.FechaExamen).toLocaleDateString()}
                </p>

                <p><strong>Observaciones / Resultados:</strong> 
                    ${ex.ObservacionesResultados || 'Sin observaciones'}
                </p>

                <a href="${ex.RutaArchivo}" target="_blank" class="btn-download">
                    Ver Archivo
                </a>
            `;

            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Error cargando exámenes:', error);
    }
}

// Navegación entre pestañas (Consultas vs Exámenes)
function showSection(sectionId) {
    // 1. Ocultar TODAS las secciones primero
    document.getElementById('consultas-section').classList.add('hidden');
    document.getElementById('examenes-section').classList.add('hidden');
    
    const chatSection = document.getElementById('view-chat');
    if (chatSection) chatSection.classList.add('hidden');
    
    // 2. Quitar clase 'active' de todos los botones del menú
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    // 3. Identificar el botón que se presionó (truco visual simple)
    // Esto busca el botón que tiene el onclick correspondiente y le pone active
    const activeBtn = document.querySelector(`button[onclick="showSection('${sectionId}')"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // 4. Mostrar la sección deseada
    if (sectionId === 'chat') {
        if (chatSection) chatSection.classList.remove('hidden');
        iniciarChat(); // Conectar WebSocket
    } else {
        const targetSection = document.getElementById(`${sectionId}-section`);
        if (targetSection) targetSection.classList.remove('hidden');
    }
}

function logout() {
    sessionStorage.clear();
    window.location.href = '../pages/login.html'; // Ajusta la ruta a tu login
}

// ==========================================
// LÓGICA DE CHAT (WEBSOCKET)
// ==========================================
let ws = null;
const chatInput = document.getElementById('chatInput');
const messagesContainer = document.getElementById('chatMessages');

// Modificar tu función 'showView' o 'showSection' existente para conectar al abrir
// EJEMPLO: (Ajusta según tu función actual)
/* 
function showView(viewName) {
    // ... tu lógica de ocultar/mostrar ...
    if (viewName === 'chat') {
        document.getElementById('view-chat').classList.remove('hidden');
        iniciarChat(); // <--- AGREGAR ESTO
    }
}
*/

// Agrega esta lógica al 'DOMContentLoaded' o llámala cuando entres a la vista
function iniciarChat() {
    const nombreUsuario = sessionStorage.getItem('nombreUsuario');
    const rolId = sessionStorage.getItem('rolId');
    
    // Mostrar nombre en la cabecera del chat
    const displayUser = document.getElementById('chatUserDisplay');
    if(displayUser) displayUser.textContent = nombreUsuario;

    // Evitar reconexiones si ya existe
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return; 
    }

    // Conectar al mismo host/puerto del backend
    // Si estás en localhost:3000, esto conecta a ws://localhost:3000
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host.split(':')[0]}:3000`; 

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Conectado al Chat WS');
        appendSystemMessage('Te has unido al chat.');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        appendMessage(data);
    };

    ws.onclose = () => {
        console.log('Desconectado del Chat');
        appendSystemMessage('Desconectado. Intentando reconectar...', true);
        setTimeout(iniciarChat, 5000); // Reintento automático
    };
}

function enviarMensajeChat() {
    if (!chatInput.value.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;

    const nombreUsuario = sessionStorage.getItem('nombreUsuario');
    
    const msg = {
        username: nombreUsuario,
        text: chatInput.value.trim(),
        rol: sessionStorage.getItem('rolId') // 1 medico, 2 paciente
    };

    ws.send(JSON.stringify(msg));
    chatInput.value = '';
    chatInput.focus();
}

// Renderizar mensaje en pantalla
function appendMessage(msgData) {
    const miNombre = sessionStorage.getItem('nombreUsuario');
    const esMio = msgData.username === miNombre;
    
    const div = document.createElement('div');
    div.className = `message-bubble ${esMio ? 'outgoing' : 'incoming'}`;
    
    div.innerHTML = `
        <span class="msg-sender">${esMio ? 'Tú' : msgData.username}</span>
        ${msgData.text}
        <span class="msg-time">${msgData.timestamp}</span>
    `;

    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight; // Auto-scroll al final
}

function appendSystemMessage(text, isError = false) {
    const div = document.createElement('div');
    div.style.textAlign = 'center';
    div.style.fontSize = '12px';
    div.style.margin = '10px 0';
    div.style.color = isError ? 'red' : '#888';
    div.textContent = text;
    messagesContainer.appendChild(div);
}

// Enviar con Enter
if(chatInput){
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') enviarMensajeChat();
    });
}