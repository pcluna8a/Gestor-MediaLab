import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, LoanRecord, Equipment, EquipmentStatus, Role, UserCategory, createNewLoan } from '../types';
import { CameraCapture } from './CameraCapture';
import { analyzeEquipmentCondition, generateLoanReportAnalysis, generateIdealSetupImage } from '../services/geminiService';
import Spinner from './Spinner';
import Modal from './Modal';
import { CameraIcon, CollectionIcon, DocumentReportIcon, SparklesIcon, DownloadIcon, ClipboardListIcon, HistoryIcon, BellIcon, ChartBarIcon, UserGroupIcon, UploadIcon, UserPlusIcon, SaveIcon, PlusCircleIcon } from './Icons';

type Tab = 'newLoan' | 'activeLoans' | 'manageUsers' | 'users' | 'myLoans' | 'inventory' | 'reports' | 'stats';

interface DashboardProps {
  currentUser: User;
  loans: LoanRecord[];
  equipment: Equipment[];
  users: User[];
  onNewLoan: (loan: LoanRecord) => void;
  onReturn: (loanId: string, returnConcept: string, returnPhoto?: string) => void;
  onUpdateInventory: (newEquipment: Equipment[]) => void;
  onAddNewUser: (newUser: User) => { success: boolean; message: string };
  onAddNewEquipment: (newItem: Equipment) => void;
  onUpdateEquipmentImage: (equipmentId: string, newImageUrl: string) => void;
  checkpointTimestamp: string | null;
  onCreateCheckpoint: () => void;
}

// --- SUB-COMPONENTS FOR EACH TAB --- //

