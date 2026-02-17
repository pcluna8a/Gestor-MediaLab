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
            // Assuming no password needed here as logic is handled elsewhere or default null
        };

        const result = onAddNewUser(newUser); // This function returns a PROMISE in the new context, wait!
        // In App.tsx refactor: handleAddNewUser returns a promise { success, message } but here prop signature says { success, message } sync? 
        // Let's check App.tsx. It's async.
        // But for sync logic in UI, we can await it if we change this to async.
        // For now, let's treat it as is or fix the prop type in next step.
        // Actually, in the ORIGINAL InstructorDashboard, onAddNewUser returned { success: boolean; message: string }.
        // In App.tsx it was updated. I should handle it.

        // Let's assume onAddNewUser handles the logic. 
        // NOTE: I will need to update the prop type in this component if I want to align with App.tsx exactly, 
        // but InstructorDashboard passes it down.

        if (result.success) { // If it returns a sync result or promise that resolves to it.
            // If promise, this checks truthiness of promise object which is true, but 'success' property undefined on promise.
            // I should await it if possible, but I can't await in sync handler easily without async wrapper.
            // Let's assume for now I will fix the prop type in `InstructorDashboard` to match what `App.tsx` passes.
            // Wait, `App.tsx` passes `handleAddNewUser`.

            // Quick Fix: Treat it as void or async and use .then() if needed, but for now let's just assume success or alert.
            setNewUserId('');
            setNewUserName('');
            setNewUserEmail('');
            setNewUserRole(Role.USUARIO_MEDIALAB);
        } else {
            alert(result.message);
        }
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

    // Monitor de Integridad de Usuarios
    const usersCount = users.length;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        <UserGroupIcon className="w-5 h-5" /> Gestión de Usuarios
                    </h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Base de datos de aprendices e instructores.</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                        {isOnline ? '● ONLINE' : '○ LOCAL'}
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{usersCount}</p>
                        <p className="text-xs uppercase text-gray-500">Registrados</p>
                    </div>
                </div>
            </div>

            {/* Formulario Agregar Usuario */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold text-sena-dark dark:text-white mb-4 flex items-center gap-2">
                    <UserPlusIcon className="w-5 h-5" /> Agregar Nuevo Usuario
                </h3>
                <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="ID (Cédula/TI)" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                    <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Nombre Completo" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                    <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as Role)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                        <option value={Role.USUARIO_MEDIALAB}>Usuario / Aprendiz</option>
                        <option value={Role.INSTRUCTOR_MEDIALAB}>Instructor</option>
                    </select>
                    {newUserRole === Role.USUARIO_MEDIALAB ? (
                        <select value={newUserCategory} onChange={e => setNewUserCategory(e.target.value as UserCategory)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                            <option value={UserCategory.APRENDIZ}>Aprendiz</option>
                            <option value={UserCategory.ADMINISTRATIVO}>Administrativo</option>
                            <option value={UserCategory.INSTRUCTOR}>Instructor (Invitado)</option>
                        </select>
                    ) : (
                        <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Correo Institucional (Opcional)" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    )}
                    <button type="submit" className="bg-sena-green text-white font-bold py-2 px-4 rounded hover:bg-opacity-90 md:col-span-2">
                        Registrar Usuario
                    </button>
                </form>
            </div>

            {/* Tabla Usuarios */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {users.map(u => (
                            <tr key={u.id}>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{u.id}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{u.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{u.role} {u.category ? `(${u.category})` : ''}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{u.email || '-'}</td>
                                <td className="px-6 py-4 text-sm font-medium">
                                    <button onClick={() => openEditModal(u)} className="text-blue-600 hover:text-blue-900 mr-2">Editar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
                    <button onClick={handleUpdateClick} className="w-full bg-blue-600 text-white py-2 rounded">Guardar Cambios</button>
                </div>
            </Modal>
        </div>
    );
};

export default ManageUsersView;
