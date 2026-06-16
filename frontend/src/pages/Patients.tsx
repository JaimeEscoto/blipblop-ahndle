import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api, User } from '../api/client';
import { Plus, Pencil, Trash2, Search, Phone, Mail, CreditCard, MapPin, Cake, Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

// --- Importación CSV ---
const HEADER_MAP: Record<string, string> = {
  nombre: 'name', nombre_completo: 'name', paciente: 'name',
  tipo_documento: 'document_type', documento_tipo: 'document_type', tipo_doc: 'document_type',
  documento: 'document_id', numero_documento: 'document_id', identidad: 'document_id', dni: 'document_id', no_documento: 'document_id',
  fecha_nacimiento: 'birth_date', nacimiento: 'birth_date', fecha_de_nacimiento: 'birth_date',
  genero: 'gender', sexo: 'gender',
  ocupacion: 'occupation', profesion: 'occupation',
  telefono: 'phone', celular: 'phone', tel: 'phone',
  email: 'email', correo: 'email',
  direccion: 'address', domicilio: 'address',
  departamento: 'department', depto: 'department',
  municipio: 'city', ciudad: 'city',
  tipo_sangre: 'blood_type', sangre: 'blood_type', grupo_sanguineo: 'blood_type',
  alergias: 'allergies',
  contacto_emergencia: 'emergency_contact', emergencia_contacto: 'emergency_contact',
  telefono_emergencia: 'emergency_phone', tel_emergencia: 'emergency_phone', emergencia_telefono: 'emergency_phone',
};

const TEMPLATE_HEADERS = ['nombre', 'tipo_documento', 'documento', 'fecha_nacimiento', 'genero', 'ocupacion', 'telefono', 'email', 'direccion', 'departamento', 'municipio', 'tipo_sangre', 'alergias', 'contacto_emergencia', 'telefono_emergencia'];

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',' || c === ';') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}

// Normaliza fechas dd/mm/yyyy → yyyy-mm-dd
const normalizeDate = (s: string) => {
  const t = s.trim();
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return t;
};

interface ImportRow { name: string; [k: string]: string }

