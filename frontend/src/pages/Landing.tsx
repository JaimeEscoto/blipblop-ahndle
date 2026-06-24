import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Users, Stethoscope, FileText, Package, Bell, Wallet,
  Smartphone, ShieldCheck, QrCode, MessageCircle, Image as ImageIcon,
  Activity, ArrowRight, CheckCircle2, Sparkles, Cloud,
} from 'lucide-react';
import { trackVisit } from '../utils/track';

export default function Landing() {
  useEffect(() => { trackVisit('/'); }, []);
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#eaf6fb] via-blue-50 to-[#e6fbfd] text-gray-800">
      {/* Marca de agua sutil */}
      <img src="/icono.png" alt="" aria-hidden="true"
        className="pointer-events-none select-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vw,640px)] max-w-none opacity-[0.04]" />

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src="/icono.png" alt="odontiacloud" className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
          <span className="font-bold text-gray-900 hidden min-[420px]:inline">odontiacloud</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          <a href="#modulos" className="hover:text-blue-700">Módulos</a>
          <a href="#como-funciona" className="hover:text-blue-700">Cómo funciona</a>
          <a href="#faq" className="hover:text-blue-700">Preguntas</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link to="/login"
            className="text-xs sm:text-sm font-medium text-gray-700 hover:text-blue-700 whitespace-nowrap">
            <span className="sm:hidden">Entrar</span>
            <span className="hidden sm:inline">Iniciar sesión</span>
          </Link>
          <Link to="/crear-clinica"
            className="text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-2.5 sm:px-3.5 py-1.5 rounded-lg shadow-sm whitespace-nowrap">
            <span className="sm:hidden">Crear clínica</span>
            <span className="hidden sm:inline">Crear mi clínica</span>
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-16 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" /> Hecho para clínicas dentales
          </div>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-gray-900 leading-[1.1]">
            La nube de tu <span className="text-blue-600">clínica dental</span>
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-lg">
            Pacientes, citas, odontograma, recordatorios por WhatsApp y facturación, todo en
            un solo lugar. Tu propio espacio en <span className="font-medium text-gray-800">odontiacloud.com/tu-clinica</span>.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/crear-clinica"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-md">
              Crear mi clínica gratis <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#modulos"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-gray-800 font-medium hover:bg-gray-50 border border-gray-200">
              Ver módulos
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-600" /> Sin tarjeta de crédito</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-600" /> En menos de 1 minuto</li>
            <li className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-600" /> Web y Android</li>
          </ul>
        </div>

        {/* Mock de la app — ventana de "navegador" con vista de agenda */}
        <AppMockup />
      </section>

      {/* ── Strip de confianza ───────────────────────────────── */}
      <section className="relative z-10 border-y border-blue-100/60 bg-white/40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <Stat n="Multi-clínica" sub="cada una en su subdominio" />
          <Stat n="Multi-usuario" sub="invitaciones por correo" />
          <Stat n="Multi-dispositivo" sub="web, móvil y Android" />
          <Stat n="Multi-idioma" sub="español e inglés" />
        </div>
      </section>

      {/* ── Módulos ──────────────────────────────────────────── */}
      <section id="modulos" className="relative z-10 max-w-6xl mx-auto px-6 py-20">
        <SectionTitle eyebrow="Módulos" title="Todo lo que tu clínica necesita" subtitle="Una sola plataforma integrada — sin saltar entre herramientas." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          <FeatureCard icon={Calendar} title="Agenda con QR público"
            text="Comparte un código QR y los pacientes ven sus citas sin instalar nada." />
          <FeatureCard icon={Users} title="Pacientes"
            text="Ficha completa: contacto, documento, dirección, ocupación y más." />
          <FeatureCard icon={FileText} title="Expedientes con odontograma"
            text="Historia clínica detallada y odontograma interactivo por pieza dental." />
          <FeatureCard icon={Stethoscope} title="Médicos y especialidades"
            text="Asigna doctores a cada cita y gestiona sus horarios y datos." />
          <FeatureCard icon={Package} title="Inventario"
            text="Stock de materiales, alertas de bajo nivel y reabastecimiento." />
          <FeatureCard icon={Bell} title="Recordatorios"
            text="Avisos automáticos a pacientes vía WhatsApp para reducir ausencias." />
          <FeatureCard icon={Wallet} title="Finanzas y facturación"
            text="Cobros, pagos, facturas y reportes con tu moneda e impuesto local." />
          <FeatureCard icon={ImageIcon} title="Adjuntos clínicos"
            text="Radiografías, fotos y documentos guardados de forma segura." />
          <FeatureCard icon={Activity} title="Bitácora de actividad"
            text="Sabes quién hizo qué y cuándo — auditoría completa por usuario." />
        </div>
      </section>

      {/* ── Cómo funciona ────────────────────────────────────── */}
      <section id="como-funciona" className="relative z-10 bg-white/60 backdrop-blur border-y border-blue-100/60">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <SectionTitle eyebrow="Empezar" title="En 3 pasos estás trabajando" />
          <div className="grid md:grid-cols-3 gap-6 mt-10">
            <Step n={1} title="Crea tu clínica" text="Inicia sesión con Google, elige tu subdominio y nombre. Listo en menos de un minuto." />
            <Step n={2} title="Invita a tu equipo" text="Envía invitaciones por correo. Doctores y asistentes acceden solo a lo que tú permitas." />
            <Step n={3} title="Empieza a trabajar" text="Carga pacientes, agenda citas y arranca con tu odontograma. Tus datos viven aislados." />
          </div>
        </div>
      </section>

      {/* ── Showcase: módulos destacados ─────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-20 space-y-20">
        <Showcase reverse={false}
          eyebrow="Agenda" title="Citas claras y compartibles"
          text="Visualiza el día completo, agenda en segundos y comparte un enlace público con QR para que el paciente lo abra desde su celular sin necesidad de instalar nada."
          bullets={['Vista por día con horarios', 'Estados de la cita (programada, completada, cancelada)', 'QR público para cada cita', 'Recordatorios WhatsApp']}
          visual={<MockAgenda />}
        />
        <Showcase reverse={true}
          eyebrow="Odontograma" title="Historia clínica visual"
          text="Cada paciente tiene su odontograma interactivo. Anota tratamientos pieza por pieza y mantén un expediente completo con adjuntos como radiografías y fotos."
          bullets={['Odontograma interactivo', 'Notas por tratamiento', 'Adjuntos (radiografías, fotos)', 'Historial cronológico']}
          visual={<MockOdontogram />}
        />
        <Showcase reverse={false}
          eyebrow="Finanzas" title="Cobros y reportes en tu moneda"
          text="Genera facturas con tu numeración, registra pagos parciales, controla saldos y ve cómo va tu clínica con reportes claros. Configurable en Lempiras, USD o tu moneda local."
          bullets={['Facturación con numeración propia', 'Pagos parciales', 'Impuesto configurable', 'Reportes mensuales']}
          visual={<MockFinance />}
        />
      </section>

      {/* ── Móvil / Multi-tenant ─────────────────────────────── */}
      <section className="relative z-10 bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-white/15 text-white text-xs font-medium px-3 py-1 rounded-full">
              <Smartphone className="w-3.5 h-3.5" /> Web + Android
            </div>
            <h3 className="mt-4 text-3xl font-bold leading-tight">
              Tu clínica también en el bolsillo
            </h3>
            <p className="mt-3 text-white/90 max-w-md">
              Usa odontiacloud desde cualquier navegador o instala la app Android.
              Tus datos viajan contigo a la consulta, a casa o a una conferencia.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <Highlight icon={ShieldCheck} title="Datos aislados"
              text="Cada clínica vive en su propio espacio. Otra clínica nunca ve tus pacientes." />
            <Highlight icon={QrCode} title="QR público de citas"
              text="Comparte una cita por WhatsApp con un enlace que el paciente abre al instante." />
            <Highlight icon={MessageCircle} title="WhatsApp integrado"
              text="Confirma citas y envía recordatorios sin salir de la plataforma." />
            <Highlight icon={Cloud} title="Tu propio subdominio"
              text="odontiacloud.com/tu-clinica — fácil de recordar y compartir." />
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <SectionTitle eyebrow="Preguntas frecuentes" title="Antes de empezar" />
        <div className="mt-8 space-y-3">
          <Faq q="¿Cuánto cuesta?" a="Puedes empezar gratis. Los planes de pago aparecen cuando necesitas más capacidad o funciones avanzadas." />
          <Faq q="¿Mis datos son privados?" a="Sí. Cada clínica vive en su propio espacio aislado. Ningún otro usuario o clínica puede ver tu información." />
          <Faq q="¿Cómo invito a mi equipo?" a="Desde la sección de invitaciones envías un correo. Cada miembro entra con su cuenta de Google o con contraseña propia." />
          <Faq q="¿Funciona en celular?" a="Sí. La web funciona perfectamente en cualquier navegador móvil, y además tenemos app Android nativa." />
          <Faq q="¿Puedo exportar mis datos?" a="Sí. Tus datos son tuyos. Mientras tu cuenta esté activa puedes solicitar una exportación cuando quieras." />
        </div>
      </section>

      {/* ── CTA Final ────────────────────────────────────────── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-3xl bg-white shadow-xl border border-blue-100 p-10 text-center">
          <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">Tu clínica organizada hoy mismo</h3>
          <p className="mt-2 text-gray-600">Crea tu espacio en menos de un minuto. Sin instalación, sin tarjeta.</p>
          <Link to="/crear-clinica"
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-md">
            Crear mi clínica gratis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-blue-100/60 bg-white/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <img src="/icono.png" alt="" className="h-6 w-6 object-contain" />
            <span>© {new Date().getFullYear()} odontiacloud</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="mailto:soporte@odontiacloud.com" className="hover:text-blue-700">Contacto</a>
            <span className="text-gray-300">·</span>
            <span>Hecho en Honduras</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ───────────────────────── Sub-componentes ───────────────────────── */

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="inline-block text-xs font-semibold text-blue-600 uppercase tracking-wider">{eyebrow}</div>
      <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="mt-3 text-gray-600">{subtitle}</p>}
    </div>
  );
}

