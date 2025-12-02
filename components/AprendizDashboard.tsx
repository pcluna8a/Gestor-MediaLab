
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, LoanRecord, Equipment, EquipmentStatus, Role, createNewLoan } from '../types';
import { 
  CameraIcon, PlusCircleIcon, ClipboardListIcon, DownloadIcon, SearchIcon,
  DocumentReportIcon, HistoryIcon, HomeIcon, SwitchCameraIcon
} from './Icons';
import { CameraCapture } from './CameraCapture';
import { readInventoryLabel } from '../services/geminiService';
import Spinner from './Spinner';

export interface UserDashboardProps {
    currentUser: User;
    loans: LoanRecord[];
    equipment: Equipment[];
    users: User[];
    onNewLoan: (loan: LoanRecord) => void;
}

export type Tab = 'newLoan' | 'myLoans';

export interface CartItem {
    equipment: Equipment;
}

const NewLoanRequestForm: React.FC<Pick<UserDashboardProps, 'currentUser' | 'equipment' | 'users' | 'onNewLoan'> & { setActiveTab: (tab: Tab) => void }> = ({ currentUser, equipment, users, onNewLoan, setActiveTab }) => {
    const [selectedInstructor, setSelectedInstructor] = useState('');
    const [inventoryCode, setInventoryCode] = useState('');
    const [foundEquipment, setFoundEquipment] = useState<Equipment | null>(null);
    
    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    
    const [isScanning, setIsScanning] = useState(false);
    const [scanningError, setScanningError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionSuccess, setSubmissionSuccess] = useState(false);
    
    const instructors = useMemo(() => (users || []).filter(u => u.role === Role.INSTRUCTOR_MEDIALAB), [users]);
    
    useEffect(() => {
        if (inventoryCode.length > 4) {
            const eq = equipment.find(e => e.id === inventoryCode);
            setFoundEquipment(eq || null);
        } else {
            setFoundEquipment(null);
        }
    }, [inventoryCode, equipment]);

    const handleScanLabel = async (photoB64: string) => {
        setIsScanning(false);
        setInventoryCode('Leyendo...');
        const code = await readInventoryLabel(photoB64);
        if (code && code !== 'NO_FOUND' && code !== 'ERROR') {
            setInventoryCode(code);
        } else {
            setInventoryCode('');
            setScanningError('No se pudo detectar un código válido.');
        }
    };

    const addToCart = () => {
        if (foundEquipment && !cart.find(i => i.equipment.id === foundEquipment.id)) {
            setCart([...cart, { equipment: foundEquipment }]);
            setInventoryCode('');
            setFoundEquipment(null);
        }
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(i => i.equipment.id !== id));
    };

    const resetForm = () => {
        setCart([]);
        setSelectedInstructor('');
        setInventoryCode('');
        setFoundEquipment(null);
        setSubmissionSuccess(false);
    };

    const handleFinalizeLoan = async () => {
        setIsSubmitting(true);
        // Simulate processing for each item
        for (const item of cart) {
            const loan = createNewLoan({
                equipmentId: item.equipment.id,
                borrowerId: currentUser.id,
                instructorId: selectedInstructor,
                placa: item.equipment.id
            });
            await onNewLoan(loan);
        }
        setIsSubmitting(false);
        setSubmissionSuccess(true);
    };

    if (submissionSuccess) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center animate-scale-in">
                <div className="flex justify-center mb-4">
                    <div className="bg-green-100 p-4 rounded-full">
                        <DownloadIcon className="w-12 h-12 text-sena-green" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-sena-green">¡Préstamo Múltiple Registrado!</h2>
                <p className="text-gray-600 dark:text-gray-300">
                    Se han registrado los préstamos correctamente.
                </p>
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button onClick={resetForm} className="px-6 py-2 bg-sena-green text-white font-bold rounded-lg hover:bg-opacity-80 transition-colors">
                        Solicitar otro préstamo
                    </button>
                    <button onClick={() => setActiveTab('myLoans')} className="px-6 py-2 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors">
                        Ver mis préstamos
                    </button>
                </div>
            </div>
        )
    }
    
    return (
        <div className="space-y-8 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md animate-fade-in">
            <div>
                <h2 className="text-2xl font-bold text-sena-dark dark:text-white">Solicitar Préstamo de Equipo</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Agrega los equipos que necesitas a la lista.</p>
            </div>
            
            {/* Section 1: Instructor */}
            <div>
                <label htmlFor="instructor-select" className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">1. Instructor Responsable</label>
                <select
                    id="instructor-select"
                    value={selectedInstructor}
                    onChange={e => setSelectedInstructor(e.target.value)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-sena-green outline-none transition-all dark:text-sena-blue-light"
                >
                    <option value="" disabled>-- Selecciona quién autoriza --</option>
                    {instructors.map(instructor => (
                        <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
                    ))}
                </select>
            </div>

            {/* Section 2: Equipment Identification */}
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">2. Identificación y Agregado de Equipos</label>
                
                <div className="flex flex-col md:flex-row gap-4 items-start">
                    <div className="w-full md:w-1/2 space-y-2">
                         <p className="text-xs text-gray-500 dark:text-gray-400">Ingresa o escanea el código del equipo.</p>
                         <div className="flex gap-2">
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={inventoryCode}
                                onChange={(e) => setInventoryCode(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="Ej: 10100113..."
                                className="flex-grow p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-sena-green outline-none font-mono text-lg tracking-wider dark:text-sena-blue-light"
                            />
                         </div>
                         <div className="mt-2">
                            {!isScanning ? (
                                <button 
                                    type="button" 
                                    onClick={() => setIsScanning(true)}
                                    className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    <CameraIcon className="w-5 h-5" /> Escanear etiqueta con IA
                                </button>
                            ) : (
                                <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900">
                                    <CameraCapture 
                                        onCapture={(photo) => handleScanLabel(photo)} 
                                        maxCaptures={1} 
                                        captures={[]} 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => { setIsScanning(false); setScanningError(''); }}
                                        className="mt-2 w-full py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                    >
                                        Cancelar Escaneo
                                    </button>
                                </div>
                            )}
                             {scanningError && <p className="text-red-500 text-xs mt-1 animate-pulse">{scanningError}</p>}
                         </div>
                    </div>

                    {/* Equipment Preview & Add Button */}
                    <div className="w-full md:w-1/2">
                        {foundEquipment ? (
                            <div className="border-2 border-sena-green bg-green-50 dark:bg-green-900/20 p-4 rounded-lg flex flex-col gap-3 animate-scale-in">
                                <div className="flex gap-4 items-center">
                                    {foundEquipment.imageUrl && <img src={foundEquipment.imageUrl} alt={foundEquipment.description} className="w-20 h-20 object-cover rounded-md bg-white"/>}
                                    <div>
                                        <p className="text-xs font-bold text-sena-green uppercase tracking-wide">Equipo Identificado</p>
                                        <h3 className="font-bold text-lg leading-tight dark:text-white">{foundEquipment.description}</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">{foundEquipment.type}</p>
                                    </div>
                                </div>
                                
                                {foundEquipment.status === EquipmentStatus.AVAILABLE ? (
                                    <button 
                                        type="button"
                                        onClick={addToCart}
                                        className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex justify-center gap-2 items-center"
                                    >
                                        <PlusCircleIcon className="w-5 h-5" /> Agregar a la Lista
                                    </button>
                                ) : (
                                    <div className="bg-red-100 text-red-800 p-2 text-center rounded text-sm font-bold">
                                        Equipo no disponible
                                    </div>
                                )}
                            </div>
                        ) : (
                             <div className="h-full flex items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-400 text-center text-sm min-h-[120px]">
                                {inventoryCode.length > 4 ? "Buscando..." : "Ingresa un código para ver el equipo"}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Section 3: Cart List */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <ClipboardListIcon className="w-5 h-5" /> Lista de Equipos a Prestar ({cart.length})
                </h3>
                {cart.length === 0 ? (
                    <p className="text-gray-500 text-sm italic">Aún no has agregado equipos.</p>
                ) : (
                    <ul className="space-y-2">
                        {cart.map((item, idx) => (
                            <li key={item.equipment.id + idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                                <div className="flex items-center gap-3">
                                    <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">{idx + 1}</span>
                                    <div>
                                        <p className="font-bold text-sm dark:text-white">{item.equipment.description}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-300">Placa: {item.equipment.id}</p>
                                    </div>
                                </div>
                                <button onClick={() => removeFromCart(item.equipment.id)} className="text-red-500 hover:text-red-700 font-bold text-sm">
                                    Eliminar
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Final Actions */}
            <div className="pt-4 flex justify-end">
                <button 
                    type="button" 
                    onClick={handleFinalizeLoan}
                    disabled={isSubmitting || cart.length === 0 || !selectedInstructor}
                    className="w-full md:w-auto px-8 py-3 bg-sena-green text-white font-bold rounded-lg hover:bg-opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? <><Spinner size="5" color="white" /> Procesando...</> : "Finalizar y Registrar"}
                </button>
            </div>
        </div>
    );
};

const MyLoansView: React.FC<{ currentUser: User, loans: LoanRecord[] }> = ({ currentUser, loans }) => {
    const myLoans = loans.filter(l => l.borrowerId === currentUser.id);
    const activeLoans = myLoans.filter(l => !l.returnDate);
    const historyLoans = myLoans.filter(l => l.returnDate);

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <ClipboardListIcon className="w-6 h-6 text-sena-green" /> Mis Préstamos Activos
                </h3>
                {activeLoans.length === 0 ? (
                    <p className="text-gray-500">No tienes equipos en tu poder actualmente.</p>
                ) : (
                    <div className="grid gap-4">
                        {activeLoans.map(loan => (
                            <div key={loan.id} className="border-l-4 border-sena-green bg-green-50 dark:bg-green-900/20 p-4 rounded shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg dark:text-white">{loan.equipmentId}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">Solicitado: {new Date(loan.loanDate).toLocaleDateString()}</p>
                                    </div>
                                    <span className="px-2 py-1 bg-green-200 text-green-800 text-xs font-bold rounded">EN USO</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
             </div>

             <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md opacity-80">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <HistoryIcon className="w-6 h-6 text-gray-500" /> Historial de Devoluciones
                </h3>
                {historyLoans.length === 0 ? (
                    <p className="text-gray-500">No hay historial disponible.</p>
                ) : (
                    <div className="grid gap-4">
                        {historyLoans.slice(0, 5).map(loan => (
                            <div key={loan.id} className="border p-3 rounded dark:border-gray-700 flex justify-between items-center">
                                 <div>
                                    <p className="font-bold text-sm dark:text-white">{loan.equipmentId}</p>
                                    <p className="text-xs text-gray-500">Devuelto: {loan.returnDate ? new Date(loan.returnDate).toLocaleDateString() : 'N/A'}</p>
                                </div>
                                <span className="text-xs text-gray-500">{loan.returnStatus}</span>
                            </div>
                        ))}
                    </div>
                )}
             </div>
        </div>
    );
};

const UserDashboard: React.FC<UserDashboardProps> = (props) => {
    const [activeTab, setActiveTab] = useState<Tab>('newLoan');

    return (
        <div className="min-h-[calc(100vh-8rem)]">
            <div className="flex justify-center mb-6">
                <div className="bg-white dark:bg-gray-800 p-1 rounded-xl shadow-md inline-flex">
                    <button
                        onClick={() => setActiveTab('newLoan')}
                        className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'newLoan' ? 'bg-sena-green text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                        Solicitar Préstamo
                    </button>
                    <button
                        onClick={() => setActiveTab('myLoans')}
                        className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'myLoans' ? 'bg-sena-green text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    >
                        Mis Préstamos
                    </button>
                </div>
            </div>

            <div className="animate-fade-in-up">
                {activeTab === 'newLoan' ? (
                    <NewLoanRequestForm {...props} setActiveTab={setActiveTab} />
                ) : (
                    <MyLoansView currentUser={props.currentUser} loans={props.loans} />
                )}
            </div>
        </div>
    );
};

export default UserDashboard;
