import React, { useState } from 'react';
import { Equipment, EquipmentStatus } from '../../types';
import { WrenchIcon, UploadIcon, PlusCircleIcon } from '../Icons';
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

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Monitor de Integridad */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-purple-500 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="font-bold text-lg text-sena-dark dark:text-white flex items-center gap-2">
                        <WrenchIcon className="w-5 h-5" /> Monitor de Inventario
                    </h3>
                    <div className="flex items-center gap-2 text-sm mt-1">
                        <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                        <span className="text-gray-600 dark:text-gray-300">{isOnline ? 'Conectado a Nube (Sincronizado)' : 'Modo Offline (Local)'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <span className="block text-2xl font-bold text-purple-600">{totalEquipment}</span>
                        <span className="text-xs uppercase text-gray-500">Items Totales</span>
                    </div>
                    {/* Migration Button: Always show if online, change label based on data */}
                    {isOnline && (
                        <button
                            onClick={handleMigration}
                            disabled={isMigrating}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all shadow-md"
                        >
                            <UploadIcon className="w-5 h-5" />
                            {isMigrating ? 'Migrando...' : (totalEquipment === 0 ? 'Migración Inicial' : 'Sincronización Forzada')}
                        </button>
                    )}
                </div>
            </div>

            {/* Modal de Progreso Migración */}
            <Modal isOpen={isMigrating} onClose={() => { }} title="Migrando a la Nube">
                <div className="text-center py-6">
                    <Spinner size="12" color="purple-600" />
                    <h3 className="mt-4 text-lg font-bold text-gray-700 dark:text-gray-200">{migrationMessage}</h3>
                    <div className="w-full bg-gray-200 rounded-full h-4 mt-4 overflow-hidden">
                        <div className="bg-purple-600 h-4 rounded-full transition-all duration-300" style={{ width: `${migrationProgress}%` }}></div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{migrationProgress}% completado</p>
                </div>
            </Modal>

            {/* Agregar Equipo */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold text-sena-dark dark:text-white mb-4 flex items-center gap-2">
                    <PlusCircleIcon className="w-5 h-5" /> Agregar Item
                </h3>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input value={newItemId} onChange={e => setNewItemId(e.target.value)} placeholder="Código / Placa" className="p-2 border rounded" required />
                    <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Nombre del Equipo" className="p-2 border rounded" required />
                    <select value={newItemType} onChange={e => setNewItemType(e.target.value)} className="p-2 border rounded">
                        <option value="Computer">Computador</option>
                        <option value="Laptop">Portátil</option>
                        <option value="Camera">Cámara</option>
                        <option value="Accessory">Accesorio</option>
                        <option value="Furniture">Mobiliario</option>
                        <option value="Appliance">Electrodoméstico</option>
                    </select>
                    <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700">Agregar</button>
                </form>
            </div>

            {/* Tabla Inventario */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Placa</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {equipment.map(e => (
                            <tr key={e.id}>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-mono">{e.id}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{e.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{e.type}</td>
                                <td className="px-6 py-4 text-sm">
                                    <span className={`px-2 py-1 rounded text-xs ${e.status === EquipmentStatus.AVAILABLE ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {e.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium flex gap-2">
                                    <button onClick={() => setEditItem(e)} className="text-blue-600 hover:text-blue-900">Editar</button>
                                    <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-900">Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
                        <button onClick={handleSaveEdit} className="w-full bg-blue-600 text-white py-2 rounded font-bold">Guardar Cambios</button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default InventoryView;
