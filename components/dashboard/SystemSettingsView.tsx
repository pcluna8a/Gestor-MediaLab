import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { CogIcon } from '../Icons';

const SystemSettingsView: React.FC = () => {
    const { systemSettings, isOnline } = useData();
    const { updateSystemSettings } = require('../../services/firebaseService');
    const { useToast } = require('../Toast');
    const { showToast } = useToast();

    const [isMaintenance, setIsMaintenance] = useState(systemSettings?.maintenanceMode || false);
    const [terms, setTerms] = useState(systemSettings?.termsAndConditions || "Normas generales de uso del equipo del MediaLab...");

    const handleSave = async () => {
        const result = await updateSystemSettings({
            maintenanceMode: isMaintenance,
            termsAndConditions: terms
        });

        if (result.success) {
            showToast("Ajustes del sistema guardados exitosamente", "success");
        } else {
            showToast("Error guardando los ajustes globales", "error");
        }
    };

    return (
        <div className="space-y-6 animate-fade-in text-gray-200">
            {/* Header / Stats */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <CogIcon className="w-6 h-6 text-sena-green" /> Ajustes Globales (SUPER-ADMIN)
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">Configuración principal y bloqueos de seguridad del sistema.</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className={`px-4 py-1.5 rounded-full text-xs font-bold border max-w-fit ${isOnline ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                        {isOnline ? '● ONLINE' : '○ LOCAL'}
                    </div>
                </div>
            </div>

            <div className="bg-white/5 p-6 rounded-xl border border-white/10 space-y-8">
                {/* Bloque: Moto de mantenimiento */}
                <div>
                    <h4 className="text-lg font-bold text-white mb-2 pb-2 border-b border-white/10">Modo Mantenimiento</h4>
                    <p className="text-sm text-gray-400 mb-4">
                        Al activar esta opción, ningún Instructor ni Aprendiz podrá registrar nuevos préstamos. Se mostrará un aviso de sistema no disponible. Los Super Administradores pueden evadir este bloqueo.
                    </p>
                    <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={isMaintenance}
                                onChange={() => setIsMaintenance(!isMaintenance)}
                            />
                            <div className={`block w-14 h-8 rounded-full transition-colors ${isMaintenance ? 'bg-red-500' : 'bg-white/10'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isMaintenance ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                        <div className="ml-4 font-bold text-sm tracking-wide">
                            {isMaintenance ? <span className="text-red-400">ACTIVADO: PRÉSTAMOS BLOQUEADOS</span> : <span className="text-gray-400">Inactivo (Operación Normal)</span>}
                        </div>
                    </label>
                </div>

                {/* Bloque: Términos y Condiciones */}
                <div>
                    <h4 className="text-lg font-bold text-white mb-2 pb-2 border-b border-white/10">Términos y Condiciones</h4>
                    <p className="text-sm text-gray-400 mb-4">
                        Este texto se le mostrará a los usuarios o instructores al momento de realizar el flujo de préstamo.
                    </p>
                    <textarea
                        value={terms}
                        onChange={(e) => setTerms(e.target.value)}
                        className="w-full h-48 p-4 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all resize-none text-sm font-mono"
                        placeholder="Escribe las políticas de MediaLab CIES..."
                    ></textarea>
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                    <button
                        onClick={handleSave}
                        className="bg-sena-green text-white font-bold py-3 px-8 rounded-lg hover:shadow-[0_0_15px_rgba(57,169,0,0.4)] transition-all hover:scale-[1.02] active:scale-95"
                    >
                        Guardar Configuración
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SystemSettingsView;
