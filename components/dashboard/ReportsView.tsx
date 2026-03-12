import React, { useState, useMemo } from 'react';
import { LoanRecord, Equipment } from '../../types';
import { DocumentReportIcon, SparklesIcon, DownloadIcon, ChartBarIcon } from '../Icons';
import { generateLoanReportAnalysis } from '../../services/geminiService';
import jsPDF from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface ReportsViewProps {
    loans: LoanRecord[];
    equipment?: Equipment[];
}

const CHART_COLORS = ['#39A900', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const ReportsView: React.FC<ReportsViewProps> = ({ loans, equipment = [] }) => {
    const [analysis, setAnalysis] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Filter loans by date range
    const filteredLoans = useMemo(() => {
        return loans.filter(l => {
            const loanDate = new Date(l.loanDate);
            if (dateFrom && loanDate < new Date(dateFrom)) return false;
            if (dateTo && loanDate > new Date(dateTo + 'T23:59:59')) return false;
            return true;
        });
    }, [loans, dateFrom, dateTo]);

    // Stats
    const stats = useMemo(() => {
        const total = filteredLoans.length;
        const active = filteredLoans.filter(l => !l.returnDate).length;
        const returned = filteredLoans.filter(l => l.returnDate).length;

        // Average duration (for returned loans)
        const durations = filteredLoans
            .filter(l => l.returnDate)
            .map(l => {
                const start = new Date(l.loanDate).getTime();
                const end = new Date(l.returnDate!).getTime();
                return (end - start) / (1000 * 60 * 60); // hours
            });
        const avgDuration = durations.length > 0
            ? (durations.reduce((a, b) => a + b, 0) / durations.length)
            : 0;

        return { total, active, returned, avgDuration };
    }, [filteredLoans]);

    // Monthly chart data
    const monthlyData = useMemo(() => {
        const months: Record<string, number> = {};
        filteredLoans.forEach(l => {
            const d = new Date(l.loanDate);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months[key] = (months[key] || 0) + 1;
        });

        return Object.entries(months)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12)
            .map(([month, count]) => {
                const [y, m] = month.split('-');
                const date = new Date(Number(y), Number(m) - 1);
                return {
                    name: date.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
                    préstamos: count
                };
            });
    }, [filteredLoans]);

    // Equipment type distribution
    const typeData = useMemo(() => {
        const types: Record<string, number> = {};
        filteredLoans.forEach(l => {
            const eq = equipment.find(e => e.id === l.equipmentId);
            const type = eq?.type || 'Desconocido';
            types[type] = (types[type] || 0) + 1;
        });
        return Object.entries(types).map(([name, value]) => ({ name, value }));
    }, [filteredLoans, equipment]);

    // Top borrowed equipment
    const topEquipment = useMemo(() => {
        const counts: Record<string, { name: string, count: number }> = {};
        filteredLoans.forEach(l => {
            const eq = equipment.find(e => e.id === l.equipmentId);
            const name = eq?.name || l.equipmentId;
            if (!counts[l.equipmentId]) counts[l.equipmentId] = { name, count: 0 };
            counts[l.equipmentId].count++;
        });
        return Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [filteredLoans, equipment]);

    const generatePDFReport = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Reporte General de Préstamos - MediaLab", 14, 22);
        doc.setFontSize(11);
        doc.text(`Fecha de corte: ${new Date().toLocaleDateString()}`, 14, 30);
        if (dateFrom || dateTo) {
            doc.text(`Rango: ${dateFrom || 'inicio'} — ${dateTo || 'hoy'}`, 14, 37);
        }

        let y = 45;
        // Stats summary
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Resumen:", 14, y); y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Total préstamos: ${stats.total}`, 14, y); y += 6;
        doc.text(`Activos: ${stats.active}`, 14, y); y += 6;
        doc.text(`Devueltos: ${stats.returned}`, 14, y); y += 6;
        doc.text(`Duración promedio: ${stats.avgDuration.toFixed(1)} horas`, 14, y); y += 12;

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Detalle de préstamos:", 14, y); y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);

        filteredLoans.forEach((l, i) => {
            if (y > 280) { doc.addPage(); y = 20; }
            const status = l.returnDate ? `Devuelto: ${new Date(l.returnDate).toLocaleDateString()}` : "Activo";
            doc.text(`${i + 1}. ${l.equipmentId} - ${l.borrowerId} (${status})`, 14, y);
            y += 6;
        });
        doc.save("Reporte_General_MediaLab.pdf");
    };

    const handleAIAnalysis = async () => {
        setIsGenerating(true);
        const result = await generateLoanReportAnalysis(filteredLoans.slice(0, 50));
        setAnalysis(result);
        setIsGenerating(false);
    };

    const formatDuration = (hours: number) => {
        if (hours < 1) return `${Math.round(hours * 60)} min`;
        if (hours < 24) return `${hours.toFixed(1)} hrs`;
        return `${(hours / 24).toFixed(1)} días`;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Date Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-end bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Desde</label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-full p-2.5 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:border-sena-green outline-none transition-all"
                        aria-label="Fecha desde"
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Hasta</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full p-2.5 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:border-sena-green outline-none transition-all"
                        aria-label="Fecha hasta"
                    />
                </div>
                {(dateFrom || dateTo) && (
                    <button
                        onClick={() => { setDateFrom(''); setDateTo(''); }}
                        className="px-4 py-2.5 bg-white/10 text-gray-300 text-sm rounded-lg hover:bg-white/20 transition-all"
                        aria-label="Limpiar filtros de fecha"
                    >
                        Limpiar
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                    <p className="text-3xl font-bold text-white">{stats.total}</p>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Total Préstamos</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                    <p className="text-3xl font-bold text-yellow-400">{stats.active}</p>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Activos</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                    <p className="text-3xl font-bold text-sena-green">{stats.returned}</p>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Devueltos</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-center">
                    <p className="text-3xl font-bold text-blue-400">{formatDuration(stats.avgDuration)}</p>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mt-1">Duración Prom.</p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Monthly Bar Chart */}
                <div className="lg:col-span-2 bg-white/5 p-6 rounded-xl border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-sena-green" /> Préstamos por Mes
                    </h3>
                    {monthlyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                    labelStyle={{ color: '#9CA3AF' }}
                                />
                                <Bar dataKey="préstamos" fill="#39A900" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-gray-500 italic text-center py-8">No hay datos para el rango seleccionado.</p>
                    )}
                </div>

                {/* Pie Chart */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-purple-400" /> Por Tipo de Equipo
                    </h3>
                    {typeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={typeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={3}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    labelLine={false}
                                >
                                    {typeData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-gray-500 italic text-center py-8">Sin datos.</p>
                    )}
                </div>
            </div>

            {/* Top Equipment + Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Top Borrowed */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4">🏆 Top 5 Más Prestados</h3>
                    {topEquipment.length > 0 ? (
                        <div className="space-y-3">
                            {topEquipment.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                            idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                            idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                                            idx === 2 ? 'bg-amber-700/20 text-amber-600' :
                                            'bg-white/10 text-gray-400'
                                        }`}>
                                            {idx + 1}
                                        </span>
                                        <span className="text-sm text-gray-300 truncate max-w-[150px]">{item.name}</span>
                                    </div>
                                    <span className="text-sm font-bold text-sena-green">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic text-center py-4">Sin datos.</p>
                    )}
                </div>

                {/* PDF Export */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <DocumentReportIcon className="w-5 h-5 text-gray-400" /> Exportar
                    </h3>
                    <p className="text-gray-500 text-sm mb-4">Descarga el historial completo de transacciones en PDF.</p>
                    <button
                        onClick={generatePDFReport}
                        className="w-full bg-white/10 text-white py-3 rounded-xl hover:bg-white/20 transition-all flex justify-center gap-2 font-semibold border border-white/10"
                        aria-label="Descargar reporte PDF"
                    >
                        <DownloadIcon className="w-5 h-5" /> Descargar PDF
                    </button>
                </div>

                {/* AI Analysis */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-purple-500" /> Análisis IA
                    </h3>
                    <p className="text-gray-500 text-sm mb-4">Pide a la IA que busque patrones y problemas.</p>
                    <button
                        onClick={handleAIAnalysis}
                        disabled={isGenerating}
                        className="w-full bg-purple-600/80 text-white py-3 rounded-xl hover:bg-purple-600 transition-all disabled:opacity-50 font-semibold border border-purple-500/30"
                        aria-label="Generar análisis con inteligencia artificial"
                    >
                        {isGenerating ? 'Analizando...' : 'Generar Insights'}
                    </button>
                </div>
            </div>

            {/* AI Analysis Result */}
            {analysis && (
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 border-t-2 border-t-purple-500 animate-fade-in">
                    <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-purple-400" /> Resultados del Análisis
                    </h3>
                    <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {analysis}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsView;
