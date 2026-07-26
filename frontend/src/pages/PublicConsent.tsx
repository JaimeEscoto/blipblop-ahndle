import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api, PublicConsent as PublicConsentData } from '../api/client';
import SignaturePad from '../components/SignaturePad';
import { FileSignature, CheckCircle2, XCircle } from 'lucide-react';

export default function PublicConsent() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<PublicConsentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [signerName, setSignerName] = useState('');
  const [signerDocument, setSignerDocument] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [justSigned, setJustSigned] = useState(false);

  useEffect(() => {
    if (!code) return;
    api.consents.getPublic(code)
      .then(d => { setData(d); setSignerName(d.user_name || ''); })
      .catch(() => setLoadError('Este enlace no es válido o ya expiró.'))
      .finally(() => setLoading(false));
  }, [code]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!signerName.trim()) { setSubmitError('Escribe el nombre de quien firma.'); return; }
    if (!signature) { setSubmitError('Firma en el recuadro antes de continuar.'); return; }
    setSubmitting(true);
    try {
      const result = await api.consents.signPublic(code!, {
        signer_name: signerName.trim(),
        signer_document: signerDocument.trim() || undefined,
        signature_data_url: signature,
      });
      setData(d => d ? { ...d, status: result.status, signed_at: result.signed_at, signer_name: signerName.trim() } : d);
      setJustSigned(true);
    } catch (e: any) {
      setSubmitError(e.message || 'No se pudo guardar la firma.');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-blue-50 to-gray-100 flex flex-col items-center p-4">
      <img src="/icono.png" alt="" aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vw,560px)] max-w-none opacity-[0.07]" />
      <div className="relative z-10 w-full max-w-lg py-6">
        <div className="flex justify-center mb-5">
          <span className="bg-white rounded-xl shadow-sm p-3 flex items-center justify-center">
            <img src="/icono.png" alt="odontiacloud" className="h-14 w-14 object-contain block" />
          </span>
        </div>

        {loading && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center text-gray-400">Cargando…</div>
        )}

        {!loading && loadError && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">{loadError}</p>
          </div>
        )}

        {!loading && data && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#0f2f4f] via-[#1e6f9f] to-[#36c1d6] text-white px-6 py-5">
              <p className="text-blue-100 text-xs uppercase tracking-wide">{data.clinic_name}</p>
              <h1 className="text-xl font-bold mt-1 flex items-center gap-2">
                <FileSignature className="w-5 h-5 shrink-0" /> {data.title}
              </h1>
            </div>

            {data.status === 'signed' ? (
              <div className="px-6 py-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-gray-800 font-medium">Documento firmado</p>
                <p className="text-sm text-gray-500 mt-1">
                  {data.signer_name}
                  {data.signed_at && <> · {fmtDateTime(data.signed_at)}</>}
                </p>
                {justSigned && (
                  <p className="text-xs text-green-600 mt-3">Gracias, tu firma quedó registrada correctamente.</p>
                )}
              </div>
            ) : (
              <div>
                <div className="px-6 py-4 border-b border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Lee el documento completo antes de firmar:</p>
                  {data.pdf_view_url ? (
                    <iframe src={data.pdf_view_url} title={data.title}
                      className="w-full h-[60vh] border border-gray-200 rounded-lg bg-gray-50" />
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-8">No se pudo cargar el documento.</p>
                  )}
                </div>

                <form onSubmit={submit} className="px-6 py-5 space-y-3">
                  {submitError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{submitError}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Nombre de quien firma *</label>
                      <input required className="input" value={signerName} onChange={e => setSignerName(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 mb-1 block">Documento (opcional)</label>
                      <input className="input" value={signerDocument} onChange={e => setSignerDocument(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Firma *</label>
                    <SignaturePad onChange={setSignature} />
                  </div>
                  <button type="submit" disabled={submitting}
                    className="w-full py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                    {submitting ? 'Guardando…' : 'Firmar'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-5">odontiacloud · gestión para clínicas dentales</p>
      </div>
    </div>
  );
}
