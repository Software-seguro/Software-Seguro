const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de conexión a SQL Server
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

// Datos simulados (Mock) por si falla la BD
const mock = {
  users: [], 
  patients: [],
  nextUserId: 1,
  nextPacienteId: 1
};

async function initDb() {
  pool = await sql.connect(dbConfig);
}

initDb().catch(err => {
  console.error('Error inicializando BD:', err.message);
  console.warn('Activando modo MOCK en memoria.');
  useMock = true;
  // Datos de prueba
  mock.users.push({ UsuarioID: mock.nextUserId++, Email: 'ana.garcia@email.com', PasswordHash: '$2a$10$ExampleHash...', RolID: 2 });
});

// --- RUTAS ---

// POST /api/signup (Registro)
app.post('/api/signup', async (req, res) => {
  // ... (Tu código de registro existente puede ir aquí, lo he resumido para enfocarme en forgot)
  // Asegúrate de mantener tu lógica de signup aquí.
  return res.status(501).json({error: "Signup endpoint check original file"});
});

// POST /api/forgot (CAMBIO DIRECTO DE CONTRASEÑA)
app.post('/api/forgot', async (req, res) => {
  try {
    // Recibimos email, password y confirm del frontend
    const { email, password, confirm } = req.body;

    // Validaciones básicas
    if (!email || !password || !confirm) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }
    if (password !== confirm) {
        return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Lógica MOCK (sin base de datos)
    if (useMock) {
      const user = mock.users.find(u => u.Email.toLowerCase() === String(email).toLowerCase());
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
      
      user.PasswordHash = hashed; // Actualizamos en memoria
      return res.json({ ok: true, message: 'Contraseña cambiada con éxito' });
    }

    // Lógica REAL (SQL Server)
    if (!pool) return res.status(503).json({ error: 'DB no conectada' });

    // 1. Verificar si el usuario existe
    const r = await pool.request()
        .input('Email', sql.NVarChar(100), email)
        .query('SELECT UsuarioID FROM Usuarios WHERE Email = @Email');

    if (!r.recordset.length) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuarioId = r.recordset[0].UsuarioID;

    // 2. Actualizar la contraseña directamente
    await pool.request()
        .input('PasswordHash', sql.NVarChar(255), hashed)
        .input('UsuarioID', sql.Int, usuarioId)
        .query('UPDATE Usuarios SET PasswordHash = @PasswordHash WHERE UsuarioID = @UsuarioID');

    return res.json({ ok: true, message: 'Contraseña cambiada con éxito' });

  } catch (err) {
    console.error('forgot error', err.message || err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Opcional: Si ya no usas tokens, puedes eliminar la ruta /api/reset

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email y contraseña requeridos' });

    if (useMock) {
      const user = mock.users.find(u => u.Email.toLowerCase() === email.toLowerCase());
      if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
      const ok = await bcrypt.compare(password, user.PasswordHash);
      if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

      // Aquí debes obtener pacienteId y nombreUsuario si el rol es paciente (2)
      let pacienteId = null;
      let nombreUsuario = null;
      if (user.RolID === 2) {
        const paciente = mock.patients.find(p => p.UsuarioID === user.UsuarioID);
        if (paciente) {
          pacienteId = paciente.PacienteID;
          nombreUsuario = paciente.Nombre;
        }
      }

      return res.json({
        ok: true,
        usuarioId: user.UsuarioID,
        rolId: user.RolID,
        pacienteId,
        nombreUsuario,
        token: uuidv4()
      });
    }

    if (!pool) return res.status(503).json({ error: 'DB no conectada' });

    const r = await pool.request()
      .input('Email', sql.NVarChar(100), email)
      .query('SELECT UsuarioID, PasswordHash, RolID FROM Usuarios WHERE Email = @Email');

    if (!r.recordset.length)
      return res.status(401).json({ error: 'Credenciales inválidas' });

    const row = r.recordset[0];
    const ok = await bcrypt.compare(password, row.PasswordHash);
    if (!ok)
      return res.status(401).json({ error: 'Credenciales inválidas' });

    // Buscar pacienteId y nombreUsuario solo si rol es paciente
    let pacienteId = null;
    let nombreUsuario = null;
    if (row.RolID === 2) {
      const pacienteResult = await pool.request()
        .input('UsuarioID', sql.Int, row.UsuarioID)
        .query('SELECT PacienteID, Nombre FROM Pacientes WHERE UsuarioID = @UsuarioID');
      if (pacienteResult.recordset.length) {
        pacienteId = pacienteResult.recordset[0].PacienteID;
        nombreUsuario = pacienteResult.recordset[0].Nombre;
      }
    }

    return res.json({
      ok: true,
      usuarioId: row.UsuarioID,
      rolId: row.RolID,
      pacienteId,
      nombreUsuario,
      token: uuidv4() // token o JWT real en producción
    });

  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/paciente/:id/consultas
app.get('/api/paciente/:id/consultas', async (req, res) => {
  try {
    const pacienteId = parseInt(req.params.id);

    if (!pacienteId)
      return res.status(400).json({ error: "ID inválido" });

    // Si estás en MOCK, puedes responder vacío:
    if (useMock) {
      return res.json([]);
    }

    if (!pool)
      return res.status(503).json({ error: "DB no conectada" });

    const r = await pool.request()
      .input("PacienteID", sql.Int, pacienteId)
      .query(`
        SELECT 
          C.ConsultaID,
          C.FechaConsulta,
          CONCAT(M.Nombre, ' ', M.Apellido) AS Medico,
          C.MotivoConsulta,
          C.Diagnostico,
          C.Tratamiento
        FROM Consultas C
        INNER JOIN Medicos M ON M.MedicoID = C.MedicoID
        WHERE C.PacienteID = @PacienteID
        ORDER BY C.FechaConsulta DESC
      `);

    return res.json(r.recordset);

  } catch (err) {
    console.error("consultas error", err);
    return res.status(500).json({ error: "Error interno" });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend API listening on ${PORT}`));