function Stat({ n, sub }: { n: string; sub: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-gray-900">{n}</div>
      <div className="text-xs text-gray-500">{sub}</div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="group bg-white rounded-2xl p-5 shadow-sm border border-blue-100/60 hover:shadow-md hover:border-blue-200 transition">
      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="mt-3 font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{text}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-blue-100/60 shadow-sm">
      <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">{n}</div>
      <h3 className="mt-3 font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{text}</p>
    </div>
  );
}

function Showcase({
  eyebrow, title, text, bullets, visual, reverse,
}: {
  eyebrow: string; title: string; text: string; bullets: string[]; visual: React.ReactNode; reverse: boolean;
}) {
  return (
    <div className={`grid lg:grid-cols-2 gap-10 items-center ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
      <div>
        <div className="inline-block text-xs font-semibold text-blue-600 uppercase tracking-wider">{eyebrow}</div>
        <h3 className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900">{title}</h3>
        <p className="mt-3 text-gray-600">{text}</p>
        <ul className="mt-5 space-y-2">
          {bullets.map(b => (
            <li key={b} className="flex items-start gap-2 text-sm text-gray-700">
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div>{visual}</div>
    </div>
  );
}

function Highlight({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-xl p-4 border border-white/20">
      <Icon className="w-5 h-5 text-white" />
      <div className="mt-2 font-semibold">{title}</div>
      <div className="text-xs text-white/85 mt-0.5">{text}</div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="bg-white rounded-xl border border-blue-100/60 px-5 py-4 group">
      <summary className="cursor-pointer text-sm font-medium text-gray-900 flex items-center justify-between">
        {q}
        <ArrowRight className="w-4 h-4 text-blue-600 transition-transform group-open:rotate-90" />
      </summary>
      <p className="mt-2 text-sm text-gray-600">{a}</p>
    </details>
  );
}

/* ───────────────────────── Mocks visuales ───────────────────────── */

function BrowserChrome({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white shadow-2xl border border-blue-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-3 px-3 py-1 bg-white border border-gray-200 rounded-md text-[10px] text-gray-500 truncate">
          {url}
        </div>
      </div>
      <div className="p-4 bg-gradient-to-b from-white to-blue-50/40">
        {children}
      </div>
    </div>
  );
}

/* Estados de cita reales (Appointments.tsx): scheduled=azul, completed=verde, cancelled=rojo */
const APPT_ROWS = [
  { t: '08:00', n: 'María López',  d: 'Dr. Mejía',   s: 'completed', label: 'Completada' },
  { t: '09:30', n: 'Carlos Núñez', d: 'Dra. Rivera', s: 'scheduled', label: 'Programada' },
  { t: '11:00', n: 'Ana Castro',   d: 'Dr. Mejía',   s: 'scheduled', label: 'Programada' },
  { t: '14:00', n: 'Luis Pérez',   d: 'Dra. Rivera', s: 'scheduled', label: 'Programada' },
  { t: '15:30', n: 'Sofía Reyes',  d: 'Dr. Mejía',   s: 'cancelled', label: 'Cancelada' },
] as const;

const STATUS_PILL: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function ApptList() {
  return (
    <div className="space-y-1.5">
      {APPT_ROWS.map(r => (
        <div key={r.t} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-gray-100">
          <div className="text-xs font-mono font-semibold text-gray-500 w-12">{r.t}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">{r.n}</div>
            <div className="text-[10px] text-gray-500">{r.d}</div>
          </div>
          <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[r.s]}`}>{r.label}</div>
        </div>
      ))}
    </div>
  );
}

