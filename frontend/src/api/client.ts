import { currentSlug, currentMode } from '../tenant';

const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

// Encabezado que indica al backend en qué clínica estamos.
// El backend también lee el Host, pero en dev (vite proxy) lo reescribe,
// así que enviamos el slug explícitamente desde el frontend.
function tenantHeaders(): Record<string, string> {
  const slug = currentMode() === 'superadmin' ? 'superadmin' : currentSlug();
  return slug ? { 'X-Clinic-Slug': slug } : {};
}

const TOKEN_KEY = 'clinic_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Callback que la app registra para cerrar sesión cuando el backend devuelve 401
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...tenantHeaders(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
    throw new Error('Sesión expirada');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data as T;
}

// Petición sin sesión (login/registro): NO dispara el cierre de sesión global
// en un 401, porque ahí un 401 significa "credenciales incorrectas".
async function publicRequest<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tenantHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data as T;
}

// GET sin sesión (verificación de slug, etc.)
async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: tenantHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data as T;
}

export interface User {
  id: number; name: string; email: string | null;
  phone: string | null; document_id: string | null;
  document_type: string | null; birth_date: string | null;
  gender: string | null; address: string | null;
  city: string | null; department: string | null;
  occupation: string | null; created_at: string;
}
export interface Doctor {
  id: number; name: string; specialty: string; email: string;
  phone: string | null; license_number: string | null; created_at: string;
}
export interface Appointment {
  id: number; user_id: number; doctor_id: number;
  date: string; time: string; reason: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null; created_at: string; public_code: string | null;
  user_name: string; user_email: string; user_phone: string | null;
  doctor_name: string; doctor_specialty: string;
}
export interface PublicAppointment {
  id: number; public_code: string; reason: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  date: string; time: string; user_name: string;
  doctor_name: string; doctor_specialty: string;
}
export interface MedicalInfo {
  id: number; user_id: number; blood_type: string | null;
  allergies: string | null; medical_conditions: string | null;
  current_medications: string | null; emergency_contact: string | null;
  emergency_phone: string | null; updated_at: string;
}
export interface ClinicalRecord {
  id: number; user_id: number; doctor_id: number;
  appointment_id: number | null; date: string; diagnosis: string | null;
  treatment: string | null; observations: string | null;
  tooth_chart: Record<string, string>; created_at: string;
  doctor_name: string;
}
export interface InventoryItem {
  id: number; name: string;
  category: 'material' | 'medication' | 'equipment' | 'product';
  quantity: number; unit: string; min_quantity: number;
  price: number | null; supplier: string | null; created_at: string;
}
export interface Reminder {
  id: number; title: string; description: string | null;
  date: string; time: string | null; type: 'task' | 'patient';
  status: 'pending' | 'done'; user_id: number | null;
  user_name: string | null; user_phone: string | null; created_at: string;
}

export interface Account {
  id: number; email: string; name: string | null;
  role: 'superuser' | 'clinic_admin' | 'staff';
  clinic_id: number | null;
  language: 'es' | 'en';
  is_shadow?: boolean;
}
export interface Clinic {
  id: number; slug: string; name: string;
  owner_email: string | null; created_at: string;
}
export interface DiscoverClinic {
  clinic_id: number; clinic_slug: string; clinic_name: string;
  role: 'superuser' | 'clinic_admin' | 'staff';
  token: string;
  account: Account;
}
export type DiscoverResponse =
  | { super: { token: string; account: Account } }
  | { clinics: DiscoverClinic[] };
export interface ClinicSummary extends Clinic {
  account_count: number;
  patient_count: number;
  appointment_count: number;
  last_activity_at: string | null;
}
export interface Invitation {
  id: number; email: string; status: 'pending' | 'accepted';
  invited_by: string | null; created_at: string; accepted_at: string | null;
  token: string | null;
}

export interface ActivityLog {
  id: number; clinic_id: number | null; account_id: number | null;
  account_email: string | null; account_name: string | null;
  action: string; entity: string | null; entity_id: string | null;
  summary: string; method: string | null; path: string | null;
  status_code: number | null; details: Record<string, any> | null;
  created_at: string; internal: boolean;
}
export interface ActivityAccount {
  account_email: string; account_name: string | null; events: number;
}

