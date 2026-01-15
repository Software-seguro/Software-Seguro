const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const chatRepo = require('./src/repositories/chatRepository');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Creamos un servidor HTTP básico (necesario para montar WS)
const server = http.createServer(app);

// Creamos el servidor de WebSockets
const wss = new WebSocket.Server({ server });


app.get('/api/chat/historial/:u1/:u2', async (req, res) => {
    try {
        const { u1, u2 } = req.params;
        console.log(`Petición de historial recibida: ${u1} y ${u2}`);
        const mensajes = await chatRepo.getRecentMessages(u1, u2);
        res.json(mensajes);
    } catch (error) {
        console.error("Error en ruta historial:", error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
});

// Lista de clientes conectados
const clients = new Map(); 

wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = parseInt(url.searchParams.get('userId'));

    if (!userId || isNaN(userId)) {
        ws.close();
        return;
    }

    clients.set(userId, ws);
    console.log(`Usuario ${userId} conectado.`);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            const msgToSave = {
                userId: userId,
                receptorId: data.receptorId,
                text: data.text,
                username: data.username,
                rol: data.rol
            };
            await chatRepo.saveMessage(msgToSave);
            const targetSocket = clients.get(data.receptorId);
            if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                targetSocket.send(JSON.stringify(msgToSave));
            }
            ws.send(JSON.stringify(msgToSave));
        } catch (err) {
            console.error('Error procesando mensaje:', err);
        }
    });

    ws.on('close', () => clients.delete(userId));
});

const PORT = process.env.PORT || 3004;

// ¡OJO! Usamos server.listen, no app.listen
server.listen(PORT, () => {
    console.log(`Chat Service (WebSocket) corriendo en http://localhost:${PORT}`);
});