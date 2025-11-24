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
let useMock = false;
const mock = {
  users: [], // {UsuarioID, Email, PasswordHash, RolID}
  patients: [], // {PacienteID, UsuarioID, Nombre, Apellido, FechaNacimiento, Identificacion, TelefonoContacto}
  resetTokens: [], // {Token, UsuarioID, Expira}
  nextUserId: 1,
  nextPacienteId: 1
};
async function initDb() {
  // Intenta conectar al pool. No ejecutar DDL (crear tablas) aquí —
  // la base de datos ya existe y no queremos necesitar permisos de DDL.
  pool = await sql.connect(dbConfig);
}

initDb().catch(err => {
  console.error('Error inicializando BD:', err.message || err);
  console.warn('Activando modo MOCK en memoria. La aplicación funcionará para demo sin base de datos.');
  useMock = true;
  // seed mock with an example user (medico and paciente from original seed)
  // medico
  mock.users.push({ UsuarioID: mock.nextUserId++, Email: 'dr.juan@hospital.com', PasswordHash: 'hash_simulado_123456', RolID: 1 });
  mock.patients.push({ PacienteID: mock.nextPacienteId++, UsuarioID: mock.nextUserId - 1, Nombre: 'Juan', Apellido: 'Perez', FechaNacimiento: '1980-01-01', Identificacion: 'MED-998877', TelefonoContacto: null });
  // paciente demo
  mock.users.push({ UsuarioID: mock.nextUserId++, Email: 'ana.garcia@email.com', PasswordHash: 'hash_simulado_123456', RolID: 2 });
  mock.patients.push({ PacienteID: mock.nextPacienteId++, UsuarioID: mock.nextUserId - 1, Nombre: 'Ana', Apellido: 'Garcia', FechaNacimiento: '1990-05-15', Identificacion: '1122334455', TelefonoContacto: null });
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
    if (useMock) {
      // mock signup
      if (mock.users.find(u => u.Email.toLowerCase() === String(email).toLowerCase())) {
        return res.status(409).json({ error: 'El correo o identificador ya existe' });
      }
      const hashed = await bcrypt.hash(password, 10);
      const usuarioId = mock.nextUserId++;
      mock.users.push({ UsuarioID: usuarioId, Email: email, PasswordHash: hashed, RolID: 2 });
      const pacienteId = mock.nextPacienteId++;
      mock.patients.push({ PacienteID: pacienteId, UsuarioID: usuarioId, Nombre: nombre, Apellido: apellido, FechaNacimiento: fechaNacimiento, Identificacion: identificacion, TelefonoContacto: telefono || null });
      return res.json({ ok: true, usuarioId });
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
    if (useMock) {
      const user = mock.users.find(u => u.Email.toLowerCase() === String(email).toLowerCase());
      if (!user) return res.json({ ok: true });
      const usuarioId = user.UsuarioID;
      const token = uuidv4();
      const expira = new Date(Date.now() + 1000 * 60 * 60);
      mock.resetTokens.push({ Token: token, UsuarioID: usuarioId, Expira: expira.toISOString() });
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      const resetLink = `${baseUrl.replace(/:\d+$/, ':8000')}/reset.html?token=${token}`; // point to frontend served on 8000 for demo
      console.log('Reset link (mock):', resetLink);
      return res.json({ ok: true });
    }

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
    if (useMock) {
      const rec = mock.resetTokens.find(r => r.Token === token);
      if (!rec) return res.status(400).json({ error: 'Token inválido o expirado' });
      if (new Date(rec.Expira) < new Date()) return res.status(400).json({ error: 'Token expirado' });
      const hashed = await bcrypt.hash(password, 10);
      const user = mock.users.find(u => u.UsuarioID === rec.UsuarioID);
      if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });
      user.PasswordHash = hashed;
      // remove token
      mock.resetTokens = mock.resetTokens.filter(r => r.Token !== token);
      return res.json({ ok: true });
    }

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
