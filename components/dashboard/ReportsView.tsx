import React, { useState, useMemo } from 'react';
import { LoanRecord, Equipment, EquipmentStatus } from '../../types';
import { DocumentReportIcon, SparklesIcon, DownloadIcon, ChartBarIcon } from '../Icons';
import { generateLoanReportAnalysis } from '../../services/geminiService';
import { logAuditAction } from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../Toast';
import Modal from '../Modal';
import jsPDF from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface ReportsViewProps {
    loans: LoanRecord[];
    equipment?: Equipment[];
}

const CHART_COLORS = ['#39A900', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const ReportsView: React.FC<ReportsViewProps> = ({ loans, equipment = [] }) => {
    const { currentUser } = useAuth();
    const { registerReturn } = useData();
    const { showToast } = useToast();

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

    // Inventory Status Data
    const inventoryStatusData = useMemo(() => {
        const counts = { Disponible: 0, Prestado: 0, Otros: 0 };
        equipment.forEach(e => {
            if (e.status === EquipmentStatus.AVAILABLE) counts.Disponible++;
            else if (e.status === EquipmentStatus.ON_LOAN) counts.Prestado++;
            else counts.Otros++;
        });

        return [
            ...(counts.Disponible > 0 ? [{ name: 'Disponible', value: counts.Disponible }] : []),
            ...(counts.Prestado > 0 ? [{ name: 'Prestado', value: counts.Prestado }] : []),
            ...(counts.Otros > 0 ? [{ name: 'Otros', value: counts.Otros }] : []),
        ];
    }, [equipment]);

    // Instructor Performance Data
    const instructorPerformanceData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredLoans.filter(l => l.returnDate).forEach(l => {
            const id = l.instructorId || 'Desconocido';
            counts[id] = (counts[id] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, préstamos: count }))
            .sort((a, b) => b.préstamos - a.préstamos);
    }, [filteredLoans]);

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

    const [editingLoan, setEditingLoan] = useState<LoanRecord | null>(null);
    const [editStatus, setEditStatus] = useState('Bueno');
    const [editConcept, setEditConcept] = useState('');

    const openEditModal = (loan: LoanRecord) => {
        if (!currentUser?.isSuperAdmin && currentUser?.category !== 'SUPER-ADMIN') return;
        setEditingLoan(loan);
        setEditStatus(loan.returnStatus || 'Bueno');
        setEditConcept(loan.returnConcept || '');
    };

    const handleForceEdit = async () => {
        if (!editingLoan || (!currentUser?.isSuperAdmin && currentUser?.category !== 'SUPER-ADMIN')) return;

        const result = await registerReturn(
            editingLoan.id,
            editingLoan.equipmentId,
            {
                concept: editConcept,
                status: editStatus,
                photos: editingLoan.returnPhotos || [],
                analysis: editingLoan.returnConditionAnalysis || ''
            }
        );

        if (result.success) {
            await logAuditAction('FORCE_EDIT_LOAN', currentUser.id, currentUser.name, editingLoan.id, {
                oldStatus: editingLoan.returnStatus,
                newStatus: editStatus,
                oldConcept: editingLoan.returnConcept,
                newConcept: editConcept
            });
            showToast("Préstamo cerrado editado exitosamente", "success");
        } else {
            showToast("Error al forzar edición", "error");
        }
        setEditingLoan(null);
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

            {/* Secondary Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Inventory Status Pie Chart */}
                <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-blue-400" /> Estado del Inventario
                    </h3>
                    {inventoryStatusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={inventoryStatusData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={3}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    labelLine={false}
                                >
                                    {inventoryStatusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === 'Disponible' ? '#39A900' : entry.name === 'Prestado' ? '#f59e0b' : '#3b82f6'} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-gray-500 italic text-center py-8">Sin datos de inventario.</p>
                    )}
                </div>

                {/* Instructor Performance Bar Chart (Super Admin Only) */}
                {(currentUser?.isSuperAdmin || currentUser?.category === 'SUPER-ADMIN') ? (
                    <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <ChartBarIcon className="w-5 h-5 text-orange-400" /> Rendimiento por Instructor
                        </h3>
                        {instructorPerformanceData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={instructorPerformanceData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                                    <XAxis type="number" tick={{ fill: '#9CA3AF', fontSize: 11 }} allowDecimals={false} />
                                    <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={80} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                        labelStyle={{ color: '#9CA3AF' }}
                                    />
                                    <Bar dataKey="préstamos" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-sm text-gray-500 italic text-center py-8">No hay registros de préstamos cerrados.</p>
                        )}
                    </div>
                ) : (
                    <div className="bg-white/5 p-6 rounded-xl border border-white/10 flex flex-col items-center justify-center text-center opacity-50">
                        <SparklesIcon className="w-8 h-8 text-gray-500 mb-2" />
                        <p className="text-sm text-gray-400">Rendimiento de Instructores</p>
                        <p className="text-xs text-gray-500 mt-1">Exclusivo para Super Admin</p>
                    </div>
                )}
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
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
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
            {/* Detailed Closed Loans Table for Super Admins */}
            {(currentUser?.isSuperAdmin || currentUser?.category === 'SUPER-ADMIN') && (
                <div className="bg-white/5 p-6 rounded-xl border border-white/10 mt-8">
                    <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                        <DocumentReportIcon className="w-5 h-5 text-red-400" /> Préstamos Cerrados (Solo Super Admin)
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">Desde aquí puedes forzar la edición del estado final o concepto de los préstamos ya devueltos. Esta acción será auditada.</p>
                    <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full divide-y divide-white/10 text-left">
                            <thead className="bg-black/20 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Equipo</th>
                                    <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Usuario</th>
                                    <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">F. Devolución</th>
                                    <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Estado</th>
                                    <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Concepto</th>
                                    <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLoans.filter(l => l.returnDate).map(loan => (
                                    <tr key={loan.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 text-sm text-gray-300 font-mono truncate max-w-[120px]" title={loan.equipmentId}>{loan.equipmentId}</td>
                                        <td className="px-4 py-3 text-sm text-gray-300 font-mono truncate max-w-[120px]" title={loan.borrowerId}>{loan.borrowerId}</td>
                                        <td className="px-4 py-3 text-sm text-gray-400">{new Date(loan.returnDate!).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <span className={`px-2 py-1 rounded text-xs border ${loan.returnStatus === 'Malo' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                                                {loan.returnStatus}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[150px]" title={loan.returnConcept}>{loan.returnConcept || '-'}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <button onClick={() => openEditModal(loan)} className="text-orange-400 hover:text-orange-300 font-bold text-xs" aria-label="Forzar edición">FORZAR EDICIÓN</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Force Edit Modal */}
            <Modal isOpen={!!editingLoan} onClose={() => setEditingLoan(null)} title="Forzar Edición de Préstamo">
                <div className="space-y-4">
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-md text-red-200 text-xs">
                        <strong>Atención:</strong> Estás modificando un registro histórico cerrado. Esta acción quedará grabada en el log de auditoría.
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Nuevo Estado Final</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Excelente', 'Bueno', 'Aceptable', 'Regular', 'Malo'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setEditStatus(status)}
                                    className={`py-2 px-1 text-sm rounded border ${editStatus === status
                                        ? 'bg-orange-500 text-white border-orange-500'
                                        : 'bg-black/20 border-white/10 text-gray-400'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Nuevo Concepto</label>
                        <textarea
                            value={editConcept}
                            onChange={e => setEditConcept(e.target.value)}
                            className="w-full p-3 border rounded-lg bg-black/40 border-white/10 text-white focus:border-orange-500 outline-none"
                            rows={3}
                        />
                    </div>

                    <button
                        onClick={handleForceEdit}
                        className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-500 transition-colors mt-4"
                    >
                        Confirmar y Auditar
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default ReportsView;
