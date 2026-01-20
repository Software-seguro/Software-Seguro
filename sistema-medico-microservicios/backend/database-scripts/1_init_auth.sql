CREATE DATABASE DB_Auth;
GO
USE DB_Auth;
GO

CREATE TABLE Roles (
    RolID INT PRIMARY KEY IDENTITY(1,1),
    NombreRol NVARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE Usuarios (
    UsuarioID INT PRIMARY KEY IDENTITY(1,1),
    Email NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    RolID INT NOT NULL,
    FechaRegistro DATETIME DEFAULT GETDATE(),
    IntentosFallidos INT DEFAULT 0 NOT NULL,
    Codigo2FA NVARCHAR(6) NULL,
    Expiracion2FA DATETIME NULL,    
    Activo BIT DEFAULT 1,
    CONSTRAINT FK_Usuarios_Roles FOREIGN KEY (RolID) REFERENCES Roles(RolID)
);
GO
-- Datos semilla mínimos
SET IDENTITY_INSERT Roles ON;
INSERT INTO Roles (RolID, NombreRol) VALUES (1, 'Medico');
INSERT INTO Roles (RolID, NombreRol) VALUES (2, 'Paciente');
INSERT INTO Roles (RolID, NombreRol) VALUES (3, 'Administrador');
SET IDENTITY_INSERT Roles OFF;
GO
