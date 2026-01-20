// auth-service/src/controllers/authController.js
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const userRepo = require('../repositories/userRepository');
// CORRECCIÓN: Importamos getConnection y sql en una sola línea desde tu config
const { getConnection, sql } = require('../config/db');
const { registrarLog } = require('../utils/logger');
const admin = require('firebase-admin');
const serviceAccount = require('../config/firebase-admin-key.json');

require('dotenv').config();

const resetPassword = async (req, res) => {
    // Quitamos 'currentPassword' de los datos recibidos
    const { email, newPassword } = req.body;

    try {
        const pool = await getConnection();

        // 1. Verificar que el usuario exista
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT UsuarioID FROM Usuarios WHERE Email = @email');

        const dbUser = result.recordset[0];
        if (!dbUser) return res.status(404).json({ message: "Usuario no encontrado" });

        // --- ELIMINADO: El paso de validar la contraseña actual con bcrypt ---

        // 2. Generar el nuevo Hash para la nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        // 3. Actualizar en SQL Server y resetear intentos fallidos
        await pool.request()
            .input('email', sql.VarChar, email)
            .input('pass', sql.VarChar, newHash)
            .query('UPDATE Usuarios SET PasswordHash = @pass, IntentosFallidos = 0 WHERE Email = @email');

        // Registro en Log (opcional)
        await registrarLog({
            nivel: 'INFO', servicio: 'AuthService', usuarioId: dbUser.UsuarioID,
            accion: 'Reset_Password_Exito', detalles: { motivo: 'Recuperación vía Firebase' }
        });

        res.json({ message: "Contraseña actualizada correctamente" });

    } catch (error) {
        console.error("Error en resetPassword:", error);
        res.status(500).json({ message: "Error interno al procesar el cambio de clave" });
    }
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Tu correo
        pass: process.env.EMAIL_PASS  // Tu "Contraseña de aplicación" de Google
    }
});

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

// Registro de Usuario
const register = async (req, res) => {
    try {
        const { email, password, rolId } = req.body;

        // 1. Validar existencia en SQL Server
        const existingUser = await userRepo.findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'El correo ya está registrado en el sistema' });
        }

        // 2. CREAR USUARIO EN FIREBASE (Para que funcione Recuperar Contraseña)
        // Lo hacemos en un try-catch interno para que, si falla Firebase, podamos manejarlo
        try {
            await admin.auth().createUser({
                email: email,
                password: password, // Sincronizamos la clave
                emailVerified: true // Marcamos como verificado para evitar problemas
            });
            console.log(`Usuario ${email} creado con éxito en Firebase`);
        } catch (fbError) {
            // Si el error es que ya existe en Firebase, lo ignoramos y seguimos con SQL
            if (fbError.code !== 'auth/email-already-exists') {
                console.error("Error inesperado en Firebase:", fbError);
                // Si quieres ser estricto, puedes retornar error aquí. 
                // Por ahora solo logueamos para no detener el registro en SQL.
            }
        }

        // 3. Encriptar contraseña para SQL Server
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // 4. Guardar en SQL Server
        const newUser = await userRepo.createUser(email, hash, rolId);

        // 5. Generar token temporal (Permite crear el perfil en core-service sin 2FA)
        const token = jwt.sign(
            { id: newUser.UsuarioID, rol: rolId, email: newUser.Email },
            process.env.JWT_SECRET,
            { expiresIn: '5m' }
        );

        // 6. Respuesta final
        res.status(201).json({
            message: 'Usuario creado exitosamente en SQL y Firebase',
            token: token,
            user: { id: newUser.UsuarioID, email: newUser.Email }
        });

    } catch (error) {
        console.error("Error crítico en register:", error);
        res.status(500).json({ message: 'Error interno en el servidor' });
    }
};

