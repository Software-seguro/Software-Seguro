const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    // Extracción de datos del cuerpo de la solicitud
    const { email, password, nombre, apellido, fechaNacimiento, identificacion, telefono, role, especialidad, numeroLicencia } = req.body;

    // Verificación de campos obligatorios
    if (!email || !password || !nombre || !apellido || !fechaNacimiento || !identificacion) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Validación de especialidad y número de licencia si el rol es médico
    if (role === 'medico' && (!especialidad || !numeroLicencia)) {
      return res.status(400).json({ error: 'Especialidad y número de licencia son requeridos para médicos' });
    }

    // Si usamos el modo MOCK, se inserta sin base de datos
    if (useMock) {
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

    // Si la base de datos no está conectada
    if (!pool) return res.status(503).json({ error: 'DB no conectada' });

    // Hash de la contraseña
    const hashed = await bcrypt.hash(password, 10);

    // Determinamos el RolID según el rol (1 para médico, 2 para paciente)
    const rolId = role === 'medico' ? 1 : 2;

    // Creamos una transacción SQL
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // Insertar usuario en la tabla Usuarios
      const r = await new sql.Request(tx)
        .input('Email', sql.NVarChar(100), email)
        .input('PasswordHash', sql.NVarChar(255), hashed)
        .input('RolID', sql.Int, rolId)
        .query(`INSERT INTO Usuarios (Email, PasswordHash, RolID) OUTPUT INSERTED.UsuarioID VALUES (@Email, @PasswordHash, @RolID)`);

      const usuarioId = r.recordset[0].UsuarioID;

      // Si el rol es paciente, insertamos en la tabla Pacientes
      if (rolId === 2) {
        await new sql.Request(tx)
          .input('UsuarioID', sql.Int, usuarioId)
          .input('Nombre', sql.NVarChar(50), nombre)
          .input('Apellido', sql.NVarChar(50), apellido)
          .input('FechaNacimiento', sql.Date, fechaNacimiento)
          .input('Identificacion', sql.NVarChar(20), identificacion)
          .input('TelefonoContacto', sql.NVarChar(20), telefono || null)
          .query('INSERT INTO Pacientes (UsuarioID, Nombre, Apellido, FechaNacimiento, Identificacion, TelefonoContacto) VALUES (@UsuarioID, @Nombre, @Apellido, @FechaNacimiento, @Identificacion, @TelefonoContacto)');
      }

      // Si el rol es médico, insertamos en la tabla Medicos
      if (rolId === 1) {
        await new sql.Request(tx)
          .input('UsuarioID', sql.Int, usuarioId)
          .input('Nombre', sql.NVarChar(50), nombre)
          .input('Apellido', sql.NVarChar(50), apellido)
          .input('Especialidad', sql.NVarChar(100), especialidad)
          .input('NumeroLicencia', sql.NVarChar(50), numeroLicencia)
          .query('INSERT INTO Medicos (UsuarioID, Nombre, Apellido, Especialidad, NumeroLicencia) VALUES (@UsuarioID, @Nombre, @Apellido, @Especialidad, @NumeroLicencia)');
      }

      // Si todo va bien, confirmamos la transacción
      await tx.commit();
      return res.json({ ok: true, usuarioId });

    } catch (err) {
      try { await tx.rollback(); } catch (e) {}
      if (err && err.number === 2627) return res.status(409).json({ error: 'El correo o identificador ya existe' });
      console.error('Error en signup:', err.message || err);
      return res.status(500).json({ error: 'Error interno' });
    }
  } catch (err) {
    console.error('Error en signup:', err);
    return res.status(500).json({ error: 'Error interno', details: err.message || err });
  }
});



// Nota: Se eliminó un manejador duplicado/incorrecto de `POST /api/forgot`
// para evitar conflicto con la implementación que sólo solicita el `email`.

