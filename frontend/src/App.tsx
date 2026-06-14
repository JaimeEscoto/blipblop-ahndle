import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Appointments from './pages/Appointments';
import Doctors from './pages/Doctors';
import Patients from './pages/Patients';
import Records from './pages/Records';
import Inventory from './pages/Inventory';
import Reminders from './pages/Reminders';
import PublicAppointment from './pages/PublicAppointment';
import Home from './pages/Home';

export default function App() {
  return (
    <Routes>
      {/* Ruta pública (paciente al escanear el QR) — sin layout de la clínica */}
      <Route path="/cita/:code" element={<PublicAppointment />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="/inicio"        element={<Home />} />
        <Route path="/citas"         element={<Appointments />} />
        <Route path="/expedientes"   element={<Records />} />
        <Route path="/medicos"       element={<Doctors />} />
        <Route path="/pacientes"     element={<Patients />} />
        <Route path="/inventario"    element={<Inventory />} />
        <Route path="/recordatorios" element={<Reminders />} />
        <Route path="*"              element={<Navigate to="/citas" replace />} />
      </Route>
    </Routes>
  );
}
