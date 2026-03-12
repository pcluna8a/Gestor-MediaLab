import React, { useState } from 'react';
import { User, Role, UserCategory } from '../../types';
import { UserGroupIcon, UserPlusIcon, SearchIcon, UploadIcon, CameraIcon } from '../Icons';
import Modal from '../Modal';
import Pagination from '../Pagination';

interface ManageUsersViewProps {
    users: User[];
    onAddNewUser: (newUser: User) => { success: boolean; message: string };
    onUpdateUser: (user: User) => void;
    isOnline: boolean;
}

const ManageUsersView: React.FC<ManageUsersViewProps> = ({ users, onAddNewUser, onUpdateUser, isOnline }) => {
    const [newUserId, setNewUserId] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState<Role>(Role.USUARIO_MEDIALAB);
    const [newUserCategory, setNewUserCategory] = useState<UserCategory>(UserCategory.APRENDIZ);
    const [newUserEmail, setNewUserEmail] = useState('');

    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editRole, setEditRole] = useState<Role>(Role.USUARIO_MEDIALAB);
    const [editPhoto, setEditPhoto] = useState('');

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        const newUser: User = {
            id: newUserId,
            name: newUserName.toUpperCase(),
            role: newUserRole,
            category: newUserRole === Role.USUARIO_MEDIALAB ? newUserCategory : undefined,
            email: newUserRole === Role.INSTRUCTOR_MEDIALAB ? newUserEmail : undefined,
        };

        const result = onAddNewUser(newUser);

        // Handle result (sync or basic object check) - In App.tsx it returns a helpful object now.
        // If it's a promise, we can't check .success synchronously.
        // However, standard flow here assumes optimization in parent or fire-and-forget for now with toast.

        setNewUserId('');
        setNewUserName('');
        setNewUserEmail('');
        setNewUserRole(Role.USUARIO_MEDIALAB);
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditPhoto(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setEditName(user.name);
        setEditEmail(user.email || '');
        setEditRole(user.role);
        setEditPhoto(user.photoURL || '');
    };

    const handleUpdateClick = () => {
        if (editingUser && onUpdateUser) {
            onUpdateUser({
                ...editingUser,
                name: editName.toUpperCase(),
                email: editEmail,
                role: editRole,
                photoURL: editPhoto || undefined
            });
            setEditingUser(null);
            setEditPhoto('');
        }
    };

    // Filtered and Sorted Users: Filter by search term, then Sort A-Z by Name
    const filteredUsers = users.filter(u => {
        const search = userSearchTerm.toLowerCase();
        return (
            (u.id && u.id.toLowerCase().includes(search)) ||
            (u.name && u.name.toLowerCase().includes(search)) ||
            (u.email && u.email.toLowerCase().includes(search))
        );
    });

    const sortedUsers = [...filteredUsers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const usersCount = users.length;
    const filteredCount = filteredUsers.length;

    const totalPages = Math.ceil(sortedUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = sortedUsers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <div className="space-y-6 animate-fade-in text-gray-200">
            {/* Header / Stats */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <UserGroupIcon className="w-6 h-6 text-sena-green" /> Gestión de Usuarios
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">Base de datos centralizada de aprendices e instructores.</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${isOnline ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                        {isOnline ? '● ONLINE' : '○ LOCAL'}
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-white leading-none">{usersCount}</p>
                        <p className="text-[10px] uppercase tracking-widest text-gray-500">Registrados</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Formulario Agregar Usuario */}
                <div className="lg:col-span-1 bg-white/5 p-6 rounded-xl border border-white/10 h-fit">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                        <UserPlusIcon className="w-5 h-5 text-sena-green" /> Nuevo Usuario
                    </h3>
                    <form onSubmit={handleAddUser} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Identificación</label>
                            <input type="text" value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="Cédula / TI" className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all" required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1">Nombre Completo</label>
                            <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Nombres y Apellidos" className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all" required />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Rol</label>
                                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as Role)} className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-sena-green outline-none appearance-none">
                                    <option value={Role.USUARIO_MEDIALAB} className="bg-sena-dark">Usuario</option>
                                    <option value={Role.INSTRUCTOR_MEDIALAB} className="bg-sena-dark">Instructor</option>
                                </select>
                            </div>

                            {newUserRole === Role.USUARIO_MEDIALAB && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Categoría</label>
                                    <select value={newUserCategory} onChange={e => setNewUserCategory(e.target.value as UserCategory)} className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-sena-green outline-none appearance-none">
                                        <option value={UserCategory.APRENDIZ} className="bg-sena-dark">Aprendiz</option>
                                        <option value={UserCategory.ADMINISTRATIVO} className="bg-sena-dark">Admin.</option>
                                        <option value={UserCategory.INSTRUCTOR} className="bg-sena-dark">Instr. (Inv.)</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {newUserRole === Role.INSTRUCTOR_MEDIALAB && (
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Correo Electrónico</label>
                                <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="@sena.edu.co" className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:border-sena-green outline-none transition-all" />
                            </div>
                        )}

                        <button type="submit" className="w-full bg-sena-green text-white font-bold py-3 px-4 rounded-lg hover:shadow-[0_0_15px_rgba(57,169,0,0.4)] transition-all hover:scale-[1.02] active:scale-95 mt-4">
                            Registrar Usuario
                        </button>
                    </form>
                </div>

                {/* Tabla Usuarios */}
                <div className="lg:col-span-2 bg-white/5 rounded-xl border border-white/10 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex flex-col">
                            <h4 className="font-bold text-gray-200">Directorio de Usuarios</h4>
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                                {userSearchTerm ? `Filtrados: ${filteredCount} de ${usersCount}` : 'Ordenado A-Z'}
                            </span>
                        </div>
                        <div className="relative w-full md:w-64">
                            <input
                                type="text"
                                value={userSearchTerm}
                                onChange={e => { setUserSearchTerm(e.target.value); setCurrentPage(1); }}
                                placeholder="Buscar ID o nombre..."
                                className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-full text-sm text-white placeholder-gray-600 focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all"
                                aria-label="Buscar usuarios"
                            />
                            <div className="absolute left-3.5 top-2.5 text-gray-500">
                                <SearchIcon className="w-4 h-4" />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        <table className="min-w-full divide-y divide-white/10 text-left">
                            <thead className="bg-black/20 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Nombre</th>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Rol</th>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {paginatedUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 text-sm font-mono text-gray-400 group-hover:text-white">
                                            <div className="flex items-center gap-3">
                                                {u.photoURL ? (
                                                    <img src={u.photoURL} alt={u.name} className="w-8 h-8 rounded-full object-cover border border-white/20" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                                                        <span className="text-[10px] text-gray-400">{(u.name || 'U').substring(0, 2).toUpperCase()}</span>
                                                    </div>
                                                )}
                                                {u.id}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-white">{u.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-400">
                                            <span className={`px-2 py-1 rounded text-xs ${u.role === Role.INSTRUCTOR_MEDIALAB ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-gray-300'}`}>
                                                {u.role === Role.INSTRUCTOR_MEDIALAB ? 'INSTRUCTOR' : u.category || 'APRENDIZ'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <button onClick={() => openEditModal(u)} className="text-sena-green hover:text-green-400 transition-colors" aria-label={`Editar usuario ${u.name}`}>Editar</button>
                                        </td>
                                    </tr>
                                ))}
                                {sortedUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">
                                            No hay usuarios registrados.
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
                        totalItems={sortedUsers.length}
                        itemsPerPage={ITEMS_PER_PAGE}
                    />
                </div>
            </div>

            <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Editar Usuario">
                <div className="space-y-4">
                    {editRole === Role.INSTRUCTOR_MEDIALAB && (
                        <div className="flex flex-col items-center mb-6 pt-2">
                            <div className="relative group cursor-pointer">
                                {editPhoto ? (
                                    <img src={editPhoto} alt="Preview" className="w-32 h-32 rounded-xl object-cover border-2 border-sena-green shadow-[0_0_15px_rgba(57,169,0,0.3)]" />
                                ) : (
                                    <div className="w-32 h-32 rounded-xl bg-white/5 border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-gray-500 hover:border-sena-green hover:text-sena-green transition-all">
                                        <CameraIcon className="w-8 h-8 mb-2" />
                                        <span className="text-[10px] font-bold uppercase">Sin Foto</span>
                                    </div>
                                )}
                                <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity cursor-pointer">
                                    <UploadIcon className="w-6 h-6 text-white" />
                                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                                </label>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-widest font-bold">Fotografía de Perfil</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Identificación (No editable)</label>
                        <input type="text" value={editingUser?.id || ''} disabled className="w-full p-3 bg-white/5 border border-white/10 rounded-lg text-gray-500 cursor-not-allowed outline-none" />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Nombre Completo</label>
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all" />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Correo Electrónico</label>
                        <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all" />
                    </div>

                    <div className="pt-2">
                        <button onClick={handleUpdateClick} className="w-full bg-sena-green text-white font-bold py-3 px-4 rounded-lg hover:shadow-[0_0_15px_rgba(57,169,0,0.4)] transition-all hover:scale-[1.02] active:scale-95">Guardar Cambios</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ManageUsersView;