const NewLoanFormView: React.FC<DashboardProps> = ({ currentUser, equipment, users, onNewLoan }) => {
    const [selectedEquipment, setSelectedEquipment] = useState('');
    const [selectedBorrower, setSelectedBorrower] = useState('');
    const [equipmentSearch, setEquipmentSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [analysisError, setAnalysisError] = useState('');
    const [submissionSuccess, setSubmissionSuccess] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [errors, setErrors] = useState<{ equipment?: string; borrower?: string; photos?: string; }>({});

    const availableEquipment = useMemo(() => (equipment || []).filter(e => e.status === EquipmentStatus.AVAILABLE), [equipment]);
    
    const filteredAvailableEquipment = useMemo(() => 
        availableEquipment.filter(item => item.name.toLowerCase().includes(equipmentSearch.toLowerCase())), 
    [equipmentSearch, availableEquipment]);

    const filteredUsers = useMemo(() => 
        (users || []).filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase())),
    [userSearch, users]);
    
    const handleCapture = (photo: string) => {
        const newPhotos = [...photos, photo];
        setPhotos(newPhotos);
        if (newPhotos.length === 1) handleAnalyze(newPhotos);
    };

    const handleAnalyze = async (currentPhotos: string[]) => {
        if (currentPhotos.length === 0 || !selectedEquipment) return;
        setIsLoading(true);
        setAnalysis('');
        setAnalysisError('');
        const equipmentName = equipment.find(e => e.id === selectedEquipment)?.name || '';
        const prompt = `Analiza el estado del equipo "${equipmentName}" en la foto. Describe cualquier daño o desgaste visible.`;
        const result = await analyzeEquipmentCondition(currentPhotos[0], prompt);
        setAnalysis(result.startsWith("Error") ? "" : result);
        setAnalysisError(result.startsWith("Error") ? result : "");
        setIsLoading(false);
    };

    const resetForm = () => {
        setSelectedEquipment('');
        setSelectedBorrower('');
        setEquipmentSearch('');
        setUserSearch('');
        setPhotos([]);
        setAnalysis('');
        setSubmissionSuccess(false);
    };

    const validate = () => {
        const newErrors: typeof errors = {};
        if (!selectedEquipment) newErrors.equipment = 'Selecciona un equipo.';
        if (!selectedBorrower) newErrors.borrower = 'Selecciona un usuario.';
        if (photos.length === 0) newErrors.photos = 'Se requiere al menos una foto.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) setIsConfirmModalOpen(true);
    };

    const handleConfirmLoan = () => {
        setIsSubmitting(true);
        const newLoan = createNewLoan({
            id: `L${Date.now()}`,
            borrowerId: selectedBorrower,
            instructorId: currentUser.id,
            equipmentId: selectedEquipment,
            photos: photos,
            conditionAnalysis: analysis,
        });
        onNewLoan(newLoan);
        setIsConfirmModalOpen(false);
        setIsSubmitting(false);
        setSubmissionSuccess(true);
    };
    
    if (submissionSuccess) {
        return (
            <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-sena-green">Préstamo Registrado con Éxito</h2>
                <button onClick={resetForm} className="mt-4 px-6 py-2 bg-sena-green text-white font-bold rounded-lg">Registrar Otro Préstamo</button>
            </div>
        );
    }

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-sena-dark dark:text-white">Registrar Nuevo Préstamo</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium">Usuario (Solicitante)</label>
                        <select value={selectedBorrower} onChange={e => setSelectedBorrower(e.target.value)} className="mt-1 block w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm">
                            <option value="" disabled>-- Selecciona un usuario --</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                         {errors.borrower && <p className="text-red-500 text-sm mt-1">{errors.borrower}</p>}
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Equipo</label>
                         <select value={selectedEquipment} onChange={e => setSelectedEquipment(e.target.value)} className="mt-1 block w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm">
                            <option value="" disabled>-- Selecciona un equipo disponible --</option>
                            {availableEquipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                         {errors.equipment && <p className="text-red-500 text-sm mt-1">{errors.equipment}</p>}
                    </div>
                </div>
                <div>
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Evidencia Fotográfica</label>
                    <CameraCapture onCapture={handleCapture} maxCaptures={2} captures={photos} />
                    {errors.photos && <p className="text-red-500 text-sm mt-1">{errors.photos}</p>}
                    <div className="flex flex-wrap gap-4 mt-4">
                        {photos.map((photo, index) => <img key={index} src={photo} alt={`Captura ${index + 1}`} className="w-32 h-32 object-cover rounded-lg border-2 border-sena-green"/>)}
                    </div>
                </div>
                 {(isLoading || analysis || analysisError) && (
                    <div>
                        <h3 className="text-sm font-medium">Diagnóstico IA del Equipo</h3>
                        {isLoading && <div className="flex items-center gap-2 mt-2"><Spinner size="5" /><p>Analizando...</p></div>}
                        {analysis && <div className="mt-2 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">{analysis}</div>}
                        {analysisError && <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/50 rounded-lg text-sm text-red-700 dark:text-red-200">{analysisError}</div>}
                    </div>
                )}
                <div className="text-right">
                    <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-sena-green text-white font-bold rounded-lg disabled:bg-gray-400">Registrar Préstamo</button>
                </div>
            </form>
            <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Confirmar Préstamo">
                <div className="space-y-4">
                    <p>Revisa los detalles:</p>
                    <p><strong>Usuario:</strong> {users.find(u => u.id === selectedBorrower)?.name}</p>
                    <p><strong>Equipo:</strong> {equipment.find(e => e.id === selectedEquipment)?.name}</p>
                    <div className="flex justify-end gap-4">
                        <button onClick={() => setIsConfirmModalOpen(false)} className="bg-gray-300 px-4 py-2 rounded-lg">Cancelar</button>
                        <button onClick={handleConfirmLoan} disabled={isSubmitting} className="bg-sena-green text-white px-4 py-2 rounded-lg">
                            {isSubmitting ? 'Confirmando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}

const ActiveLoansView: React.FC<DashboardProps> = ({ loans, equipment, users, onReturn }) => {
    const activeLoans = useMemo(() => (loans || []).filter(l => !l.returnDate).sort((a,b) => b.loanDate.getTime() - a.loanDate.getTime()), [loans]);
    const [loanToReturn, setLoanToReturn] = useState<LoanRecord | null>(null);
    const [returnConcept, setReturnConcept] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleOpenReturnModal = (loan: LoanRecord) => {
        setLoanToReturn(loan);
        setReturnConcept('');
    };

    const handleCloseReturnModal = () => setLoanToReturn(null);

    const handleConfirmReturn = () => {
        if (!loanToReturn || !returnConcept.trim()) {
            alert("Por favor, ingresa el concepto de devolución.");
            return;
        }
        setIsSubmitting(true);
        onReturn(loanToReturn.id, returnConcept.trim());
        setIsSubmitting(false);
        handleCloseReturnModal();
    };
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4">Préstamos Activos ({activeLoans.length})</h3>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {activeLoans.length > 0 ? activeLoans.map(loan => {
                    const item = equipment.find(e => e.id === loan.equipmentId);
                    const borrower = users.find(u => u.id === loan.borrowerId);
                    return (
                        <div key={loan.id} className="p-4 border dark:border-gray-700 rounded-lg flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <p className="font-bold">{item?.name || 'Equipo desconocido'}</p>
                                <p className="text-sm">Prestado a: {borrower?.name || 'Usuario desconocido'}</p>
                                <p className="text-xs text-gray-500">Fecha: {loan.loanDate.toLocaleString()}</p>
                            </div>
                            <button onClick={() => handleOpenReturnModal(loan)} className="bg-sena-green text-white px-4 py-2 rounded-lg hover:bg-opacity-80">
                                Registrar Devolución
                            </button>
                        </div>
                    );
                }) : <p className="text-gray-500">No hay préstamos activos.</p>}
            </div>
            <Modal isOpen={!!loanToReturn} onClose={handleCloseReturnModal} title="Registrar Devolución de Equipo">
                {loanToReturn && (
                    <div className="space-y-4">
                        <p>Estás registrando la devolución de <strong>{equipment.find(e => e.id === loanToReturn.equipmentId)?.name}</strong>.</p>
                        <div>
                            <label htmlFor="returnConcept" className="block text-sm font-medium">Concepto de Devolución</label>
                            <textarea id="returnConcept" value={returnConcept} onChange={(e) => setReturnConcept(e.target.value)} rows={4} placeholder="Ej: Devuelto en perfectas condiciones..." className="mt-1 block w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm" />
                        </div>
                        <div className="flex justify-end gap-4">
                            <button onClick={handleCloseReturnModal} className="bg-gray-300 dark:bg-gray-600 px-4 py-2 rounded-lg">Cancelar</button>
                            <button onClick={handleConfirmReturn} disabled={isSubmitting || !returnConcept.trim()} className="bg-sena-green text-white px-4 py-2 rounded-lg disabled:bg-gray-400">
                                {isSubmitting ? 'Procesando...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

const ManageUsersView: React.FC<Pick<DashboardProps, 'users' | 'onAddNewUser'>> = ({ users, onAddNewUser }) => {
    const [name, setName] = useState('');
    const [id, setId] = useState('');
    const [category, setCategory] = useState<UserCategory>(UserCategory.APRENDIZ);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newUser: User = {
            id,
            name: name.toUpperCase(),
            category,
            role: category === UserCategory.INSTRUCTOR ? Role.INSTRUCTOR_MEDIALAB : Role.USUARIO_MEDIALAB
        };
        const result = onAddNewUser(newUser);
        setFeedback({ type: result.success ? 'success' : 'error', message: result.message });
        if (result.success) {
            setName('');
            setId('');
            setCategory(UserCategory.APRENDIZ);
        }
        setTimeout(() => setFeedback(null), 3000);
    };

    const filteredUsers = useMemo(() => 
        users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.includes(searchTerm)),
    [users, searchTerm]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-4">Agregar Nuevo Usuario</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="userName" className="block text-sm font-medium">Nombre Completo</label>
                        <input type="text" id="userName" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
                    </div>
                     <div>
                        <label htmlFor="userId" className="block text-sm font-medium">ID Numérico</label>
                        <input type="text" id="userId" value={id} onChange={e => /^\d*$/.test(e.target.value) && setId(e.target.value)} required className="mt-1 block w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
                    </div>
                    <div>
                        <label htmlFor="userCategory" className="block text-sm font-medium">Categoría</label>
                        <select id="userCategory" value={category} onChange={e => setCategory(e.target.value as UserCategory)} className="mt-1 block w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md">
                            {Object.values(UserCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <button type="submit" className="w-full bg-sena-green text-white py-2 rounded-lg">Agregar Usuario</button>
                    {feedback && <p className={`text-sm mt-2 ${feedback.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{feedback.message}</p>}
                </form>
            </div>
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-4">Lista de Usuarios ({filteredUsers.length})</h3>
                <input type="text" placeholder="Buscar por nombre o ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full mb-4 p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
                <div className="max-h-96 overflow-y-auto">
                    <ul className="divide-y dark:divide-gray-700">
                        {filteredUsers.map(user => (
                            <li key={user.id} className="py-2">
                               <p className="font-semibold">{user.name}</p>
                               <p className="text-sm text-gray-500">{user.id} - {user.role} ({user.category || 'N/A'})</p>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

const UsersView: React.FC<Pick<DashboardProps, 'users'>> = ({ users }) => {
     const [searchTerm, setSearchTerm] = useState('');
     const filteredUsers = useMemo(() => 
        users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.includes(searchTerm)),
    [users, searchTerm]);
     return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4">Lista de Usuarios ({filteredUsers.length})</h3>
            <input type="text" placeholder="Buscar por nombre o ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full mb-4 p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
             <div className="max-h-96 overflow-y-auto">
                 <ul className="divide-y dark:divide-gray-700">
                    {filteredUsers.map(user => (
                        <li key={user.id} className="py-2">
                           <p className="font-semibold">{user.name}</p>
                           <p className="text-sm text-gray-500">{user.id} - {user.role} ({user.category || 'N/A'})</p>
                        </li>
                    ))}
                 </ul>
             </div>
        </div>
    );
};

const LoanHistoryView: React.FC<Pick<DashboardProps, 'loans' | 'equipment' | 'users'>> = ({ loans, equipment, users }) => {
    const completedLoans = useMemo(() => (loans || []).filter(l => l.returnDate).sort((a, b) => b.returnDate!.getTime() - a.returnDate!.getTime()), [loans]);
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4">Historial de Préstamos Completados</h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {completedLoans.length > 0 ? completedLoans.map(loan => {
                    const item = equipment.find(e => e.id === loan.equipmentId);
                    const borrower = users.find(u => u.id === loan.borrowerId);
                    return (
                        <div key={loan.id} className="p-3 border dark:border-gray-700 rounded-lg">
                            <p className="font-bold">{item?.name}</p>
                            <p className="text-sm">Usuario: {borrower?.name}</p>
                            <p className="text-xs text-gray-500">Prestado: {loan.loanDate.toLocaleDateString()} - Devuelto: {loan.returnDate!.toLocaleDateString()}</p>
                            {loan.returnConcept && <p className="text-sm mt-1 italic">Concepto: "{loan.returnConcept}"</p>}
                        </div>
                    );
                }) : <p className="text-gray-500">No hay préstamos completados.</p>}
            </div>
        </div>
    );
};

const InventoryView: React.FC<DashboardProps> = ({ equipment, onUpdateInventory, onAddNewEquipment, onUpdateEquipmentImage, loans, users }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [isImageAiModalOpen, setIsImageAiModalOpen] = useState(false);
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Add Equipment Modal State ---
    const [newItemId, setNewItemId] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [newItemType, setNewItemType] = useState('');
    const [newItemImageUrl, setNewItemImageUrl] = useState('');
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

    const filteredEquipment = useMemo(() => 
        equipment.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.id.includes(searchTerm)),
    [equipment, searchTerm]);

    const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const rows = text.split('\n').slice(1); // Skip header
            const newEquipment: Equipment[] = rows.map(row => {
                const [id, name, type, imageUrl] = row.split(',');
                return { id, name, type, imageUrl: imageUrl?.trim() || '', status: EquipmentStatus.AVAILABLE };
            }).filter(item => item.id && item.name); // Basic validation
            onUpdateInventory(newEquipment);
            alert(`${newEquipment.length} equipos importados con éxito.`);
        };
        reader.readAsText(file);
    };

    const handleAddNewItem = () => {
        if (!newItemId || !newItemName) {
            alert("El ID y el Nombre son obligatorios.");
            return;
        }
        onAddNewEquipment({
            id: newItemId,
            name: newItemName,
            type: newItemType,
            imageUrl: newItemImageUrl || 'https://via.placeholder.com/150',
            status: EquipmentStatus.AVAILABLE
        });
        setIsAddModalOpen(false);
        setNewItemId(''); setNewItemName(''); setNewItemType(''); setNewItemImageUrl('');
    };

    const handleGenerateImageForNewItem = async () => {
        if (!newItemName) {
            alert("Ingresa un nombre para el equipo para generar la imagen.");
            return;
        }
        setIsGeneratingImage(true);
        const generatedUrl = await generateIdealSetupImage(newItemName, '1:1');
        if (generatedUrl) setNewItemImageUrl(generatedUrl);
        setIsGeneratingImage(false);
    };

    const handleOpenManageModal = (item: Equipment) => {
        setSelectedEquipment(item);
        setIsManageModalOpen(true);
    };

    const handleUpdateImageWithAI = async (prompt: string) => {
        if (!selectedEquipment) return;
        setIsGeneratingImage(true);
        const newUrl = await generateIdealSetupImage(`${selectedEquipment.name}, ${prompt}`, '1:1');
        if (newUrl) {
            onUpdateEquipmentImage(selectedEquipment.id, newUrl);
            setSelectedEquipment(prev => prev ? { ...prev, imageUrl: newUrl } : null);
        }
        setIsGeneratingImage(false);
        setIsImageAiModalOpen(false);
    };

    return (
        <>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                    <h3 className="text-xl font-bold">Inventario ({filteredEquipment.length})</h3>
                    <div className="flex gap-2">
                        <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm"><PlusCircleIcon className="w-5 h-5"/> Agregar Equipo</button>
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-gray-600 text-white px-3 py-2 rounded-lg text-sm"><UploadIcon className="w-5 h-5"/> Importar CSV</button>
                        <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
                    </div>
                </div>
                <input type="text" placeholder="Buscar por nombre o ID de placa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full mb-4 p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-2">
                    {filteredEquipment.map(item => (
                        <div key={item.id} className="border dark:border-gray-700 rounded-lg p-3 text-center">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-32 object-contain rounded-md mb-2"/>
                            <p className="font-bold text-sm">{item.name}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${item.status === EquipmentStatus.AVAILABLE ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{item.status}</span>
                            <button onClick={() => handleOpenManageModal(item)} className="mt-2 w-full bg-sena-green text-white text-sm py-1 rounded-lg">Gestionar</button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modals */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Agregar Nuevo Equipo">
                <div className="space-y-4">
                    <input type="text" placeholder="ID / Placa" value={newItemId} onChange={e => setNewItemId(e.target.value)} className="w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
                    <input type="text" placeholder="Nombre del Equipo" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
                    <input type="text" placeholder="Tipo (Ej: Cámara, Laptop)" value={newItemType} onChange={e => setNewItemType(e.target.value)} className="w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
                    <div className="flex items-center gap-2">
                        <input type="text" placeholder="URL de la Imagen" value={newItemImageUrl} onChange={e => setNewItemImageUrl(e.target.value)} className="flex-grow p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
                        <button onClick={handleGenerateImageForNewItem} disabled={isGeneratingImage} className="bg-blue-500 text-white p-2 rounded-lg flex items-center gap-1">
                            {isGeneratingImage ? <Spinner size="4" /> : <SparklesIcon className="w-4 h-4"/>} IA
                        </button>
                    </div>
                    {newItemImageUrl && <img src={newItemImageUrl} alt="Preview" className="w-32 h-32 object-cover rounded-md mx-auto"/>}
                    <div className="flex justify-end gap-2"><button onClick={() => setIsAddModalOpen(false)} className="bg-gray-300 px-4 py-2 rounded-lg">Cancelar</button><button onClick={handleAddNewItem} className="bg-sena-green text-white px-4 py-2 rounded-lg">Agregar</button></div>
                </div>
            </Modal>
             <Modal isOpen={isManageModalOpen} onClose={() => setIsManageModalOpen(false)} title={`Gestionar: ${selectedEquipment?.name}`}>
                {selectedEquipment && (
                    <div className="space-y-4">
                        <img src={selectedEquipment.imageUrl} alt={selectedEquipment.name} className="w-full h-48 object-contain rounded-lg"/>
                        <button onClick={() => setIsImageAiModalOpen(true)} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg"><SparklesIcon className="w-5 h-5"/> Mejorar Imagen con IA</button>
                        <h4 className="font-bold">Historial de Préstamos</h4>
                        <div className="max-h-48 overflow-y-auto space-y-2">
                           {(loans.filter(l => l.equipmentId === selectedEquipment.id) || []).map(loan => (
                               <div key={loan.id} className="text-sm p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                                  <p><strong>Usuario:</strong> {users.find(u => u.id === loan.borrowerId)?.name}</p>
                                  <p><strong>Fecha:</strong> {loan.loanDate.toLocaleDateString()} {loan.returnDate ? `- Devuelto: ${loan.returnDate.toLocaleDateString()}` : '(Activo)'}</p>
                               </div>
                           ))}
                        </div>
                    </div>
                )}
            </Modal>
             <Modal isOpen={isImageAiModalOpen} onClose={() => setIsImageAiModalOpen(false)} title="Generar Imagen con IA">
                <form onSubmit={(e) => { e.preventDefault(); handleUpdateImageWithAI((e.target as any).prompt.value); }} className="space-y-4">
                    <p>Describe cómo te gustaría que fuera la nueva imagen para <strong>{selectedEquipment?.name}</strong>.</p>
                    <input type="text" name="prompt" placeholder="Ej: estilo minimalista, sobre un fondo blanco" className="w-full p-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md"/>
                    <button type="submit" disabled={isGeneratingImage} className="w-full bg-sena-green text-white py-2 rounded-lg flex justify-center">
                        {isGeneratingImage ? <Spinner/> : 'Generar Imagen'}
                    </button>
                </form>
            </Modal>
        </>
    );
};

const ReportsView: React.FC<Pick<DashboardProps, 'loans' | 'equipment' | 'users' | 'checkpointTimestamp' | 'onCreateCheckpoint'>> = ({ loans, equipment, users, checkpointTimestamp, onCreateCheckpoint }) => {
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateAnalysis = async () => {
        setIsLoading(true);
        const reportData = (loans || []).map(l => ({
            equipment: equipment.find(e => e.id === l.equipmentId)?.name,
            user: users.find(u => u.id === l.borrowerId)?.name,
            loanDate: l.loanDate.toISOString().split('T')[0],
            returned: !!l.returnDate,
        }));
        const result = await generateLoanReportAnalysis(reportData);
        setAnalysis(result);
        setIsLoading(false);
    };
    
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
                <h3 className="text-xl font-bold">Análisis con IA</h3>
                <button onClick={handleGenerateAnalysis} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-400 flex items-center gap-2">
                    {isLoading ? <><Spinner size="4" color="white" /> Generando...</> : 'Generar Análisis de Préstamos'}
                </button>
                {analysis && <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-md text-sm whitespace-pre-wrap font-sans max-h-96 overflow-y-auto">{analysis}</pre>}
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
                 <h3 className="text-xl font-bold">Punto de Recuperación (Checkpoint)</h3>
                 <p className="text-sm text-gray-600 dark:text-gray-300">Guarda una copia de seguridad de todos los datos actuales de la aplicación (usuarios, equipos y préstamos) en tu navegador.</p>
                 <button onClick={onCreateCheckpoint} className="bg-sena-green text-white px-4 py-2 rounded-lg flex items-center gap-2">
                     <SaveIcon className="w-5 h-5" /> Crear Checkpoint
                 </button>
                 {checkpointTimestamp && <p className="text-sm text-gray-500">Último guardado: {new Date(checkpointTimestamp).toLocaleString()}</p>}
            </div>
        </div>
    );
};

const StatsView: React.FC<DashboardProps> = ({ loans, equipment, users }) => {
    const stats = useMemo(() => {
        const activeLoans = (loans || []).filter(l => !l.returnDate);
        const onLoanCount = new Set(activeLoans.map(l => l.equipmentId)).size;
        return {
            totalEquipment: equipment.length,
            onLoan: onLoanCount,
            available: equipment.length - onLoanCount,
            totalLoans: loans.length,
            totalUsers: users.length,
        };
    }, [loans, equipment, users]);

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4">Estadísticas Rápidas</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
                <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
                    <p className="text-3xl font-bold">{stats.totalEquipment}</p>
                    <p className="text-sm text-gray-500">Equipos Totales</p>
                </div>
                 <div className="bg-yellow-100 dark:bg-yellow-900/50 p-4 rounded-lg">
                    <p className="text-3xl font-bold text-yellow-800 dark:text-yellow-300">{stats.onLoan}</p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">En Préstamo</p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/50 p-4 rounded-lg">
                    <p className="text-3xl font-bold text-green-800 dark:text-green-300">{stats.available}</p>
                    <p className="text-sm text-green-600 dark:text-green-400">Disponibles</p>
                </div>
                 <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-lg">
                    <p className="text-3xl font-bold text-blue-800 dark:text-blue-300">{stats.totalLoans}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Préstamos Históricos</p>
                </div>
                 <div className="bg-indigo-100 dark:bg-indigo-900/50 p-4 rounded-lg">
                    <p className="text-3xl font-bold text-indigo-800 dark:text-indigo-300">{stats.totalUsers}</p>
                    <p className="text-sm text-indigo-600 dark:text-indigo-400">Usuarios</p>
                </div>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD COMPONENT --- //

const TabButton: React.FC<{ icon: React.ReactNode, text: string, isActive: boolean, onClick: () => void }> = ({ icon, text, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 py-4 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
        isActive
          ? 'border-sena-green text-sena-green'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
      }`}
    >
      {icon} {text}
    </button>
);

const InstructorDashboard: React.FC<DashboardProps> = (props) => {
  const [activeTab, setActiveTab] = useState<Tab>('newLoan');
  
  const renderContent = () => {
    switch (activeTab) {
        case 'newLoan': return <NewLoanFormView {...props} />;
        case 'activeLoans': return <ActiveLoansView {...props} />;
        case 'manageUsers': return <ManageUsersView {...props} />;
        case 'users': return <UsersView {...props} />;
        case 'myLoans': return <LoanHistoryView {...props} />;
        case 'inventory': return <InventoryView {...props} />;
        case 'reports': return <ReportsView {...props} />;
        case 'stats': return <StatsView {...props} />;
        default: return null;
    }
  };
  
  return (
    <div className="w-full relative">
       <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-sena-dark dark:text-white">Panel del Instructor</h2>
        </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-2 sm:space-x-6 overflow-x-auto" aria-label="Tabs">
              <TabButton icon={<CameraIcon className="w-5 h-5"/>} text="Nuevo Préstamo" isActive={activeTab === 'newLoan'} onClick={() => setActiveTab('newLoan')} />
              <TabButton icon={<ClipboardListIcon className="w-5 h-5"/>} text="Préstamos Activos" isActive={activeTab === 'activeLoans'} onClick={() => setActiveTab('activeLoans')} />
              <TabButton icon={<UserPlusIcon className="w-5 h-5"/>} text="Gestionar Usuarios" isActive={activeTab === 'manageUsers'} onClick={() => setActiveTab('manageUsers')} />
              <TabButton icon={<UserGroupIcon className="w-5 h-5"/>} text="Usuarios" isActive={activeTab === 'users'} onClick={() => setActiveTab('users')} />
              <TabButton icon={<HistoryIcon className="w-5 h-5"/>} text="Historial" isActive={activeTab === 'myLoans'} onClick={() => setActiveTab('myLoans')} />
              <TabButton icon={<CollectionIcon className="w-5 h-5"/>} text="Inventario" isActive={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
              <TabButton icon={<DocumentReportIcon className="w-5 h-5"/>} text="Reportes" isActive={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
              <TabButton icon={<ChartBarIcon className="w-5 h-5"/>} text="Estadísticas" isActive={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
          </nav>
      </div>
      <div className="pt-6">
        {renderContent()}
      </div>
    </div>
  );
};

export default InstructorDashboard;
