const express = require('express');
const cors = require('cors');
const clinicalRoutes = require('./src/routes/clinicalRoutes');
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

const PORT = process.env.PORT || 3003;

app.use('/', clinicalRoutes);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Clinical Service corriendo en el puerto: ${PORT}`);
    // No imprimimos http://localhost porque en la nube la URL será distinta
});