# AppWebAv - Sistema de Historia Clínica

Aplicación Web Monolítica para la gestión de historias clínicas, construida con **Node.js**, **Express** y **SQL Server**.

El backend gestiona tanto la API REST como el servicio de los archivos estáticos (Frontend), simplificando el despliegue y la ejecución.

## Estructura del Proyecto

- `monoapp/` — Carpeta raíz de la aplicación.
  - `public/` — Contiene todo el Frontend (HTML, CSS, JS, Imágenes).
  - `server.js` — Servidor Express (Lógica de negocio, API y WebSockets).
  - `package.json` — Dependencias y scripts de inicio.

## Requisitos Previos

1. **Node.js** (v14 o superior).
2. **SQL Server** instalado y en ejecución.

## Configuración y Ejecución

### 1. Preparación de la Base de Datos
Ejecuta el script SQL provisto en tu SQL Server Management Studio (SSMS) para crear la base de datos `HistoriaClinicaDB` y las tablas necesarias.

Asegúrate de que las credenciales en `server.js` coincidan con tu servidor (por defecto busca usuario `KeiMag`).

> **Nota:** Si la aplicación no logra conectarse a SQL Server, iniciará automáticamente en **Modo Mock** (datos en memoria RAM) para propósitos de demostración.

### 2. Instalación
Abre tu terminal en la carpeta `backend`:

```bash
cd backend
npm install
