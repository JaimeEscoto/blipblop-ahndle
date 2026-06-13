import { NavLink, Outlet } from 'react-router-dom';
import { Calendar, Users, Stethoscope, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/citas', label: 'Citas', icon: Calendar },
  { to: '/medicos', label: 'Médicos', icon: Stethoscope },
  { to: '/pacientes', label: 'Pacientes', icon: Users },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight">ClínicaPro</span>
          </div>
          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-blue-800 text-white' : 'text-blue-100 hover:bg-blue-700'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-blue-700"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {/* Mobile nav */}
        {menuOpen && (
          <nav className="md:hidden border-t border-blue-700 px-4 pb-3 pt-2 flex flex-col gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-blue-800 text-white' : 'text-blue-100 hover:bg-blue-700'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'
              }`
            }
          >
            <Icon className="w-5 h-5 mb-0.5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom padding for mobile nav */}
      <div className="md:hidden h-14" />
    </div>
  );
}
