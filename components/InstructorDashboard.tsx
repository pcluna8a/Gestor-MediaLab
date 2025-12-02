
import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, LoanRecord, Equipment, Role, UserCategory, EquipmentStatus, 
  MaintenanceSuggestion, createNewLoan 
} from '../types';
import { 
  CameraIcon, UserGroupIcon, UserPlusIcon, SearchIcon, 
  HomeIcon, ClipboardListIcon, CollectionIcon, DocumentReportIcon,
  WrenchIcon, MenuIcon, XIcon, PlusCircleIcon, SwitchCameraIcon,
  ChartBarIcon, SaveIcon, CloudIcon, UploadIcon, WifiIcon
} from './Icons';
import Modal from './Modal';
import Spinner from './Spinner';
import { generateMaintenanceSuggestions, analyzeEquipmentCondition } from '../services/geminiService';

export interface DashboardProps {
    currentUser: User;
    loans: LoanRecord[];
    equipment: Equipment[];
    users: User[];
    onNewLoan: (loan: LoanRecord) => void;
    onReturn: (loanId: string, concept: string, status: string, photos: string[], analysis: string) => void;
    onUpdateInventory: () => void;
    onAddNewUser: (newUser: User) => Promise<{ success: boolean; message: string }>;
    onUpdateUser: (updatedUser: User) => void;
    onBatchUploadUsers?: (users: User[], onProgress: (c: number, t: number) => void) => Promise<{ success: boolean; message: string }>; // NEW PROP
    onAddNewEquipment: (item: Equipment) => void;
    onUpdateEquipmentImage: (id: string, url: string) => void;
    onEditEquipment: (item: Equipment) => void;
    onDeleteEquipment: (id: string) => void;
    onForceSync: (onProgress: (msg: string) => void) => Promise<void>;
    checkpointTimestamp: any;
    onCreateCheckpoint: any;
    isOnline: boolean;
}

type View = 'home' | 'loans' | 'newLoan' | 'inventory' | 'users';

