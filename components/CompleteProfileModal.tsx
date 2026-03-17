import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserCategory } from '../types';
import Spinner from './Spinner';

export const CompleteProfileModal: React.FC = () => {
    const { pendingProfileUser, completeProfile, logout } = useAuth();
    
    const [idInput, setIdInput] = useState('');
    const [category, setCategory] = useState<UserCategory | ''>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!pendingProfileUser) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        const cleanId = idInput.trim().replace(/[^0-9]/g, '');
        if (!cleanId || cleanId.length < 5) {
            setError("Por favor ingresa un número de documento válido.");
            return;
        }
        
        if (!category) {
            setError("Por favor selecciona tu categoría Institucional.");
            return;
        }

        setLoading(true);
        const result = await completeProfile(cleanId, category as UserCategory);
        
        if (!result.success) {
            setError(result.error || "Ocurrió un error al vincular tu perfil.");
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-sena-dark/90 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
                <div className="text-center mb-6">
                    <img src="/logoSena.png" alt="SENA" className="w-16 h-16 mx-auto mb-4 dark:brightness-0 dark:invert rounded-full bg-white p-2 border-2 border-sena-green" />
                    <h2 className="text-2xl font-bold text-sena-dark dark:text-white mb-2">Completar Perfil</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Para usar Gestor MediaLab necesitamos vincular tu cuenta con tu Documento de Identidad (ID).
                    </p>
                    <p className="text-xs font-mono bg-gray-100 dark:bg-gray-700/50 p-2 rounded mt-2 text-sena-green">
                        {pendingProfileUser.email || pendingProfileUser.displayName || 'Usuario Nuevo'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-1">
                            Documento de Identidad
                        </label>
                        <input
                            type="text"
                            value={idInput}
                            onChange={(e) => setIdInput(e.target.value)}
                            placeholder="Ej: 1005... (Solo números)"
                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sena-dark dark:text-white focus:ring-2 focus:ring-sena-green transition-all outline-none font-mono"
                            required
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Este será tu identificador único en el sistema.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest mb-1">
                            Categoría SENA
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as UserCategory)}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sena-dark dark:text-white focus:ring-2 focus:ring-sena-green transition-all outline-none"
                            required
                        >
                            <option value="" disabled>Selecciona tu categoría...</option>
                            {Object.values(UserCategory).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {error && <div className="p-3 bg-red-100/50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}

                    <div className="pt-2 flex flex-col gap-3">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-sena-green text-white font-bold py-3 rounded-xl hover:shadow-[0_0_15px_rgba(57,169,0,0.5)] transition-all flex justify-center items-center h-12"
                        >
                            {loading ? <Spinner size="5" color="white" /> : 'Vincular y Continuar'}
                        </button>
                        <button
                            type="button"
                            onClick={logout}
                            disabled={loading}
                            className="w-full text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-semibold transition-colors"
                        >
                            Cancelar y Salir
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
