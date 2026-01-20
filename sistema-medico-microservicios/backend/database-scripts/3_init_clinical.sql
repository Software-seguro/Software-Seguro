CREATE DATABASE DB_Clinical;
GO
USE DB_Clinical;
GO

CREATE TABLE Consultas (
    ConsultaID INT PRIMARY KEY IDENTITY(1,1),
    PacienteID INT NOT NULL, -- Ref lógica a DB_Core
    MedicoID INT NOT NULL,   -- Ref lógica a DB_Core
    FechaConsulta DATETIME DEFAULT GETDATE(),
    MotivoConsulta NVARCHAR(255) NOT NULL,
    Sintomas NVARCHAR(MAX),
    Diagnostico NVARCHAR(MAX) NOT NULL,
    Tratamiento NVARCHAR(MAX) NOT NULL,
    NotasAdicionales NVARCHAR(MAX)
);

CREATE TABLE Examenes (
    ExamenID INT PRIMARY KEY IDENTITY(1,1),
    ConsultaID INT NULL,
    PacienteID INT NOT NULL, -- Ref lógica a DB_Core
    TipoExamen NVARCHAR(100) NOT NULL,
    FechaRealizacion DATE NOT NULL,
    RutaArchivo NVARCHAR(500) NOT NULL,
    ObservacionesResultados NVARCHAR(MAX),
    FechaSubida DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Examenes_Consultas FOREIGN KEY (ConsultaID) REFERENCES Consultas(ConsultaID)
);

USE DB_Clinical;
GO

-- Cambiamos el límite de MotivoConsulta para soportar el crecimiento del texto cifrado
ALTER TABLE Consultas ALTER COLUMN MotivoConsulta NVARCHAR(MAX) NOT NULL;
GO