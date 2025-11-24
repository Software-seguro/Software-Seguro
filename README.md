# AppWebAv - Estructura Frontend / Backend

Estructura propuesta:

- `frontend/` — páginas estáticas HTML/CSS/JS para signup, forgot y reset.
- `backend/` — API Node.js (Express) que se conecta a SQL Server y expone endpoints.

Cómo probar localmente

1) Preparar la base de datos en SQL Server ejecutando el script SQL provisto (crea `HistoriaClinicaDB` y tablas). Asegúrate de que el login `KeiMag` exista y tenga permisos.

2) Iniciar backend:

```powershell
cd backend
npm install
npm start
```

3) Abrir frontend: puedes servir la carpeta `frontend/` con cualquier servidor estático. Ejemplo rápido con Python 3:

```powershell
cd frontend
python -m http.server 8000

# Abrir en el navegador:
# http://localhost:8000/signup.html
# http://localhost:8000/forgot.html
# http://localhost:8000/reset.html?token=...
```

Si frontend y backend están en orígenes distintos, edita `frontend/config.js` para poner `window.BACKEND_URL = 'http://localhost:3000'`.