// POST /api/forgot
// POST /api/forgot - MODO: Cambio directo de contraseña (ajustado a tu formulario)
app.post('/api/forgot', async (req, res) => {
  try {
    // 1. Recibimos email Y password (el frontend los envía)
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y nueva contraseña son requeridos' });
    }

    const hashed = await bcrypt.hash(password, 10);

    // --- MODO MOCK (Sin base de datos) ---
    if (useMock) {
      const user = mock.users.find(u => u.Email.toLowerCase() === String(email).toLowerCase());
      if (!user) {
          // Por seguridad, a veces se dice "éxito" aunque no exista, 
          // pero para desarrollo es mejor saber si falló.
          return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      user.PasswordHash = hashed;
      console.log(`Password actualizado en Mock para: ${email}`);
      return res.json({ ok: true, message: 'Contraseña actualizada correctamente' });
    }

    // --- MODO SQL SERVER ---
    if (!pool) return res.status(503).json({ error: 'DB no conectada' });

    // 2. Actualizamos directamente la contraseña del usuario con ese email
    // Nota: No usamos tokens porque tu formulario pide la contraseña de una vez.
    const r = await pool.request()
        .input('Email', sql.NVarChar(100), email)
        .input('PasswordHash', sql.NVarChar(255), hashed)
        .query(`
            UPDATE Usuarios 
            SET PasswordHash = @PasswordHash 
            WHERE Email = @Email
        `);

    // rowsAffected devuelve un array, el primer elemento es el número de filas cambiadas
    if (r.rowsAffected[0] === 0) {
        return res.status(404).json({ error: 'No existe un usuario con ese correo' });
    }

    return res.json({ ok: true, message: 'Contraseña actualizada correctamente' });

  } catch (err) {
    console.error('Error en forgot password:', err.message || err);
    return res.status(500).json({ error: 'Error interno del servidor' });
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

// --- RUTAS DE MÉDICO ---

// 1. Obtener lista de pacientes (Para el directorio del médico)
app.get('/api/pacientes', async (req, res) => {
    if (useMock) return res.json(mock.patients);
    try {
        const r = await pool.request().query('SELECT PacienteID, Nombre, Apellido, Identificacion, FechaNacimiento FROM Pacientes');
        res.json(r.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Crear nueva Consulta (BLINDADO)
app.post('/api/consultas', async (req, res) => {
    // 1. Convertir a enteros para evitar errores de tipo en SQL
    const pacienteId = parseInt(req.body.pacienteId);
    const medicoId = parseInt(req.body.medicoId);
    const { motivo, diagnostico, tratamiento, sintomas } = req.body;

    // 2. Validación estricta
    if (!pacienteId || !medicoId) {
        return res.status(400).json({ error: "Falta ID de Paciente o Médico." });
    }

    try {
        if (!pool) return res.status(503).json({ error: "DB no conectada" });
        
        const r = await pool.request()
            .input('PacienteID', sql.Int, pacienteId)
            .input('MedicoID', sql.Int, medicoId)
            .input('Motivo', sql.NVarChar, motivo)
            .input('Diagnostico', sql.NVarChar, diagnostico)
            .input('Tratamiento', sql.NVarChar, tratamiento)
            .input('Sintomas', sql.NVarChar, sintomas || '')
            .query(`
                INSERT INTO Consultas (PacienteID, MedicoID, MotivoConsulta, Diagnostico, Tratamiento, Sintomas)
                OUTPUT INSERTED.ConsultaID
                VALUES (@PacienteID, @MedicoID, @Motivo, @Diagnostico, @Tratamiento, @Sintomas)
            `);
        res.json({ ok: true, consultaId: r.recordset[0].ConsultaID });
    } catch (err) { 
        console.error("Error al crear consulta:", err); // Ver esto en la consola del servidor
        res.status(500).json({ error: err.message }); 
    }
});

// 3. Crear nuevo Examen (BLINDADO)
app.post('/api/examenes', async (req, res) => {
    // Convertir IDs explícitamente
    const pacienteId = parseInt(req.body.pacienteId);
    const consultaId = parseInt(req.body.consultaId); // Viene del input hidden
    const { tipo, observaciones } = req.body;
    
    const rutaFake = "/uploads/demo.pdf"; 

    if (!pacienteId || !consultaId) {
        return res.status(400).json({ error: "Falta ID de Paciente o Consulta." });
    }
    
    try {
        if (!pool) return res.status(503).json({ error: "DB no conectada" });

        await pool.request()
            .input('PacienteID', sql.Int, pacienteId)
            .input('ConsultaID', sql.Int, consultaId)
            .input('Tipo', sql.NVarChar, tipo)
            .input('Ruta', sql.NVarChar, rutaFake)
            .input('Obs', sql.NVarChar, observaciones || '')
            .input('Fecha', sql.Date, new Date())
            .query(`INSERT INTO Examenes (PacienteID, ConsultaID, TipoExamen, RutaArchivo, ObservacionesResultados, FechaRealizacion) VALUES (@PacienteID, @ConsultaID, @Tipo, @Ruta, @Obs, @Fecha)`);
            
        res.json({ ok: true });
    } catch (err) { 
        console.error("Error al crear examen:", err);
        res.status(500).json({ error: err.message }); 
    }
});

// 4. Crear Paciente Rápido (Solo datos demográficos básicos para no complicar usuario/login)
app.post('/api/pacientes', async (req, res) => {
    // Esta ruta requeriría crear Usuario + Paciente con transacción. 
    // Para este ejemplo, asumiremos que se crean pacientes que YA tienen usuario o simplificamos.
    // Te dejo el esqueleto:
    return res.status(501).json({ error: "Implementar creación completa con Transacción SQL (Usuario + Paciente)" });
});

// GET /api/paciente/:id/consultas
app.get('/api/paciente/:id/consultas', async (req, res) => {
  try {
    const pacienteId = parseInt(req.params.id);
    if (!pacienteId) return res.status(400).json({ error: "ID inválido" });

    if (useMock) return res.json([]); // Retorno vacío si es Mock

    if (!pool) return res.status(503).json({ error: "DB no conectada" });

    const r = await pool.request()
      .input("PacienteID", sql.Int, pacienteId)
      .query(`
        SELECT 
          C.ConsultaID,
          C.FechaConsulta,
          M.Nombre + ' ' + M.Apellido AS Medico,
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

// GET /api/paciente/:id/examenes
app.get('/api/paciente/:id/examenes', async (req, res) => {
  try {
    const pacienteId = parseInt(req.params.id);
    if (!pacienteId) return res.status(400).json({ error: "ID inválido" });

    if (useMock) return res.json([]);

    if (!pool) return res.status(503).json({ error: "DB no conectada" });

    // Hacemos LEFT JOIN con Consultas para obtener la fecha de la consulta
    // Esto es vital para que tu frontend agrupe el examen visualmente
    const r = await pool.request()
      .input("PacienteID", sql.Int, pacienteId)
      .query(`
        SELECT 
            E.ExamenID,
            E.ConsultaID,
            E.TipoExamen,
            E.FechaRealizacion,
            E.ObservacionesResultados,
            E.RutaArchivo,
            C.FechaConsulta 
        FROM Examenes E
        LEFT JOIN Consultas C ON C.ConsultaID = E.ConsultaID
        WHERE E.PacienteID = @PacienteID
        ORDER BY E.FechaRealizacion DESC
      `);

    return res.json(r.recordset);

  } catch (err) {
    console.error("examenes error", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    // --- MODO MOCK (Sin BD) ---
    if (useMock) {
      const user = mock.users.find(u => u.Email.toLowerCase() === email.toLowerCase());
      if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

      // Verificar password
      const ok = await bcrypt.compare(password, user.PasswordHash);
      if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

      // Buscar datos adicionales (Nombre, IDs)
      let pacienteId = null;
      let medicoId = null;
      let nombreUsuario = 'Usuario';

      if (user.RolID === 2) { // Paciente
        const p = mock.patients.find(x => x.UsuarioID === user.UsuarioID);
        if (p) {
          pacienteId = p.PacienteID;
          nombreUsuario = `${p.Nombre} ${p.Apellido}`;
        }
      } 
      // Si fuera médico en mock, aquí iría la lógica similar...

      return res.json({
        ok: true,
        usuarioId: user.UsuarioID,
        rolId: user.RolID,
        pacienteId,
        medicoId,
        nombreUsuario,
        token: uuidv4()
      });
    }

    // --- MODO SQL SERVER ---
    if (!pool) return res.status(503).json({ error: 'DB no conectada' });

    // 1. Buscar usuario por Email
    const r = await pool.request()
      .input('Email', sql.NVarChar(100), email)
      .query('SELECT UsuarioID, PasswordHash, RolID FROM Usuarios WHERE Email = @Email');

    if (!r.recordset.length) return res.status(401).json({ error: 'Credenciales inválidas' });

    const row = r.recordset[0];
    
    // 2. Verificar contraseña
    const ok = await bcrypt.compare(password, row.PasswordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    // 3. Obtener datos específicos según el rol
    let pacienteId = null;
    let medicoId = null;
    let nombreUsuario = null;

    if (row.RolID === 2) { // Paciente
        const pRes = await pool.request().input('UsuarioID', sql.Int, row.UsuarioID).query('SELECT PacienteID, Nombre, Apellido FROM Pacientes WHERE UsuarioID = @UsuarioID');
        if (pRes.recordset.length) {
            pacienteId = pRes.recordset[0].PacienteID;
            nombreUsuario = `${pRes.recordset[0].Nombre} ${pRes.recordset[0].Apellido}`;
        }
    } else if (row.RolID === 1) { // Médico <--- NUEVO BLOQUE
        const mRes = await pool.request().input('UsuarioID', sql.Int, row.UsuarioID).query('SELECT MedicoID, Nombre, Apellido FROM Medicos WHERE UsuarioID = @UsuarioID');
        if (mRes.recordset.length) {
            medicoId = mRes.recordset[0].MedicoID;
            nombreUsuario = `Dr. ${mRes.recordset[0].Nombre} ${mRes.recordset[0].Apellido}`;
        }
    }

    // 4. Responder al Frontend
    return res.json({
      ok: true,
      usuarioId: row.UsuarioID,
      rolId: row.RolID,
      pacienteId,
      medicoId,
      nombreUsuario,
      token: uuidv4()
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// RUTAS CRUD ADICIONALES (UPDATE / DELETE)
// ==========================================

// --- CONSULTAS ---

// PUT (Actualizar) Consulta
app.put('/api/consultas/:id', async (req, res) => {
    const id = req.params.id;
    const { motivo, diagnostico, tratamiento, sintomas } = req.body;
    try {
        if (!pool) return res.status(503).json({ error: "DB no conectada" });
        await pool.request()
            .input('ID', sql.Int, id)
            .input('Motivo', sql.NVarChar, motivo)
            .input('Diagnostico', sql.NVarChar, diagnostico)
            .input('Tratamiento', sql.NVarChar, tratamiento)
            .input('Sintomas', sql.NVarChar, sintomas || '')
            .query(`UPDATE Consultas SET MotivoConsulta=@Motivo, Diagnostico=@Diagnostico, Tratamiento=@Tratamiento, Sintomas=@Sintomas WHERE ConsultaID=@ID`);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE (Eliminar) Consulta
app.delete('/api/consultas/:id', async (req, res) => {
    const id = req.params.id;
    try {
        if (!pool) return res.status(503).json({ error: "DB no conectada" });
        // Nota: Si hay exámenes ligados, esto podría fallar por Foreign Key. 
        // Lo ideal es borrar exámenes primero o usar CASCADE en SQL.
        // Aquí intentaremos borrar primero los exámenes hijos manualmente para asegurar éxito:
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const reqTx = new sql.Request(tx);
            await reqTx.input('ID', sql.Int, id).query('DELETE FROM Examenes WHERE ConsultaID = @ID');
            await reqTx.query('DELETE FROM Consultas WHERE ConsultaID = @ID');
            await tx.commit();
            res.json({ ok: true });
        } catch (err) {
            await tx.rollback();
            throw err;
        }
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- EXÁMENES ---

// PUT (Actualizar) Examen
app.put('/api/examenes/:id', async (req, res) => {
    const id = req.params.id;
    const { tipo, observaciones } = req.body;
    try {
        if (!pool) return res.status(503).json({ error: "DB no conectada" });
        await pool.request()
            .input('ID', sql.Int, id)
            .input('Tipo', sql.NVarChar, tipo)
            .input('Obs', sql.NVarChar, observaciones || '')
            .query(`UPDATE Examenes SET TipoExamen=@Tipo, ObservacionesResultados=@Obs WHERE ExamenID=@ID`);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE (Eliminar) Examen
app.delete('/api/examenes/:id', async (req, res) => {
    const id = req.params.id;
    try {
        if (!pool) return res.status(503).json({ error: "DB no conectada" });
        await pool.request()
            .input('ID', sql.Int, id)
            .query('DELETE FROM Examenes WHERE ExamenID = @ID');
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// CONFIGURACIÓN WEBSOCKET + SERVIDOR HTTP
// ==========================================
const http = require('http');


// 1. Crear servidor HTTP usando la app de Express
const server = http.createServer(app);

// 2. Crear servidor WebSocket montado sobre el servidor HTTP
const wss = new WebSocket.Server({ server });

// 3. Lógica del Chat (Broadcast)
wss.on('connection', (ws) => {
    console.log('Cliente de chat conectado');

    ws.on('message', (data) => {
        try {
            // Reenviar el mensaje a todos los clientes conectados
            // Data es un Buffer, lo convertimos a String
            const messageData = JSON.parse(data.toString());
            
            // Agregamos timestamp del servidor
            const broadcastMsg = JSON.stringify({
                username: messageData.username,
                text: messageData.text,
                rol: messageData.rol, // Opcional: para saber si es médico o paciente
                timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
            });

            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(broadcastMsg);
                }
            });
        } catch (error) {
            console.error('Error procesando mensaje WS:', error);
        }
    });

    ws.on('close', () => console.log('Cliente desconectado'));
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================
// IMPORTANTE: Usamos server.listen en lugar de app.listen
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Backend API + Chat WS corriendo en puerto ${PORT}`));