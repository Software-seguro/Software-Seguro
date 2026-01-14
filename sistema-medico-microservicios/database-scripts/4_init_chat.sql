-- Creación de la BD para el Chat
CREATE DATABASE DB_Chat;
GO
USE DB_Chat;
GO

-- Tabla de Mensajes
CREATE TABLE Mensajes (
    MensajeID INT PRIMARY KEY IDENTITY(1,1),
    UsuarioID INT NOT NULL,     -- ID del usuario que envía (Ref lógica a DB_Auth)
    NombreUsuario NVARCHAR(50), -- Guardamos el nombre aquí para no tener que consultarlo a otro servicio cada vez que cargamos el chat (Patrón de desnormalización para rendimiento)
    RolID INT NOT NULL,         -- 1: Medico, 2: Paciente
    Contenido NVARCHAR(MAX) NOT NULL,
    FechaEnvio DATETIME DEFAULT GETDATE()
);
GO

-- Insertar un mensaje de bienvenida/prueba
INSERT INTO Mensajes (UsuarioID, NombreUsuario, RolID, Contenido)
VALUES (0, 'Sistema', 3, 'Bienvenido al chat médico seguro.');
GO