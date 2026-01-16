// authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/userRepository');
const { getConnection, sql } = require('../config/db');
const { registrarLog } = require('../utils/logger');
require('dotenv').config();

// Registro de Usuario
const register = async (req, res) => {
    try {
        const { email, password, rolId } = req.body;

        // 1. Validar que no exista
        const existingUser = await userRepo.findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'El correo ya está registrado' });
        }

        // 2. Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // 3. Guardar en BD
        const newUser = await userRepo.createUser(email, hash, rolId);

        // TODO: Aquí llamaremos al servicio de Logs más adelante

        res.status(201).json({
            message: 'Usuario creado exitosamente',
            user: { id: newUser.UsuarioID, email: newUser.Email }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// Login
const login = async (req, res) => {
    const { email, password } = req.body;
    // Capturamos la IP para el log (requerimiento de seguridad)
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        const pool = await getConnection();

        // 1. Buscar usuario
        const userResult = await userRepo.findUserByEmail(email);
        
        // SEGURIDAD: Si el usuario NO existe, fingimos que falló la contraseña
        // para evitar "User Enumeration Attacks" (que hackers sepan qué correos existen).
        if (!userResult) {
            await registrarLog({
                nivel: 'WARNING', servicio: 'AuthService', ip, accion: 'Login_Fallido',
                detalles: { motivo: 'Usuario no encontrado', emailIntento: email }
            });
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // 2. Revisar si YA está bloqueado
        if (!userResult.Activo) {
            await registrarLog({
                nivel: 'SECURITY', servicio: 'AuthService', usuarioId: userResult.UsuarioID, rolId: userResult.RolID, ip, accion: 'Acceso_Denegado',
                detalles: { motivo: 'Cuenta inactiva/bloqueada' }
            });
            return res.status(403).json({ message: 'Su cuenta está bloqueada. Contacte al administrador.' });
        }

        // 3. Comparar contraseña
        const isMatch = await bcrypt.compare(password, userResult.PasswordHash);

        if (!isMatch) {
            // --- MANEJO DE INTENTOS FALLIDOS ---
            const nuevosIntentos = (userResult.IntentosFallidos || 0) + 1;
            
            if (nuevosIntentos >= 3) {
                // BLOQUEO INMEDIATO
                await pool.request()
                    .input('ID', sql.Int, userResult.UsuarioID)
                    .input('Nuevos', sql.Int, nuevosIntentos)
                    .query('UPDATE Usuarios SET Activo = 0, IntentosFallidos = @Nuevos WHERE UsuarioID = @ID'); // Ponemos nuevos intentos, o podriamos dejarlo en 3.
                    
                await registrarLog({
                    nivel: 'CRITICAL', servicio: 'AuthService', usuarioId: userResult.UsuarioID, rolId: userResult.RolID, ip, accion: 'Cuenta_Bloqueada',
                    detalles: { motivo: '3 intentos fallidos consecutivos' }
                });
                
                return res.status(403).json({ message: 'Ha excedido el número de intentos. Su cuenta ha sido bloqueada.' });
            } else {
                // INCREMENTAR CONTADOR
                await pool.request()
                    .input('Nuevos', sql.Int, nuevosIntentos)
                    .input('ID', sql.Int, userResult.UsuarioID)
                    .query('UPDATE Usuarios SET IntentosFallidos = @Nuevos WHERE UsuarioID = @ID');

                await registrarLog({
                    nivel: 'WARNING', servicio: 'AuthService', usuarioId: userResult.UsuarioID, rolId: userResult.RolID, ip, accion: 'Login_Fallido',
                    detalles: { motivo: 'Password incorrecto', intento: nuevosIntentos }
                });

                return res.status(401).json({ message: `Credenciales inválidas. Intento ${nuevosIntentos} de 3.` });
            }
        }

        // 4. SI LLEGA AQUÍ: LOGIN EXITOSO
        // Importante: Reiniciar contador de fallos a 0
        if (userResult.IntentosFallidos > 0) {
            await pool.request()
                .input('ID', sql.Int, userResult.UsuarioID)
                .query('UPDATE Usuarios SET IntentosFallidos = 0 WHERE UsuarioID = @ID');
        }

        // Generar JWT
        const payload = {
            id: userResult.UsuarioID,
            rol: userResult.RolID,
            email: userResult.Email
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

        // LOG DE ÉXITO
        await registrarLog({
            nivel: 'INFO', servicio: 'AuthService', usuarioId: userResult.UsuarioID, rolId: userResult.RolID, ip, accion: 'Login_Exitoso',
            detalles: { metodo: 'JWT' }
        });

        res.json({
            message: 'Login exitoso',
            token: token,
            user: { id: userResult.UsuarioID, email: userResult.Email, rol: userResult.RolID }
        });

    } catch (error) {
        console.error(error);
        await registrarLog({
            nivel: 'ERROR', servicio: 'AuthService', ip, accion: 'Error_Servidor',
            detalles: { error: error.message }
        });
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validar que el usuario exista
        const user = await userRepo.findUserByEmail(email);
        if (!user) {
            // Por seguridad, a veces no se dice si el correo existe o no, 
            // pero para este proyecto seremos explícitos.
            return res.status(404).json({ message: 'El correo no está registrado.' });
        }

        // 2. Encriptar la nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // 3. Actualizar en BD
        const updated = await userRepo.updatePassword(email, hash);

        if (updated) {
            // TODO: Log de auditoría "Cambio de contraseña"
            res.json({ message: 'Contraseña actualizada correctamente.' });
        } else {
            res.status(400).json({ message: 'No se pudo actualizar la contraseña.' });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor' });
    }
};

// GESTIÓN ADMIN: Actualizar credenciales (Email o Password)
const adminUpdateUser = async (req, res) => {
    const { id } = req.params; // ID del usuario a modificar
    const { email, password } = req.body;

    try {
        const pool = await getConnection();
        
        if (email) {
            await pool.request()
                .input('ID', sql.Int, id)
                .input('Email', sql.NVarChar, email)
                .query('UPDATE Usuarios SET Email = @Email WHERE UsuarioID = @ID');
        }

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await pool.request()
                .input('ID', sql.Int, id)
                .input('Pass', sql.NVarChar, hashedPassword)
                .query('UPDATE Usuarios SET PasswordHash = @Pass WHERE UsuarioID = @ID');
        }

        res.json({ message: 'Credenciales actualizadas' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error actualizando credenciales' });
    }
};

// GESTIÓN ADMIN: Eliminar usuario de la tabla de autenticación
const deleteUserAuth = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getConnection();
        await pool.request().input('ID', sql.Int, id).query('DELETE FROM Usuarios WHERE UsuarioID = @ID');
        res.json({ message: 'Usuario eliminado de Auth' });
    } catch (error) {
        res.status(500).json({ message: 'Error eliminando usuario Auth' });
    }
};

module.exports = { register, login, forgotPassword, adminUpdateUser, deleteUserAuth };