import React, { useState, useMemo } from 'react';
import { Equipment, EquipmentStatus } from '../../types';
import { WrenchIcon, UploadIcon, PlusCircleIcon, SearchIcon, CameraIcon, InformationCircleIcon } from '../Icons';
import { seedCloudDatabase } from '../../services/firebaseService';
import Modal from '../Modal';
import Spinner from '../Spinner';
import Pagination from '../Pagination';
import ConfirmDialog from '../ConfirmDialog';

interface InventoryViewProps {
    equipment: Equipment[];
    onAddNewEquipment: (newItem: Equipment) => void;
    onEditEquipment: (updatedItem: Equipment) => void;
    onDeleteEquipment: (itemId: string) => void;
    isOnline: boolean;
}

const InventoryView: React.FC<InventoryViewProps> = ({ equipment, onAddNewEquipment, onEditEquipment, onDeleteEquipment, isOnline }) => {
    const [newItemId, setNewItemId] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [newItemType, setNewItemType] = useState('Computer');
    const [newItemImage, setNewItemImage] = useState('');
    const [editItem, setEditItem] = useState<Equipment | null>(null);
    const [viewDetailItem, setViewDetailItem] = useState<Equipment | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    // Migration States
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationProgress, setMigrationProgress] = useState(0);
    const [migrationMessage, setMigrationMessage] = useState('');

    type SortKey = 'id' | 'name' | 'status';
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

    // Filtered equipment
    const filteredEquipment = useMemo(() => {
        if (!searchTerm?.trim()) return equipment;
        const term = searchTerm.toLowerCase();
        return equipment.filter(e =>
            (e?.id || '').toLowerCase().includes(term) ||
            (e?.name || '').toLowerCase().includes(term) ||
            (e?.description || '').toLowerCase().includes(term) ||
            (e?.type || '').toLowerCase().includes(term)
        );
    }, [equipment, searchTerm]);

    const sortedEquipment = React.useMemo(() => {
        let sortableEquipment = [...filteredEquipment];
        if (sortConfig !== null) {
            sortableEquipment.sort((a, b) => {
                let aValue = a[sortConfig.key] || '';
                let bValue = b[sortConfig.key] || '';

                if (sortConfig.key === 'name') {
                    aValue = a.description || a.name;
                    bValue = b.description || b.name;
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableEquipment;
    }, [filteredEquipment, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const totalPages = Math.ceil(sortedEquipment.length / ITEMS_PER_PAGE);
    const paginatedEquipment = sortedEquipment.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleNewImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewItemImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        onAddNewEquipment({
            id: newItemId,
            name: newItemName.toUpperCase(),
            type: newItemType,
            status: EquipmentStatus.AVAILABLE,
            imageUrl: newItemImage || ''
        });
        setNewItemId('');
        setNewItemName('');
        setNewItemImage('');
    };

    const handleMigration = async () => {
        if (!isOnline) return;
        setIsMigrating(true);
        setMigrationProgress(0);
        setMigrationMessage("Iniciando...");

        const result = await seedCloudDatabase((msg, pct) => {
            setMigrationMessage(msg);
            setMigrationProgress(pct);
        });

        if (result.success) {
            setMigrationMessage("¡Completado!");
            setMigrationProgress(100);
            setTimeout(() => setIsMigrating(false), 2000);
        } else {
            setMigrationMessage("Error: " + result.message);
            setTimeout(() => setIsMigrating(false), 4000);
        }
    };

    const handleSaveEdit = () => {
        if (editItem) {
            onEditEquipment(editItem);
            setEditItem(null);
        }
    };

    const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && editItem) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditItem({ ...editItem, imageUrl: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDelete = (id: string) => {
        setDeleteTarget(id);
    };

    const confirmDelete = () => {
        if (deleteTarget) {
            onDeleteEquipment(deleteTarget);
            setDeleteTarget(null);
        }
    };

    const totalEquipment = equipment.length;
    // Simple verification for "Zonas de Carga Diferenciadas": Distinct visual area for adding items vs viewing list.

    return (
        <div className="space-y-6 animate-fade-in text-gray-200">
            {/* Monitor de Integridad (Top Bar) */}
            <div className="bg-white/5 p-4 rounded-xl shadow-lg border-l-4 border-sena-green backdrop-blur-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        <WrenchIcon className="w-5 h-5 text-sena-green" /> Monitor de Inventario
                    </h3>
                    <div className="flex items-center gap-2 text-sm mt-1">
                        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                        <span className="text-gray-400">{isOnline ? 'Conectado a Nube' : 'Modo Offline'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <span className="block text-2xl font-bold text-white">{totalEquipment}</span>
                        <span className="text-[10px] uppercase text-gray-500 tracking-wider">Items Totales</span>
                    </div>
                    {/* Migration Button */}
                    {isOnline && (
                        <button
                            onClick={handleMigration}
                            disabled={isMigrating}
                            className="flex items-center gap-2 px-4 py-2 bg-sena-green/20 text-sena-green border border-sena-green/50 rounded-lg hover:bg-sena-green hover:text-white disabled:opacity-50 transition-all shadow-[0_0_10px_rgba(57,169,0,0.2)] hover:shadow-[0_0_15px_rgba(57,169,0,0.6)]"
                        >
                            <UploadIcon className="w-5 h-5" />
                            <span className="text-sm font-bold">{isMigrating ? 'Migrando...' : (totalEquipment === 0 ? 'Migración' : 'Sincronizar')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Modal de Progreso Migración */}
            <Modal isOpen={isMigrating} onClose={() => { }} title="Migrando a la Nube">
                <div className="text-center py-6">
                    <Spinner size="12" color="sena-green" />
                    <h3 className="mt-4 text-lg font-bold text-gray-800 dark:text-gray-200">{migrationMessage}</h3>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-4 overflow-hidden">
                        <div className="bg-sena-green h-2 rounded-full transition-all duration-300" style={{ width: `${migrationProgress}%` }}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{migrationProgress}% completado</p>
                </div>
            </Modal>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Agregar Equipo - Zona Diferenciada (Glass Panel) */}
                <div className="lg:col-span-1 bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-md h-fit relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-sena-green to-transparent opacity-50"></div>
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <PlusCircleIcon className="w-5 h-5 text-sena-green" /> Nuevo Ingreso
                    </h3>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Código / Placa</label>
                            <input value={newItemId} onChange={e => setNewItemId(e.target.value)} placeholder="Ej: PC-001" className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all" required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Nombre del Equipo</label>
                            <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Ej: Portátil Dell Latitude" className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all" required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Tipo de Equipo</label>
                            <select value={newItemType} onChange={e => setNewItemType(e.target.value)} className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-sena-green outline-none appearance-none">
                                <option value="Computer" className="bg-sena-dark">Computador</option>
                                <option value="Laptop" className="bg-sena-dark">Portátil</option>
                                <option value="Camera" className="bg-sena-dark">Cámara</option>
                                <option value="Accessory" className="bg-sena-dark">Accesorio</option>
                                <option value="Furniture" className="bg-sena-dark">Mobiliario</option>
                                <option value="Appliance" className="bg-sena-dark">Electrodoméstico</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-2">Fotografía (Opcional)</label>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-black/20 border border-white/10 flex items-center justify-center overflow-hidden">
                                    {newItemImage ? (
                                        <img src={newItemImage} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <CameraIcon className="w-6 h-6 text-gray-600" />
                                    )}
                                </div>
                                <label className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2 text-center text-xs font-bold text-gray-400 hover:bg-white/10 cursor-pointer transition-all">
                                    {newItemImage ? 'Cambiar Foto' : 'Subir Foto'}
                                    <input type="file" accept="image/*" onChange={handleNewImageUpload} className="hidden" />
                                </label>
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-sena-green text-white font-bold py-3 px-4 rounded-lg hover:shadow-[0_0_15px_rgba(57,169,0,0.4)] transition-all hover:scale-[1.02] active:scale-95 mt-2">
                            Agregar al Inventario
                        </button>
                    </form>
                </div>

                {/* Tabla Inventario - Lista */}
                <div className="lg:col-span-3 bg-white/5 rounded-xl border border-white/10 overflow-hidden flex flex-col min-h-[400px]">
                    <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                        <h4 className="font-bold text-gray-200">Listado de Activos</h4>
                        <div className="relative">
                            <SearchIcon className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                placeholder="Buscar por placa, nombre o tipo..."
                                className="pl-9 pr-4 py-1.5 bg-black/20 border border-white/10 rounded-full text-sm text-gray-300 focus:outline-none focus:border-sena-green w-48 transition-all focus:w-64"
                                aria-label="Buscar equipos"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-black/20">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider cursor-pointer select-none transition-colors" onClick={() => requestSort('id')}>
                                        <div className="flex items-center gap-1">
                                            Placa {sortConfig?.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider cursor-pointer select-none transition-colors" onClick={() => requestSort('name')}>
                                        <div className="flex items-center gap-1">
                                            Nombre / Descripción {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider cursor-pointer select-none transition-colors" onClick={() => requestSort('status')}>
                                        <div className="flex items-center gap-1">
                                            Estado {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {paginatedEquipment.map(e => (
                                    <tr key={e.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 text-sm text-sena-green font-mono font-bold group-hover:text-white transition-colors">{e.id}</td>
                                        <td className="px-6 py-4 text-sm text-gray-300 font-medium">
                                            <div className="flex flex-col">
                                                <span>{e.description || e.name}</span>
                                                {e.currentDescription && (
                                                    <button
                                                        onClick={() => setViewDetailItem(e)}
                                                        className="text-[10px] text-sena-green hover:underline mt-1 flex items-center gap-1 w-fit uppercase font-bold tracking-tighter"
                                                        aria-label={`Ver detalle de ${e.name}`}
                                                    >
                                                        <InformationCircleIcon className="w-3 h-3" /> Ver Detalle
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${e.status === EquipmentStatus.AVAILABLE ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                                                {e.status === EquipmentStatus.AVAILABLE ? 'DISPONIBLE' : 'PRESTADO'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium flex gap-3">
                                            <button onClick={() => setEditItem(e)} className="text-blue-400 hover:text-white transition-colors" aria-label={`Editar ${e.name}`}>Editar</button>
                                            <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-200 transition-colors" aria-label={`Eliminar ${e.name}`}>Eliminar</button>
                                        </td>
                                    </tr>
                                ))}
                                {sortedEquipment.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                                            {searchTerm ? 'No se encontraron equipos con ese criterio.' : 'Inventario vacío. Agrega items usando el panel izquierdo.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={filteredEquipment.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                    />
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={!!deleteTarget}
                title="¿Eliminar equipo?"
                message="Esta acción no se puede deshacer. El equipo será eliminado permanentemente del inventario."
                confirmLabel="Eliminar"
                cancelLabel="Cancelar"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
                variant="danger"
            />


            {/* Modal Detalle */}
            <Modal isOpen={!!viewDetailItem} onClose={() => setViewDetailItem(null)} title="Detalle del Equipo">
                {viewDetailItem && (
                    <div className="space-y-4">
                        <div className="flex flex-col items-center">
                            {viewDetailItem.imageUrl && (
                                <img src={viewDetailItem.imageUrl} alt={viewDetailItem.name} className="w-48 h-48 rounded-lg object-cover mb-4 border border-white/10" />
                            )}
                            <h3 className="text-xl font-bold text-white uppercase text-center">{viewDetailItem.name}</h3>
                            <p className="text-xs text-sena-green font-mono">{viewDetailItem.id}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                            <h4 className="text-[10px] uppercase text-gray-500 tracking-widest font-bold mb-2">Información Técnica / Descripción Actual</h4>
                            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{viewDetailItem.currentDescription || 'Sin descripción técnica adicional.'}</p>
                        </div>
                        <button onClick={() => setViewDetailItem(null)} className="w-full bg-white/10 text-white py-2 rounded font-bold hover:bg-white/20 transition-all">Cerrar</button>
                    </div>
                )}
            </Modal>

            {/* Isolated Edit View (Modal replacement behavior but in-page responsiveness) */}
            {editItem && (
                <div className="fixed inset-0 z-50 bg-sena-dark/95 backdrop-blur-xl animate-fade-in flex flex-col p-6 overflow-y-auto">
                    <div className="max-w-4xl mx-auto w-full space-y-8">
                        <div className="flex justify-between items-center border-b border-white/10 pb-6">
                            <div>
                                <h2 className="text-3xl font-extrabold text-white uppercase tracking-tighter">Editando Equipo</h2>
                                <p className="text-sena-green font-mono text-sm">{editItem.id}</p>
                            </div>
                            <button onClick={() => setEditItem(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                                <span className="text-sm font-bold px-2">CANCELAR</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {/* Left: Image Handling */}
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <div className="relative group w-full aspect-square max-w-[300px]">
                                    {editItem.imageUrl ? (
                                        <img src={editItem.imageUrl} alt="Equipment" className="w-full h-full rounded-2xl object-cover border-2 border-white/10 shadow-2xl" />
                                    ) : (
                                        <div className="w-full h-full rounded-2xl bg-white/5 border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-gray-500">
                                            <CameraIcon className="w-12 h-12 mb-3" />
                                            <span className="text-sm font-bold uppercase">Sin Imagen</span>
                                        </div>
                                    )}
                                    <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl transition-all cursor-pointer">
                                        <UploadIcon className="w-10 h-10 text-white mb-2" />
                                        <span className="text-white font-bold text-sm">CAMBIAR FOTO</span>
                                        <input type="file" accept="image/*" onChange={handleEditImageUpload} className="hidden" />
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black">Control de Activo Fijo</p>
                            </div>

                            {/* Right: Data Handling */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Nombre / Descripción Corta</label>
                                    <input
                                        type="text"
                                        value={editItem.description || editItem.name}
                                        onChange={e => setEditItem({ ...editItem, description: e.target.value })}
                                        className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white font-medium focus:border-sena-green outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Descripción Técnica (Detalle)</label>
                                    <textarea
                                        value={editItem.currentDescription || ''}
                                        onChange={e => setEditItem({ ...editItem, currentDescription: e.target.value })}
                                        rows={5}
                                        className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white font-medium focus:border-sena-green outline-none transition-all resize-none"
                                        placeholder="Ingrese especificaciones técnicas detalladas..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Estado</label>
                                        <select
                                            value={editItem.status}
                                            onChange={e => setEditItem({ ...editItem, status: e.target.value as EquipmentStatus })}
                                            className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white focus:border-sena-green outline-none appearance-none cursor-pointer"
                                        >
                                            <option value={EquipmentStatus.AVAILABLE} className="bg-sena-dark">Disponible</option>
                                            <option value={EquipmentStatus.ON_LOAN} className="bg-sena-dark">En Préstamo</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Tipo (Referencia)</label>
                                        <input
                                            type="text"
                                            value={editItem.type}
                                            onChange={e => setEditItem({ ...editItem, type: e.target.value })}
                                            className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white font-medium focus:border-sena-green outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 border-t border-white/5">
                            <button
                                onClick={handleSaveEdit}
                                className="w-full bg-sena-green text-white py-5 rounded-2xl font-black text-xl hover:shadow-[0_0_30px_rgba(57,169,0,0.4)] transition-all transform hover:scale-[1.01] active:scale-[0.99] uppercase tracking-tighter"
                            >
                                Actualizar Registro de Equipo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryView;
