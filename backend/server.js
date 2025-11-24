const express = require('express');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Configuración de conexión a SQL Server (ajustar con variables de entorno)
const dbConfig = {
  user: process.env.DB_USER || 'KeiMag',
  password: process.env.DB_PASSWORD || 'keimag',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'HistoriaClinicaDB',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: { trustServerCertificate: true }
};

let pool;
async function initDb() {
  pool = await sql.connect(dbConfig);

  // Crear tabla ResetTokens si no existe
  const createTableSql = `
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ResetTokens')
BEGIN
    CREATE TABLE ResetTokens (
        Token NVARCHAR(100) PRIMARY KEY,
        UsuarioID INT NOT NULL,
        Expira DATETIME NOT NULL
    );
END
`;
  await pool.request().query(createTableSql);
}

initDb().catch(err => {
  console.error('Error inicializando BD:', err.message || err);
  // Do not exit: we prefer server to start to allow diagnostics; endpoints will fail until DB is reachable.
});

// Nota: este backend expone únicamente la API. El frontend se sirve por separado
// (ej. desde `frontend/` vía IIS, `python -m http.server`, o un servidor estático).

// POST /api/signup
app.post('/api/signup', async (req, res) => {
  try {
    const { email, password, nombre, apellido, fechaNacimiento, identificacion, telefono } = req.body;
    if (!email || !password || !nombre || !apellido || !fechaNacimiento || !identificacion) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    if (!pool) return res.status(503).json({ error: 'DB no conectada' });

    const hashed = await bcrypt.hash(password, 10);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const r = await new sql.Request(tx)
        .input('Email', sql.NVarChar(100), email)
        .input('PasswordHash', sql.NVarChar(255), hashed)
        .input('RolID', sql.Int, 2)
        .query(`INSERT INTO Usuarios (Email, PasswordHash, RolID) OUTPUT INSERTED.UsuarioID VALUES (@Email,@PasswordHash,@RolID)`);
      const usuarioId = r.recordset[0].UsuarioID;
      await new sql.Request(tx)
        .input('UsuarioID', sql.Int, usuarioId)
        .input('Nombre', sql.NVarChar(50), nombre)
        .input('Apellido', sql.NVarChar(50), apellido)
        .input('FechaNacimiento', sql.Date, fechaNacimiento)
        .input('Identificacion', sql.NVarChar(20), identificacion)
        .input('TelefonoContacto', sql.NVarChar(20), telefono || null)
        .query('INSERT INTO Pacientes (UsuarioID, Nombre, Apellido, FechaNacimiento, Identificacion, TelefonoContacto) VALUES (@UsuarioID,@Nombre,@Apellido,@FechaNacimiento,@Identificacion,@TelefonoContacto)');
      await tx.commit();
      return res.json({ ok: true, usuarioId });
    } catch (err) {
      try { await tx.rollback(); } catch (e) {}
      if (err && err.number === 2627) return res.status(409).json({ error: 'El correo o identificador ya existe' });
      console.error('signup error', err.message || err);
      return res.status(500).json({ error: 'Error interno' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/forgot
app.post('/api/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });
    if (!pool) return res.status(503).json({ error: 'DB no conectada' });

    const r = await pool.request().input('Email', sql.NVarChar(100), email).query('SELECT UsuarioID FROM Usuarios WHERE Email = @Email');
    if (!r.recordset.length) return res.json({ ok: true });
    const usuarioId = r.recordset[0].UsuarioID;
    const token = uuidv4();
    const expira = new Date(Date.now() + 1000 * 60 * 60);
    await pool.request().input('Token', sql.NVarChar(100), token).input('UsuarioID', sql.Int, usuarioId).input('Expira', sql.DateTime, expira).query('INSERT INTO ResetTokens (Token, UsuarioID, Expira) VALUES (@Token,@UsuarioID,@Expira)');
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const resetLink = `${baseUrl}/reset.html?token=${token}`; // point to frontend reset page
    console.log('Reset link (simulado):', resetLink);
    return res.json({ ok: true });
  } catch (err) {
    console.error('forgot error', err.message || err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/reset
app.post('/api/reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token y password requeridos' });
    if (!pool) return res.status(503).json({ error: 'DB no conectada' });

    const r = await pool.request().input('Token', sql.NVarChar(100), token).query('SELECT UsuarioID, Expira FROM ResetTokens WHERE Token = @Token');
    if (!r.recordset.length) return res.status(400).json({ error: 'Token inválido o expirado' });
    const row = r.recordset[0];
    if (new Date(row.Expira) < new Date()) return res.status(400).json({ error: 'Token expirado' });
    const hashed = await bcrypt.hash(password, 10);
    await pool.request().input('PasswordHash', sql.NVarChar(255), hashed).input('UsuarioID', sql.Int, row.UsuarioID).query('UPDATE Usuarios SET PasswordHash = @PasswordHash WHERE UsuarioID = @UsuarioID');
    await pool.request().input('Token', sql.NVarChar(100), token).query('DELETE FROM ResetTokens WHERE Token = @Token');
    return res.json({ ok: true });
  } catch (err) {
    console.error('reset error', err.message || err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend API listening on ${PORT}`));