const DEPARTMENTS = [
  'Atlántida', 'Choluteca', 'Colón', 'Comayagua', 'Copán', 'Cortés', 'El Paraíso',
  'Francisco Morazán', 'Gracias a Dios', 'Intibucá', 'Islas de la Bahía', 'La Paz',
  'Lempira', 'Ocotepeque', 'Olancho', 'Santa Bárbara', 'Valle', 'Yoro',
];
const DOC_TYPES = ['Identidad', 'RTN', 'Pasaporte', 'Carné de menor', 'Otro'];
const GENDERS = ['Masculino', 'Femenino', 'Otro'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const EMPTY = {
  name: '', email: '', phone: '', document_id: '', document_type: 'Identidad',
  birth_date: '', gender: '', address: '', city: '', department: '', occupation: '',
  // datos médicos (medical_info)
  blood_type: '', allergies: '', emergency_contact: '', emergency_phone: '',
  medical_conditions: '', current_medications: '',
};

export default function Patients() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ type: 'create' | 'edit'; user?: User } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Importación CSV
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<{ ok: number; fail: { name: string; reason: string }[] } | null>(null);

  const load = useCallback(async () => {
    setUsers(await api.users.list());
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => { setForm({ ...EMPTY }); setError(''); setModal({ type: 'create' }); };

  const openEdit = async (u: User) => {
    setForm({
      ...EMPTY,
      name: u.name, email: u.email || '', phone: u.phone || '', document_id: u.document_id || '',
      document_type: u.document_type || 'Identidad', birth_date: u.birth_date || '', gender: u.gender || '',
      address: u.address || '', city: u.city || '', department: u.department || '', occupation: u.occupation || '',
    });
    setError(''); setModal({ type: 'edit', user: u });
    // Carga los datos médicos existentes para no perderlos al guardar
    try {
      const info = await api.medical.getInfo(u.id);
      if (info) setForm(f => ({
        ...f,
        blood_type: info.blood_type || '', allergies: info.allergies || '',
        emergency_contact: info.emergency_contact || '', emergency_phone: info.emergency_phone || '',
        medical_conditions: info.medical_conditions || '', current_medications: info.current_medications || '',
      }));
    } catch { /* noop */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const userPayload = {
        name: form.name, email: form.email, phone: form.phone, document_id: form.document_id,
        document_type: form.document_type, birth_date: form.birth_date, gender: form.gender,
        address: form.address, city: form.city, department: form.department, occupation: form.occupation,
      };
      const userId = modal?.type === 'create'
        ? (await api.users.create(userPayload as any)).id
        : (await api.users.update(modal!.user!.id, userPayload as any)).id;

      // Guarda datos médicos básicos solo si hay algo que guardar
      const med = { blood_type: form.blood_type, allergies: form.allergies, emergency_contact: form.emergency_contact, emergency_phone: form.emergency_phone, medical_conditions: form.medical_conditions, current_medications: form.current_medications };
      if (Object.values(med).some(v => v && v.trim())) {
        await api.medical.saveInfo(userId, med);
      }
      await load();
      setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.users.delete(deleteId);
    await load(); setDeleteId(null);
  };

  // ── Importación CSV ──────────────────────────────────────
  const openImport = () => { setImportRows([]); setImportError(''); setImportDone(null); setImportOpen(true); };

  const downloadTemplate = () => {
    const example = ['Juan García López', 'Identidad', '0801-1990-12345', '1990-05-20', 'Masculino', 'Comerciante', '+504 9999 9999', 'juan@ejemplo.com', 'Col. Kennedy, calle 3, casa 12', 'Francisco Morazán', 'Tegucigalpa', 'O+', 'Penicilina', 'María López', '+504 8888 8888'];
    const csv = TEMPLATE_HEADERS.join(',') + '\n' + example.map(v => /[,;"\n]/.test(v) ? `"${v}"` : v).join(',') + '\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'plantilla_pacientes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file: File) => {
    setImportError(''); setImportDone(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const grid = parseCSV(String(reader.result));
        if (grid.length < 2) { setImportError(t('patients.errNoDataRows')); setImportRows([]); return; }
        const headers = grid[0].map(normalizeHeader).map(h => HEADER_MAP[h] || '');
        if (!headers.includes('name')) { setImportError(t('patients.errNoNameColumn')); setImportRows([]); return; }
        const parsed: ImportRow[] = [];
        for (let r = 1; r < grid.length; r++) {
          const obj: any = {};
          headers.forEach((key, c) => { if (key) obj[key] = (grid[r][c] || '').trim(); });
          if (!obj.name) continue;
          if (obj.birth_date) obj.birth_date = normalizeDate(obj.birth_date);
          parsed.push(obj);
        }
        if (parsed.length === 0) { setImportError(t('patients.errNoNamedPatients')); setImportRows([]); return; }
        setImportRows(parsed);
      } catch {
        setImportError(t('patients.errReadFile'));
      }
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    setImporting(true);
    const fail: { name: string; reason: string }[] = [];
    let ok = 0;
    for (const row of importRows) {
      try {
        const userPayload = {
          name: row.name, email: row.email || '', phone: row.phone || '', document_id: row.document_id || '',
          document_type: row.document_type || 'Identidad', birth_date: row.birth_date || '', gender: row.gender || '',
          address: row.address || '', city: row.city || '', department: row.department || '', occupation: row.occupation || '',
        };
        const created = await api.users.create(userPayload as any);
        const med = { blood_type: row.blood_type || '', allergies: row.allergies || '', emergency_contact: row.emergency_contact || '', emergency_phone: row.emergency_phone || '', medical_conditions: '', current_medications: '' };
        if (Object.values(med).some(v => v && v.trim())) {
          try { await api.medical.saveInfo(created.id, med); } catch { /* el paciente igual se creó */ }
        }
        ok++;
      } catch (e: any) {
        fail.push({ name: row.name, reason: e.message || t('patients.errGeneric') });
      }
    }
    setImporting(false);
    setImportDone({ ok, fail });
    setImportRows([]);
    await load();
  };

  const age = (b: string | null) => {
    if (!b) return null;
    const d = new Date(b + 'T00:00:00');
    return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.document_id || '').includes(search)
  );

  const field = (label: string, key: string, placeholder = '', type = 'text', required = false) => (
    <div>
      <label className="text-xs font-medium text-gray-700 mb-1 block">{label}{required && ' *'}</label>
      <input required={required} type={type} className="input" value={(form as any)[key] || ''} onChange={e => set(key, e.target.value)} placeholder={placeholder} />
    </div>
  );

  const sectionTitle = (t: string) => <p className="text-xs font-bold text-gray-400 uppercase tracking-wide pt-2">{t}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('patients.title')}</h1>
          <p className="text-sm text-gray-500">{t('patients.registeredCount', { count: users.length })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openImport} className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Upload className="w-4 h-4" /> {t('patients.import')}
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> {t('common.new')}
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('patients.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">{t('patients.noneFound')}</div>
        )}
        {filtered.map(u => {
          const a = age(u.birth_date);
          return (
            <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                  <div className="mt-1 space-y-0.5">
                    {u.document_id && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <CreditCard className="w-3.5 h-3.5 shrink-0" />
                        <span>{u.document_type || t('patients.doc')}: {u.document_id}</span>
                      </div>
                    )}
                    {u.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Phone className="w-3.5 h-3.5 shrink-0" /><span>{u.phone}</span>
                      </div>
                    )}
                    {u.email && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Mail className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{u.email}</span>
                      </div>
                    )}
                    {(u.city || u.department) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{[u.city, u.department].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    {a !== null && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Cake className="w-3.5 h-3.5 shrink-0" /><span>{t('patients.yearsOld', { count: a })}{u.gender ? ` · ${u.gender}` : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(u)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteId(u.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <Modal title={modal.type === 'create' ? t('patients.createTitle') : t('patients.editTitle')} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            {sectionTitle(t('patients.sectionGeneral'))}
            {field(t('patients.fullName'), 'name', t('patients.fullNamePlaceholder'), 'text', true)}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t('patients.documentType')}</label>
                <select className="input" value={form.document_type} onChange={e => set('document_type', e.target.value)}>
                  {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {field(t('patients.documentNumber'), 'document_id', t('patients.documentNumberPlaceholder'))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field(t('patients.birthDate'), 'birth_date', '', 'date')}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t('patients.gender')}</label>
                <select className="input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            {field(t('patients.occupation'), 'occupation', t('patients.occupationPlaceholder'))}

            {sectionTitle(t('patients.sectionContact'))}
            <div className="grid grid-cols-2 gap-3">
              {field(t('patients.phone'), 'phone', '+504 9999 9999')}
              {field(t('patients.email'), 'email', t('patients.emailPlaceholder'), 'email')}
            </div>
            {field(t('patients.address'), 'address', t('patients.addressPlaceholder'))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t('patients.department')}</label>
                <select className="input" value={form.department} onChange={e => set('department', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {field(t('patients.city'), 'city', t('patients.cityPlaceholder'))}
            </div>

            {sectionTitle(t('patients.sectionMedical'))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">{t('patients.bloodType')}</label>
                <select className="input" value={form.blood_type} onChange={e => set('blood_type', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {field(t('patients.allergies'), 'allergies', t('patients.allergiesPlaceholder'))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field(t('patients.emergencyContact'), 'emergency_contact', t('patients.emergencyContactPlaceholder'))}
              {field(t('patients.emergencyPhone'), 'emergency_phone', '+504 9999 9999')}
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {importOpen && (
        <Modal title={t('patients.importTitle')} onClose={() => setImportOpen(false)}>
          <div className="space-y-3">
            {importError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{importError}</p>}

            {importDone ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2.5">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('patients.importedCount', { count: importDone.ok })}</span>
                </div>
                {importDone.fail.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 mb-1"><AlertCircle className="w-4 h-4" />{t('patients.withError', { count: importDone.fail.length })}</p>
                    <ul className="text-xs text-amber-700 space-y-0.5 max-h-32 overflow-y-auto">
                      {importDone.fail.map((f, i) => <li key={i}>• {f.name}: {f.reason}</li>)}
                    </ul>
                  </div>
                )}
                <button onClick={() => setImportOpen(false)} className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">{t('common.done')}</button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600">{t('patients.importIntro')} <span className="font-medium">{t('patients.nameWord')}</span>.</p>
                <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline">
                  <Download className="w-4 h-4" /> {t('patients.downloadTemplate')}
                </button>

                <label className="block border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30">
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <span className="text-sm text-gray-600 font-medium">{t('patients.chooseFile')}</span>
                  <input type="file" accept=".csv,text/csv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                </label>

                {importRows.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-800 mb-1">{t('patients.detectedCount', { count: importRows.length })}</p>
                    <ul className="text-xs text-gray-500 space-y-0.5 max-h-32 overflow-y-auto">
                      {importRows.slice(0, 10).map((r, i) => <li key={i}>• {r.name}{r.document_id ? ` (${r.document_id})` : ''}</li>)}
                      {importRows.length > 10 && <li>{t('patients.andMore', { count: importRows.length - 10 })}</li>}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setImportOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
                  <button onClick={runImport} disabled={importRows.length === 0 || importing}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                    {importing ? t('patients.importing') : t('patients.importAction', { count: importRows.length || '' })}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          message={t('patients.deleteConfirm')}
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
