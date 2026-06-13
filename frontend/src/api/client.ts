const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
  return data as T;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  document_id: string | null;
  created_at: string;
}

export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  email: string;
  phone: string | null;
  license_number: string | null;
  created_at: string;
}

export interface Appointment {
  id: number;
  user_id: number;
  doctor_id: number;
  date: string;
  time: string;
  reason: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  doctor_name: string;
  doctor_specialty: string;
}

export const api = {
  users: {
    list: () => request<User[]>('/users'),
    create: (data: Omit<User, 'id' | 'created_at'>) =>
      request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Omit<User, 'id' | 'created_at'>) =>
      request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/users/${id}`, { method: 'DELETE' }),
  },
  doctors: {
    list: () => request<Doctor[]>('/doctors'),
    create: (data: Omit<Doctor, 'id' | 'created_at'>) =>
      request<Doctor>('/doctors', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Omit<Doctor, 'id' | 'created_at'>) =>
      request<Doctor>(`/doctors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/doctors/${id}`, { method: 'DELETE' }),
  },
  appointments: {
    list: () => request<Appointment[]>('/appointments'),
    create: (data: { user_id: number; doctor_id: number; date: string; time: string; reason?: string; notes?: string }) =>
      request<Appointment>('/appointments', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { user_id: number; doctor_id: number; date: string; time: string; reason?: string; status: string; notes?: string }) =>
      request<Appointment>(`/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: number, status: string) =>
      request<Appointment>(`/appointments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    delete: (id: number) => request<void>(`/appointments/${id}`, { method: 'DELETE' }),
  },
};
