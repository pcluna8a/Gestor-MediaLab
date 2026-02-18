import React, { useState } from 'react';
import { Equipment, EquipmentStatus } from '../../types';
import { WrenchIcon, UploadIcon, PlusCircleIcon, SearchIcon } from '../Icons';
import { seedCloudDatabase } from '../../services/firebaseService';
import Modal from '../Modal';
import Spinner from '../Spinner';

interface InventoryViewProps {
    equipment: Equipment[];
    onAddNewEquipment: (newItem: Equipment) => void;
    onEditEquipment: (updatedItem: Equipment) => void;
    onDeleteEquipment: (itemId: string) => void;
    onUpdateInventory?: (newEquipment: Equipment[]) => void;
    isOnline: boolean;
}

const InventoryView: React.FC<InventoryViewProps> = ({ equipment, onAddNewEquipment, onEditEquipment, onDeleteEquipment, isOnline }) => {
    const [newItemId, setNewItemId] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [newItemType, setNewItemType] = useState('Computer');
    const [newItemImage, setNewItemImage] = useState('');

    const [editItem, setEditItem] = useState<Equipment | null>(null);

    // Migration States
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationProgress, setMigrationProgress] = useState(0);
    const [migrationMessage, setMigrationMessage] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        onAddNewEquipment({
            id: newItemId,
            name: newItemName.toUpperCase(),
            type: newItemType,
            status: EquipmentStatus.AVAILABLE,
            imageUrl: newItemImage || 'https://via.placeholder.com/150'
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

    const handleDelete = (id: string) => {
        if (confirm("¿Estás seguro de eliminar este equipo? Esta acción no se puede deshacer.")) {
            onDeleteEquipment(id);
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
                            <input type="text" placeholder="Buscar..." className="pl-9 pr-4 py-1.5 bg-black/20 border border-white/10 rounded-full text-sm text-gray-300 focus:outline-none focus:border-sena-green w-48 transition-all focus:w-64" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-x-auto">
                        <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-black/20">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Placa</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tipo</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {equipment.map(e => (
                                    <tr key={e.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 text-sm text-sena-green font-mono font-bold group-hover:text-white transition-colors">{e.id}</td>
                                        <td className="px-6 py-4 text-sm text-gray-300 font-medium">{e.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-400">{e.type}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${e.status === EquipmentStatus.AVAILABLE ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                                                {e.status === EquipmentStatus.AVAILABLE ? 'DISPONIBLE' : 'PRESTADO'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium flex gap-3">
                                            <button onClick={() => setEditItem(e)} className="text-blue-400 hover:text-white transition-colors">Editar</button>
                                            <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-200 transition-colors">Eliminar</button>
                                        </td>
                                    </tr>
                                ))}
                                {equipment.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                                            Inventario vacío. Agrega items usando el panel izquierdo.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal Edición */}
            <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Editar Equipo">
                {editItem && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-1">Nombre</label>
                            <input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Tipo</label>
                            <select value={editItem.type} onChange={e => setEditItem({ ...editItem, type: e.target.value })} className="w-full p-2 border rounded">
                                <option value="Computer">Computador</option>
                                <option value="Laptop">Portátil</option>
                                <option value="Camera">Cámara</option>
                                <option value="Accessory">Accesorio</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Estado Manual</label>
                            <select value={editItem.status} onChange={e => setEditItem({ ...editItem, status: e.target.value as EquipmentStatus })} className="w-full p-2 border rounded">
                                <option value={EquipmentStatus.AVAILABLE}>Disponible</option>
                                <option value={EquipmentStatus.ON_LOAN}>En Préstamo</option>
                            </select>
                        </div>
                        <button onClick={handleSaveEdit} className="w-full bg-sena-green text-white py-2 rounded font-bold">Guardar Cambios</button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default InventoryView;
