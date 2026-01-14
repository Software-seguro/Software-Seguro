// api-gateway/index.js
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad básica
app.use(cors());
//app.use(express.json());

// Rutas de prueba para verificar que el Gateway vive
app.get('/', (req, res) => {
    res.send('API Gateway Saludable - Sistema Médico');
});

// --- ENRUTAMIENTO DE MICROSERVICIOS ---

// 1. Auth Service (Puerto 3001)
app.use('/api/auth', createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
    pathRewrite: {
        '^/api/auth': '', // Elimina /api/auth antes de enviarlo al microservicio
    },
}));

// 2. Core Service (Perfiles) (Puerto 3002)
app.use('/api/core', createProxyMiddleware({
    target: 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/api/core': '' },
}));

// 3. Clinical Service (Puerto 3003)
app.use('/api/clinical', createProxyMiddleware({
    target: 'http://localhost:3003',
    changeOrigin: true,
    pathRewrite: { '^/api/clinical': '' },
}));

// 4. Chat Service (Puerto 3004) - Notar que WS necesita configuración especial, por ahora HTTP
app.use('/api/chat', createProxyMiddleware({
    target: 'http://localhost:3004',
    changeOrigin: true,
    pathRewrite: { '^/api/chat': '' },
}));

app.listen(PORT, () => {
    console.log(`Gateway corriendo en http://localhost:${PORT}`);
});