export const api = {
  auth: {
    google: (credential: string, language?: 'es' | 'en') => publicRequest<{ token: string; account: Account }>('/auth/google', { credential, language }),
    superGoogle: (credential: string) => publicRequest<{ token: string; account: Account }>('/auth/super/google', { credential }),
    discover: (credential: string) => publicRequest<DiscoverResponse>('/auth/discover', { credential }),
    login: (email: string, password: string) => publicRequest<{ token: string; account: Account }>('/auth/login', { email, password }),
    register: (token: string, name: string, password: string, language?: 'es' | 'en') => publicRequest<{ token: string; account: Account }>('/auth/register', { token, name, password, language }),
    getInvitation: (token: string) => request<{ email: string }>(`/auth/invitation/${token}`),
    me: () => request<{ account: Account; clinic: Clinic | null }>('/auth/me'),
    setLanguage: (language: 'es' | 'en') => request<{ account: Account }>('/auth/language', { method:'PUT', body:JSON.stringify({ language }) }),
  },
  clinics: {
    checkSlug: (slug: string) => publicGet<{ available: boolean; reason: 'taken' | 'invalid' | null }>(`/clinics/check-slug/${encodeURIComponent(slug)}`),
    create: (credential: string, slug: string, name: string) =>
      publicRequest<{ token: string; account: Account; clinic: Clinic }>('/clinics', { credential, slug, name }),
  },
  super: {
    clinics: () => request<ClinicSummary[]>('/super/clinics'),
    activity: (params?: { clinic_id?: number; account?: string; entity?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.clinic_id) q.set('clinic_id', String(params.clinic_id));
      if (params?.account) q.set('account', params.account);
      if (params?.entity) q.set('entity', params.entity);
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return request<(ActivityLog & { clinic_slug: string | null; clinic_name: string | null })[]>(`/super/activity${qs ? `?${qs}` : ''}`);
    },
  },
  invitations: {
    list: () => request<Invitation[]>('/invitations'),
    create: (email: string) => request<Invitation>('/invitations', { method:'POST', body:JSON.stringify({ email }) }),
    delete: (id: number) => request<void>(`/invitations/${id}`, { method:'DELETE' }),
  },
  activity: {
    list: (params?: { account?: string; entity?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.account) q.set('account', params.account);
      if (params?.entity) q.set('entity', params.entity);
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return request<ActivityLog[]>(`/activity${qs ? `?${qs}` : ''}`);
    },
    accounts: () => request<ActivityAccount[]>('/activity/accounts'),
  },
  admin: {
    // Descarga el respaldo SQL como archivo (no es JSON, por eso no usa request()).
    backup: async (): Promise<{ blob: Blob; filename: string }> => {
      const token = getToken();
      const res = await fetch(`${BASE}/admin/backup`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) { clearToken(); onUnauthorized?.(); throw new Error('Sesión expirada'); }
      if (!res.ok) throw new Error('No se pudo generar el respaldo');
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition') || '';
      const m = disp.match(/filename="?([^"]+)"?/);
      return { blob, filename: m?.[1] || 'backup.sql' };
    },
  },
  users: {
    list: () => request<User[]>('/users'),
    create: (d: Omit<User,'id'|'created_at'>) => request<User>('/users', { method:'POST', body:JSON.stringify(d) }),
    update: (id: number, d: Omit<User,'id'|'created_at'>) => request<User>(`/users/${id}`, { method:'PUT', body:JSON.stringify(d) }),
    delete: (id: number) => request<void>(`/users/${id}`, { method:'DELETE' }),
  },
  doctors: {
    list: () => request<Doctor[]>('/doctors'),
    create: (d: Omit<Doctor,'id'|'created_at'>) => request<Doctor>('/doctors', { method:'POST', body:JSON.stringify(d) }),
    update: (id: number, d: Omit<Doctor,'id'|'created_at'>) => request<Doctor>(`/doctors/${id}`, { method:'PUT', body:JSON.stringify(d) }),
    delete: (id: number) => request<void>(`/doctors/${id}`, { method:'DELETE' }),
  },
  appointments: {
    list: () => request<Appointment[]>('/appointments'),
    create: (d: any) => request<Appointment>('/appointments', { method:'POST', body:JSON.stringify(d) }),
    update: (id: number, d: any) => request<Appointment>(`/appointments/${id}`, { method:'PUT', body:JSON.stringify(d) }),
    updateStatus: (id: number, status: string) => request<Appointment>(`/appointments/${id}/status`, { method:'PATCH', body:JSON.stringify({ status }) }),
    getPublic: (code: string) => request<PublicAppointment>(`/appointments/public/${code}`),
    delete: (id: number) => request<void>(`/appointments/${id}`, { method:'DELETE' }),
  },
  medical: {
    getInfo: (userId: number) => request<MedicalInfo | null>(`/medical/info/${userId}`),
    saveInfo: (userId: number, d: any) => request<MedicalInfo>(`/medical/info/${userId}`, { method:'POST', body:JSON.stringify(d) }),
    getRecords: (userId: number) => request<ClinicalRecord[]>(`/medical/records/${userId}`),
    createRecord: (d: any) => request<ClinicalRecord>('/medical/records', { method:'POST', body:JSON.stringify(d) }),
    updateRecord: (id: number, d: any) => request<ClinicalRecord>(`/medical/records/${id}`, { method:'PUT', body:JSON.stringify(d) }),
    deleteRecord: (id: number) => request<void>(`/medical/records/${id}`, { method:'DELETE' }),
  },
  inventory: {
    list: () => request<InventoryItem[]>('/inventory'),
    lowStock: () => request<InventoryItem[]>('/inventory/low-stock'),
    create: (d: any) => request<InventoryItem>('/inventory', { method:'POST', body:JSON.stringify(d) }),
    update: (id: number, d: any) => request<InventoryItem>(`/inventory/${id}`, { method:'PUT', body:JSON.stringify(d) }),
    updateQuantity: (id: number, quantity: number) => request<InventoryItem>(`/inventory/${id}/quantity`, { method:'PATCH', body:JSON.stringify({ quantity }) }),
    delete: (id: number) => request<void>(`/inventory/${id}`, { method:'DELETE' }),
  },
  reminders: {
    list: () => request<Reminder[]>('/reminders'),
    create: (d: any) => request<Reminder>('/reminders', { method:'POST', body:JSON.stringify(d) }),
    updateStatus: (id: number, status: string) => request<Reminder>(`/reminders/${id}/status`, { method:'PATCH', body:JSON.stringify({ status }) }),
    delete: (id: number) => request<void>(`/reminders/${id}`, { method:'DELETE' }),
  },
};
