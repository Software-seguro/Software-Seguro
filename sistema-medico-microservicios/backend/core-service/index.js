const express = require('express');
const cors = require('cors');
const profileRoutes = require('./src/routes/profileRoutes');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({
    origin: [
        'http://localhost:5173', // Tu Vite local
        /\.azurestaticapps\.net$/ // Cualquier URL de Azure Static Web Apps (Frontend)
    ],
    credentials: true
}));

const PORT = process.env.PORT || 3002;

app.use('/', profileRoutes);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Core Service corriendo en el puerto: ${PORT}`);
    // No imprimimos http://localhost porque en la nube la URL será distinta
});