function AppMockup() {
  return (
    <div className="relative">
      <div className="absolute -top-6 -right-4 w-32 h-32 bg-blue-200 rounded-full blur-3xl opacity-50" />
      <div className="absolute -bottom-8 -left-6 w-40 h-40 bg-cyan-200 rounded-full blur-3xl opacity-60" />
      <BrowserChrome url="odontiacloud.com/dental-sur/citas">
        <div className="flex items-center justify-between mb-3">
          <div className="relative flex-1 mr-2">
            <div className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg bg-white text-[11px] text-gray-400">Buscar paciente…</div>
            <div className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-gray-400" />
          </div>
          <div className="text-[10px] px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium">+ Nueva cita</div>
        </div>
        <ApptList />
      </BrowserChrome>
    </div>
  );
}

/* Pantalla pública de la cita (PublicAppointment.tsx) — gradiente del header de la app */
function MockAgenda() {
  return (
    <BrowserChrome url="odontiacloud.com/cita/a8x2k">
      <div className="rounded-xl overflow-hidden border border-gray-100 bg-white">
        <div className="bg-gradient-to-r from-[#0f2f4f] via-[#1e6f9f] to-[#36c1d6] text-white px-4 py-4">
          <p className="text-blue-100 text-[9px] uppercase tracking-wide">Invitación a tu cita</p>
          <h4 className="text-lg font-bold mt-0.5">Hola, María</h4>
          <span className="inline-flex items-center gap-1 mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">
            Programada
          </span>
        </div>
        <div className="px-4 py-3 border-b border-gray-100 space-y-1">
          <div className="flex items-center gap-2 text-gray-800 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-medium">Jueves 25 de junio</span>
          </div>
          <div className="flex items-center gap-2 text-gray-800 text-xs">
            <Bell className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-medium">09:30 h</span>
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-[9px] text-gray-400 uppercase tracking-wide">Tu doctor</p>
          <p className="text-xs text-gray-800 mt-0.5">Dr. Mejía</p>
        </div>
      </div>
    </BrowserChrome>
  );
}

