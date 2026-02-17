import React, { useState, useEffect, useMemo } from 'react';
import { LoanRecord, Equipment, EquipmentStatus, MaintenanceSuggestion } from '../../types';
import { generateMaintenanceSuggestions } from '../../services/geminiService';
import { CollectionIcon, ClipboardListIcon, SparklesIcon, ChartBarIcon } from '../Icons';
import Spinner from '../Spinner';

interface HomeViewProps {
    loans: LoanRecord[];
    equipment: Equipment[];
}

const HomeView: React.FC<HomeViewProps> = ({ loans, equipment }) => {
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
        const onLoan = equipment.filter(e => e.status === EquipmentStatus.ON_LOAN).length;
        const available = equipment.filter(e => e.status === EquipmentStatus.AVAILABLE).length;
        return { total, onLoan, available };
    }, [equipment]);

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
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-4 border-l-4 border-blue-500">
                    <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                        <CollectionIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Equipos</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-4 border-l-4 border-yellow-500">
                    <div className="p-3 bg-yellow-100 rounded-full text-yellow-600">
                        <ClipboardListIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">En Préstamo</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.onLoan}</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-4 border-l-4 border-green-500">
                    <div className="p-3 bg-green-100 rounded-full text-green-600">
                        <SparklesIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Disponibles</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.available}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-sena-green" /> Tendencia de Préstamos (7 días)
                    </h3>
                    <div className="h-48 flex items-end justify-between gap-2">
                        {chartData.map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center w-full group">
                                <div className="relative w-full flex justify-center items-end h-40">
                                    <div
                                        className="w-full max-w-[30px] bg-sena-green rounded-t-md transition-all duration-500 hover:bg-green-600 relative group-hover:opacity-90"
                                        style={{ height: `${(item.count / maxCount) * 100}%` }}
                                    >
                                        <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {item.count}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-500 mt-2 uppercase font-semibold">{item.date}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AI Suggestions */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-purple-500" /> IA - Mantenimiento
                    </h3>
                    {isLoading ? (
                        <div className="flex justify-center py-8"><Spinner /></div>
                    ) : suggestions.length > 0 ? (
                        <div className="space-y-3 overflow-y-auto max-h-48">
                            {suggestions.map((s, i) => (
                                <div key={i} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                                    <p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase">{s.equipmentName}</p>
                                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">{s.suggestion}</p>
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
