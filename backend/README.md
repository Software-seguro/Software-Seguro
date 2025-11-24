# Backend - API

Este servicio expone las APIs necesarias para autenticación y recuperación de contraseña.

Configuración básica
- Variables de entorno (opcional):
  - `DB_USER` (default `KeiMag`)
  - `DB_PASSWORD` (default `keimag`)
  - `DB_SERVER` (default `localhost`)
  - `DB_DATABASE` (default `HistoriaClinicaDB`)
  - `DB_PORT` (default `1433`)
  - `PORT` (default `3000`)

Instalación y ejecución
```powershell
cd backend
npm install
npm start
```

Notas
- El backend no sirve archivos estáticos: el frontend debe desplegarse desde la carpeta `frontend/` (IIS, servidor estático, etc.).
- El endpoint `/api/forgot` imprime en consola un link de reseteo (simulación de envío de email). Asegúrate de adaptar si quieres enviar correos reales.
- Asegúrate de ejecutar el script SQL que creaste para crear la base `HistoriaClinicaDB` y sus tablas antes de usar estos endpoints.
