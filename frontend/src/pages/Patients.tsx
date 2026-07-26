import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { api, User, Doctor, ClinicalRecord, MedicalInfo, PatientBalance } from '../api/client';
import Attachments from '../components/Attachments';
import Consents from '../components/Consents';
import TreatmentsTab from '../components/TreatmentsTab';
import {
  Plus, Pencil, Trash2, Search, Upload, Download, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Paperclip, Receipt, Activity,
} from 'lucide-react';
import { formatMoney } from '../utils/money';
import { COUNTRIES, findCountry } from '../data/countries';
import { withSlug } from '../tenant';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Odontogram from '../components/Odontogram';

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
  departamento: 'department', depto: 'department', provincia: 'department',
  municipio: 'city', ciudad: 'city',
  pais: 'country', país: 'country',
  tipo_sangre: 'blood_type', sangre: 'blood_type', grupo_sanguineo: 'blood_type',
  alergias: 'allergies',
  contacto_emergencia: 'emergency_contact', emergencia_contacto: 'emergency_contact',
  telefono_emergencia: 'emergency_phone', tel_emergencia: 'emergency_phone', emergencia_telefono: 'emergency_phone',
};

const TEMPLATE_HEADERS = ['nombre', 'tipo_documento', 'documento', 'fecha_nacimiento', 'genero', 'ocupacion', 'telefono', 'email', 'direccion', 'pais', 'departamento', 'municipio', 'tipo_sangre', 'alergias', 'contacto_emergencia', 'telefono_emergencia'];

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

