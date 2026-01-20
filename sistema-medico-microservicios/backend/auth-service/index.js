const express = require('express');
const cors = require('cors');
// Importar rutas
const authRoutes = require('./src/routes/authRoutes'); 

require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3001;

// Usar las rutas
app.use('/', authRoutes); // Quedará como POST /register y POST /login

// Endpoint de salud
app.get('/ping', (req, res) => res.send('Auth Service OK'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Auth Service corriendo en el puerto: ${PORT}`);
    // No imprimimos http://localhost porque en la nube la URL será distinta
});