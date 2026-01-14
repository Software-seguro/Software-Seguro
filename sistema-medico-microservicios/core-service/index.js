const express = require('express');
const cors = require('cors');
const profileRoutes = require('./src/routes/profileRoutes');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3002;

app.use('/', profileRoutes);

app.listen(PORT, () => {
    console.log(`Core Service corriendo en http://localhost:${PORT}`);
});