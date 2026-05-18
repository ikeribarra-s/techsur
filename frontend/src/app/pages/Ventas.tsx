import { useState, useEffect } from "react";
import { toast } from "sonner";
import { api, parseDecimal } from "../api";
import type { Venta, Producto, Cliente } from "../api";
import { formatCurrency, formatDate } from "../lib/utils";
import StatusBadge from "../components/StatusBadge";
import Button from "../components/Button";
import Input from "../components/Input";
import Select from "../components/Select";
import Textarea from "../components/Textarea";
import Modal from "../components/Modal";

export default function Ventas() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    producto_id: '',
    cliente_id: '',
    precio_final: '',
    forma_pago: 'efectivo',
    monto_permuta: '0',
    notas: '',
  });

  useEffect(() => {
    Promise.all([
      api.get('/ventas/'),
      api.get('/productos/', { estado: 'disponible' }),
      api.get('/clientes/'),
    ])
      .then(([v, p, c]) => { setVentas(v); setProductos(p); setClientes(c); })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedProducto = productos.find((p) => p.id === form.producto_id);

  const handleCreate = async () => {
    if (!form.producto_id || !form.precio_final) {
      toast.error('Producto y precio final son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const venta = await api.post('/ventas/', {
        producto_id: form.producto_id,
        cliente_id: form.cliente_id || undefined,
        precio_final: parseFloat(form.precio_final),
        forma_pago: form.forma_pago,
        monto_permuta: parseFloat(form.monto_permuta) || 0,
        notas: form.notas || undefined,
      }) as Venta;
      setVentas((prev) => [venta, ...prev]);
      setProductos((prev) => prev.filter((p) => p.id !== form.producto_id));
      setForm({ producto_id: '', cliente_id: '', precio_final: '', forma_pago: 'efectivo', monto_permuta: '0', notas: '' });
      setShowForm(false);
      toast.success('Venta registrada');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const allProductos = [...productos];
  ventas.forEach((v) => {
    if (!allProductos.find((p) => p.id === v.producto_id)) {
      allProductos.push({ id: v.producto_id, nombre: `Producto ${v.producto_id.slice(0, 8)}`, marca: '', modelo: '', storage: null, color: null, condicion: 'usado', bateria_salud: null, precio_compra: '0', precio_venta: '0', estado: 'vendido', notas: null, fotos: [], created_at: '', updated_at: '' });
    }
  });

  const getProductoNombre = (id: string) => {
    const p = allProductos.find((p) => p.id === id);
    return p ? p.nombre : id.slice(0, 8);
  };

  const getClienteNombre = (id: string | null) => {
    if (!id) return '—';
    const c = clientes.find((c) => c.id === id);
    return c ? `${c.nombre} ${c.apellido ?? ''}`.trim() : id.slice(0, 8);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-200 rounded" />)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
        <Button variant="primary" onClick={() => setShowForm(true)}>+ Registrar venta</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-500">Total ventas</p>
          <p className="text-2xl font-bold text-gray-900">{ventas.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-500">Ingresos totales</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(ventas.reduce((s, v) => s + parseDecimal(v.precio_final), 0))}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-500">Precio promedio</p>
          <p className="text-2xl font-bold text-gray-900">
            {ventas.length > 0 ? formatCurrency(ventas.reduce((s, v) => s + parseDecimal(v.precio_final), 0) / ventas.length) : '—'}
          </p>
        </div>
      </div>

      {ventas.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          No hay ventas registradas aún.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Precio final</th>
                  <th className="px-4 py-3 font-medium">Pago</th>
                  <th className="px-4 py-3 font-medium">Permuta</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((v) => (
                  <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{getProductoNombre(v.producto_id)}</td>
                    <td className="px-4 py-3 text-gray-600">{getClienteNombre(v.cliente_id)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(parseDecimal(v.precio_final))}</td>
                    <td className="px-4 py-3"><StatusBadge status={v.forma_pago as any} /></td>
                    <td className="px-4 py-3 text-gray-600">
                      {parseDecimal(v.monto_permuta) > 0 ? formatCurrency(parseDecimal(v.monto_permuta)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(v.fecha_venta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Registrar venta">
        <div className="space-y-4">
          <Select
            label="Producto disponible"
            required
            options={[
              { value: '', label: 'Seleccionar producto...' },
              ...productos.map((p) => ({ value: p.id, label: `${p.nombre}${p.storage ? ` · ${p.storage}` : ''}${p.color ? ` · ${p.color}` : ''}` })),
            ]}
            value={form.producto_id}
            onChange={(e) => {
              const p = productos.find((x) => x.id === e.target.value);
              setForm({ ...form, producto_id: e.target.value, precio_final: p ? String(parseDecimal(p.precio_venta)) : form.precio_final });
            }}
          />

          {selectedProducto && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-blue-800">{selectedProducto.nombre}</p>
              <p className="text-blue-600">
                Precio venta: {formatCurrency(parseDecimal(selectedProducto.precio_venta))}
                {selectedProducto.condicion !== 'nuevo' && selectedProducto.bateria_salud ? ` · Batería: ${selectedProducto.bateria_salud}%` : ''}
              </p>
            </div>
          )}

          <Select
            label="Cliente (opcional)"
            options={[
              { value: '', label: 'Sin cliente registrado' },
              ...clientes.map((c) => ({ value: c.id, label: `${c.nombre} ${c.apellido ?? ''}`.trim() })),
            ]}
            value={form.cliente_id}
            onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Precio final ($)" type="number" required value={form.precio_final} onChange={(e) => setForm({ ...form, precio_final: e.target.value })} />
            <Select
              label="Forma de pago"
              options={[
                { value: 'efectivo', label: 'Efectivo' },
                { value: 'transferencia', label: 'Transferencia' },
                { value: 'tarjeta', label: 'Tarjeta' },
                { value: 'mixto', label: 'Mixto' },
              ]}
              value={form.forma_pago}
              onChange={(e) => setForm({ ...form, forma_pago: e.target.value })}
            />
          </div>

          {(form.forma_pago === 'mixto') && (
            <Input
              label="Monto por permuta ($)"
              type="number"
              value={form.monto_permuta}
              onChange={(e) => setForm({ ...form, monto_permuta: e.target.value })}
              placeholder="Valor del equipo recibido en parte de pago"
            />
          )}

          <Textarea label="Notas (opcional)" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />

          <div className="flex gap-3 pt-2">
            <Button variant="primary" onClick={handleCreate} className="flex-1" disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar venta'}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
