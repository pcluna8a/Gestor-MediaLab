import React, { useState } from 'react';
import { User, LoanRecord, Equipment, EquipmentStatus, Role, createNewLoan } from '../../types';
import { SearchIcon } from '../Icons';

interface NewLoanViewProps {
    users: User[];
    equipment: Equipment[];
    onNewLoan: (loan: LoanRecord) => void;
    currentUser: User;
}

const NewLoanView: React.FC<NewLoanViewProps> = ({ users, equipment, onNewLoan, currentUser }) => {
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedEquipment, setSelectedEquipment] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const availableEquipment = equipment.filter(e => e.status === EquipmentStatus.AVAILABLE);

    // Filter users by role and search term
    const eligibleUsers = users
        .filter(u => u.role === Role.USUARIO_MEDIALAB)
        .filter(u => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
                u.name.toLowerCase().includes(term) ||
                u.id.includes(term)
            );
        });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedUser && selectedEquipment) {
            const newLoan = createNewLoan({
                equipmentId: selectedEquipment,
                borrowerId: selectedUser,
                instructorId: currentUser.id,
            });
            onNewLoan(newLoan);
            setSelectedUser('');
            setSelectedEquipment('');
            setSearchTerm('');
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md animate-fade-in">
            <h2 className="text-2xl font-bold text-sena-dark dark:text-white mb-6">Registrar Nuevo Préstamo (Manual)</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Aprendiz / Usuario</label>

                    {/* Search Filter input */}
                    <div className="relative mb-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por Nombre o Documento..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-sena-green focus:border-transparent"
                        />
                    </div>

                    <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        required
                        size={5} // Show multiple options to make selection easier after filtering
                    >
                        {eligibleUsers.length === 0 ? (
                            <option value="" disabled>No se encontraron usuarios</option>
                        ) : (
                            // Add a default option if no user is selected yet, but only if not searching or if needed
                            !selectedUser && <option value="">Seleccionar Usuario...</option>
                        )}
                        {eligibleUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name} - {u.id}</option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                        {eligibleUsers.length} usuario(s) encontrado(s).
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Equipo Disponible</label>
                    <select
                        value={selectedEquipment}
                        onChange={(e) => setSelectedEquipment(e.target.value)}
                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        required
                    >
                        <option value="">Seleccionar Equipo</option>
                        {availableEquipment.map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.type}) - {e.id}</option>
                        ))}
                    </select>
                </div>

                <button type="submit" className="w-full bg-sena-green text-white font-bold py-3 rounded-lg hover:bg-opacity-90 transition-colors">
                    Registrar Préstamo
                </button>
            </form>
        </div>
    );
};

export default NewLoanView;
