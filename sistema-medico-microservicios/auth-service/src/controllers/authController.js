const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepo = require('../repositories/userRepository');
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
    try {
        const { email, password } = req.body;

        // 1. Buscar usuario
        const user = await userRepo.findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        // 2. Comparar contraseña (Hash vs Texto plano)
        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        if (!user.Activo) {
            return res.status(403).json({ message: 'Usuario inactivo' });
        }

        // 3. Generar JWT
        // Payload: Datos que viajan dentro del token
        const payload = {
            id: user.UsuarioID,
            rol: user.RolID,
            email: user.Email
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

        // TODO: Log de auditoría "Login Exitoso"

        res.json({
            message: 'Login exitoso',
            token: token,
            user: { id: user.UsuarioID, email: user.Email, rol: user.RolID }
        });

    } catch (error) {
        console.error(error);
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

module.exports = { register, login, forgotPassword };