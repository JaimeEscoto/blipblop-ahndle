import { Link } from 'react-router-dom';
import { Cloud, ShieldCheck, Users, Calendar } from 'lucide-react';

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#eaf6fb] via-blue-50 to-[#e6fbfd]">
      {/* Marca de agua */}
      <img src="/icono.png" alt="" aria-hidden="true"
        className="pointer-events-none select-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vw,640px)] max-w-none opacity-[0.05]" />

      <header className="relative z-10 max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/icono.png" alt="odontiacloud" className="h-9 w-9 object-contain" />
          <span className="font-bold text-gray-800">odontiacloud</span>
        </div>
        <Link to="/crear-clinica"
          className="text-sm font-medium text-blue-700 hover:underline">
          Crear mi clínica
        </Link>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 pt-12 pb-20 text-center">
        <img src="/icono.png" alt="odontiacloud" className="h-24 w-24 object-contain mx-auto mb-6" />
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
          La nube de tu clínica dental
        </h1>
        <p className="mt-3 text-gray-600 max-w-xl mx-auto">
          Administra pacientes, citas, expedientes e inventario desde un solo lugar.
          Cada clínica tiene su propio subdominio y datos aislados.
        </p>

        <Link to="/crear-clinica"
          className="inline-block mt-8 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-md">
          Crear mi clínica gratis
        </Link>

        <div className="grid sm:grid-cols-3 gap-4 mt-14 text-left">
          <div className="bg-white/80 backdrop-blur rounded-xl p-5 shadow-sm border border-white">
            <Calendar className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900">Citas y agenda</h3>
            <p className="text-sm text-gray-600 mt-1">Agenda con QR público y mensajes por WhatsApp.</p>
          </div>
          <div className="bg-white/80 backdrop-blur rounded-xl p-5 shadow-sm border border-white">
            <Users className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900">Pacientes y expedientes</h3>
            <p className="text-sm text-gray-600 mt-1">Historia clínica completa con odontograma.</p>
          </div>
          <div className="bg-white/80 backdrop-blur rounded-xl p-5 shadow-sm border border-white">
            <ShieldCheck className="w-6 h-6 text-blue-600 mb-2" />
            <h3 className="font-semibold text-gray-900">Datos aislados</h3>
            <p className="text-sm text-gray-600 mt-1">Tu clínica vive en su subdominio propio.</p>
          </div>
        </div>

        <p className="mt-12 text-xs text-gray-400 flex items-center justify-center gap-1.5">
          <Cloud className="w-3.5 h-3.5" /> tu-clinica.odontiacloud.com
        </p>
      </main>
    </div>
  );
}
