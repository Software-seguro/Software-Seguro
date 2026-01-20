// api-gateway/index.js
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad básica
app.use(cors({
    origin: [
        'http://localhost:5173', // Tu Vite local
        /\.azurestaticapps\.net$/ // Cualquier URL de Azure Static Web Apps (Frontend)
    ],
    credentials: true
}));
//app.use(express.json());

// Rutas de prueba para verificar que el Gateway vive
app.get('/', (req, res) => {
    res.send('API Gateway Saludable - Sistema Médico');
});

// --- ENRUTAMIENTO DE MICROSERVICIOS ---

// Usa variables de entorno, si no existen (como en tu PC), usa el localhost
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';
const CORE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3002';
const CLINICAL_URL = process.env.CLINICAL_SERVICE_URL || 'http://localhost:3003';
const CHAT_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:3004';

// 1. Auth Service (Puerto 3001)
app.use('/api/auth', createProxyMiddleware({
    target: AUTH_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api/auth': '', // Elimina /api/auth antes de enviarlo al microservicio
    },
}));

// 2. Core Service (Perfiles) (Puerto 3002)
app.use('/api/core', createProxyMiddleware({
    target: CORE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/core': '' },
}));

// 3. Clinical Service (Puerto 3003)
app.use('/api/clinical', createProxyMiddleware({
    target: CLINICAL_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/clinical': '' },
}));

// 4. Chat Service (Puerto 3004) - Notar que WS necesita configuración especial, por ahora HTTP
app.use('/api/chat', createProxyMiddleware({
    target: CHAT_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/chat': '' },
}));


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gateway corriendo en el puerto: ${PORT}`);
    // No imprimimos http://localhost porque en la nube la URL será distinta
});