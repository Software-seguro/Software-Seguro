-- Creación de la BD para Auditoría y Seguridad
CREATE DATABASE DB_Logs;
GO
USE DB_Logs;
GO

CREATE TABLE Auditoria (
    LogID INT PRIMARY KEY IDENTITY(1,1),
    FechaHora DATETIME DEFAULT GETDATE(),
    ServicioOrigen NVARCHAR(50) NOT NULL, -- Ej: 'AuthService', 'ClinicalService'
    Nivel NVARCHAR(20) NOT NULL,          -- Ej: 'INFO', 'WARNING', 'CRITICAL', 'SECURITY'
    UsuarioID INT NULL,                   -- Quién lo hizo (Si es NULL, fue el sistema o un anónimo)
    RolID INT NULL,
    IPOrigen NVARCHAR(50),                -- Desde qué IP se hizo la petición
    Accion NVARCHAR(100) NOT NULL,        -- Ej: 'Login_Fallido', 'Eliminar_Receta'
    Detalles NVARCHAR(MAX)                -- JSON con datos extra (ej: "Intento password incorrecto")
);
GO

-- Índices para búsqueda rápida (Vital para seguridad)
CREATE INDEX IX_Auditoria_Fecha ON Auditoria(FechaHora);
CREATE INDEX IX_Auditoria_Usuario ON Auditoria(UsuarioID);
CREATE INDEX IX_Auditoria_Accion ON Auditoria(Accion);
GO