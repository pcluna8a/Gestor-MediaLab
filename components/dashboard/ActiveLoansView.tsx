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

const ActiveLoansView: React.FC<ActiveLoansViewProps> = ({ loans, equipment, users, onReturn }) => {
    const activeLoans = loans.filter(l => !l.returnDate).sort((a, b) => b.loanDate.getTime() - a.loanDate.getTime());

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;
    const totalPages = Math.ceil(activeLoans.length / ITEMS_PER_PAGE);
    const paginatedLoans = activeLoans.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

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
            <h2 className="text-2xl font-bold text-sena-dark dark:text-white">Préstamos Activos</h2>

            {/* Modal de Devolución */}
            <Modal isOpen={!!selectedLoan} onClose={() => setSelectedLoan(null)} title="Registrar Devolución">
                <div className="space-y-4">
                    {selectedLoan && (
                        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-sm">
                            <p><span className="font-bold">Equipo:</span> {equipment.find(e => e.id === selectedLoan.equipmentId)?.name}</p>
                            <p><span className="font-bold">Usuario:</span> {users.find(u => u.id === selectedLoan.borrowerId)?.name}</p>
                        </div>
                    )}

                    {/* Selección de Estado Cualitativo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estado Actual (Devolución)</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['Excelente', 'Bueno', 'Aceptable', 'Regular', 'Malo'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setReturnStatus(status)}
                                    className={`py-2 px-1 text-sm rounded border ${returnStatus === status
                                        ? 'bg-sena-green text-white border-sena-green'
                                        : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Evidencia Fotográfica (Opcional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Verificación Visual (Opcional)</label>
                        {returnPhotos.length > 0 ? (
                            <div className="relative">
                                <img src={returnPhotos[0]} alt="Evidencia" className="w-full h-48 object-cover rounded-lg" />
                                <button
                                    onClick={() => setReturnPhotos([])}
                                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 text-xs"
                                >
                                    ✕
                                </button>
                                {isAnalyzing && <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white"><Spinner color="white" /> Analizando...</div>}
                                {!isAnalyzing && aiAnalysis && (
                                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 text-xs rounded border border-blue-100 dark:border-blue-800 text-gray-700 dark:text-gray-300">
                                        <strong>IA Analysis:</strong> {aiAnalysis}
                                    </div>
                                )}
                            </div>
                        ) : (
                            !isCameraOpen ? (
                                <button
                                    onClick={() => setIsCameraOpen(true)}
                                    className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center gap-2 text-gray-500 hover:border-sena-green hover:text-sena-green transition-colors"
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones / Concepto Final</label>
                        <textarea
                            value={returnConcept}
                            onChange={e => setReturnConcept(e.target.value)}
                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                            rows={3}
                            placeholder="Observaciones adicionales sobre la devolución..."
                        />
                    </div>

                    <button
                        onClick={submitReturn}
                        className="w-full bg-sena-green text-white font-bold py-3 rounded-lg hover:bg-opacity-90 transition-colors"
                    >
                        Confirmar Devolución
                    </button>
                </div>
            </Modal>

            {/* Tabla de Préstamos */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Equipo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Usuario</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha Préstamo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acción</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {activeLoans.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No hay préstamos activos.</td>
                            </tr>
                        ) : (
                            paginatedLoans.map((loan) => {
                                const eq = equipment.find(e => e.id === loan.equipmentId);
                                const usr = users.find(u => u.id === loan.borrowerId);
                                return (
                                    <tr key={loan.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white flex items-center gap-3">
                                            {eq ? (
                                                <>
                                                    <img src={eq.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                                                    <div>
                                                        <div className="font-bold text-xs leading-tight uppercase">{eq.description || eq.name}</div>
                                                        <div className="text-[10px] text-gray-500 mt-1">ID: {eq.id}</div>
                                                    </div>
                                                </>
                                            ) : 'Equipo Desconocido'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white uppercase">
                                                {usr ? (usr.name !== 'Usuario' ? usr.name : 'Usuario Registrado') : 'Usuario Desconocido'}
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-mono mt-1">ID: {loan.borrowerId}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{loan.loanDate.toLocaleDateString()} {loan.loanDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button onClick={() => openReturnModal(loan)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-bold" aria-label={`Registrar devolución de ${eq?.name || loan.equipmentId}`}>Registrar Devolución</button>
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
                totalItems={activeLoans.length}
                itemsPerPage={ITEMS_PER_PAGE}
            />
        </div>
    );
};

export default ActiveLoansView;