const NavButton = ({ 
  active, 
  onClick, 
  icon: Icon, 
  label 
}: { active: boolean; onClick: () => void; icon: any; label: string }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
      active 
        ? 'bg-sena-green text-white shadow-md' 
        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
    }`}
  >
    <Icon className="w-5 h-5" />
    <span className="font-medium">{label}</span>
  </button>
);

const HomeView: React.FC<{ loans: LoanRecord[], equipment: Equipment[], onSuggestion: (s: MaintenanceSuggestion[]) => void }> = ({ loans, equipment, onSuggestion }) => {
    const [suggestions, setSuggestions] = useState<MaintenanceSuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    const stats = useMemo(() => {
        const active = loans.filter(l => !l.returnDate).length;
        const available = equipment.filter(e => e.status === EquipmentStatus.AVAILABLE).length;
        const total = equipment.length;
        return { active, available, total };
    }, [loans, equipment]);

    const handleGenerateSuggestions = async () => {
        setLoadingSuggestions(true);
        const data = await generateMaintenanceSuggestions(loans, equipment);
        setSuggestions(data);
        setLoadingSuggestions(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-blue-500">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm uppercase">Préstamos Activos</p>
                            <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{stats.active}</h3>
                        </div>
                        <ClipboardListIcon className="w-10 h-10 text-blue-500 opacity-20" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-green-500">
                    <div className="flex justify-between items-center">
                         <div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm uppercase">Equipos Disponibles</p>
                            <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{stats.available}</h3>
                        </div>
                        <CollectionIcon className="w-10 h-10 text-green-500 opacity-20" />
                    </div>
                </div>
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-purple-500">
                    <div className="flex justify-between items-center">
                         <div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm uppercase">Total Inventario</p>
                            <h3 className="text-3xl font-bold text-gray-800 dark:text-white">{stats.total}</h3>
                        </div>
                        <ChartBarIcon className="w-10 h-10 text-purple-500 opacity-20" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <WrenchIcon className="w-5 h-5" /> Sugerencias de Mantenimiento (IA)
                    </h3>
                    <button 
                        onClick={handleGenerateSuggestions}
                        disabled={loadingSuggestions}
                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100 transition-colors"
                    >
                        {loadingSuggestions ? 'Analizando...' : 'Generar Análisis'}
                    </button>
                </div>
                
                {suggestions.length > 0 ? (
                    <div className="space-y-3">
                        {suggestions.map((s, idx) => (
                            <div key={idx} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                <p className="font-bold text-yellow-800 dark:text-yellow-200">{s.equipmentName}</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{s.suggestion}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-gray-500 text-sm italic">
                        Genera un reporte para ver recomendaciones basadas en el uso de los equipos.
                    </p>
                )}
            </div>
        </div>
    );
};

const ManageUsersView: React.FC<DashboardProps> = ({ users, onAddNewUser, onUpdateUser, onBatchUploadUsers, isOnline }) => {
    const [newUserId, setNewUserId] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState(''); 
    const [selectedProfileType, setSelectedProfileType] = useState<'APRENDIZ' | 'ADMINISTRATIVO' | 'INSTRUCTOR_SENA' | 'ADMIN_MEDIALAB'>('APRENDIZ');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPhoto, setEditPhoto] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        const terms = searchTerm.toLowerCase().split(' ').filter(t => t);
        return users.filter(u => {
            const searchString = `${u.name} ${u.id} ${u.role} ${u.category || ''}`.toLowerCase();
            return terms.every(term => searchString.includes(term));
        });
    }, [users, searchTerm]);

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        let role: Role; let category: UserCategory | undefined;
        switch (selectedProfileType) {
            case 'APRENDIZ': role = Role.USUARIO_MEDIALAB; category = UserCategory.APRENDIZ; break;
            case 'ADMINISTRATIVO': role = Role.USUARIO_MEDIALAB; category = UserCategory.ADMINISTRATIVO; break;
            case 'INSTRUCTOR_SENA': role = Role.USUARIO_MEDIALAB; category = UserCategory.INSTRUCTOR_SENA; break;
            case 'ADMIN_MEDIALAB': role = Role.INSTRUCTOR_MEDIALAB; category = undefined; break;
            default: role = Role.USUARIO_MEDIALAB; category = UserCategory.APRENDIZ;
        }
        const newUser: User = { id: newUserId, name: newUserName.toUpperCase(), role: role, category: category, email: role === Role.INSTRUCTOR_MEDIALAB ? newUserEmail : undefined };
        const result = await onAddNewUser(newUser);
        if (result.success) { setNewUserId(''); setNewUserName(''); setNewUserEmail(''); setSelectedProfileType('APRENDIZ'); } else { alert(result.message); }
    };

    const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const json = JSON.parse(event.target?.result as string);
                    if (Array.isArray(json) && onBatchUploadUsers) {
                        if(window.confirm(`¿Cargar ${json.length} usuarios a la nube?`)) {
                            setIsUploading(true);
                            const res = await onBatchUploadUsers(json, (c, t) => {
                                // console.log(`Procesados ${c} de ${t}`);
                            });
                            setIsUploading(false);
                            if(res.success) alert(res.message);
                            else alert("Error: " + res.message);
                        }
                    } else {
                        alert("El archivo no tiene formato de lista de usuarios válido.");
                    }
                } catch (error) {
                    alert("Error al leer JSON. Verifique el formato.");
                }
            };
            reader.readAsText(file);
        }
    };

    const downloadTemplate = () => {
        const template = [
            { 
                "id": "1234567890", 
                "name": "NOMBRE EJEMPLO", 
                "role": "USUARIO-MEDIALAB", 
                "category": "APRENDIZ" 
            },
            { 
                "id": "9876543210", 
                "name": "INSTRUCTOR EJEMPLO", 
                "role": "INSTRUCTOR-MEDIALAB", 
                "email": "ejemplo@sena.edu.co"
            }
        ];
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(template, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "plantilla_usuarios.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; const reader = new FileReader(); reader.onloadend = () => { if (typeof reader.result === 'string') { setEditPhoto(reader.result); } }; reader.readAsDataURL(file); } };
    const usersCount = users.length;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2"><UserGroupIcon className="w-5 h-5"/> Gestión de Usuarios</h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Base de datos de aprendices e instructores.</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                    <div className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-sm transition-all ${isOnline ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-gray-200 text-gray-700 border border-gray-300'}`}>
                        <WifiIcon className="w-4 h-4" />
                        {isOnline ? 'CONECTADO' : 'MODO LOCAL'}
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{usersCount}</p>
                        <p className="text-xs uppercase text-gray-500">Registrados</p>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Formulario Manual */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md"><h3 className="text-lg font-bold text-sena-dark dark:text-white mb-4 flex items-center gap-2"><UserPlusIcon className="w-5 h-5"/> Agregar Individual</h3>
                <form onSubmit={handleAddUser} className="grid grid-cols-1 gap-4">
                    <input 
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={newUserId} 
                        onChange={e => setNewUserId(e.target.value.replace(/[^0-9]/g, ''))} 
                        placeholder="ID (Cédula/TI)" 
                        className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-sena-blue-light font-mono" 
                        required 
                    />
                    <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Nombre Completo" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-sena-blue-light" required /><div className=""><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Tipo de Perfil</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setSelectedProfileType('APRENDIZ')} className={`p-2 text-sm rounded border ${selectedProfileType === 'APRENDIZ' ? 'bg-sena-green text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>Usuario / Aprendiz</button><button type="button" onClick={() => setSelectedProfileType('ADMINISTRATIVO')} className={`p-2 text-sm rounded border ${selectedProfileType === 'ADMINISTRATIVO' ? 'bg-sena-green text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>Usuario / Administrativo</button><button type="button" onClick={() => setSelectedProfileType('INSTRUCTOR_SENA')} className={`p-2 text-sm rounded border ${selectedProfileType === 'INSTRUCTOR_SENA' ? 'bg-sena-green text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>Usuario / Instructor SENA</button><button type="button" onClick={() => setSelectedProfileType('ADMIN_MEDIALAB')} className={`p-2 text-sm rounded border ${selectedProfileType === 'ADMIN_MEDIALAB' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>INSTRUCTOR-MEDIALAB (Admin)</button></div></div>{selectedProfileType === 'ADMIN_MEDIALAB' && (<input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Correo Institucional" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 w-full dark:text-sena-blue-light" />)}<button type="submit" className="bg-sena-green text-white font-bold py-2 px-4 rounded hover:bg-opacity-90 w-full">Registrar Usuario</button></form></div>
                
                {/* Carga Masiva */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-orange-200 dark:border-orange-900/30">
                     <h3 className="text-lg font-bold text-sena-dark dark:text-white mb-4 flex items-center gap-2"><UploadIcon className="w-5 h-5"/> Carga Masiva (Excel/JSON)</h3>
                     <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
                        1. Crea tu archivo en Excel siguiendo la estructura.<br/>
                        2. Convierte el Excel a JSON (o guarda como JSON).<br/>
                        3. Sube el archivo aquí.
                     </p>
                     
                     <div className="space-y-4">
                        <button 
                            onClick={downloadTemplate}
                            className="w-full py-2 border border-dashed border-gray-400 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                        >
                            Descargar Plantilla JSON de Ejemplo
                        </button>
                        
                        <div className="relative">
                            <label className={`w-full flex justify-center items-center px-4 py-3 bg-orange-600 text-white rounded-lg shadow-lg tracking-wide border border-blue cursor-pointer hover:bg-orange-700 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <CloudIcon className="w-6 h-6 mr-2" />
                                <span className="text-base leading-normal">{isUploading ? 'Cargando...' : 'Seleccionar Archivo JSON'}</span>
                                <input type='file' accept=".json" className="hidden" onChange={handleJsonUpload} disabled={isUploading} />
                            </label>
                        </div>
                     </div>
                </div>
            </div>

            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-gray-700 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                        Directorio de Usuarios ({filteredUsers.length})
                    </h3>
                    <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-sena-green focus:border-transparent sm:text-sm dark:text-white transition duration-150 ease-in-out"
                            placeholder="Buscar por nombre o ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Foto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Nombre</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Rol</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {u.photoURL ? (
                                                <img src={u.photoURL} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold text-xs">
                                                    {u.name.substring(0, 2)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-mono">{u.id}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 font-medium">{u.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.role === Role.INSTRUCTOR_MEDIALAB ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                {u.role === Role.INSTRUCTOR_MEDIALAB ? 'ADMIN' : u.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <button 
                                                onClick={() => { setEditingUser(u); setEditName(u.name); setEditEmail(u.email || ''); setEditPhoto(u.photoURL || ''); }} 
                                                className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        No se encontraron usuarios que coincidan con "{searchTerm}".
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

             <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Editar Perfil de Usuario"><div className="space-y-4"><div className="flex flex-col items-center justify-center gap-4 mb-6"><div className="relative w-24 h-24">{editPhoto ? (<img src={editPhoto} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-gray-100 dark:border-gray-700 shadow-sm" />) : (<div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-2xl text-gray-400 font-bold">{editName ? editName.substring(0,2) : 'User'}</div>)}<label htmlFor="photo-upload" className="absolute bottom-0 right-0 bg-sena-green text-white p-2 rounded-full cursor-pointer hover:bg-green-700 shadow-md transition-colors"><CameraIcon className="w-4 h-4" /><input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload}/></label></div><p className="text-xs text-gray-500">Click en la cámara para cambiar foto</p></div><div><label className="block text-sm font-bold mb-1 dark:text-gray-300">Nombre Completo</label><input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light dark:border-gray-600" /></div>{editingUser?.role === Role.INSTRUCTOR_MEDIALAB && (<div><label className="block text-sm font-bold mb-1 dark:text-gray-300">Correo Institucional</label><input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light dark:border-gray-600" /></div>)}<div className="pt-4 flex gap-2"><button onClick={() => setEditingUser(null)} className="w-1/2 bg-gray-300 text-gray-800 py-2 rounded font-bold hover:bg-gray-400 transition-colors">Cancelar</button><button onClick={() => { if(editingUser && onUpdateUser) { onUpdateUser({ ...editingUser, name: editName.toUpperCase(), email: editEmail, photoURL: editPhoto }); setEditingUser(null); } }} className="w-1/2 bg-sena-green text-white py-2 rounded font-bold hover:bg-opacity-90 transition-colors">Guardar Cambios</button></div></div></Modal>
        </div>
    );
};

const InventoryView: React.FC<DashboardProps> = ({ equipment, onAddNewEquipment, onUpdateInventory, onUpdateEquipmentImage, onEditEquipment, onDeleteEquipment }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredEquipment = useMemo(() => {
        if (!searchTerm) return equipment;
        const lowerTerm = searchTerm.toLowerCase();
        return equipment.filter(e => 
            e.id.toLowerCase().includes(lowerTerm) ||
            e.description.toLowerCase().includes(lowerTerm) ||
            e.status.toLowerCase().includes(lowerTerm) ||
            (e.type && e.type.toLowerCase().includes(lowerTerm))
        );
    }, [equipment, searchTerm]);

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <div>
                    <h3 className="text-lg font-bold text-purple-800 dark:text-purple-300 flex items-center gap-2">
                        <CollectionIcon className="w-5 h-5"/> Gestión de Inventario
                    </h3>
                    <p className="text-sm text-purple-600 dark:text-purple-400">
                        Control total de equipos y activos fijos.
                    </p>
                </div>
                <div className="flex items-center gap-4 text-right">
                    <div>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{equipment.length}</p>
                        <p className="text-xs uppercase text-gray-500">Total Items</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-gray-700 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                        Listado de Equipos ({filteredEquipment.length})
                    </h3>
                    <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-sena-green focus:border-transparent sm:text-sm dark:text-white transition duration-150 ease-in-out"
                            placeholder="Buscar por ID, nombre o estado..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="overflow-x-auto max-h-[600px]">
                     <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Imagen</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Placa (ID)</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Descripción</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                            {filteredEquipment.length > 0 ? (
                                filteredEquipment.map(e => (
                                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                {e.imageUrl ? (
                                                     <img className="h-10 w-10 rounded-full object-cover" src={e.imageUrl} alt="" />
                                                ) : (
                                                    <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                                                        <CollectionIcon className="h-5 w-5 text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900 dark:text-white">
                                            {e.id}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                                            {e.description}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {e.type}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                e.status === 'Disponible' 
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            }`}>
                                                {e.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button 
                                                onClick={() => onEditEquipment(e)}
                                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3"
                                            >
                                                Editar
                                            </button>
                                            <button 
                                                onClick={() => { if(window.confirm('¿Eliminar equipo?')) onDeleteEquipment(e.id); }}
                                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                        No se encontraron equipos que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                     </table>
                </div>
            </div>
        </div>
    );
};

const ActiveLoansView: React.FC<{ loans: LoanRecord[], onReturn: DashboardProps['onReturn'] }> = ({ loans, onReturn }) => {
    const activeLoans = loans.filter(l => !l.returnDate);
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
             <h3 className="text-lg font-bold mb-4 dark:text-white">Préstamos Activos ({activeLoans.length})</h3>
             {activeLoans.length === 0 ? <p className="text-gray-500">No hay préstamos activos.</p> : (
                 <ul className="space-y-4">
                     {activeLoans.map(loan => (
                         <li key={loan.id} className="border p-4 rounded dark:border-gray-700 flex justify-between items-center">
                             <div>
                                 <p className="font-bold dark:text-white">Préstamo: {loan.id}</p>
                                 <p className="text-sm text-gray-600 dark:text-gray-300">Equipo: {loan.equipmentId}</p>
                                 <p className="text-sm text-gray-600 dark:text-gray-300">Solicitante: {loan.borrowerId}</p>
                             </div>
                             <button 
                                onClick={() => onReturn(loan.id, 'Devolución normal', 'Bueno', [], '')}
                                className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                             >
                                 Registrar Devolución
                             </button>
                         </li>
                     ))}
                 </ul>
             )}
        </div>
    );
}

const NewLoanView: React.FC<{ users: User[], equipment: Equipment[], onNewLoan: DashboardProps['onNewLoan'] }> = ({ users, equipment, onNewLoan }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold mb-4 dark:text-white">Registrar Nuevo Préstamo</h3>
            <p className="text-gray-500">Use el panel de aprendiz para solicitar préstamos.</p>
        </div>
    );
};

const InstructorDashboard: React.FC<DashboardProps> = (props) => {
    const [currentView, setCurrentView] = useState<View>('home');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState('');

    const handleForceSync = async () => {
        if(window.confirm("¿Confirmar verificación y sincronización? Esto actualizará roles y contactos en la nube basados en la configuración local.")) {
            setIsSyncing(true);
            setSyncProgress("Iniciando...");
            await props.onForceSync((msg) => setSyncProgress(msg));
            setIsSyncing(false);
            setSyncProgress("");
        }
    };

    const renderView = () => {
        switch (currentView) {
            case 'home': return <HomeView loans={props.loans} equipment={props.equipment} onSuggestion={() => {}} />;
            case 'loans': return <ActiveLoansView loans={props.loans} onReturn={props.onReturn} />;
            case 'newLoan': return <NewLoanView users={props.users} equipment={props.equipment} onNewLoan={props.onNewLoan} />;
            case 'inventory': return <InventoryView {...props} />;
            case 'users': return <ManageUsersView {...props} />;
            default: return <HomeView loans={props.loans} equipment={props.equipment} onSuggestion={() => {}} />;
        }
    };

    return (
        <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)] gap-6">
            {/* Sidebar */}
            <aside className={`md:w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg flex-shrink-0 flex flex-col ${isMobileMenuOpen ? 'fixed inset-0 z-50 p-4' : 'hidden md:flex'}`}>
                <div className="flex justify-between md:hidden mb-4">
                    <span className="font-bold text-lg dark:text-white">Menú</span>
                    <button onClick={() => setIsMobileMenuOpen(false)}><XIcon className="w-6 h-6 dark:text-white" /></button>
                </div>
                <nav className="space-y-2 p-4 flex-grow">
                    <NavButton active={currentView === 'home'} onClick={() => { setCurrentView('home'); setIsMobileMenuOpen(false); }} icon={HomeIcon} label="Resumen" />
                    <NavButton active={currentView === 'loans'} onClick={() => { setCurrentView('loans'); setIsMobileMenuOpen(false); }} icon={ClipboardListIcon} label="Préstamos" />
                    <NavButton active={currentView === 'inventory'} onClick={() => { setCurrentView('inventory'); setIsMobileMenuOpen(false); }} icon={CollectionIcon} label="Inventario" />
                    <NavButton active={currentView === 'users'} onClick={() => { setCurrentView('users'); setIsMobileMenuOpen(false); }} icon={UserGroupIcon} label="Usuarios" />
                </nav>

                {/* Botón exclusivo SUPER-ADMIN o Instructor Específico */}
                {(props.currentUser.role === Role.SUPER_ADMIN || props.currentUser.id === '79653359') && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                        <button 
                            onClick={handleForceSync}
                            disabled={isSyncing}
                            className={`w-full flex flex-col items-center justify-center px-4 py-3 rounded-lg text-white font-bold transition-all shadow-md ${isSyncing ? 'bg-gray-400 cursor-wait' : 'bg-orange-600 hover:bg-orange-700'}`}
                        >
                            <div className="flex items-center gap-2">
                                {isSyncing ? <Spinner size="4" color="white" /> : <CloudIcon className="w-5 h-5" />}
                                <span className="text-sm">{isSyncing ? 'Procesando...' : 'Verificar y Sincronizar Nube'}</span>
                            </div>
                            {isSyncing && (
                                <span className="text-xs mt-1 font-normal opacity-90">{syncProgress}</span>
                            )}
                        </button>
                        {!isSyncing && (
                            <p className="text-[10px] text-gray-500 mt-2 text-center leading-tight">
                                Actualiza roles y datos de contacto en la nube.
                            </p>
                        )}
                    </div>
                )}
            </aside>

            {/* Mobile Menu Button */}
            <div className="md:hidden fixed bottom-6 right-6 z-40">
                <button onClick={() => setIsMobileMenuOpen(true)} className="bg-sena-green text-white p-3 rounded-full shadow-lg">
                    <MenuIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1">
                {renderView()}
            </div>
        </div>
    );
};

export default InstructorDashboard;
