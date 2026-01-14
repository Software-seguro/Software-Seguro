import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';

function Register() {
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('#606770');
  const [isMedico, setIsMedico] = useState(false);
  const navigate = useNavigate();

  const handleRoleChange = (e) => {
    setIsMedico(e.target.value === 'medico');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('Creando cuenta...');
    setMsgColor('#606770');

    const formData = new FormData(e.target);
    const rolValue = formData.get('role'); 
    const rolId = rolValue === 'medico' ? 1 : 2;
    const email = formData.get('email');
    const password = formData.get('password');

    // Validación básica
    if (password.length < 6) {
        setMsg('La contraseña debe tener al menos 6 caracteres.');
        setMsgColor('#dc2626');
        return;
    }

    try {
      // ----------------------------------------------
      // PASO 1: Registrar Usuario (Auth Service)
      // ----------------------------------------------
      const resAuth = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rolId })
      });

      const bodyAuth = await resAuth.json();

      if (!resAuth.ok) {
        throw new Error(bodyAuth.message || 'Error al registrar usuario.');
      }

      setMsg('Usuario creado. Iniciando sesión para configurar perfil...');
      setMsgColor('#1877f2'); // Azul de progreso

      // ----------------------------------------------
      // PASO 2: Auto-Login para obtener Token (Auth Service)
      // ----------------------------------------------
      const resLogin = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const bodyLogin = await resLogin.json();
      if (!resLogin.ok) throw new Error('Error al iniciar sesión automática.');

      const token = bodyLogin.token; // ¡TENEMOS LA LLAVE!

      // ----------------------------------------------
      // PASO 3: Crear Perfil (Core Service)
      // ----------------------------------------------
      setMsg('Guardando tus datos personales...');
      
      // Preparamos datos según el rol
      let profileUrl = '';
      let profileData = {};

      if (rolId === 1) { // Medico
        profileUrl = `${API_URL}/api/core/medicos`;
        profileData = {
            nombre: formData.get('nombre'),
            apellido: formData.get('apellido'),
            especialidad: formData.get('especialidad'),
            licencia: formData.get('numeroLicencia'),
            telefono: formData.get('telefono')
        };
      } else { // Paciente
        profileUrl = `${API_URL}/api/core/pacientes`;
        profileData = {
            nombre: formData.get('nombre'),
            apellido: formData.get('apellido'),
            fechaNacimiento: formData.get('fechaNacimiento'),
            identificacion: formData.get('identificacion'),
            telefono: formData.get('telefono')
        };
      }

      const resProfile = await fetch(profileUrl, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Usamos el token recién obtenido
        },
        body: JSON.stringify(profileData)
      });

      if (!resProfile.ok) {
          console.error(await resProfile.text()); // Para debug
          throw new Error('El usuario se creó, pero hubo error al guardar el perfil.');
      }

      // ----------------------------------------------
      // FINAL: Todo Éxito
      // ----------------------------------------------
      setMsg('¡Cuenta configurada con éxito! Redirigiendo...');
      setMsgColor('#42b72a');
      
      // Guardar token en sesión para que ya entre logueado
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('usuarioId', bodyLogin.user.id);
      sessionStorage.setItem('email', bodyLogin.user.email);
      sessionStorage.setItem('rolId', bodyLogin.user.rol);

      setTimeout(() => {
          // Aquí redirigiremos al dashboard cuando lo tengamos
          navigate('/'); // Por ahora volvemos al login o home
      }, 1500);

    } catch (err) {
      console.error(err);
      setMsg(err.message);
      setMsgColor('#dc2626');
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', color: 'var(--primary)', marginBottom: '20px' }}>APOLO</h1>

      <div className="card">
        <h2 style={{ marginTop: 0, marginBottom: '5px' }}>Crear cuenta nueva</h2>
        <p style={{ margin: '0 0 20px 0', color: '#606770' }}>Es rápido y fácil.</p>
        <div className="separator" style={{ marginTop: 0 }}></div>
        
        <div className="msg" style={{ color: msgColor, fontWeight: 'bold' }}>{msg}</div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <input type="text" name="nombre" placeholder="Nombre" required className="form-control" style={{width: '100%'}} />
            <input type="text" name="apellido" placeholder="Apellido" required className="form-control" style={{width: '100%'}} />
          </div>

          <div className="form-group">
            <input type="email" name="email" placeholder="Correo electrónico" required />
          </div>

          <div className="form-group">
            <input type="password" name="password" placeholder="Contraseña nueva" required minLength="6" />
          </div>

          {/* Campo Fecha Nacimiento para Pacientes */}
          {!isMedico && (
             <div className="form-group">
                <label style={{fontSize: '12px', color: '#666'}}>Fecha de Nacimiento</label>
                <input type="date" name="fechaNacimiento" required />
             </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
             <div className="form-group" style={{flex: 1}}>
               <input type="text" name="identificacion" placeholder="Cédula/DNI" required style={{width: '100%'}} />
             </div>
             <div className="form-group" style={{flex: 1}}>
               <input type="tel" name="telefono" placeholder="Teléfono" style={{width: '100%'}} />
             </div>
          </div>

          <div className="form-group">
            <label style={{ fontSize: '12px', color: '#606770', display: 'block' }}>¿Quién eres?</label>
            <select name="role" onChange={handleRoleChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}>
              <option value="paciente">Paciente</option>
              <option value="medico">Médico / Especialista</option>
            </select>
          </div>

          {/* Renderizado Condicional: Solo se muestra si es Médico */}
          {isMedico && (
            <div style={{ background: '#f7f8fa', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px dashed #ccc' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)' }}>Datos Profesionales</p>
              <div className="form-group">
                <input type="text" name="especialidad" placeholder="Especialidad" />
              </div>
              <div className="form-group">
                <input type="text" name="numeroLicencia" placeholder="Número de Licencia" />
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-success" style={{ width: '100%', marginTop: '10px' }}>Registrarte</button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'var(--primary)' }}>¿Ya tienes una cuenta?</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;