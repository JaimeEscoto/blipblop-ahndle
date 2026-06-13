import { useState, useEffect, useCallback } from 'react';
import { api, User } from '../api/client';
import { Plus, Pencil, Trash2, Search, Phone, Mail, CreditCard } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const EMPTY: Omit<User, 'id' | 'created_at'> = { name: '', email: '', phone: '', document_id: '' };

export default function Patients() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ type: 'create' | 'edit'; user?: User } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const data = await api.users.list();
    setUsers(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setError(''); setModal({ type: 'create' }); };
  const openEdit = (u: User) => { setForm({ name: u.name, email: u.email, phone: u.phone || '', document_id: u.document_id || '' }); setError(''); setModal({ type: 'edit', user: u }); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (modal?.type === 'create') await api.users.create(form);
      else await api.users.update(modal!.user!.id, form);
      await load();
      setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.users.delete(deleteId);
    await load();
    setDeleteId(null);
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.document_id || '').includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500">{users.length} registrados</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar por nombre, email o documento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No se encontraron pacientes</div>
        )}
        {filtered.map(u => (
          <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                <div className="mt-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  {u.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{u.phone}</span>
                    </div>
                  )}
                  {u.document_id && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <CreditCard className="w-3.5 h-3.5 shrink-0" />
                      <span>{u.document_id}</span>
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
        ))}
      </div>

      {modal && (
        <Modal title={modal.type === 'create' ? 'Nuevo Paciente' : 'Editar Paciente'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Nombre completo *</label>
              <input required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Juan García" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Email *</label>
              <input required type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="juan@ejemplo.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Teléfono</label>
              <input className="input" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+57 300 000 0000" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Documento de identidad</label>
              <input className="input" value={form.document_id || ''} onChange={e => setForm({ ...form, document_id: e.target.value })} placeholder="1234567890" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          message="¿Eliminar este paciente? También se eliminarán sus citas asociadas."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
