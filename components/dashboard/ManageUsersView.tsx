import React, { useState } from 'react';
import { User, Role, UserCategory } from '../../types';
import { UserGroupIcon, UserPlusIcon } from '../Icons';
import Modal from '../Modal';

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

    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editRole, setEditRole] = useState<Role>(Role.USUARIO_MEDIALAB);

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

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setEditName(user.name);
        setEditEmail(user.email || '');
        setEditRole(user.role);
    };

    const handleUpdateClick = () => {
        if (editingUser && onUpdateUser) {
            onUpdateUser({
                ...editingUser,
                name: editName.toUpperCase(),
                email: editEmail,
                role: editRole
            });
            setEditingUser(null);
        }
    };

    // Sorted Users: A-Z by Name
    const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));
    const usersCount = users.length;

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
                    <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
                        <h4 className="font-bold text-gray-200">Directorio de Usuarios</h4>
                        <span className="text-xs text-gray-500">Ordenado A-Z</span>
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
                                {sortedUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 text-sm font-mono text-gray-400 group-hover:text-white">{u.id}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-white">{u.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-400">
                                            <span className={`px-2 py-1 rounded text-xs ${u.role === Role.INSTRUCTOR_MEDIALAB ? 'bg-blue-500/20 text-blue-300' : 'bg-white/10 text-gray-300'}`}>
                                                {u.role === Role.INSTRUCTOR_MEDIALAB ? 'INSTRUCTOR' : u.category || 'APRENDIZ'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <button onClick={() => openEditModal(u)} className="text-sena-green hover:text-green-400 transition-colors">Editar</button>
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
                </div>
            </div>

            {/* Modal Edición */}
            <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Editar Usuario">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1">Nombre</label>
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-2 border rounded" />
                    </div>
                    {editRole === Role.INSTRUCTOR_MEDIALAB && (
                        <div>
                            <label className="block text-sm font-bold mb-1">Email</label>
                            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full p-2 border rounded" />
                        </div>
                    )}
                    <button onClick={handleUpdateClick} className="w-full bg-sena-green text-white py-2 rounded">Guardar Cambios</button>
                </div>
            </Modal>
        </div>
    );
};

export default ManageUsersView;
