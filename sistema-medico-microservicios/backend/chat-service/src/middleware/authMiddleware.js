const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // El token suele venir en el header: "Authorization: Bearer eyJhbGci..."
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Tomamos la parte después de "Bearer"

    if (!token) {
        return res.status(403).json({ message: 'Token requerido' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Guardamos los datos del usuario en la petición para usarlos luego
        next(); // Dejamos pasar la petición
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido o expirado' });
    }
};

module.exports = verifyToken;