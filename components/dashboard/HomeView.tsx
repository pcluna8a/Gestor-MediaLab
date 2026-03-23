import React, { useState, useEffect, useMemo } from 'react';
import { LoanRecord, Equipment, EquipmentStatus, MaintenanceSuggestion } from '../../types';
import { generateMaintenanceSuggestions } from '../../services/geminiService';
import { CollectionIcon, ClipboardListIcon, SparklesIcon, ChartBarIcon } from '../Icons';
import Spinner from '../Spinner';

interface HomeViewProps {
    loans: LoanRecord[];
    equipment: Equipment[];
    onTabChange?: (tab: any) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ loans, equipment, onTabChange }) => {
    const [suggestions, setSuggestions] = useState<MaintenanceSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSuggestions = async () => {
            setIsLoading(true);
            const maintSuggestions = await generateMaintenanceSuggestions(loans, equipment);
            setSuggestions(maintSuggestions);
            setIsLoading(false);
        };
        if (loans.length > 0) {
            fetchSuggestions();
        } else {
            setIsLoading(false);
        }
    }, [loans, equipment]);

    const stats = useMemo(() => {
        const total = equipment.length;
        const onLoan = loans.filter(l => !l.returnDate).length;
        const available = total - equipment.filter(e => e.status === EquipmentStatus.ON_LOAN).length;
        return { total, onLoan, available };
    }, [equipment, loans]);

    const chartData = useMemo(() => {
        const days = 7;
        const data = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            const count = loans.filter(l => {
                const loanDate = new Date(l.loanDate).toISOString().split('T')[0];
                return loanDate === dateStr;
            }).length;

            data.push({ date: d.toLocaleDateString('es-CO', { weekday: 'short' }), count });
        }
        return data;
    }, [loans]);

    const maxCount = Math.max(...chartData.map(d => d.count), 1);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                    onClick={() => onTabChange?.('inventory')}
                    className="bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/10 flex items-center gap-4 cursor-pointer hover:bg-white/10 hover:border-sena-green/30 hover:shadow-[0_0_15px_rgba(57,169,0,0.15)] transition-all active:scale-[0.98] group"
                >
                    <div className="p-3 bg-blue-500/20 rounded-full text-blue-400 group-hover:bg-blue-500/30 transition-colors">
                        <CollectionIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Total Equipos</p>
                        <p className="text-3xl font-bold text-white">{stats.total}</p>
                    </div>
                </div>
                <div
                    onClick={() => onTabChange?.('activeLoans')}
                    className="bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/10 flex items-center gap-4 cursor-pointer hover:bg-white/10 hover:border-yellow-500/30 hover:shadow-[0_0_15px_rgba(234,179,8,0.15)] transition-all active:scale-[0.98] group"
                >
                    <div className="p-3 bg-yellow-500/20 rounded-full text-yellow-400 group-hover:bg-yellow-500/30 transition-colors">
                        <ClipboardListIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">En Préstamo</p>
                        <p className="text-3xl font-bold text-yellow-400">{stats.onLoan}</p>
                    </div>
                </div>
                <div
                    onClick={() => onTabChange?.('inventory')}
                    className="bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/10 flex items-center gap-4 cursor-pointer hover:bg-white/10 hover:border-sena-green/30 hover:shadow-[0_0_15px_rgba(57,169,0,0.15)] transition-all active:scale-[0.98] group"
                >
                    <div className="p-3 bg-sena-green/20 rounded-full text-sena-green group-hover:bg-sena-green/30 transition-colors">
                        <SparklesIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Disponibles</p>
                        <p className="text-3xl font-bold text-sena-green">{stats.available}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-sena-green" /> Tendencia de Préstamos (7 días)
                    </h3>
                    <div className="h-48 flex items-end justify-between gap-2">
                        {chartData.map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center w-full group">
                                <div className="relative w-full flex justify-center items-end h-40">
                                    <div
                                        className="w-full max-w-[30px] bg-sena-green/80 rounded-t-md transition-all duration-500 hover:bg-sena-green relative group-hover:shadow-[0_0_8px_rgba(57,169,0,0.4)]"
                                        style={{ height: `${Math.max((item.count / maxCount) * 100, 4)}%` }}
                                    >
                                        <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {item.count}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-[10px] text-gray-500 mt-2 uppercase font-semibold tracking-wider">{item.date}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AI Suggestions */}
                <div className="bg-white/5 backdrop-blur-md p-6 rounded-xl border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-purple-400" /> IA - Mantenimiento
                    </h3>
                    {isLoading ? (
                        <div className="flex justify-center py-8"><Spinner /></div>
                    ) : suggestions.length > 0 ? (
                        <div className="space-y-3 overflow-y-auto max-h-48">
                            {suggestions.map((s, i) => (
                                <div key={i} className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                                    <p className="text-xs font-bold text-purple-300 uppercase">{s.equipmentName}</p>
                                    <p className="text-xs text-gray-400 mt-1">{s.suggestion}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic text-center py-4">No hay suficiente data para sugerencias aún.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomeView;
