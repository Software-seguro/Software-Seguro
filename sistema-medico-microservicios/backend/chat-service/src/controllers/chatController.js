const chatRepo = require('../repositories/chatRepository');

const getChatHistory = async (req, res) => {
    try {
        const { u1, u2 } = req.params;
        const requestingUser = req.user.id;

        // Seguridad FDP: Un usuario solo puede pedir su propio historial
        if (parseInt(requestingUser) !== parseInt(u1) && parseInt(requestingUser) !== parseInt(u2)) {
            return res.status(403).json({ message: "No tienes permiso para ver este chat" });
        }

        const mensajes = await chatRepo.getRecentMessages(u1, u2);
        res.json(mensajes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener historial' });
    }
};

module.exports = { getChatHistory };