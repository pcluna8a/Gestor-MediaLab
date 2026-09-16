import React, { useState } from 'react';
import { User, LoanRecord, Equipment, EquipmentStatus, Role, createNewLoan, isValidUserFullName, isProfileIncomplete } from '../../types';
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
    const [formError, setFormError] = useState('');

    const [selectedCategory, setSelectedCategory] = useState('');

    const availableEquipment = equipment
        .filter(e => e.status === EquipmentStatus.AVAILABLE)
        .filter(e => {
            if (!equipmentSearchTerm) return true;
            const term = equipmentSearchTerm.toLowerCase();
            return (
                (e.name || '').toLowerCase().includes(term) ||
                (e.id || '').toLowerCase().includes(term) ||
                (e.description || '').toLowerCase().includes(term)
            );
        });

    const eligibleUsers = users
        .filter(u => {
            if (!selectedCategory) return true;
            if (selectedCategory === 'INSTRUCTOR-MEDIALAB') return u.role === Role.INSTRUCTOR_MEDIALAB;
            return u.role === Role.USUARIO_MEDIALAB && u.category === selectedCategory;
        })
        .filter(u => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            return (
                (u.name || '').toLowerCase().includes(term) ||
                (u.id || '').toLowerCase().includes(term)
            );
        });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (selectedUser && selectedEquipment) {
            // 1. REGLA: El prestatario NO puede ser el mismo equipo
            if (selectedUser === selectedEquipment) {
                setFormError("Error crítico: El ID del usuario prestatario no puede ser igual al ID del equipo a prestar.");
                return;
            }

            // 2. REGLA: El prestatario no puede ser un equipo de inventario
            const isUserAnEquipment = equipment.some(e => e.id === selectedUser);
            if (isUserAnEquipment) {
                setFormError("Error: El ID seleccionado corresponde a un equipo del inventario y no a un usuario real.");
                return;
            }

            // 3. REGLA: El prestatario debe tener Nombre y Apellido completos y correo
            const userObj = users.find(u => u.id === selectedUser);
            if (!userObj || isProfileIncomplete(userObj)) {
                setFormError("El usuario prestatario no tiene su Nombre, Apellido o Correo completos registrados. No se le puede prestar equipos hasta que complete sus datos.");
                return;
            }

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
            setFormError('');
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 shadow-2xl animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">Registrar Nuevo Préstamo <span className="text-[10px] uppercase tracking-widest text-gray-500 font-mono ml-2">Manual</span></h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-2 mt-2 uppercase tracking-widest">Usuario</label>

                    {/* Category Filter */}
                    <select
                        value={selectedCategory}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setSelectedUser('');
                        }}
                        className="w-full mb-3 p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all"
                    >
                        <option value="">Todos los Usuarios</option>
                        <option value="APRENDIZ">Usuario / Aprendiz</option>
                        <option value="ADMINISTRATIVO">Usuario / Administrativo</option>
                        <option value="INSTRUCTOR-SENA">Usuario / Instructor SENA</option>
                        <option value="INSTRUCTOR-MEDIALAB">Instructor-MediaLab</option>
                    </select>

                    {/* Search Filter input */}
                    <div className="relative mb-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por Nombre o Documento..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 p-2.5 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all"
                        />
                    </div>

                    <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-sena-green outline-none transition-all"
                        required
                        size={5}
                    >
                        {eligibleUsers.length === 0 ? (
                            <option value="" disabled>No se encontraron usuarios</option>
                        ) : (
                            !selectedUser && <option value="">Seleccionar Usuario...</option>
                        )}
                        {eligibleUsers.map(u => {
                            const incomplete = isProfileIncomplete(u);
                            const isEqMatch = equipment.some(e => e.id === u.id);
                            return (
                                <option 
                                    key={u.id} 
                                    value={u.id}
                                    disabled={incomplete || isEqMatch}
                                    className={incomplete || isEqMatch ? 'text-gray-500 italic' : 'text-white'}
                                >
                                    {u.name} - {u.id} {isEqMatch ? '❌ [ID DE EQUIPO - NO PERMITIDO]' : incomplete ? '⚠️ [DATOS INCOMPLETOS]' : ''}
                                </option>
                            );
                        })}
                    </select>
                    <p className="text-[10px] text-gray-500 mt-1 font-mono uppercase tracking-wider">
                        {eligibleUsers.length} usuario(s) encontrado(s).
                    </p>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-2 mt-4 uppercase tracking-widest">Equipo Disponible</label>
                    <div className="relative mb-2">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por Código, Nombre o Descripción..."
                            value={equipmentSearchTerm}
                            onChange={(e) => setEquipmentSearchTerm(e.target.value)}
                            className="w-full pl-10 p-2.5 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all"
                        />
                    </div>
                    <select
                        value={selectedEquipment}
                        onChange={(e) => setSelectedEquipment(e.target.value)}
                        className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-sena-green outline-none transition-all"
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
                    <p className="text-[10px] text-gray-500 mt-1 font-mono uppercase tracking-wider">
                        {availableEquipment.length} equipo(s) disponible(s).
                    </p>

                    {/* Equipment Preview Card */}
                    {selectedEquipment && (
                        <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col sm:flex-row items-center gap-4 animate-fade-in">
                            {(() => {
                                const eq = availableEquipment.find(e => e.id === selectedEquipment);
                                if (!eq) return null;
                                return (
                                    <>
                                        <div className="w-24 h-24 flex-shrink-0 bg-black/40 rounded-lg overflow-hidden flex items-center justify-center border border-white/10">
                                            {eq.imageUrl ? (
                                                <img src={eq.imageUrl} alt={eq.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-gray-500 text-xs">Sin imagen</span>
                                            )}
                                        </div>
                                        <div className="flex-1 text-center sm:text-left">
                                            <h4 className="text-lg font-bold text-white capitalize">{eq.name}</h4>
                                            <p className="text-sm text-sena-green font-semibold uppercase tracking-wide">{eq.type}</p>
                                            <p className="text-[10px] text-gray-500 mt-1 font-mono">ID: {eq.id}</p>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {formError && (
                    <div className="p-3 bg-red-950/60 border border-red-500/50 text-red-300 rounded-xl text-xs leading-relaxed animate-shake">
                        {formError}
                    </div>
                )}

                <button type="submit" className="w-full bg-sena-green text-white font-bold py-3 rounded-xl hover:shadow-[0_0_20px_rgba(57,169,0,0.4)] hover:scale-[1.02] active:scale-95 transition-all">
                    Registrar Préstamo
                </button>
            </form>
        </div>
    );
};

export default NewLoanView;
