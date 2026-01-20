CREATE DATABASE DB_Core;
GO
USE DB_Core;
GO

CREATE TABLE Medicos (
    MedicoID INT PRIMARY KEY IDENTITY(1,1),
    UsuarioID INT NOT NULL UNIQUE, -- Referencia lógica a DB_Auth
    Nombre NVARCHAR(50) NOT NULL,
    Apellido NVARCHAR(50) NOT NULL,
    Identificacion NVARCHAR(20) NOT NULL UNIQUE,
    Especialidad NVARCHAR(100) NOT NULL,
    NumeroLicencia NVARCHAR(50) NOT NULL UNIQUE,
    Telefono NVARCHAR(20)
);

CREATE TABLE Pacientes (
    PacienteID INT PRIMARY KEY IDENTITY(1,1),
    UsuarioID INT NOT NULL UNIQUE, -- Referencia lógica a DB_Auth
    MedicoID INT NOT NULL,
    Nombre NVARCHAR(50) NOT NULL,
    Apellido NVARCHAR(50) NOT NULL,
    FechaNacimiento DATE NOT NULL,
    Identificacion NVARCHAR(20) NOT NULL UNIQUE,
    TipoSangre NVARCHAR(5),
    Direccion NVARCHAR(200),
    TelefonoContacto NVARCHAR(20),
    Alergias NVARCHAR(MAX),
    CONSTRAINT FK_Pacientes_Medicos FOREIGN KEY (MedicoID) REFERENCES Medicos(MedicoID)
);