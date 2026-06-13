import { useState, useEffect, useCallback } from 'react';
import { api, InventoryItem } from '../api/client';
import { Plus, Pencil, Trash2, Search, AlertTriangle, Package } from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const CATEGORIES = [
  { value: 'material',   label: 'Material dental',   color: 'bg-blue-100 text-blue-700' },
  { value: 'medication', label: 'Medicamento',        color: 'bg-green-100 text-green-700' },
  { value: 'equipment',  label: 'Equipo/Herramienta', color: 'bg-purple-100 text-purple-700' },
  { value: 'product',    label: 'Producto de venta',  color: 'bg-orange-100 text-orange-700' },
];

const EMPTY = { name:'', category:'material', quantity:'0', unit:'', min_quantity:'5', price:'', supplier:'' };

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [modal, setModal] = useState<{ type:'create'|'edit'|'qty'; item?: InventoryItem } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [newQty, setNewQty] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await api.inventory.list();
    setItems(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const lowStock = items.filter(i => Number(i.quantity) <= Number(i.min_quantity));

  const openCreate = () => { setForm(EMPTY); setError(''); setModal({ type:'create' }); };
  const openEdit = (item: InventoryItem) => {
    setForm({ name:item.name, category:item.category, quantity:String(item.quantity), unit:item.unit,
      min_quantity:String(item.min_quantity), price:item.price ? String(item.price) : '', supplier:item.supplier || '' });
    setError(''); setModal({ type:'edit', item });
  };
  const openQty = (item: InventoryItem) => { setNewQty(String(item.quantity)); setModal({ type:'qty', item }); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const payload = { ...form, quantity: Number(form.quantity), min_quantity: Number(form.min_quantity), price: form.price ? Number(form.price) : null };
      if (modal?.type === 'create') await api.inventory.create(payload);
      else if (modal?.type === 'edit') await api.inventory.update(modal.item!.id, payload);
      await load(); setModal(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleQty = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    await api.inventory.updateQuantity(modal!.item!.id, Number(newQty));
    await load(); setModal(null); setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await api.inventory.delete(deleteId);
    await load(); setDeleteId(null);
  };

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || (i.supplier || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || i.category === filterCat;
    return matchSearch && matchCat;
  });

  const getCatCfg = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500">{items.length} productos</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {/* Low stock warning */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Stock bajo — {lowStock.length} producto{lowStock.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-amber-600 mt-0.5">{lowStock.map(i => i.name).join(', ')}</p>
          </div>
        </div>
      )}

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar producto o proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[{ value:'all', label:'Todos' }, ...CATEGORIES].map(c => (
          <button key={c.value} onClick={() => setFilterCat(c.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterCat === c.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No se encontraron productos</div>}
        {filtered.map(item => {
          const isLow = Number(item.quantity) <= Number(item.min_quantity);
          const catCfg = getCatCfg(item.category);
          return (
            <div key={item.id} className={`bg-white rounded-xl border shadow-sm p-4 ${isLow ? 'border-amber-300' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    {isLow && <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><AlertTriangle className="w-3 h-3" />Stock bajo</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${catCfg.color}`}>{catCfg.label}</span>
                  <div className="flex items-center gap-3 mt-2 text-sm">
                    <span className={`font-bold text-lg ${isLow ? 'text-amber-600' : 'text-gray-800'}`}>
                      {Number(item.quantity)} <span className="text-xs font-normal text-gray-400">{item.unit}</span>
                    </span>
                    <span className="text-xs text-gray-400">mín. {Number(item.min_quantity)} {item.unit}</span>
                    {item.price && <span className="text-xs text-gray-400">${Number(item.price).toLocaleString()}</span>}
                  </div>
                  {item.supplier && <p className="text-xs text-gray-400 mt-0.5">Proveedor: {item.supplier}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openQty(item)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Ajustar cantidad">
                    <Package className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteId(item.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create/Edit modal */}
      {modal && modal.type !== 'qty' && (
        <Modal title={modal.type === 'create' ? 'Nuevo producto' : 'Editar producto'} onClose={() => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Nombre *</label>
              <input required className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Resina compuesta A2..." />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Categoría *</label>
              <select required className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Cantidad actual *</label>
                <input required type="number" min="0" className="input" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Unidad *</label>
                <input required className="input" value={form.unit} placeholder="unidades, ml, cajas..." onChange={e => setForm({...form, unit: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Cantidad mínima</label>
                <input type="number" min="0" className="input" value={form.min_quantity} onChange={e => setForm({...form, min_quantity: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Precio</label>
                <input type="number" min="0" className="input" value={form.price} placeholder="0" onChange={e => setForm({...form, price: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Proveedor</label>
              <input className="input" value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})} placeholder="Nombre del proveedor..." />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Quick qty modal */}
      {modal?.type === 'qty' && (
        <Modal title={`Ajustar cantidad — ${modal.item?.name}`} onClose={() => setModal(null)}>
          <form onSubmit={handleQty} className="space-y-4">
            <p className="text-sm text-gray-500">Cantidad actual: <strong>{modal.item?.quantity} {modal.item?.unit}</strong></p>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Nueva cantidad</label>
              <input required type="number" min="0" className="input text-lg" value={newQty} onChange={e => setNewQty(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button type="submit" disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Guardando...' : 'Actualizar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && <ConfirmDialog message="¿Eliminar este producto del inventario?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}
