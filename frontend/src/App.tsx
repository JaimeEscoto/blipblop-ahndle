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
import Landing from './pages/Landing';
import CreateClinic from './pages/CreateClinic';
import SuperAdminPortal from './pages/SuperAdminPortal';
import { useAuth } from './auth/AuthContext';
import { currentMode } from './tenant';

function Splash() {
  const { t } = useTranslation();
  return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">{t('common.loading')}</div>;
}

export default function App() {
  const mode = currentMode();

  // Modo "raíz" (odontiacloud.com): landing pública y creación de clínicas
  if (mode === 'root') {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/crear-clinica" element={<CreateClinic />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Modo "super admin" (superadmin.odontiacloud.com): solo jaimeted
  if (mode === 'superadmin') {
    return <SuperAdminPortal />;
  }

  // Modo "clínica" (<slug>.odontiacloud.com): app de la clínica
  return <ClinicApp />;
}

function ClinicApp() {
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
          <Route path="/superadmin"    element={account.role === 'superuser' || account.role === 'clinic_admin' ? <SuperAdmin /> : <Navigate to="/inicio" replace />} />
          <Route path="/invitaciones"  element={<Navigate to="/superadmin" replace />} />
          <Route path="/actividad"     element={<Navigate to="/superadmin" replace />} />
          <Route path="*"              element={<Navigate to="/inicio" replace />} />
        </Route>
      )}
    </Routes>
  );
}
