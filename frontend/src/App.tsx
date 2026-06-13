import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Appointments from './pages/Appointments';
import Doctors from './pages/Doctors';
import Patients from './pages/Patients';
import Records from './pages/Records';
import Inventory from './pages/Inventory';
import Reminders from './pages/Reminders';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/citas" replace />} />
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
