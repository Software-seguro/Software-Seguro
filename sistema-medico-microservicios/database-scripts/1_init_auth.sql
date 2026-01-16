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
    Activo BIT DEFAULT 1,
    CONSTRAINT FK_Usuarios_Roles FOREIGN KEY (RolID) REFERENCES Roles(RolID)
);

-- Datos semilla mínimos
INSERT INTO Roles (NombreRol) VALUES ('Medico'), ('Paciente'), ('Administrador');
-- Usuarios de prueba (Pass: 123456)
INSERT INTO Usuarios (Email, PasswordHash, RolID) VALUES ('dr.juan@hospital.com', 'hash_simulado_123456', 1);
INSERT INTO Usuarios (Email, PasswordHash, RolID) VALUES ('ana.garcia@email.com', 'hash_simulado_123456', 2);
GO
USE DB_Auth;
GO

-- Agregamos el contador de fallos
ALTER TABLE Usuarios ADD IntentosFallidos INT DEFAULT 0 NOT NULL;
GO