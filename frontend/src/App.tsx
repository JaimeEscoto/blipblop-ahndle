import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Layout from './components/Layout';
import Appointments from './pages/Appointments';
import Doctors from './pages/Doctors';
import Patients from './pages/Patients';
import Records from './pages/Records';
import Inventory from './pages/Inventory';
import Reminders from './pages/Reminders';
import Finance from './pages/Finance';
import PublicAppointment from './pages/PublicAppointment';
import Home from './pages/Home';
import Login from './pages/Login';
import CreateAccount from './pages/CreateAccount';
import SuperAdmin from './pages/SuperAdmin';
import Settings from './pages/Settings';
import Landing from './pages/Landing';
import CreateClinic from './pages/CreateClinic';
import GlobalLogin from './pages/GlobalLogin';
import SuperAdminPortal from './pages/SuperAdminPortal';
import Demo from './pages/Demo';
import InstallPrompt from './components/InstallPrompt';
import { useAuth } from './auth/AuthContext';

function Splash() {
  const { t } = useTranslation();
  return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">{t('common.loading')}</div>;
}

export default function App() {
  return (
    <>
      <InstallPrompt />
      <Routes>
        {/* Públicas (sin clínica) */}
        <Route path="/" element={<Landing />} />
        <Route path="/crear-clinica" element={<CreateClinic />} />
        <Route path="/login" element={<GlobalLogin />} />
        <Route path="/cita/:code" element={<PublicAppointment />} />

        {/* Demo público: pide nombre y entra a la clínica de demostración */}
        <Route path="/demo/:slug" element={<Demo />} />

        {/* Portal Super Admin */}
        <Route path="/superadmin/*" element={<SuperAdminPortal />} />

        {/* Aceptar invitación (público, requiere conocer la clínica por el slug) */}
        <Route path="/:slug/crear-cuenta" element={<CreateAccount />} />

        {/* App de la clínica (todo lo demás bajo /:slug/...) */}
        <Route path="/:slug/*" element={<ClinicApp />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function ClinicApp() {
  const { account, loading } = useAuth();

  if (loading) return <Splash />;
  if (!account) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index               element={<Home />} />
        <Route path="inicio"        element={<Home />} />
        <Route path="citas"         element={<Appointments />} />
        <Route path="expedientes"   element={<Records />} />
        <Route path="medicos"       element={<Doctors />} />
        <Route path="pacientes"     element={<Patients />} />
        <Route path="inventario"    element={<Inventory />} />
        <Route path="recordatorios" element={<Reminders />} />
        <Route path="finanzas"      element={<Finance />} />
        <Route path="ajustes"       element={<Settings />} />
        <Route path="superadmin"    element={(account.role === 'superuser' || account.role === 'clinic_admin') ? <SuperAdmin /> : <Navigate to="../inicio" replace />} />
        {/* Rutas antiguas: ahora viven dentro de Super Admin */}
        <Route path="invitaciones"  element={<Navigate to="../superadmin" replace />} />
        <Route path="actividad"     element={<Navigate to="../superadmin" replace />} />
        <Route path="*"             element={<Navigate to="inicio" replace />} />
      </Route>
    </Routes>
  );
}
