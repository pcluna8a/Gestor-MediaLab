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
    const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('');

    const [selectedCategory, setSelectedCategory] = useState('');

    const availableEquipment = equipment
        .filter(e => e.status === EquipmentStatus.AVAILABLE)
        .filter(e => {
            if (!equipmentSearchTerm) return true;
            const term = equipmentSearchTerm.toLowerCase();
            return (
                e.name.toLowerCase().includes(term) ||
                e.id.toLowerCase().includes(term) ||
                e.description?.toLowerCase().includes(term)
            );
        });
    // ... (omitting eligibleUsers for brevity if possible, but replace_file_content needs exact match)
    // Filter users by category and search term
    const eligibleUsers = users
        .filter(u => {
            if (!selectedCategory) return u.role === Role.USUARIO_MEDIALAB; // Default behavior
            if (selectedCategory === 'INSTRUCTOR-MEDIALAB') return u.role === Role.INSTRUCTOR_MEDIALAB;
            return u.role === Role.USUARIO_MEDIALAB && u.category === selectedCategory;
        })
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
            setEquipmentSearchTerm('');
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md animate-fade-in">
            <h2 className="text-2xl font-bold text-sena-dark dark:text-white mb-6">Registrar Nuevo Préstamo (Manual)</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-2 uppercase tracking-wide">USUARIO</label>

                    {/* Category Filter */}
                    <select
                        value={selectedCategory}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setSelectedUser(''); // Reset selection when filter changes
                        }}
                        className="w-full mb-3 p-3 bg-gray-50 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-sena-green"
                    >
                        <option value="">Todos los Usuarios</option>
                        <option value="APRENDIZ">Usuario / Aprendiz</option>
                        <option value="ADMINISTRATIVO">Usuario / Administrativo</option>
                        <option value="INSTRUCTOR">Usuario / Instructor</option>
                        <option value="INSTRUCTOR-MEDIALAB">Instructor-MediaLab</option>
                    </select>

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
                            className="w-full pl-10 p-2 bg-gray-50 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-sena-green focus:border-transparent"
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 mt-4 uppercase tracking-wide">Equipo Disponible</label>
                    <div className="relative mb-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por Código, Nombre o Descripción..."
                            value={equipmentSearchTerm}
                            onChange={(e) => setEquipmentSearchTerm(e.target.value)}
                            className="w-full pl-10 p-2 bg-gray-50 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-sena-green focus:border-transparent"
                        />
                    </div>
                    <select
                        value={selectedEquipment}
                        onChange={(e) => setSelectedEquipment(e.target.value)}
                        className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        required
                        size={5}
                    >
                        {availableEquipment.length === 0 ? (
                            <option value="" disabled>No se encontraron equipos</option>
                        ) : (
                            !selectedEquipment && <option value="">Seleccionar Equipo...</option>
                        )}
                        {availableEquipment.map(e => (
                            <option key={e.id} value={e.id}>{e.name || e.id} - {e.id}</option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                        {availableEquipment.length} equipo(s) disponible(s).
                    </p>

                    {/* Equipment Preview Card */}
                    {selectedEquipment && (
                        <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50 flex flex-col sm:flex-row items-center gap-4 animate-fade-in">
                            {(() => {
                                const eq = availableEquipment.find(e => e.id === selectedEquipment);
                                if (!eq) return null;
                                return (
                                    <>
                                        <div className="w-24 h-24 flex-shrink-0 bg-white dark:bg-gray-700 rounded-md overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-600">
                                            {eq.imageUrl ? (
                                                <img src={eq.imageUrl} alt={eq.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-gray-400 text-xs">Sin imagen</span>
                                            )}
                                        </div>
                                        <div className="flex-1 text-center sm:text-left">
                                            <h4 className="text-lg font-bold text-gray-800 dark:text-white capitalize">{eq.name}</h4>
                                            <p className="text-sm text-sena-green font-semibold uppercase tracking-wide">{eq.type}</p>
                                            <p className="text-xs text-gray-500 mt-1">ID: {eq.id}</p>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>

                <button type="submit" className="w-full bg-sena-green text-white font-bold py-3 rounded-lg hover:bg-opacity-90 transition-colors">
                    Registrar Préstamo
                </button>
            </form>
        </div>
    );
};

export default NewLoanView;
