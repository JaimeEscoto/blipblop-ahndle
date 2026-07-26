import { NavLink, Outlet } from 'react-router-dom';
import { Home, Calendar, Users, Stethoscope, Menu, X, Package, Bell, LogOut, Shield, Settings, Wallet, FlaskConical, RotateCcw, Search, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { withSlug, currentSlug } from '../tenant';
import TermsGate from './TermsGate';
import WhatsNewModal from './WhatsNewModal';
import GlobalSearch from './GlobalSearch';

// Banner persistente que avisa al visitante que está en modo demo.
// Incluye un botón para resetear el sandbox compartido.
function DemoBanner({ visitorName }: { visitorName: string }) {
  const [resetting, setResetting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const slug = currentSlug();
  const token = (() => { try { return localStorage.getItem('demo_token_' + slug) || ''; } catch { return ''; } })();
  const reset = async () => {
    if (!slug || !token) return;
    setResetting(true);
    try {
      await api.demo.reset(slug, token);
      window.location.reload();
    } catch (e) {
      console.error(e);
      setResetting(false);
    }
  };
  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-xs flex items-center gap-3 justify-center flex-wrap z-40 relative">
      <FlaskConical className="w-4 h-4 shrink-0" />
      <span className="font-medium">Modo demostración</span>
      <span className="opacity-90">·</span>
      <span>Hola, <strong className="font-semibold">{visitorName || 'visitante'}</strong></span>
      <span className="opacity-90">·</span>
      {confirming ? (
        <span className="flex items-center gap-2">
          <span>¿Resetear datos demo?</span>
          <button onClick={reset} disabled={resetting} className="bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded font-semibold disabled:opacity-60">
            {resetting ? 'Reseteando…' : 'Sí, resetear'}
          </button>
          <button onClick={() => setConfirming(false)} className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded">No</button>
        </span>
      ) : (
        <button onClick={() => setConfirming(true)} className="flex items-center gap-1 bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded font-semibold">
          <RotateCcw className="w-3 h-3" /> Resetear datos
        </button>
      )}
    </div>
  );
}

// Agrupado por qué tan seguido se usa: operación diaria arriba, negocio en medio,
// configuración/uso ocasional al final. El sidebar (desktop) muestra los grupos con
// encabezado; el menú móvil usa la misma lista aplanada, sin encabezados de grupo.
function buildNavGroups(isAdmin: boolean) {
  return [
    { label: 'Operación', items: [
      { to: 'inicio',    label: 'menu.home',         icon: Home },
      { to: 'citas',     label: 'menu.appointments', icon: Calendar },
      { to: 'pacientes', label: 'menu.patients',     icon: Users },
    ]},
    { label: 'Negocio', items: [
      { to: 'finanzas',   label: 'menu.finance',   icon: Wallet },
      { to: 'inventario', label: 'menu.inventory', icon: Package },
    ]},
    { label: 'Configuración', items: [
      { to: 'medicos',       label: 'menu.doctors',    icon: Stethoscope },
      { to: 'recordatorios', label: 'menu.reminders',  icon: Bell },
      ...(isAdmin ? [{ to: 'superadmin', label: 'menu.superadmin', icon: Shield }] : []),
      { to: 'ajustes', label: 'menu.settings', icon: Settings },
    ]},
  ];
}

export default function Layout() {
  const { account, logout } = useAuth();
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = account?.role === 'superuser' || account?.role === 'clinic_admin';
  const navGroups = buildNavGroups(isAdmin).map(g => ({
    ...g,
    items: g.items.map(it => ({ ...it, to: withSlug(it.to) })),
  }));
  const navItems = navGroups.flatMap(g => g.items);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [pendingReminders, setPendingReminders] = useState(0);

  useEffect(() => {
    const loadBadges = async () => {
      try {
        const [ls, rem] = await Promise.all([api.inventory.lowStock(), api.reminders.list()]);
        setLowStockCount(ls.length);
        setPendingReminders(rem.filter(r => r.status === 'pending').length);
      } catch {}
    };
    loadBadges();
    const interval = setInterval(loadBadges, 60000);
    return () => clearInterval(interval);
  }, []);

  const getBadge = (to: string) => {
    if (to.endsWith('/inventario') && lowStockCount > 0) return lowStockCount;
    if (to.endsWith('/recordatorios') && pendingReminders > 0) return pendingReminders;
    return 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col relative">
      {/* Marca de agua: logo degradado al fondo */}
      <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <img src="/icono.png" alt="" aria-hidden="true"
          className="w-[min(70vw,520px)] max-w-none opacity-[0.05]" />
      </div>
      {/* Banner persistente para visitantes del modo demostración */}
      {account?.is_demo_visitor && <DemoBanner visitorName={account.name || ''} />}
      {/* Header: logo + búsqueda global + salir. La navegación vive en el sidebar (desktop) / menú (móvil). */}
      <header className="bg-blue-900 text-white shadow-md sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center gap-3">
          <span className="shrink-0 bg-white rounded-xl p-1.5 shadow-sm flex items-center justify-center">
            <img src="/icono.png" alt="odontiacloud" className="h-9 w-9 object-contain block" />
          </span>
          <div className="hidden md:block flex-1 max-w-sm">
            <GlobalSearch />
          </div>
          <div className="flex-1 md:hidden" />
          <button onClick={toggleTheme} title={theme === 'dark' ? t('menu.lightMode') : t('menu.darkMode')} className="hidden md:flex shrink-0 items-center p-2 rounded-lg text-blue-100 hover:bg-blue-700">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={logout} title={t('menu.logout')} className="hidden md:flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-700">
            <LogOut className="w-4 h-4" />
          </button>
          {/* Mobile: ícono de búsqueda + menú */}
          <button className="md:hidden shrink-0 p-2 rounded-lg hover:bg-blue-700" onClick={() => setMobileSearchOpen(true)}>
            <Search className="w-5 h-5" />
          </button>
          <button className="md:hidden shrink-0 p-2 rounded-lg hover:bg-blue-700" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {/* Mobile dropdown nav */}
        {menuOpen && (
          <nav className="md:hidden border-t border-blue-700 px-4 pb-3 pt-2 flex flex-col gap-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const badge = getBadge(to);
              return (
                <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-800 text-white' : 'text-blue-100 hover:bg-blue-700'
                    }`}>
                  <Icon className="w-4 h-4" />
                  {t(label)}
                  {badge > 0 && (
                    <span className="ml-auto bg-amber-400 text-gray-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
            <div className="border-t border-blue-700 mt-1 pt-2">
              {account && <p className="px-3 text-xs text-blue-200 mb-1 truncate">{account.email}</p>}
              <button onClick={toggleTheme} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-700">
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {theme === 'dark' ? t('menu.lightMode') : t('menu.darkMode')}
              </button>
              <button onClick={() => { setMenuOpen(false); logout(); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-700">
                <LogOut className="w-4 h-4" /> {t('menu.logout')}
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Sidebar (desktop) + contenido */}
      <div className="flex-1 flex w-full min-h-0">
        <aside className="hidden md:block w-56 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 relative z-10 py-4 px-3 overflow-y-auto">
          {navGroups.map(group => (
            <div key={group.label} className="mb-4">
              <p className="px-3 mb-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => {
                  const badge = getBadge(to);
                  return (
                    <NavLink key={to} to={to}
                      className={({ isActive }) =>
                        `relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/60'
                        }`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{t(label)}</span>
                      {badge > 0 && (
                        <span className="ml-auto shrink-0 bg-amber-400 text-gray-900 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        <main className="relative z-10 flex-1 min-w-0 overflow-x-hidden">
          <div className="max-w-5xl mx-auto w-full px-4 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Buscador global en pantalla completa (móvil) */}
      {mobileSearchOpen && <GlobalSearch fullScreen onClose={() => setMobileSearchOpen(false)} />}

      {/* Modal bloqueante de Términos de Servicio si la versión vigente no ha sido aceptada */}
      <TermsGate />

      {/* Novedades del sistema (una vez por usuario, salta lo ya visto) */}
      <WhatsNewModal isDemoVisitor={account?.is_demo_visitor} />

      {/* Bottom nav mobile — solo primeras 5 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex z-30">
        {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => {
          const badge = getBadge(to);
          return (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `relative flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-[#1e6f9f] dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:text-[#36c1d6]'
                }`}>
              <Icon className="w-5 h-5 mb-0.5" />
              {t(label)}
              {badge > 0 && (
                <span className="absolute top-1 right-1/4 bg-amber-400 text-gray-900 text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="md:hidden h-14" />
    </div>
  );
}
