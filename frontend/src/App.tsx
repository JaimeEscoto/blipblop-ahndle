import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Appointments from './pages/Appointments';
import Doctors from './pages/Doctors';
import Patients from './pages/Patients';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/citas" replace />} />
        <Route path="/citas" element={<Appointments />} />
        <Route path="/medicos" element={<Doctors />} />
        <Route path="/pacientes" element={<Patients />} />
        <Route path="*" element={<Navigate to="/citas" replace />} />
      </Route>
    </Routes>
  );
}