const DOC_TYPES = ['Identidad', 'RTN', 'Pasaporte', 'Carné de menor', 'Otro'];
const GENDERS = ['Masculino', 'Femenino', 'Otro'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const EMPTY_DEMOGRAPHICS = {
  name: '', email: '', phone: '', document_id: '', document_type: 'Identidad',
  birth_date: '', gender: '', address: '', city: '', department: '', country: '', occupation: '',
};

// ── Campos demográficos, reutilizados tanto en la pestaña "Datos" como en el alta rápida ──
function DemographicFields({ form, set }: { form: any; set: (k: string, v: string) => void }) {
  const { t } = useTranslation();
  const country = findCountry(form.country);
  const divisionLabel = country?.divisionLabel || t('patients.department');
  const age = (() => {
    if (!form.birth_date) return null;
    const d = new Date(form.birth_date + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  })();

  return (
    <>
      <div>
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('patients.fullName')} *</label>
        <input required className="input" value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder={t('patients.fullNamePlaceholder')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('patients.documentType')}</label>
          <select className="input" value={form.document_type || 'Identidad'} onChange={e => set('document_type', e.target.value)}>
            {DOC_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('patients.documentNumber')}</label>
          <input className="input" value={form.document_id || ''} onChange={e => set('document_id', e.target.value)} placeholder={t('patients.documentNumberPlaceholder')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
            {t('patients.birthDate')}{age !== null && <span className="text-gray-400 dark:text-gray-500 font-normal"> ({t('patients.yearsOld', { count: age })})</span>}
          </label>
          <input type="date" className="input" value={form.birth_date || ''} onChange={e => set('birth_date', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('patients.gender')}</label>
          <select className="input" value={form.gender || ''} onChange={e => set('gender', e.target.value)}>
            <option value="">{t('common.select')}</option>
            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('patients.occupation')}</label>
        <input className="input" value={form.occupation || ''} onChange={e => set('occupation', e.target.value)} placeholder={t('patients.occupationPlaceholder')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('patients.phone')}</label>
          <input className="input" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+504 9999 9999" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('patients.email')}</label>
          <input type="email" className="input" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder={t('patients.emailPlaceholder')} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('patients.address')}</label>
        <input className="input" value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder={t('patients.addressPlaceholder')} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">País</label>
          <select className="input" value={form.country || ''} onChange={e => {
            const code = e.target.value;
            const c = findCountry(code);
            const divs = c?.divisions || [];
            set('country', code);
            if (!divs.includes(form.department)) set('department', '');
          }}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{divisionLabel}</label>
          <select className="input" value={form.department || ''} onChange={e => set('department', e.target.value)}>
            <option value="">{t('common.select')}</option>
            {(country?.divisions || []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('patients.city')}</label>
          <input className="input" value={form.city || ''} onChange={e => set('city', e.target.value)} placeholder={t('patients.cityPlaceholder')} />
        </div>
      </div>
    </>
  );
}

export default function Patients() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Lista + finanzas
  const [users, setUsers] = useState<User[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');
  const [balances, setBalances] = useState<Record<number, PatientBalance>>({});
  const [currency, setCurrency] = useState('HNL');
  const [defaultCountry, setDefaultCountry] = useState('HN');

  // Expediente expandido: pestaña activa + datos clínicos cargados perezosamente
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'data' | 'history' | 'info' | 'odontogram' | 'treatments' | 'files' | 'consents'>('data');
  const [records, setRecords] = useState<Record<number, ClinicalRecord[]>>({});
  const [medicalInfos, setMedicalInfos] = useState<Record<number, MedicalInfo | null>>({});
  const [openChart, setOpenChart] = useState<number | null>(null);
  const [openFiles, setOpenFiles] = useState<number | null>(null);

  // Pestaña "Datos": edición inline de los datos demográficos del paciente expandido
  const [demoForm, setDemoForm] = useState<any>({});
  const [demoError, setDemoError] = useState('');
  const [demoSaving, setDemoSaving] = useState(false);

  // Modal de historial clínico / datos médicos (dentro del expediente)
  const [modal, setModal] = useState<{ type: 'record' | 'info'; userId: number; record?: ClinicalRecord } | null>(null);
  const [form, setForm] = useState<any>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteRecordId, setDeleteRecordId] = useState<number | null>(null);

  // Alta de paciente nuevo (aún sin expediente que expandir)
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ ...EMPTY_DEMOGRAPHICS });
  const [createError, setCreateError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
  const [deletePatientId, setDeletePatientId] = useState<number | null>(null);

  // Importación CSV
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<{ ok: number; fail: { name: string; reason: string }[] } | null>(null);

  const load = useCallback(async () => {
    const [u, d, bs, s] = await Promise.all([
      api.users.list(),
      api.doctors.list(),
      api.finance.balances().catch(() => [] as (PatientBalance & { user_id: number })[]),
      api.finance.settings().catch(() => ({ currency: 'HNL', tax_rate: 0, next_invoice_number: 1, default_country: 'HN' })),
    ]);
    setUsers(u);
    setDoctors(d);
    setBalances(Object.fromEntries(bs.map(b => [b.user_id, b])));
    setCurrency(s.currency);
    setDefaultCountry(s.default_country || 'HN');
    return u;
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadUserData = async (userId: number) => {
    if (records[userId]) return;
    const [recs, info] = await Promise.all([api.medical.getRecords(userId), api.medical.getInfo(userId)]);
    setRecords(r => ({ ...r, [userId]: recs }));
    setMedicalInfos(m => ({ ...m, [userId]: info }));
  };

  // Expande el expediente de un paciente y precarga su pestaña "Datos" con lo que ya tenemos en memoria.
  const expandUser = (u: User) => {
    setExpandedUser(u.id);
    setActiveTab('data');
    setDemoForm({
      name: u.name, email: u.email || '', phone: u.phone || '', document_id: u.document_id || '',
      document_type: u.document_type || 'Identidad', birth_date: u.birth_date || '', gender: u.gender || '',
      address: u.address || '', city: u.city || '', department: u.department || '',
      country: u.country || defaultCountry, occupation: u.occupation || '',
    });
    setDemoError('');
    loadUserData(u.id);
  };

  const toggleUser = (u: User) => {
    if (expandedUser === u.id) { setExpandedUser(null); return; }
    expandUser(u);
  };

  // ?user=ID → abre directamente el expediente de ese paciente (ej. desde una factura en Finanzas)
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || users.length === 0) return;
    deepLinkHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user');
    if (!userParam) return;
    const u = users.find(x => x.id === Number(userParam));
    if (u) expandUser(u);
    const url = new URL(window.location.href);
    url.searchParams.delete('user');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  // ── Guardar cambios de la pestaña "Datos" ──
  const saveDemoData = async (userId: number) => {
    setDemoError(''); setDemoSaving(true);
    try {
      const updated = await api.users.update(userId, {
        name: demoForm.name, email: demoForm.email || null, phone: demoForm.phone || null,
        document_id: demoForm.document_id || null, document_type: demoForm.document_type || null,
        birth_date: demoForm.birth_date || null, gender: demoForm.gender || null,
        address: demoForm.address || null, city: demoForm.city || null, department: demoForm.department || null,
        country: demoForm.country || null, occupation: demoForm.occupation || null,
      } as any);
      setUsers(list => list.map(x => x.id === userId ? updated : x));
    } catch (e: any) { setDemoError(e.message); }
    finally { setDemoSaving(false); }
  };

  // ── Alta de paciente nuevo ──
  const openCreate = () => {
    setCreateForm({ ...EMPTY_DEMOGRAPHICS, country: defaultCountry });
    setCreateError(''); setCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreateError(''); setCreateSaving(true);
    try {
      const created = await api.users.create({
        name: createForm.name, email: createForm.email || null, phone: createForm.phone || null,
        document_id: createForm.document_id || null, document_type: createForm.document_type || null,
        birth_date: createForm.birth_date || null, gender: createForm.gender || null,
        address: createForm.address || null, city: createForm.city || null, department: createForm.department || null,
        country: createForm.country || null, occupation: createForm.occupation || null,
      } as any);
      setCreateOpen(false);
      await load();
      // Deja el expediente recién creado ya abierto, listo para completar historial/tratamientos.
      setExpandedUser(created.id);
      setActiveTab('data');
      setDemoForm({
        name: created.name, email: created.email || '', phone: created.phone || '', document_id: created.document_id || '',
        document_type: created.document_type || 'Identidad', birth_date: created.birth_date || '', gender: created.gender || '',
        address: created.address || '', city: created.city || '', department: created.department || '',
        country: created.country || defaultCountry, occupation: created.occupation || '',
      });
    } catch (e: any) { setCreateError(e.message); }
    finally { setCreateSaving(false); }
  };

  const handleDeletePatient = async () => {
    if (!deletePatientId) return;
    await api.users.delete(deletePatientId);
    if (expandedUser === deletePatientId) setExpandedUser(null);
    await load();
    setDeletePatientId(null);
  };

  // ── Historial clínico / datos médicos (modal) ──
  const openRecord = (userId: number, record?: ClinicalRecord) => {
    setForm(record ? {
      doctor_id: String(record.doctor_id), date: record.date,
      diagnosis: record.diagnosis || '', treatment: record.treatment || '',
      observations: record.observations || '', tooth_chart: record.tooth_chart || {}
    } : {
      doctor_id: '', date: new Date().toISOString().split('T')[0],
      diagnosis: '', treatment: '', observations: '', tooth_chart: {}
    });
    setError(''); setModal({ type: 'record', userId, record });
  };

  const openInfo = (userId: number) => {
    const info = medicalInfos[userId];
    setForm(info ? {
      blood_type: info.blood_type || '', allergies: info.allergies || '',
      medical_conditions: info.medical_conditions || '', current_medications: info.current_medications || '',
      emergency_contact: info.emergency_contact || '', emergency_phone: info.emergency_phone || ''
    } : { blood_type: '', allergies: '', medical_conditions: '', current_medications: '', emergency_contact: '', emergency_phone: '' });
    setError(''); setModal({ type: 'info', userId });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (modal?.type === 'info') {
        const info = await api.medical.saveInfo(modal.userId, form);
        setMedicalInfos(m => ({ ...m, [modal.userId]: info }));
      } else {
        const payload = { ...form, user_id: modal!.userId, doctor_id: Number(form.doctor_id) };
        if (modal?.record) {
          const updated = await api.medical.updateRecord(modal.record.id, payload);
          setRecords(r => ({ ...r, [modal.userId]: r[modal.userId].map(x => x.id === updated.id ? updated : x) }));
        } else {
          const created = await api.medical.createRecord(payload);
          setRecords(r => ({ ...r, [modal!.userId]: [created, ...(r[modal!.userId] || [])] }));
        }
      }
      setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDeleteRecord = async () => {
    if (!deleteRecordId || !expandedUser) return;
    await api.medical.deleteRecord(deleteRecordId);
    setRecords(r => ({ ...r, [expandedUser]: r[expandedUser].filter(x => x.id !== deleteRecordId) }));
    setDeleteRecordId(null);
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

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.document_id || '').includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('patients.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('patients.registeredCount', { count: users.length })}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openImport} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
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
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('patients.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">{t('patients.noneFound')}</div>
        )}
        {filtered.map(u => (
          <div key={u.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="w-full flex items-center gap-2 p-4">
              <button className="flex-1 min-w-0 text-left" onClick={() => toggleUser(u)}>
                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{u.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{u.document_id || u.email || u.phone || '—'}</p>
              </button>
              {balances[u.id] && balances[u.id].balance > 0 && (
                <span className="shrink-0 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded-full whitespace-nowrap">
                  {formatMoney(balances[u.id].balance, currency)}
                </span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setDeletePatientId(u.id)} title={t('common.delete')} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => toggleUser(u)} className="p-1.5 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg">
                  {expandedUser === u.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {expandedUser === u.id && (
              <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4">
                {/* Tabs */}
                <div className="flex gap-1 my-3 bg-gray-100 dark:bg-gray-900/40 rounded-lg p-1 overflow-x-auto">
                  {(['data', 'history', 'info', 'odontogram', 'treatments', 'files', 'consents'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-white dark:bg-gray-700 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                      {tab === 'data' ? 'Datos'
                        : tab === 'history' ? t('records.tabHistory')
                        : tab === 'info' ? t('records.tabInfo')
                        : tab === 'odontogram' ? t('records.tabOdontogram')
                        : tab === 'treatments' ? 'Tratamientos'
                        : tab === 'files' ? t('records.tabFiles')
                        : 'Consentimientos'}
                    </button>
                  ))}
                </div>

                {activeTab === 'data' && (
                  <form onSubmit={e => { e.preventDefault(); saveDemoData(u.id); }} className="space-y-3">
                    {demoError && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/40 rounded-lg px-3 py-2">{demoError}</p>}
                    <DemographicFields form={demoForm} set={(k, v) => setDemoForm((f: any) => ({ ...f, [k]: v }))} />
                    <div className="flex justify-end pt-1">
                      <button type="submit" disabled={demoSaving} className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                        {demoSaving ? t('common.saving') : t('common.save')}
                      </button>
                    </div>
                  </form>
                )}

                {activeTab === 'history' && (
                  <div>
                    <button onClick={() => openRecord(u.id)} className="flex items-center gap-1.5 mb-3 text-sm text-blue-600 dark:text-blue-300 font-medium hover:underline">
                      <Plus className="w-4 h-4" /> {t('records.newEntry')}
                    </button>
                    {(records[u.id] || []).length === 0
                      ? <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">{t('records.noHistory')}</p>
                      : (records[u.id] || []).map(r => (
                        <div key={r.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 mb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{r.date} · Dr. {r.doctor_name}</p>
                              {r.diagnosis && <p className="text-sm font-medium mt-1 text-gray-800 dark:text-gray-100">{r.diagnosis}</p>}
                              {r.treatment && <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5">{t('records.treatmentLabel', { value: r.treatment })}</p>}
                              {r.observations && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">{r.observations}</p>}
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => openRecord(u.id, r)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setDeleteRecordId(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                          {r.invoice_id && (
                            <div className="mt-2 pt-2 border-t border-gray-50 dark:border-gray-700">
                              <button
                                type="button"
                                onClick={() => navigate(`${withSlug('/finanzas')}?invoice=${r.invoice_id}`)}
                                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-300 font-medium hover:underline"
                                title="Ver factura asociada a esta cita"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                Ver factura #{String(r.invoice_number).padStart(4, '0')}
                              </button>
                            </div>
                          )}
                          {r.tooth_chart && Object.keys(r.tooth_chart).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-50 dark:border-gray-700">
                              <button onClick={() => setOpenChart(openChart === r.id ? null : r.id)}
                                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-300 font-medium hover:underline">
                                <Activity className="w-3.5 h-3.5" />
                                {openChart === r.id ? t('records.hideChart') : t('records.showChart')}
                              </button>
                              {openChart === r.id && (
                                <div className="mt-3">
                                  <Odontogram value={r.tooth_chart} onChange={() => {}} readOnly />
                                </div>
                              )}
                            </div>
                          )}
                          <div className="mt-2 pt-2 border-t border-gray-50 dark:border-gray-700">
                            <button onClick={() => setOpenFiles(openFiles === r.id ? null : r.id)}
                              className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-300 font-medium hover:underline">
                              <Paperclip className="w-3.5 h-3.5" />
                              {openFiles === r.id ? t('records.hideFiles') : t('records.showFiles')}
                            </button>
                            {openFiles === r.id && (
                              <div className="mt-3">
                                <Attachments userId={u.id} recordId={r.id} compact />
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {activeTab === 'info' && (
                  <div>
                    <button onClick={() => openInfo(u.id)} className="flex items-center gap-1.5 mb-3 text-sm text-blue-600 dark:text-blue-300 font-medium hover:underline">
                      <Pencil className="w-4 h-4" /> {t('records.editMedical')}
                    </button>
                    {medicalInfos[u.id] ? (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {[
                          [t('records.bloodType'), medicalInfos[u.id]?.blood_type],
                          [t('records.allergies'), medicalInfos[u.id]?.allergies],
                          [t('records.conditionsShort'), medicalInfos[u.id]?.medical_conditions],
                          [t('records.medicationsShort'), medicalInfos[u.id]?.current_medications],
                          [t('records.emergencyContactShort'), medicalInfos[u.id]?.emergency_contact],
                          [t('records.emergencyPhoneShort'), medicalInfos[u.id]?.emergency_phone],
                        ].map(([label, val]) => val ? (
                          <div key={label as string} className="col-span-2 sm:col-span-1">
                            <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{val}</p>
                          </div>
                        ) : null)}
                      </div>
                    ) : <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">{t('records.noMedical')}</p>}
                  </div>
                )}

                {activeTab === 'odontogram' && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{t('records.lastChart')}</p>
                    {(records[u.id] || []).length > 0
                      ? <Odontogram value={records[u.id][0].tooth_chart || {}} onChange={() => {}} readOnly />
                      : <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">{t('records.noChart')}</p>
                    }
                  </div>
                )}

                {activeTab === 'treatments' && (
                  <TreatmentsTab userId={u.id} doctors={doctors} currency={currency} />
                )}

                {activeTab === 'files' && (
                  <div className="pt-1">
                    <Attachments userId={u.id} />
                  </div>
                )}

                {activeTab === 'consents' && (
                  <div className="pt-1">
                    <Consents user={u} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {createOpen && (
        <Modal title={t('patients.createTitle')} onClose={() => setCreateOpen(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            {createError && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/40 rounded-lg px-3 py-2">{createError}</p>}
            <DemographicFields form={createForm} set={(k, v) => setCreateForm(f => ({ ...f, [k]: v }))} />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={createSaving} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {createSaving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modal && (
        <Modal
          title={modal.type === 'info' ? t('records.infoTitle') : modal.record ? t('records.editEntry') : t('records.newEntryTitle')}
          onClose={() => setModal(null)}
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/40 rounded-lg px-3 py-2">{error}</p>}

            {modal.type === 'info' ? (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('records.bloodType')}</label>
                  <select className="input" value={form.blood_type} onChange={e => setForm({ ...form, blood_type: e.target.value })}>
                    <option value="">{t('common.select')}</option>
                    {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                {[
                  ['allergies', t('records.allergies'), t('records.allergiesPlaceholder')],
                  ['medical_conditions', t('records.conditions'), t('records.conditionsPlaceholder')],
                  ['current_medications', t('records.medications'), t('records.medicationsPlaceholder')],
                  ['emergency_contact', t('records.emergencyContact'), t('records.emergencyContactPlaceholder')],
                  ['emergency_phone', t('records.emergencyPhone'), t('records.emergencyPhonePlaceholder')],
                ].map(([field, label, placeholder]) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{label}</label>
                    <input className="input" placeholder={placeholder} value={form[field] || ''}
                      onChange={e => setForm({ ...form, [field]: e.target.value })} />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('records.doctor')} *</label>
                    <select required className="input" value={form.doctor_id} onChange={e => setForm({ ...form, doctor_id: e.target.value })}>
                      <option value="">{t('common.select')}</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('records.date')} *</label>
                    <input required type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('records.diagnosis')}</label>
                  <input className="input" value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} placeholder={t('records.diagnosisPlaceholder')} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('records.treatment')}</label>
                  <input className="input" value={form.treatment} onChange={e => setForm({ ...form, treatment: e.target.value })} placeholder={t('records.treatmentPlaceholder')} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">{t('records.observations')}</label>
                  <textarea className="input resize-none" rows={2} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} placeholder={t('records.observationsPlaceholder')} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">{t('records.tabOdontogram')}</label>
                  <Odontogram value={form.tooth_chart || {}} onChange={tc => setForm({ ...form, tooth_chart: tc })} />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">{t('common.cancel')}</button>
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
            {importError && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/40 rounded-lg px-3 py-2">{importError}</p>}

            {importDone ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/40 rounded-lg px-3 py-2.5">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('patients.importedCount', { count: importDone.ok })}</span>
                </div>
                {importDone.fail.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-300 mb-1"><AlertCircle className="w-4 h-4" />{t('patients.withError', { count: importDone.fail.length })}</p>
                    <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5 max-h-32 overflow-y-auto">
                      {importDone.fail.map((f, i) => <li key={i}>• {f.name}: {f.reason}</li>)}
                    </ul>
                  </div>
                )}
                <button onClick={() => setImportOpen(false)} className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">{t('common.done')}</button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('patients.importIntro')} <span className="font-medium">{t('patients.nameWord')}</span>.</p>
                <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-300 font-medium hover:underline">
                  <Download className="w-4 h-4" /> {t('patients.downloadTemplate')}
                </button>

                <label className="block border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/30 dark:hover:bg-blue-900/20">
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{t('patients.chooseFile')}</span>
                  <input type="file" accept=".csv,text/csv" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                </label>

                {importRows.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-1">{t('patients.detectedCount', { count: importRows.length })}</p>
                    <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 max-h-32 overflow-y-auto">
                      {importRows.slice(0, 10).map((r, i) => <li key={i}>• {r.name}{r.document_id ? ` (${r.document_id})` : ''}</li>)}
                      {importRows.length > 10 && <li>{t('patients.andMore', { count: importRows.length - 10 })}</li>}
                    </ul>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setImportOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">{t('common.cancel')}</button>
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

      {deleteRecordId && <ConfirmDialog message={t('records.deleteConfirm')} onConfirm={handleDeleteRecord} onCancel={() => setDeleteRecordId(null)} />}

      {deletePatientId && (
        <ConfirmDialog
          message={t('patients.deleteConfirm')}
          onConfirm={handleDeletePatient}
          onCancel={() => setDeletePatientId(null)}
        />
      )}
    </div>
  );
}