/* Estados reales del odontograma (Odontogram.tsx) */
const TOOTH_COLORS = {
  healthy:   '#ffffff',
  cavity:    '#ef4444',
  filled:    '#3b82f6',
  extracted: '#6b7280',
  crown:     '#f59e0b',
  implant:   '#8b5cf6',
};

function Tooth({ num, state }: { num: number; state: keyof typeof TOOTH_COLORS }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg viewBox="0 0 20 24" className="w-5 h-6">
        <path d="M4 4 C 4 1, 16 1, 16 4 L 17 14 C 17 19, 13 23, 10 23 C 7 23, 3 19, 3 14 Z"
          fill={TOOTH_COLORS[state]} stroke="#9ca3af" strokeWidth="0.8" />
      </svg>
      <span className="text-[7px] text-gray-400 leading-none">{num}</span>
    </div>
  );
}

function MockOdontogram() {
  // Patrón realista: la mayoría sanos, algunos caries/empastes
  const upper: (keyof typeof TOOTH_COLORS)[] = ['healthy','healthy','filled','healthy','cavity','healthy','healthy','crown','healthy','healthy','healthy','filled','healthy','healthy','healthy','healthy'];
  const lower: (keyof typeof TOOTH_COLORS)[] = ['healthy','healthy','healthy','healthy','filled','healthy','extracted','healthy','healthy','cavity','healthy','healthy','healthy','healthy','healthy','healthy'];
  return (
    <BrowserChrome url="odontiacloud.com/dental-sur/expedientes">
      <div className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold">Expediente</div>
      <div className="text-base font-bold text-gray-900 mt-0.5 mb-3">Luis Pérez · 34 años</div>

      <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-3">
        <div>
          <p className="text-[9px] text-gray-400 mb-1">Superior</p>
          <div className="flex gap-1 flex-wrap">
            {upper.map((s, i) => <Tooth key={i} num={18 - i} state={s} />)}
          </div>
        </div>
        <div>
          <p className="text-[9px] text-gray-400 mb-1">Inferior</p>
          <div className="flex gap-1 flex-wrap">
            {lower.map((s, i) => <Tooth key={i} num={48 - i} state={s} />)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
          {([
            ['Sano', 'healthy'],
            ['Caries', 'cavity'],
            ['Obturación', 'filled'],
            ['Extraído', 'extracted'],
            ['Corona', 'crown'],
          ] as const).map(([label, k]) => (
            <span key={k} className="flex items-center gap-1 text-[9px] text-gray-500">
              <span className="w-2 h-2 rounded border border-gray-300 inline-block" style={{ background: TOOTH_COLORS[k] }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </BrowserChrome>
  );
}

/* Lista de facturas real (Finance.tsx): #número, estado, paciente, doctor, fecha, total */
const INVOICE_STATUS = {
  issued:    { label: 'Emitida',  cls: 'bg-blue-100 text-blue-700' },
  partial:   { label: 'Parcial',  cls: 'bg-amber-100 text-amber-700' },
  paid:      { label: 'Pagada',   cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Anulada',  cls: 'bg-red-100 text-red-700' },
} as const;

const INVOICES = [
  { num: '0028', status: 'paid',    name: 'María López',   date: '20 jun', dr: 'Mejía',  total: 'L 1,850.00' },
  { num: '0027', status: 'partial', name: 'Carlos Núñez',  date: '19 jun', dr: 'Rivera', total: 'L 4,200.00', paid: 'Pagado L 2,000.00' },
  { num: '0026', status: 'issued',  name: 'Ana Castro',    date: '18 jun', dr: 'Mejía',  total: 'L 950.00' },
  { num: '0025', status: 'paid',    name: 'Luis Pérez',    date: '17 jun', dr: 'Rivera', total: 'L 3,400.00' },
] as const;

function MockFinance() {
  return (
    <BrowserChrome url="odontiacloud.com/dental-sur/finanzas">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <div className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg bg-white text-[11px] text-gray-400">Buscar # o paciente…</div>
        </div>
        <div className="text-[10px] px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-600">Todos</div>
        <div className="text-[10px] px-2 py-1.5 bg-blue-600 text-white rounded-lg font-medium">+ Nueva factura</div>
      </div>
      <div className="space-y-1.5">
        {INVOICES.map(inv => {
          const st = INVOICE_STATUS[inv.status];
          return (
            <div key={inv.num} className="bg-white rounded-lg border border-gray-100 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-gray-500">#{inv.num}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-900 truncate mt-0.5">{inv.name}</p>
                  <p className="text-[10px] text-gray-400">{inv.date} · Dr. {inv.dr}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-gray-900">{inv.total}</p>
                  {'paid' in inv && inv.paid && <p className="text-[9px] text-amber-600">{inv.paid}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </BrowserChrome>
  );
}
