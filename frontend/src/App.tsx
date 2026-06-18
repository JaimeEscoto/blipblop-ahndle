import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from './components/Layout';
import Appointments from './pages/Appointments';
import Doctors from './pages/Doctors';
import Patients from './pages/Patients';
import Records from './pages/Records';
import Inventory from './pages/Inventory';
import Reminders from './pages/Reminders';
import PublicAppointment from './pages/PublicAppointment';
import Home from './pages/Home';
import Login from './pages/Login';
import CreateAccount from './pages/CreateAccount';
import SuperAdmin from './pages/SuperAdmin';
import Settings from './pages/Settings';
import { useAuth } from './auth/AuthContext';

function Splash() {
  const { t } = useTranslation();
  return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">{t('common.loading')}</div>;
}

export default function App() {
  const { account, loading } = useAuth();

  return (
    <Routes>
      {/* Ruta pública (paciente al escanear el QR) — sin login */}
      <Route path="/cita/:code" element={<PublicAppointment />} />
      {/* Crear cuenta desde el enlace de invitación — sin login */}
      <Route path="/crear-cuenta" element={<CreateAccount />} />

      {!account ? (
        <Route path="*" element={loading ? <Splash /> : <Login />} />
      ) : (
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/inicio"        element={<Home />} />
          <Route path="/citas"         element={<Appointments />} />
          <Route path="/expedientes"   element={<Records />} />
          <Route path="/medicos"       element={<Doctors />} />
          <Route path="/pacientes"     element={<Patients />} />
          <Route path="/inventario"    element={<Inventory />} />
          <Route path="/recordatorios" element={<Reminders />} />
          <Route path="/ajustes"       element={<Settings />} />
          <Route path="/superadmin"    element={account.role === 'superuser' ? <SuperAdmin /> : <Navigate to="/inicio" replace />} />
          {/* Rutas antiguas: ahora viven dentro de Super Admin */}
          <Route path="/invitaciones"  element={<Navigate to="/superadmin" replace />} />
          <Route path="/actividad"     element={<Navigate to="/superadmin" replace />} />
          <Route path="*"              element={<Navigate to="/inicio" replace />} />
        </Route>
      )}
    </Routes>
  );
}
