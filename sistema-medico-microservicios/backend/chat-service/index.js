const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // Para validar el socket
const chatRoutes = require('./src/routes/chatRoutes');
const chatRepo = require('./src/repositories/chatRepository');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// RUTAS HTTP (Historial)
app.use('/', chatRoutes);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Map();

wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token'); // El cliente debe enviar ?token=...

    try {
        // Validamos el token también en el WebSocket
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;

        clients.set(userId, ws);
        console.log(`Usuario ${userId} conectado mediante WebSocket seguro.`);

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

                // Enviar al receptor
                const targetSocket = clients.get(data.receptorId);
                if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                    targetSocket.send(JSON.stringify(msgToSave));
                }
                // Confirmar al emisor
                ws.send(JSON.stringify(msgToSave));
            } catch (err) {
                console.error('Error en mensaje:', err);
            }
        });

        ws.on('close', () => clients.delete(userId));

    } catch (err) {
        console.log('Conexión WS rechazada: Token inválido');
        ws.terminate();
    }
});

const PORT = process.env.PORT || 3004;
server.listen(PORT, () => console.log(`Secure Chat Service en puerto ${PORT}`));