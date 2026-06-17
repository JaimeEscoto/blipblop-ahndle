import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, PublicAppointment as PublicAppt } from '../api/client';
import { dateLocale } from '../i18n/format';
import { Calendar, Clock, MapPin, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const STATUS: Record<string, { cls: string; Icon: typeof CheckCircle }> = {
  scheduled: { cls: 'bg-blue-100 text-blue-700', Icon: AlertCircle },
  completed: { cls: 'bg-green-100 text-green-700', Icon: CheckCircle },
  cancelled: { cls: 'bg-red-100 text-red-700', Icon: XCircle },
};

export default function PublicAppointment() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const [appt, setAppt] = useState<PublicAppt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    api.appointments.getPublic(code)
      .then(setAppt)
      .catch(() => setError(t('publicAppointment.notFound')))
      .finally(() => setLoading(false));
  }, [code]);

  const fmtDate = (d: string) => {
    const f = new Date(d + 'T00:00:00').toLocaleDateString(dateLocale(), {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    return f.charAt(0).toUpperCase() + f.slice(1);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-blue-50 to-gray-100 flex flex-col items-center justify-center p-4">
      {/* Marca de agua: logo degradado al fondo */}
      <img src="/icono.png" alt="" aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vw,560px)] max-w-none opacity-[0.07]" />
      <div className="relative z-10 w-full max-w-md">
        {/* Encabezado clínica */}
        <div className="flex justify-center mb-5">
          <span className="bg-white rounded-xl shadow-sm px-5 py-3">
            <img src="/logo.png" alt="odontiacloud" className="h-14 w-auto block" />
          </span>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-400">{t('publicAppointment.loading')}</div>
        )}

        {!loading && error && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">{error}</p>
          </div>
        )}

        {!loading && appt && (() => {
          const st = STATUS[appt.status] || STATUS.scheduled;
          const StIcon = st.Icon;
          return (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {/* Cabecera con degradado de marca */}
              <div className="bg-gradient-to-r from-[#0f2f4f] via-[#1e6f9f] to-[#36c1d6] text-white px-6 py-5">
                <p className="text-blue-100 text-xs uppercase tracking-wide">{t('publicAppointment.inviteLabel')}</p>
                <h1 className="text-2xl font-bold mt-1">{t('publicAppointment.greeting', { name: appt.user_name })}</h1>
                <span className={`inline-flex items-center gap-1 mt-3 text-xs px-2.5 py-1 rounded-full font-medium ${st.cls}`}>
                  <StIcon className="w-3.5 h-3.5" /> {t(`status.${appt.status}`)}
                </span>
              </div>

              {/* Fecha y hora */}
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3 text-gray-800">
                  <Calendar className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-base font-medium">{fmtDate(appt.date)}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-800 mt-2">
                  <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                  <span className="text-base font-medium">{appt.time} h</span>
                </div>
              </div>

              {/* Médico y motivo */}
              <div className="px-6 py-5 space-y-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{t('publicAppointment.yourDoctor')}</p>
                  <p className="text-sm text-gray-800 mt-0.5">Dr. {appt.doctor_name}</p>
                  <p className="text-xs text-gray-500">{appt.doctor_specialty}</p>
                </div>
                {appt.reason && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">{t('publicAppointment.reason')}</p>
                    <p className="text-sm text-gray-800 mt-0.5">{appt.reason}</p>
                  </div>
                )}
              </div>

              {/* Indicaciones */}
              <div className="bg-blue-50 px-6 py-4">
                <p className="text-xs text-blue-800 flex items-start gap-2">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                  {t('publicAppointment.arriveNote')}
                </p>
              </div>

              {/* Código */}
              <div className="px-6 py-3 text-center border-t border-gray-100">
                <p className="text-[11px] text-gray-400">{t('publicAppointment.appointmentCode')}</p>
                <p className="text-sm font-bold text-gray-700 tracking-widest">{appt.public_code}</p>
              </div>
            </div>
          );
        })()}

        <p className="text-center text-xs text-gray-400 mt-5">{t('publicAppointment.tagline')}</p>
      </div>
    </div>
  );
}
