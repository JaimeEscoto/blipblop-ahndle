import { NavLink, Outlet } from 'react-router-dom';
import { Home, Calendar, Users, Stethoscope, Menu, X, FileText, Package, Bell, Mail, LogOut, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const baseNavItems = [
  { to: '/inicio',       label: 'Inicio',         icon: Home },
  { to: '/citas',        label: 'Citas',         icon: Calendar },
  { to: '/expedientes',  label: 'Expedientes',   icon: FileText },
  { to: '/medicos',      label: 'Médicos',        icon: Stethoscope },
  { to: '/pacientes',    label: 'Pacientes',      icon: Users },
  { to: '/inventario',   label: 'Inventario',     icon: Package },
  { to: '/recordatorios',label: 'Recordatorios',  icon: Bell },
];

export default function Layout() {
  const { account, logout } = useAuth();
  const navItems = account?.role === 'superuser'
    ? [...baseNavItems,
        { to: '/invitaciones', label: 'Invitaciones', icon: Mail },
        { to: '/actividad', label: 'Actividad', icon: Activity }]
    : baseNavItems;
  const [menuOpen, setMenuOpen] = useState(false);
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
    if (to === '/inventario' && lowStockCount > 0) return lowStockCount;
    if (to === '/recordatorios' && pendingReminders > 0) return pendingReminders;
    return 0;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#0f2f4f] via-[#1e6f9f] to-[#36c1d6] text-white shadow-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <span className="bg-white rounded-xl px-3.5 py-2 shadow-sm">
              <img src="/logo.png" alt="odontiacloud" className="h-10 w-auto block" />
            </span>
          </div>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const badge = getBadge(to);
              return (
                <NavLink key={to} to={to}
                  className={({ isActive }) =>
                    `relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-blue-800 text-white' : 'text-blue-100 hover:bg-blue-700'
                    }`}>
                  <Icon className="w-4 h-4" />
                  {label}
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-400 text-gray-900 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
            <button onClick={logout} title="Cerrar sesión" className="ml-1 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-700">
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-lg hover:bg-blue-700" onClick={() => setMenuOpen(!menuOpen)}>
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
                  {label}
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
              <button onClick={() => { setMenuOpen(false); logout(); }} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-100 hover:bg-blue-700">
                <LogOut className="w-4 h-4" /> Cerrar sesión
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom nav mobile — solo primeras 5 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
        {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => {
          const badge = getBadge(to);
          return (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `relative flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-[#1e6f9f]' : 'text-gray-500 hover:text-[#36c1d6]'
                }`}>
              <Icon className="w-5 h-5 mb-0.5" />
              {label}
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
