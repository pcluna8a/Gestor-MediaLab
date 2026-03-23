import React, { useState } from 'react';
import { LoanRecord, Equipment, User } from '../../types';
import { analyzeEquipmentCondition } from '../../services/geminiService';
import Modal from '../Modal';
import Spinner from '../Spinner';
import { CameraIcon } from '../Icons';
import { CameraCapture } from '../CameraCapture';
import Pagination from '../Pagination';

interface ActiveLoansViewProps {
    loans: LoanRecord[];
    equipment: Equipment[];
    users: User[];
    onReturn: (loanId: string, returnConcept: string, returnStatus: string, returnPhoto?: string[], returnAnalysis?: string) => void;
}

type SortKey = 'equipment' | 'user' | 'date';

const ActiveLoansView: React.FC<ActiveLoansViewProps> = ({ loans, equipment, users, onReturn }) => {
    const activeLoans = loans.filter(l => !l.returnDate).sort((a, b) => b.loanDate.getTime() - a.loanDate.getTime());

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Search filter
    const filteredLoans = activeLoans.filter(loan => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        const eq = equipment.find(e => e.id === loan.equipmentId);
        const usr = users.find(u => u.id === loan.borrowerId);
        return (
            (eq?.name || '').toLowerCase().includes(term) ||
            (eq?.id || '').toLowerCase().includes(term) ||
            (usr?.name || '').toLowerCase().includes(term) ||
            (usr?.id || '').toLowerCase().includes(term)
        );
    });

    // Sort
    const sortedLoans = React.useMemo(() => {
        const sortable = [...filteredLoans];
        if (sortConfig) {
            sortable.sort((a, b) => {
                let aVal = '';
                let bVal = '';
                if (sortConfig.key === 'equipment') {
                    aVal = equipment.find(e => e.id === a.equipmentId)?.name || a.equipmentId;
                    bVal = equipment.find(e => e.id === b.equipmentId)?.name || b.equipmentId;
                } else if (sortConfig.key === 'user') {
                    aVal = users.find(u => u.id === a.borrowerId)?.name || a.borrowerId;
                    bVal = users.find(u => u.id === b.borrowerId)?.name || b.borrowerId;
                } else if (sortConfig.key === 'date') {
                    return sortConfig.direction === 'asc'
                        ? a.loanDate.getTime() - b.loanDate.getTime()
                        : b.loanDate.getTime() - a.loanDate.getTime();
                }
                const cmp = aVal.localeCompare(bVal);
                return sortConfig.direction === 'asc' ? cmp : -cmp;
            });
        }
        return sortable;
    }, [filteredLoans, sortConfig, equipment, users]);

    const totalPages = Math.ceil(sortedLoans.length / ITEMS_PER_PAGE);
    const paginatedLoans = sortedLoans.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return prev.direction === 'asc' ? { key, direction: 'desc' } : null;
            }
            return { key, direction: 'asc' };
        });
        setCurrentPage(1);
    };

    const getSortIndicator = (key: SortKey) => {
        if (sortConfig?.key !== key) return ' ↕';
        return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
    };

    const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(null);
    const [returnConcept, setReturnConcept] = useState('');
    const [returnStatus, setReturnStatus] = useState('Bueno');
    const [returnPhotos, setReturnPhotos] = useState<string[]>([]);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState('');

    const openReturnModal = (loan: LoanRecord) => {
        setSelectedLoan(loan);
        setReturnConcept('');
        setReturnStatus('Bueno');
        setReturnPhotos([]);
        setAiAnalysis('');
        setIsCameraOpen(false);
    };

    const handleCaptureReturnPhoto = async (photo: string) => {
        setReturnPhotos([photo]);
        setIsCameraOpen(false);

        setIsAnalyzing(true);
        const analysis = await analyzeEquipmentCondition(photo, "Analiza brevemente el estado físico del equipo en esta foto. ¿Se ve en buen estado o hay daños visibles?");
        setAiAnalysis(analysis);
        setIsAnalyzing(false);
    };

    const submitReturn = () => {
        if (selectedLoan) {
            onReturn(selectedLoan.id, returnConcept, returnStatus, returnPhotos, aiAnalysis);
            setSelectedLoan(null);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-white">Préstamos Activos</h2>
                <div className="relative max-w-xs w-full">
                    <input
                        type="text"
                        placeholder="Buscar equipo o usuario..."
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full pl-4 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:border-sena-green outline-none transition-all"
                    />
                </div>
            </div>

            {/* Modal de Devolución */}
            <Modal isOpen={!!selectedLoan} onClose={() => setSelectedLoan(null)} title="Registrar Devolución">
                <div className="space-y-4">
                    {selectedLoan && (
                        <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-sm text-gray-300">
                            <p><span className="font-bold text-white">Equipo:</span> {equipment.find(e => e.id === selectedLoan.equipmentId)?.name}</p>
                            <p><span className="font-bold text-white">Usuario:</span> {users.find(u => u.id === selectedLoan.borrowerId)?.name}</p>
                        </div>
                    )}

                    {/* Selección de Estado Cualitativo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Estado Actual (Devolución)</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Excelente', 'Bueno', 'Aceptable', 'Regular', 'Malo'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setReturnStatus(status)}
                                    className={`py-2 px-1 text-sm rounded border transition-all ${returnStatus === status
                                        ? 'bg-sena-green text-white border-sena-green shadow-[0_0_10px_rgba(57,169,0,0.3)]'
                                        : 'bg-black/20 border-white/10 text-gray-400 hover:border-white/20'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Evidencia Fotográfica (Opcional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Verificación Visual (Opcional)</label>
                        {returnPhotos.length > 0 ? (
                            <div className="relative">
                                <img src={returnPhotos[0]} alt="Evidencia" className="w-full h-48 object-cover rounded-lg border border-white/10" />
                                <button
                                    onClick={() => setReturnPhotos([])}
                                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 text-xs hover:bg-red-400 transition-colors"
                                >
                                    ✕
                                </button>
                                {isAnalyzing && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center text-white rounded-lg"><Spinner color="white" /> Analizando...</div>}
                                {!isAnalyzing && aiAnalysis && (
                                    <div className="mt-2 p-2 bg-blue-500/10 text-xs rounded border border-blue-500/20 text-gray-300">
                                        <strong className="text-blue-400">IA Analysis:</strong> {aiAnalysis}
                                    </div>
                                )}
                            </div>
                        ) : (
                            !isCameraOpen ? (
                                <button
                                    onClick={() => setIsCameraOpen(true)}
                                    className="w-full py-3 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center gap-2 text-gray-500 hover:border-sena-green/50 hover:text-sena-green transition-colors"
                                >
                                    <CameraIcon className="w-5 h-5" /> Agregar Foto Evidencia (Opcional)
                                </button>
                            ) : (
                                <CameraCapture
                                    onCapture={handleCaptureReturnPhoto}
                                    maxCaptures={1}
                                    captures={[]}
                                />
                            )
                        )}
                    </div>

                    {/* Concepto Texto */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Observaciones / Concepto Final</label>
                        <textarea
                            value={returnConcept}
                            onChange={e => setReturnConcept(e.target.value)}
                            className="w-full p-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-600 focus:border-sena-green outline-none transition-all"
                            rows={3}
                            placeholder="Observaciones adicionales sobre la devolución..."
                        />
                    </div>

                    <button
                        onClick={submitReturn}
                        className="w-full bg-sena-green text-white font-bold py-3 rounded-xl hover:shadow-[0_0_20px_rgba(57,169,0,0.4)] hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        Confirmar Devolución
                    </button>
                </div>
            </Modal>

            {/* Tabla de Préstamos */}
            <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left">
                    <thead className="bg-black/20 sticky top-0 backdrop-blur-md">
                        <tr>
                            <th
                                onClick={() => handleSort('equipment')}
                                className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
                            >
                                Equipo{getSortIndicator('equipment')}
                            </th>
                            <th
                                onClick={() => handleSort('user')}
                                className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
                            >
                                Usuario{getSortIndicator('user')}
                            </th>
                            <th
                                onClick={() => handleSort('date')}
                                className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
                            >
                                Fecha Préstamo{getSortIndicator('date')}
                            </th>
                            <th className="px-6 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {sortedLoans.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">No hay préstamos activos.</td>
                            </tr>
                        ) : (
                            paginatedLoans.map((loan) => {
                                const eq = equipment.find(e => e.id === loan.equipmentId);
                                const usr = users.find(u => u.id === loan.borrowerId);
                                return (
                                    <tr key={loan.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white flex items-center gap-3">
                                            {eq ? (
                                                <>
                                                    <img src={eq.imageUrl} alt="" className="w-8 h-8 rounded object-cover border border-white/10" />
                                                    <div>
                                                        <div className="font-bold text-xs leading-tight uppercase">{eq.description || eq.name}</div>
                                                        <div className="text-[10px] text-gray-500 mt-1 font-mono">ID: {eq.id}</div>
                                                    </div>
                                                </>
                                            ) : 'Equipo Desconocido'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-white uppercase">
                                                {usr ? (usr.name !== 'Usuario' ? usr.name : 'Usuario Registrado') : 'Usuario Desconocido'}
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-mono mt-1">ID: {loan.borrowerId}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{loan.loanDate.toLocaleDateString()} {loan.loanDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => openReturnModal(loan)}
                                                className="text-sena-green hover:text-green-300 font-bold text-xs uppercase tracking-wider transition-colors"
                                                aria-label={`Registrar devolución de ${eq?.name || loan.equipmentId}`}
                                            >
                                                Registrar Devolución
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={sortedLoans.length}
                itemsPerPage={ITEMS_PER_PAGE}
            />
        </div>
    );
};

export default ActiveLoansView;
