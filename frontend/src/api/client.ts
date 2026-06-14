const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

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
  id: number; email: string; name: string | null; role: 'superuser' | 'staff';
}
export interface Invitation {
  id: number; email: string; status: 'pending' | 'accepted';
  invited_by: string | null; created_at: string; accepted_at: string | null;
}

export const api = {
  auth: {
    google: (credential: string) => request<{ token: string; account: Account }>('/auth/google', { method:'POST', body:JSON.stringify({ credential }) }),
    me: () => request<{ account: Account }>('/auth/me'),
  },
  invitations: {
    list: () => request<Invitation[]>('/invitations'),
    create: (email: string) => request<Invitation>('/invitations', { method:'POST', body:JSON.stringify({ email }) }),
    delete: (id: number) => request<void>(`/invitations/${id}`, { method:'DELETE' }),
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
