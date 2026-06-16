import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, Appointment, InventoryItem } from '../api/client';
import { generateAppointmentPDF } from '../utils/generateAppointmentPDF';
import { dateLocale } from '../i18n/format';
import { Calendar, Clock, Download, MessageCircle, Package, AlertTriangle, ChevronRight, CalendarDays } from 'lucide-react';

export default function Home() {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [appts, ls] = await Promise.all([api.appointments.list(), api.inventory.lowStock()]);
      setAppointments(appts);
      setLowStock(ls);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

  // Próximas citas: programadas, de hoy en adelante, ordenadas
  const upcoming = appointments
    .filter(a => a.status === 'scheduled' && a.date >= todayStr)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 6);

  const fmtDate = (d: string) => {
    const f = new Date(d + 'T00:00:00').toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
    return f.charAt(0).toUpperCase() + f.slice(1);
  };

  const relativeDay = (d: string) => {
    if (d === todayStr) return t('home.today');
    const tomorrow = (() => { const t = new Date(); t.setDate(t.getDate() + 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();
    if (d === tomorrow) return t('home.tomorrow');
    return null;
  };

  const isToday = (d: string) => d === todayStr;

  const waLink = (a: Appointment) => {
    if (!a.user_phone) return null;
    const phone = a.user_phone.replace(/\D/g, '');
    const url = a.public_code ? `${window.location.origin}/cita/${a.public_code}` : '';
    const fecha = new Date(a.date + 'T00:00:00').toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
    const msg = encodeURIComponent(
      t('home.waMessage', {
        name: a.user_name,
        date: fecha,
        time: a.time,
        doctor: a.doctor_name,
        url: url ? t('home.waMessageUrl', { url }) : '',
      })
    );
    return `https://wa.me/${phone}?text=${msg}`;
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">{t('home.title')}</h1>
        <p className="text-sm text-gray-500">{t('home.subtitle')}</p>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <CalendarDays className="w-4 h-4" />
            <span className="text-xs font-medium text-gray-500">{t('home.upcomingAppointments')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{upcoming.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <Package className="w-4 h-4" />
            <span className="text-xs font-medium text-gray-500">{t('home.lowStock')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{lowStock.length}</p>
        </div>
      </div>

      {/* Alertas de stock bajo */}
      {lowStock.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-800">{t('home.runningOut')}</h2>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl divide-y divide-amber-100 overflow-hidden">
            {lowStock.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-amber-700">{t('home.remaining', { quantity: item.quantity, unit: item.unit, min: item.min_quantity })}</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">{t('home.low')}</span>
              </div>
            ))}
          </div>
          {lowStock.length > 5 && (
            <Link to="/inventario" className="flex items-center justify-end gap-1 mt-2 text-xs text-blue-600 font-medium hover:underline">
              {t('home.seeProducts', { count: lowStock.length })} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}

      {/* Próximas citas */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-800">{t('home.upcomingAppointments')}</h2>
        <Link to="/citas" className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline">
          {t('home.seeAll')} <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">{t('common.loading')}</div>
      ) : upcoming.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-gray-100">{t('home.noUpcoming')}</div>
      ) : (
        <div className="space-y-3">
          {upcoming.map(a => {
            const rel = relativeDay(a.date);
            const link = waLink(a);
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{a.user_name}</p>
                    <p className="text-sm text-gray-600 truncate">Dr. {a.doctor_name} · <span className="text-gray-400">{a.doctor_specialty}</span></p>
                  </div>
                  {rel && (
                    <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${isToday(a.date) ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{rel}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center gap-1 text-xs text-gray-500"><Calendar className="w-3.5 h-3.5" />{fmtDate(a.date)}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500"><Clock className="w-3.5 h-3.5" />{a.time}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => generateAppointmentPDF(a)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                    <Download className="w-3.5 h-3.5" /> {t('home.downloadInvite')}
                  </button>
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100">
                      <MessageCircle className="w-3.5 h-3.5" /> {t('common.whatsapp')}
                    </a>
                  ) : (
                    <span className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 bg-gray-50 text-gray-400 rounded-lg cursor-not-allowed" title={t('home.noPhoneTitle')}>
                      <MessageCircle className="w-3.5 h-3.5" /> {t('common.noPhone')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
