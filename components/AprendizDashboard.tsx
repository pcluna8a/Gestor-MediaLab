import React, { useState, useMemo, useEffect } from 'react';
import { User, LoanRecord, Equipment, Role, EquipmentStatus, createNewLoan } from '../types';
import { CameraCapture } from './CameraCapture';
import { analyzeEquipmentCondition } from '../services/geminiService';
import Spinner from './Spinner';
import Modal from './Modal';
import { HistoryIcon, CameraIcon } from './Icons';

type Tab = 'myLoans' | 'newLoan';

interface UserDashboardProps {
  currentUser: User;
  loans: LoanRecord[];
  equipment: Equipment[];
  users: User[];
  onNewLoan: (loan: LoanRecord) => void;
}

const TabButton: React.FC<{ icon: React.ReactNode, text: string, isActive: boolean, onClick: () => void }> = ({ icon, text, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 py-4 px-3 border-b-2 font-medium text-sm transition-colors ${
        isActive
          ? 'border-sena-green text-sena-green'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
      }`}
    >
      {icon} {text}
    </button>
);

const MyLoansView: React.FC<Pick<UserDashboardProps, 'currentUser' | 'loans' | 'equipment' | 'users'>> = ({ currentUser, loans, equipment, users }) => {
    const myLoans = (loans || []).filter(loan => loan.borrowerId === currentUser.id).sort((a,b) => b.loanDate.getTime() - a.loanDate.getTime());
  
    return (
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-sena-dark dark:text-white mb-4">Mis Préstamos de Equipo</h2>
        {myLoans.length === 0 ? (
          <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
            <p className="text-gray-500 dark:text-gray-400">No tienes préstamos actuales o pasados.</p>
            <p className="mt-2 text-sm text-gray-400">Puedes solicitar un equipo en la pestaña "Solicitar Préstamo".</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myLoans.map(loan => {
              const equipmentItem = (equipment || []).find(e => e.id === loan.equipmentId);
              const instructor = users.find(i => i.id === loan.instructorId && i.role === Role.INSTRUCTOR_MEDIALAB);
  
              return (
                <div key={loan.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <img src={equipmentItem?.imageUrl || 'https://via.placeholder.com/150'} alt={equipmentItem?.name} className="w-32 h-32 object-cover rounded-md flex-shrink-0"/>
                  <div className="flex-grow">
                    <h2 className="text-xl font-bold">{equipmentItem?.name}</h2>
                    {loan.placa && <p className="text-sm font-mono text-gray-500 dark:text-gray-400">Placa: {loan.placa}</p>}
                    <p className="text-sm text-gray-500 dark:text-gray-400">Prestado el: {loan.loanDate.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Instructor a cargo: {instructor?.name || 'No Aplica'}</p>
                    {loan.conditionAnalysis && <p className="text-xs mt-2 italic text-gray-600 dark:text-gray-300">Estado inicial: "{loan.conditionAnalysis}"</p>}
                    {loan.returnDate && loan.returnConcept && (
                        <p className="text-xs mt-2 italic text-blue-600 dark:text-blue-300">
                            <span className="font-semibold">Concepto del Instructor:</span> "{loan.returnConcept}"
                        </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {loan.returnDate ? (
                       <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Devuelto
                       </span>
                    ) : (
                      <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          En Préstamo
                      </span>
                    )}
                     {loan.returnDate && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Devuelto: {loan.returnDate.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
};

const NewLoanRequestForm: React.FC<Pick<UserDashboardProps, 'currentUser' | 'equipment' | 'users' | 'onNewLoan'> & { setActiveTab: (tab: Tab) => void }> = ({ currentUser, equipment, users, onNewLoan, setActiveTab }) => {
    const [selectedEquipment, setSelectedEquipment] = useState('');
    const [selectedInstructor, setSelectedInstructor] = useState('');
    const [equipmentSearch, setEquipmentSearch] = useState('');
    const [isEquipmentDropdownOpen, setIsEquipmentDropdownOpen] = useState(false);
    const [placa, setPlaca] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [analysisError, setAnalysisError] = useState('');
    const [submissionSuccess, setSubmissionSuccess] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [errors, setErrors] = useState<{ equipment?: string; instructor?: string; photos?: string; }>({});

    const availableEquipment = useMemo(() => (equipment || []).filter(e => e.status === EquipmentStatus.AVAILABLE), [equipment]);
    const instructors = useMemo(() => (users || []).filter(u => u.role === Role.INSTRUCTOR_MEDIALAB), [users]);
    
    const filteredAvailableEquipment = useMemo(() => {
        const searchTerms = equipmentSearch.toLowerCase().split(' ').filter(term => term.length > 0);
        if (searchTerms.length === 0) return availableEquipment;

        return availableEquipment.filter(item => {
            const itemName = item.name.toLowerCase();
            return searchTerms.every(term => itemName.includes(term));
        });
    }, [equipmentSearch, availableEquipment]);
    
    useEffect(() => {
        if (selectedInstructor) setErrors(prev => ({ ...prev, instructor: undefined }));
    }, [selectedInstructor]);

    useEffect(() => {
        if (selectedEquipment) setErrors(prev => ({ ...prev, equipment: undefined }));
    }, [selectedEquipment]);

    useEffect(() => {
        if (photos.length > 0) setErrors(prev => ({ ...prev, photos: undefined }));
    }, [photos]);

    const handleCapture = (photo: string) => {
        const newPhotos = [...photos, photo];
        setPhotos(newPhotos);
        if (newPhotos.length === 1) { // Auto-analyze on first photo
            handleAnalyze(newPhotos);
        }
    };

    const handleAnalyze = async (currentPhotos: string[]) => {
        if (currentPhotos.length === 0 || !selectedEquipment) {
            setAnalysisError("Por favor, selecciona un equipo antes de analizar la foto.");
            return;
        }
        setIsLoading(true);
        setAnalysis('');
        setAnalysisError('');
        const equipmentName = (equipment || []).find(e => e.id === selectedEquipment)?.name || '';
        const prompt = `Analiza el estado del equipo en la foto. Confirma si el equipo parece ser un "${equipmentName}". Describe cualquier rasguño, desgaste o daño visible. Sé conciso y profesional.`;
        const result = await analyzeEquipmentCondition(currentPhotos[0], prompt);
        if (result.startsWith("Error")) {
            setAnalysisError(result);
        } else {
            setAnalysis(result);
        }
        setIsLoading(false);
    };

    const resetForm = () => {
        setSelectedEquipment('');
        setSelectedInstructor('');
        setEquipmentSearch('');
        setPlaca('');
        setPhotos([]);
        setAnalysis('');
        setAnalysisError('');
        setIsSubmitting(false);
        setSubmissionSuccess(false);
        setErrors({});
    };

    const validateForm = () => {
        const newErrors: { equipment?: string; instructor?: string; photos?: string; } = {};
        if (!selectedInstructor) newErrors.instructor = 'Debes seleccionar un instructor a cargo.';
        if (!selectedEquipment) newErrors.equipment = 'Debes seleccionar un equipo de la lista.';
        if (photos.length === 0) newErrors.photos = 'Se requiere al menos una foto como evidencia.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validateForm()) {
            setIsConfirmModalOpen(true);
        }
    };

    const handleConfirmLoan = () => {
        setIsSubmitting(true);
        
        // Usamos la función auxiliar para crear el préstamo de forma segura
        const newLoan = createNewLoan({
            id: `L${Date.now()}`,
            borrowerId: currentUser.id,
            instructorId: selectedInstructor,
            equipmentId: selectedEquipment,
            placa: placa,
            photos: photos,
            conditionAnalysis: analysis,
        });

        onNewLoan(newLoan);
        
        setIsConfirmModalOpen(false);
        setIsSubmitting(false);
        setSubmissionSuccess(true);
    }

    const renderHighlightedText = (text: string, highlight: string) => {
        const parts = text.split(new RegExp(`(${highlight.split(' ').join('|')})`, 'gi'));
        return <span>{parts.map((part, i) => 
            highlight.toLowerCase().split(' ').filter(Boolean).includes(part.toLowerCase()) ? 
            <strong key={i} className="text-sena-green">{part}</strong> : part
        )}</span>;
    };

    if (submissionSuccess) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center">
                <h2 className="text-2xl font-bold text-sena-green">¡Préstamo Registrado con Éxito!</h2>
                <p className="text-gray-600 dark:text-gray-300">
                    El préstamo ha sido asignado correctamente. Puedes ver los detalles en la pestaña "Mis Préstamos".
                </p>
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button
                        onClick={resetForm}
                        className="px-6 py-2 bg-sena-green text-white font-bold rounded-lg hover:bg-opacity-80 transition-colors"
                    >
                        Solicitar otro préstamo
                    </button>
                    <button
                        onClick={() => setActiveTab('myLoans')}
                        className="px-6 py-2 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Ver mis préstamos
                    </button>
                </div>
            </div>
        )
    }
    
    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-sena-dark dark:text-white mb-4">Solicitar Préstamo de Equipo</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="instructor-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Instructor a cargo</label>
                        <select
                          id="instructor-select"
                          value={selectedInstructor}
                          onChange={e => setSelectedInstructor(e.target.value)}
                          required
                          className="mt-1 block w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:ring-sena-green focus:border-sena-green"
                        >
                            <option value="" disabled>-- Selecciona un instructor --</option>
                            {instructors.map(instructor => (
                              <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
                            ))}
                        </select>
                        {errors.instructor && <p className="text-red-500 text-sm mt-1">{errors.instructor}</p>}
                    </div>
                    <div>
                        <label htmlFor="equipment-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Equipo</label>
                        <div className="relative mt-1">
                            <input
                                type="text"
                                id="equipment-search"
                                value={equipmentSearch}
                                onChange={e => {
                                    setEquipmentSearch(e.target.value);
                                    setSelectedEquipment('');
                                    setIsEquipmentDropdownOpen(true);
                                }}
                                onFocus={() => setIsEquipmentDropdownOpen(true)}
                                onBlur={() => setTimeout(() => setIsEquipmentDropdownOpen(false), 200)}
                                placeholder="Busca un equipo disponible..."
                                required={!selectedEquipment}
                                autoComplete="off"
                                className="w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:ring-sena-green focus:border-sena-green"
                            />
                            {isEquipmentDropdownOpen && filteredAvailableEquipment.length > 0 && (
                                <ul className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg">
                                    {filteredAvailableEquipment.map(item => (
                                        <li
                                            key={item.id}
                                            onMouseDown={() => {
                                                setSelectedEquipment(item.id);
                                                setEquipmentSearch(item.name);
                                                setIsEquipmentDropdownOpen(false);
                                                if (photos.length > 0) handleAnalyze(photos);
                                            }}
                                            className="px-4 py-2 text-sm text-gray-900 dark:text-gray-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                            {renderHighlightedText(item.name, equipmentSearch)}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {errors.equipment && <p className="text-red-500 text-sm mt-1">{errors.equipment}</p>}
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fotos de Evidencia (Máx. 2)</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Toma una foto clara del equipo con el instructor presente para registrar su estado inicial.</p>
                    <CameraCapture onCapture={handleCapture} maxCaptures={2} captures={photos} />
                    {errors.photos && <p className="text-red-500 text-sm mt-1">{errors.photos}</p>}
                    <div className="flex flex-wrap gap-4 mt-4">
                        {photos.map((photo, index) => (
                            <img key={index} src={photo} alt={`Captura ${index + 1}`} className="w-32 h-32 object-cover rounded-lg border-2 border-sena-green"/>
                        ))}
                    </div>
                </div>
                
                {(isLoading || analysis || analysisError) && (
                    <div>
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Diagnóstico IA</h3>
                        {isLoading && <div className="flex items-center gap-2 mt-2"><Spinner size="5" /><p>Analizando...</p></div>}
                        {analysis && <div className="mt-2 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">{analysis}</div>}
                        {analysisError && <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/50 rounded-lg text-sm text-red-700 dark:text-red-200">{analysisError}</div>}
                    </div>
                )}


                <div className="text-right">
                    <button 
                    type="submit" 
                    disabled={ isSubmitting || !selectedEquipment || photos.length === 0 || !selectedInstructor } 
                    className="px-6 py-2 bg-sena-green text-white font-bold rounded-lg hover:bg-opacity-80 transition-colors disabled:bg-gray-400"
                    >
                        Registrar Préstamo
                    </button>
                </div>
            </form>
             <Modal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                title="Confirmar Registro de Préstamo"
            >
                <div className="space-y-4">
                    <p className="text-sena-dark dark:text-gray-200">Por favor, revisa los detalles del préstamo antes de confirmar.</p>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2 text-sena-dark dark:text-gray-200">
                        <div>
                            <span className="font-semibold text-gray-600 dark:text-gray-300">Equipo: </span>
                            <span>{(equipment || []).find(e => e.id === selectedEquipment)?.name || 'Desconocido'}</span>
                        </div>
                        <div>
                            <span className="font-semibold text-gray-600 dark:text-gray-300">Instructor: </span>
                            <span>{users.find(u => u.id === selectedInstructor)?.name || 'Desconocido'}</span>
                        </div>
                        <div>
                            <span className="font-semibold text-gray-600 dark:text-gray-300">Solicitante: </span>
                            <span>{currentUser.name}</span>
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6">
                        <button
                            onClick={() => setIsConfirmModalOpen(false)}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmLoan}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-sena-green text-white font-bold rounded-lg hover:bg-opacity-80 transition-colors flex items-center gap-2"
                        >
                            {isSubmitting && <Spinner size="4" color="white" />}
                            Confirmar Préstamo
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};


const UserDashboard: React.FC<UserDashboardProps> = ({ currentUser, loans, equipment, users, onNewLoan }) => {
  const [activeTab, setActiveTab] = useState<Tab>('myLoans');

  return (
    <div className="w-full">
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-6 overflow-x-auto whitespace-nowrap" aria-label="Tabs">
          <TabButton icon={<HistoryIcon className="w-5 h-5"/>} text="Mis Préstamos" isActive={activeTab === 'myLoans'} onClick={() => setActiveTab('myLoans')} />
          <TabButton icon={<CameraIcon className="w-5 h-5"/>} text="Solicitar Préstamo" isActive={activeTab === 'newLoan'} onClick={() => setActiveTab('newLoan')} />
        </nav>
      </div>

      <div>
        {activeTab === 'myLoans' && <MyLoansView currentUser={currentUser} loans={loans} equipment={equipment} users={users} />}
        {activeTab === 'newLoan' && <NewLoanRequestForm currentUser={currentUser} equipment={equipment} users={users} onNewLoan={onNewLoan} setActiveTab={setActiveTab} />}
      </div>
    </div>
  );
};

export default UserDashboard;