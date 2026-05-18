import { useState, useEffect, useRef } from "react";
import { Upload, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, uploadFile, parseDecimal } from "../api";
import type { Producto } from "../api";
import { formatCurrency, exportCSV } from "../lib/utils";
import StatusBadge from "../components/StatusBadge";
import Button from "../components/Button";
import Input from "../components/Input";
import Select from "../components/Select";
import Textarea from "../components/Textarea";
import Modal from "../components/Modal";
import Carousel from "../components/Carousel";

const emptyProducto = {
  nombre: '',
  marca: 'Apple',
  modelo: '',
  storage: '',
  color: '',
  condicion: 'usado' as const,
  bateria_salud: '' as string | number,
  precio_compra: '',
  precio_venta: '',
  notas: '',
};

const STORAGE_OPTIONS = ['64GB', '128GB', '256GB', '512GB', '1TB'];
const MARCA_OPTIONS = ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Google', 'Otro'];

export default function Inventario() {
  const [activeTab, setActiveTab] = useState<'lista' | 'agregar' | 'fotos'>('lista');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('todos');
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [deletingProducto, setDeletingProducto] = useState<Producto | null>(null);
  const [nuevoProducto, setNuevoProducto] = useState(emptyProducto);
  const [nuevoFotoFiles, setNuevoFotoFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [fotoProductoId, setFotoProductoId] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const nuevoFotoInputRef = useRef<HTMLInputElement>(null);
  const editFotosInputRef = useRef<HTMLInputElement>(null);

  const getFotos = (p: Producto) => p.fotos?.map((f) => f.url) ?? [];

  const loadProductos = () =>
    api.get('/productos/')
      .then(setProductos)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { loadProductos(); }, []);

  const filtered = productos.filter((p) => filter === 'todos' ? true : p.estado === filter);
  const disponibles = productos.filter((p) => p.estado === 'disponible').length;
  const reservados = productos.filter((p) => p.estado === 'reservado').length;
  const vendidos = productos.filter((p) => p.estado === 'vendido').length;

  const handleAgregar = async () => {
    if (!nuevoProducto.nombre || !nuevoProducto.modelo) {
      toast.error('Nombre y modelo son obligatorios');
      return;
    }
    if (!nuevoProducto.precio_compra || !nuevoProducto.precio_venta) {
      toast.error('Los precios son obligatorios');
      return;
    }
    setSaving(true);
    try {
      let created = await api.post('/productos/', {
        nombre: nuevoProducto.nombre,
        marca: nuevoProducto.marca,
        modelo: nuevoProducto.modelo,
        storage: nuevoProducto.storage || undefined,
        color: nuevoProducto.color || undefined,
        condicion: nuevoProducto.condicion,
        bateria_salud: nuevoProducto.bateria_salud ? parseInt(String(nuevoProducto.bateria_salud)) : undefined,
        precio_compra: parseFloat(String(nuevoProducto.precio_compra)),
        precio_venta: parseFloat(String(nuevoProducto.precio_venta)),
        notas: nuevoProducto.notas || undefined,
      }) as Producto;
      for (const file of nuevoFotoFiles) {
        created = await uploadFile(`/productos/${created.id}/foto`, file) as Producto;
      }
      setProductos((prev) => [created, ...prev]);
      setNuevoProducto(emptyProducto);
      setNuevoFotoFiles([]);
      if (nuevoFotoInputRef.current) nuevoFotoInputRef.current.value = '';
      setActiveTab('lista');
      toast.success('Producto agregado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingProducto) return;
    setSaving(true);
    try {
      const { id, created_at, updated_at, fotos, ...rest } = editingProducto;
      const updated = await api.put(`/productos/${id}`, {
        ...rest,
        precio_compra: parseFloat(String(rest.precio_compra)),
        precio_venta: parseFloat(String(rest.precio_venta)),
        bateria_salud: rest.bateria_salud ?? undefined,
      }) as Producto;
      setProductos((prev) => prev.map((p) => (p.id === id ? updated : p)));
      setEditingProducto(null);
      toast.success('Producto actualizado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProducto) return;
    setSaving(true);
    try {
      await api.delete(`/productos/${deletingProducto.id}`);
      setProductos((prev) => prev.filter((p) => p.id !== deletingProducto.id));
      setDeletingProducto(null);
      toast.success('Producto eliminado');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleReserva = async (producto: Producto) => {
    const nuevoEstado = producto.estado === 'disponible' ? 'reservado' : 'disponible';
    try {
      const updated = await api.put(`/productos/${producto.id}`, { estado: nuevoEstado }) as Producto;
      setProductos((prev) => prev.map((p) => (p.id === producto.id ? updated : p)));
      toast.success(nuevoEstado === 'reservado' ? 'Producto reservado' : 'Producto liberado');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUploadFotos = async (files: FileList) => {
    if (!fotoProductoId || files.length === 0) return;
    setUploadingFoto(true);
    try {
      let updated: Producto | null = null;
      for (const file of Array.from(files)) {
        updated = await uploadFile(`/productos/${fotoProductoId}/foto`, file) as Producto;
      }
      if (updated) setProductos((prev) => prev.map((p) => (p.id === updated!.id ? updated! : p)));
      toast.success(files.length === 1 ? 'Foto agregada' : `${files.length} fotos agregadas`);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleDeleteFoto = async (productoId: string, fotoId: string) => {
    try {
      await api.delete(`/productos/${productoId}/fotos/${fotoId}`);
      const removeFoto = (p: Producto) =>
        p.id === productoId ? { ...p, fotos: p.fotos.filter((f) => f.id !== fotoId) } : p;
      setProductos((prev) => prev.map(removeFoto));
      setEditingProducto((prev) => (prev ? removeFoto(prev) : prev));
      toast.success('Foto eliminada');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleEditUploadFotos = async (files: FileList) => {
    if (!editingProducto || files.length === 0) return;
    setEditUploading(true);
    try {
      let updated: Producto = editingProducto;
      for (const file of Array.from(files)) {
        updated = await uploadFile(`/productos/${editingProducto.id}/foto`, file) as Producto;
      }
      setProductos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingProducto(updated);
      toast.success(files.length === 1 ? 'Foto agregada' : `${files.length} fotos agregadas`);
      if (editFotosInputRef.current) editFotosInputRef.current.value = '';
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEditUploading(false);
    }
  };

  const selectedFotoProducto = productos.find((p) => p.id === fotoProductoId);

  const condicionOpts = [
    { value: 'nuevo', label: 'Nuevo' },
    { value: 'usado', label: 'Usado' },
    { value: 'reacondicionado', label: 'Reacondicionado' },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Inventario</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden animate-pulse">
              <div className="bg-gray-200 h-36" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Inventario</h1>

      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {(['lista', 'agregar', 'fotos'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 border-b-2 font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'lista' ? 'Lista' : tab === 'agregar' ? 'Agregar' : 'Fotos'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'lista' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{productos.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-gray-500">Disponibles</p>
              <p className="text-2xl font-bold text-green-600">{disponibles}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-gray-500">Reservados</p>
              <p className="text-2xl font-bold text-amber-600">{reservados}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-sm text-gray-500">Vendidos</p>
              <p className="text-2xl font-bold text-gray-500">{vendidos}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Select
              options={[
                { value: 'todos', label: 'Todos los estados' },
                { value: 'disponible', label: 'Disponible' },
                { value: 'reservado', label: 'Reservado' },
                { value: 'vendido', label: 'Vendido' },
              ]}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="secondary"
              onClick={() => exportCSV(`inventario_${new Date().toISOString().slice(0, 10)}.csv`, filtered.map((p) => ({
                ID: p.id,
                Nombre: p.nombre,
                Marca: p.marca,
                Modelo: p.modelo,
                Storage: p.storage ?? '',
                Color: p.color ?? '',
                Condicion: p.condicion,
                Bateria: p.bateria_salud ?? '',
                'Precio Compra': p.precio_compra,
                'Precio Venta': p.precio_venta,
                Estado: p.estado,
              })))}
            >
              <Download className="w-4 h-4 mr-1 inline" /> Exportar CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((producto) => (
              <div key={producto.id} className="space-y-3">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  <Carousel urls={getFotos(producto)} height={148} />
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900 leading-tight">{producto.nombre}</h3>
                      <StatusBadge status={producto.condicion} />
                    </div>
                    <p className="text-sm text-gray-500">
                      {producto.marca} · {producto.modelo}
                      {producto.storage ? ` · ${producto.storage}` : ''}
                      {producto.color ? ` · ${producto.color}` : ''}
                    </p>
                    {producto.condicion !== 'nuevo' && producto.bateria_salud != null && (
                      <p className="text-xs text-gray-500">Batería: {producto.bateria_salud}%</p>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(parseDecimal(producto.precio_venta))}
                      </p>
                      <StatusBadge status={producto.estado} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setEditingProducto(producto)}>
                    Editar
                  </Button>
                  {producto.estado !== 'vendido' && (
                    <Button
                      variant="secondary"
                      className={`flex-1 ${producto.estado === 'reservado' ? 'text-amber-700 border-amber-300 hover:bg-amber-50' : ''}`}
                      onClick={() => handleToggleReserva(producto)}
                    >
                      {producto.estado === 'disponible' ? 'Reservar' : 'Liberar'}
                    </Button>
                  )}
                  {producto.estado === 'disponible' && (
                    <Button variant="danger" className="flex-1" onClick={() => setDeletingProducto(producto)}>
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'agregar' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Nombre del producto" value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })} placeholder="ej: iPhone 15 Pro 256GB" required />
            <Select label="Marca" options={MARCA_OPTIONS.map((m) => ({ value: m, label: m }))} value={nuevoProducto.marca} onChange={(e) => setNuevoProducto({ ...nuevoProducto, marca: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Modelo" value={nuevoProducto.modelo} onChange={(e) => setNuevoProducto({ ...nuevoProducto, modelo: e.target.value })} placeholder="ej: iPhone 15 Pro" required />
            <Select label="Storage" options={[{ value: '', label: '—' }, ...STORAGE_OPTIONS.map((s) => ({ value: s, label: s }))]} value={String(nuevoProducto.storage)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, storage: e.target.value })} />
            <Input label="Color" value={String(nuevoProducto.color)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, color: e.target.value })} placeholder="ej: Natural Titanium" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label="Condición" options={condicionOpts} value={nuevoProducto.condicion} onChange={(e) => setNuevoProducto({ ...nuevoProducto, condicion: e.target.value as any })} />
            <Input label="Salud de batería (%)" type="number" min={0} max={100} value={String(nuevoProducto.bateria_salud)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, bateria_salud: e.target.value })} placeholder="ej: 87" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Precio compra ($)" type="number" value={String(nuevoProducto.precio_compra)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio_compra: e.target.value })} required />
            <Input label="Precio venta ($)" type="number" value={String(nuevoProducto.precio_venta)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio_venta: e.target.value })} required />
          </div>
          <Textarea label="Notas" value={String(nuevoProducto.notas)} onChange={(e) => setNuevoProducto({ ...nuevoProducto, notas: e.target.value })} />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Fotos (opcional)</p>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
              onClick={() => nuevoFotoInputRef.current?.click()}
            >
              <input ref={nuevoFotoInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => setNuevoFotoFiles(e.target.files ? Array.from(e.target.files) : [])} />
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {nuevoFotoFiles.length > 0
                  ? `${nuevoFotoFiles.length} imagen${nuevoFotoFiles.length > 1 ? 'es' : ''} seleccionada${nuevoFotoFiles.length > 1 ? 's' : ''}`
                  : 'Seleccionar imágenes'}
              </p>
            </div>
          </div>
          <Button variant="primary" onClick={handleAgregar} className="w-full" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar producto'}
          </Button>
        </div>
      )}

      {activeTab === 'fotos' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
          <Select
            label="Producto"
            options={[
              { value: '', label: 'Seleccionar producto...' },
              ...productos.map((p) => ({ value: p.id, label: `${p.nombre} · ${p.estado}` })),
            ]}
            value={fotoProductoId}
            onChange={(e) => setFotoProductoId(e.target.value)}
          />
          {selectedFotoProducto && (
            <>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Fotos actuales ({getFotos(selectedFotoProducto).length})</p>
                {selectedFotoProducto.fotos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {selectedFotoProducto.fotos.map((foto) => (
                      <div key={foto.id} className="relative group rounded-lg overflow-hidden border border-gray-200" style={{ height: 120 }}>
                        <img src={foto.url} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleDeleteFoto(selectedFotoProducto.id, foto.id)}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Sin fotos</p>
                )}
              </div>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
                onClick={() => fotoInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600">Seleccionar imágenes</p>
                <input ref={fotoInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => e.target.files && handleUploadFotos(e.target.files)} />
              </div>
              {uploadingFoto && <p className="text-sm text-center text-gray-500">Subiendo...</p>}
            </>
          )}
        </div>
      )}

      {editingProducto && (
        <Modal isOpen={true} onClose={() => setEditingProducto(null)} title="Editar producto">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Fotos ({editingProducto.fotos.length})</p>
              {editingProducto.fotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {editingProducto.fotos.map((foto) => (
                    <div key={foto.id} className="relative group rounded-lg overflow-hidden border border-gray-200" style={{ height: 90 }}>
                      <img src={foto.url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleDeleteFoto(editingProducto.id, foto.id)}
                        className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-gray-400 transition-colors"
                onClick={() => editFotosInputRef.current?.click()}
              >
                <input ref={editFotosInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => e.target.files && handleEditUploadFotos(e.target.files)} />
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                <p className="text-xs text-gray-500">{editUploading ? 'Subiendo...' : 'Agregar fotos'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nombre" value={editingProducto.nombre} onChange={(e) => setEditingProducto({ ...editingProducto, nombre: e.target.value })} required />
              <Select label="Marca" options={MARCA_OPTIONS.map((m) => ({ value: m, label: m }))} value={editingProducto.marca} onChange={(e) => setEditingProducto({ ...editingProducto, marca: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Modelo" value={editingProducto.modelo} onChange={(e) => setEditingProducto({ ...editingProducto, modelo: e.target.value })} />
              <Select label="Storage" options={[{ value: '', label: '—' }, ...STORAGE_OPTIONS.map((s) => ({ value: s, label: s }))]} value={editingProducto.storage ?? ''} onChange={(e) => setEditingProducto({ ...editingProducto, storage: e.target.value || null })} />
              <Input label="Color" value={editingProducto.color ?? ''} onChange={(e) => setEditingProducto({ ...editingProducto, color: e.target.value || null })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label="Condición" options={condicionOpts} value={editingProducto.condicion} onChange={(e) => setEditingProducto({ ...editingProducto, condicion: e.target.value as any })} />
              <Input label="Batería (%)" type="number" min={0} max={100} value={editingProducto.bateria_salud ?? ''} onChange={(e) => setEditingProducto({ ...editingProducto, bateria_salud: e.target.value ? parseInt(e.target.value) : null })} />
              <Select label="Estado" options={[{ value: 'disponible', label: 'Disponible' }, { value: 'reservado', label: 'Reservado' }, { value: 'vendido', label: 'Vendido' }]} value={editingProducto.estado} onChange={(e) => setEditingProducto({ ...editingProducto, estado: e.target.value as any })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Precio compra ($)" type="number" value={editingProducto.precio_compra} onChange={(e) => setEditingProducto({ ...editingProducto, precio_compra: e.target.value })} />
              <Input label="Precio venta ($)" type="number" value={editingProducto.precio_venta} onChange={(e) => setEditingProducto({ ...editingProducto, precio_venta: e.target.value })} />
            </div>
            <Textarea label="Notas" value={editingProducto.notas ?? ''} onChange={(e) => setEditingProducto({ ...editingProducto, notas: e.target.value || null })} />
            <div className="flex gap-3 pt-4">
              <Button variant="primary" onClick={handleSaveEdit} className="flex-1" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button variant="secondary" onClick={() => setEditingProducto(null)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {deletingProducto && (
        <Modal isOpen={true} onClose={() => setDeletingProducto(null)} title="¿Eliminar producto?" className="max-w-md">
          <div className="space-y-4">
            <p className="text-gray-700">¿Eliminar <strong>{deletingProducto.nombre}</strong> (ID {deletingProducto.id.slice(0, 8)})?</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">Esta acción no se puede deshacer.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="danger" onClick={handleDelete} className="flex-1" disabled={saving}>
                {saving ? 'Eliminando...' : 'Sí, eliminar'}
              </Button>
              <Button variant="secondary" onClick={() => setDeletingProducto(null)} className="flex-1">Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
