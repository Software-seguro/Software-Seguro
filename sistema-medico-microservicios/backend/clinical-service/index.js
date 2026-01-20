const express = require('express');
const cors = require('cors');
const clinicalRoutes = require('./src/routes/clinicalRoutes');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3003;

app.use('/', clinicalRoutes);

app.listen(PORT, () => {
    console.log(`Clinical Service corriendo en http://localhost:${PORT}`);
});