// Login
const login = async (req, res) => {
    const { email, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        const pool = await getConnection();
        const userResult = await userRepo.findUserByEmail(email);

        if (!userResult) {
            await registrarLog({
                nivel: 'WARNING', servicio: 'AuthService', ip, accion: 'Login_Fallido',
                detalles: { motivo: 'Usuario no encontrado', emailIntento: email }
            });
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        if (!userResult.Activo) {
            await registrarLog({
                nivel: 'SECURITY', servicio: 'AuthService', usuarioId: userResult.UsuarioID, rolId: userResult.RolID, ip, accion: 'Acceso_Denegado',
                detalles: { motivo: 'Cuenta inactiva/bloqueada' }
            });
            return res.status(403).json({ message: 'Su cuenta está bloqueada.' });
        }

        const isMatch = await bcrypt.compare(password, userResult.PasswordHash);

        if (!isMatch) {
            const nuevosIntentos = (userResult.IntentosFallidos || 0) + 1;

            if (nuevosIntentos >= 3) {
                await pool.request()
                    .input('ID', sql.Int, userResult.UsuarioID)
                    .input('Nuevos', sql.Int, nuevosIntentos)
                    .query('UPDATE Usuarios SET Activo = 0, IntentosFallidos = @Nuevos WHERE UsuarioID = @ID');

                await registrarLog({
                    nivel: 'CRITICAL', servicio: 'AuthService', usuarioId: userResult.UsuarioID, rolId: userResult.RolID, ip, accion: 'Cuenta_Bloqueada',
                    detalles: { motivo: '3 intentos fallidos consecutivos' }
                });
                return res.status(403).json({ message: 'Cuenta bloqueada por exceso de intentos.' });
            } else {
                await pool.request()
                    .input('Nuevos', sql.Int, nuevosIntentos)
                    .input('ID', sql.Int, userResult.UsuarioID)
                    .query('UPDATE Usuarios SET IntentosFallidos = @Nuevos WHERE UsuarioID = @ID');

                await registrarLog({
                    nivel: 'WARNING',
                    servicio: 'AuthService',
                    usuarioId: userResult.UsuarioID,
                    rolId: userResult.RolID,
                    ip,
                    accion: 'Login_Fallido',
                    detalles: { motivo: 'Contraseña incorrecta', intento: nuevosIntentos, maximos: 3 }
                });

                return res.status(401).json({ message: `Credenciales inválidas. Intento ${nuevosIntentos} de 3.` });
            }
        }

        const codigo2FA = Math.floor(100000 + Math.random() * 900000).toString();
        const expiracion = new Date(Date.now() + 10 * 60000);
        await pool.request()
            .input('ID', sql.Int, userResult.UsuarioID)
            .input('Cod', sql.NVarChar, codigo2FA)
            .input('Exp', sql.DateTime, expiracion)
            .query('UPDATE Usuarios SET Codigo2FA = @Cod, Expiracion2FA = @Exp, IntentosFallidos = 0 WHERE UsuarioID = @ID');

        const mailOptions = {
            from: '"Apolo Sistema Médico" <keimag.apolo@gmail.com>',
            to: userResult.Email,
            subject: '🔐 Código de Verificación - Apolo',
            html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #1877f2; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">APOLO</h1>
                <p style="color: #e0e0e0; margin: 5px 0 0 0;">Sistema Médico Integral</p>
            </div>
            <div style="padding: 40px; text-align: center; background-color: #ffffff;">
                <h2 style="color: #333; margin-top: 0;">Verificación de Seguridad</h2>
                <p style="color: #666; font-size: 16px;">Has solicitado acceder a tu cuenta. Utiliza el siguiente código para completar tu inicio de sesión:</p>
                
                <div style="background-color: #f0f2f5; border-radius: 8px; padding: 20px; margin: 30px 0; display: inline-block; letter-spacing: 10px; font-size: 36px; font-weight: bold; color: #1877f2; border: 1px dashed #1877f2;">
                    ${codigo2FA}
                </div>

                <p style="color: #d93025; font-weight: bold; font-size: 14px; margin-top: 20px;">
                    ⚠️ Este código tiene una vigencia de 10 minutos.
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                    Si no has solicitado este acceso, por favor ignora este mensaje o contacta a soporte.
                </p>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eeeeee;">
                © 2026 KeiMag para Apolo | KeiMag para ti y tu empresa
            </div>
        </div>
    `
        };

        await transporter.sendMail(mailOptions);

        res.json({
            require2FA: true,
            userId: userResult.UsuarioID,
            email: userResult.Email,
            message: 'Código enviado al correo'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

const verify2FA = async (req, res) => {
    const { userId, code } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('ID', sql.Int, userId)
            .query('SELECT UsuarioID, Email, RolID, Codigo2FA, Expiracion2FA FROM Usuarios WHERE UsuarioID = @ID');

        const dbUser = result.recordset[0];

        if (!dbUser || dbUser.Codigo2FA !== code || new Date() > dbUser.Expiracion2FA) {
            return res.status(401).json({ message: 'Código inválido o expirado' });
        }

        await pool.request()
            .input('ID', sql.Int, userId)
            .query('UPDATE Usuarios SET Codigo2FA = NULL, Expiracion2FA = NULL WHERE UsuarioID = @ID');

        const payload = { id: dbUser.UsuarioID, rol: dbUser.RolID, email: dbUser.Email };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });

        await registrarLog({
            nivel: 'INFO',
            servicio: 'AuthService',
            usuarioId: dbUser.UsuarioID,
            rolId: dbUser.RolID,
            ip,
            accion: 'Login_Exitoso',
            detalles: { metodo: '2FA_Verificado' }
        });

        res.json({
            message: 'Autenticación completada',
            token: token,
            user: { id: dbUser.UsuarioID, email: dbUser.Email, rol: dbUser.RolID }
        });

    } catch (error) {
        console.error("Error en verify2FA:", error);
        res.status(500).json({ message: 'Error interno en la verificación' });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userRepo.findUserByEmail(email);
        if (!user) return res.status(404).json({ message: 'El correo no está registrado.' });

        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        const updated = await userRepo.updatePassword(email, hash);

        if (updated) res.json({ message: 'Contraseña actualizada correctamente.' });
        else res.status(400).json({ message: 'No se pudo actualizar.' });

    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

const adminUpdateUser = async (req, res) => {
    const { id } = req.params;
    const { email } = req.body; // Solo recibimos email

    try {
        const pool = await getConnection();

        // Buscamos el email anterior para actualizarlo también en Firebase
        const userResult = await pool.request()
            .input('ID', sql.Int, id)
            .query('SELECT Email FROM Usuarios WHERE UsuarioID = @ID');

        if (userResult.recordset.length === 0) return res.status(404).json({ message: "Usuario no encontrado" });

        const oldEmail = userResult.recordset[0].Email;

        if (email) {
            // A. Actualizar en Firebase
            const fbUser = await admin.auth().getUserByEmail(oldEmail);
            await admin.auth().updateUser(fbUser.uid, { email: email });

            // B. Actualizar en SQL Server
            await pool.request()
                .input('ID', sql.Int, id)
                .input('Email', sql.NVarChar, email)
                .query('UPDATE Usuarios SET Email = @Email WHERE UsuarioID = @ID');
        }

        res.json({ message: 'Correo actualizado en SQL y Firebase' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error actualizando cuenta' });
    }
};

const deleteUserAuth = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getConnection();

        // A. Obtener el email del usuario antes de borrarlo
        const userResult = await pool.request()
            .input('ID', sql.Int, id)
            .query('SELECT Email FROM Usuarios WHERE UsuarioID = @ID');

        if (userResult.recordset.length > 0) {
            const emailABorrar = userResult.recordset[0].Email;

            // B. Borrar de Firebase
            try {
                const fbUser = await admin.auth().getUserByEmail(emailABorrar);
                await admin.auth().deleteUser(fbUser.uid);
                console.log(`Usuario ${emailABorrar} eliminado de Firebase`);
            } catch (fbErr) {
                console.warn("No se encontró en Firebase o ya estaba borrado.");
            }
        }

        // C. Borrar de SQL Server
        await pool.request()
            .input('ID', sql.Int, id)
            .query('DELETE FROM Usuarios WHERE UsuarioID = @ID');

        res.json({ message: 'Usuario eliminado de SQL Server y Firebase' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error eliminando usuario' });
    }
};
const verifyPassword = async (req, res) => {
    try {
        const { password } = req.body;
        const usuarioId = req.user.id; // Obtenido del token por el middleware

        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Int, usuarioId)
            .query('SELECT PasswordHash FROM Usuarios WHERE UsuarioID = @id');

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

        const isMatch = await bcrypt.compare(password, user.PasswordHash);

        if (isMatch) {
            res.json({ success: true, message: "Re-autenticación exitosa" });
        } else {
            res.status(400).json({ success: false, message: "Contraseña incorrecta" });
        }
    } catch (error) {
        res.status(500).json({ message: "Error en la verificación" });
    }
}

// EXPORTS CORREGIDOS (Sin duplicados)
module.exports = {
    register,
    login,
    verify2FA,
    forgotPassword,
    adminUpdateUser,
    deleteUserAuth,
    resetPassword,
    verifyPassword
};