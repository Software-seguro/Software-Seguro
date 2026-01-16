// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Forgot from './pages/Forgot';
import DashboardMedico from './pages/DashboardMedico';
import DashboardPaciente from './pages/DashboardPaciente';
import DashboardAdmin from './pages/DashboardAdmin';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/dashboard-medico" element={<DashboardMedico />} />
        <Route path="/dashboard-paciente" element={<DashboardPaciente />} />
        <Route path="/dashboard-admin" element={<DashboardAdmin />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App