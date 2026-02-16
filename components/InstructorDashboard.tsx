
import React, { useState, useMemo, useEffect } from 'react';
import { User, LoanRecord, Equipment, EquipmentStatus, Role, UserCategory, createNewLoan, MaintenanceSuggestion } from '../types';
import { CameraCapture } from './CameraCapture';
import { analyzeEquipmentCondition, generateMaintenanceSuggestions, generateLoanReportAnalysis } from '../services/geminiService';
import { seedCloudDatabase } from '../services/firebaseService'; 
import Spinner from './Spinner';
import Modal from './Modal';
import { CameraIcon, CollectionIcon, DocumentReportIcon, SparklesIcon, DownloadIcon, ClipboardListIcon, HistoryIcon, ChartBarIcon, UserPlusIcon, PlusCircleIcon, HomeIcon, WrenchIcon, UserGroupIcon, SaveIcon, UploadIcon } from './Icons';
import jsPDF from 'jspdf';

type Tab = 'home' | 'newLoan' | 'activeLoans' | 'manageUsers' | 'inventory' | 'reports';

interface DashboardProps {
  currentUser: User;
  loans: LoanRecord[];
  equipment: Equipment[];
  users: User[];
  onNewLoan: (loan: LoanRecord) => void;
  onReturn: (loanId: string, returnConcept: string, returnStatus: string, returnPhoto?: string[], returnAnalysis?: string) => void;
  onUpdateInventory: (newEquipment: Equipment[]) => void;
  onAddNewUser: (newUser: User) => { success: boolean; message: string };
  onUpdateUser?: (user: User) => void;
  onAddNewEquipment: (newItem: Equipment) => void;
  onUpdateEquipmentImage: (equipmentId: string, newImageUrl: string) => void;
  onEditEquipment: (updatedItem: Equipment) => void;
  onDeleteEquipment: (itemId: string) => void;
  checkpointTimestamp: string | null;
  onCreateCheckpoint: () => void;
  isOnline?: boolean;
}

// --- SUB-COMPONENTS ---

const HomeView: React.FC<DashboardProps> = ({ loans, equipment }) => {
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

const NewLoanView: React.FC<DashboardProps> = ({ users, equipment, onNewLoan, currentUser }) => {
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState('');

  const availableEquipment = equipment.filter(e => e.status === EquipmentStatus.AVAILABLE);
  const eligibleUsers = users.filter(u => u.role === Role.USUARIO_MEDIALAB);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser && selectedEquipment) {
      const newLoan = createNewLoan({
        equipmentId: selectedEquipment,
        borrowerId: selectedUser,
        instructorId: currentUser.id,
      });
      onNewLoan(newLoan);
      setSelectedUser('');
      setSelectedEquipment('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md animate-fade-in">
      <h2 className="text-2xl font-bold text-sena-dark dark:text-white mb-6">Registrar Nuevo Préstamo (Manual)</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Aprendiz / Usuario</label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            required
          >
            <option value="">Seleccionar Usuario</option>
            {eligibleUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name} - {u.id}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Equipo Disponible</label>
          <select
            value={selectedEquipment}
            onChange={(e) => setSelectedEquipment(e.target.value)}
            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            required
          >
            <option value="">Seleccionar Equipo</option>
            {availableEquipment.map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.type}) - {e.id}</option>
            ))}
          </select>
        </div>

        <button type="submit" className="w-full bg-sena-green text-white font-bold py-3 rounded-lg hover:bg-opacity-90 transition-colors">
          Registrar Préstamo
        </button>
      </form>
    </div>
  );
};

const ActiveLoansView: React.FC<DashboardProps> = ({ loans, equipment, users, onReturn }) => {
  const activeLoans = loans.filter(l => !l.returnDate).sort((a, b) => b.loanDate.getTime() - a.loanDate.getTime());
  
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
                            className={`py-2 px-1 text-sm rounded border ${
                                returnStatus === status 
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
                    className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
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
                activeLoans.map((loan) => {
                const eq = equipment.find(e => e.id === loan.equipmentId);
                const usr = users.find(u => u.id === loan.borrowerId);
                return (
                    <tr key={loan.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white flex items-center gap-3">
                        {eq ? (
                             <>
                                <img src={eq.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                                <div>
                                    <div className="font-bold">{eq.name}</div>
                                    <div className="text-xs text-gray-500">{eq.id}</div>
                                </div>
                             </>
                        ) : 'Equipo Desconocido'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{usr ? usr.name : loan.borrowerId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{loan.loanDate.toLocaleDateString()} {loan.loanDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button onClick={() => openReturnModal(loan)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-bold">Registrar Devolución</button>
                    </td>
                    </tr>
                );
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ManageUsersView: React.FC<DashboardProps> = ({ users, onAddNewUser, onUpdateUser, isOnline }) => {
    const [newUserId, setNewUserId] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState<Role>(Role.USUARIO_MEDIALAB);
    const [newUserCategory, setNewUserCategory] = useState<UserCategory>(UserCategory.APRENDIZ);
    const [newUserEmail, setNewUserEmail] = useState(''); 
    
    const [editingUser, setEditingUser] = useState<User | null>(null);
    
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editRole, setEditRole] = useState<Role>(Role.USUARIO_MEDIALAB);

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        const newUser: User = {
            id: newUserId,
            name: newUserName.toUpperCase(),
            role: newUserRole,
            category: newUserRole === Role.USUARIO_MEDIALAB ? newUserCategory : undefined,
            email: newUserRole === Role.INSTRUCTOR_MEDIALAB ? newUserEmail : undefined,
        };

        const result = onAddNewUser(newUser);
        if (result.success) {
            setNewUserId('');
            setNewUserName('');
            setNewUserEmail('');
            setNewUserRole(Role.USUARIO_MEDIALAB);
        } else {
            alert(result.message);
        }
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setEditName(user.name);
        setEditEmail(user.email || '');
        setEditRole(user.role);
    };

    const handleUpdateClick = () => {
        if (editingUser && onUpdateUser) {
            onUpdateUser({
                ...editingUser,
                name: editName.toUpperCase(),
                email: editEmail,
                role: editRole
            });
            setEditingUser(null);
        }
    };

    // Monitor de Integridad de Usuarios
    const usersCount = users.length;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                        <UserGroupIcon className="w-5 h-5"/> Gestión de Usuarios
                    </h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400">Base de datos de aprendices e instructores.</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                        {isOnline ? '● ONLINE' : '○ LOCAL'}
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{usersCount}</p>
                        <p className="text-xs uppercase text-gray-500">Registrados</p>
                    </div>
                </div>
            </div>

            {/* Formulario Agregar Usuario */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold text-sena-dark dark:text-white mb-4 flex items-center gap-2">
                    <UserPlusIcon className="w-5 h-5"/> Agregar Nuevo Usuario
                </h3>
                <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="ID (Cédula/TI)" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                    <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Nombre Completo" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                    <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as Role)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                        <option value={Role.USUARIO_MEDIALAB}>Usuario / Aprendiz</option>
                        <option value={Role.INSTRUCTOR_MEDIALAB}>Instructor</option>
                    </select>
                    {newUserRole === Role.USUARIO_MEDIALAB ? (
                        <select value={newUserCategory} onChange={e => setNewUserCategory(e.target.value as UserCategory)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                            <option value={UserCategory.APRENDIZ}>Aprendiz</option>
                            <option value={UserCategory.ADMINISTRATIVO}>Administrativo</option>
                            <option value={UserCategory.INSTRUCTOR}>Instructor (Invitado)</option>
                        </select>
                    ) : (
                        <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Correo Institucional (Opcional)" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    )}
                    <button type="submit" className="bg-sena-green text-white font-bold py-2 px-4 rounded hover:bg-opacity-90 md:col-span-2">
                        Registrar Usuario
                    </button>
                </form>
            </div>

            {/* Tabla Usuarios */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {users.map(u => (
                            <tr key={u.id}>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{u.id}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{u.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{u.role} {u.category ? `(${u.category})` : ''}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{u.email || '-'}</td>
                                <td className="px-6 py-4 text-sm font-medium">
                                    <button onClick={() => openEditModal(u)} className="text-blue-600 hover:text-blue-900 mr-2">Editar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

             {/* Modal Edición */}
             <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Editar Usuario">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1">Nombre</label>
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-2 border rounded" />
                    </div>
                    {editRole === Role.INSTRUCTOR_MEDIALAB && (
                        <div>
                            <label className="block text-sm font-bold mb-1">Email</label>
                            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full p-2 border rounded" />
                        </div>
                    )}
                    <button onClick={handleUpdateClick} className="w-full bg-blue-600 text-white py-2 rounded">Guardar Cambios</button>
                </div>
            </Modal>
        </div>
    );
};

const InventoryView: React.FC<DashboardProps> = ({ equipment, onAddNewEquipment, onEditEquipment, onDeleteEquipment, onUpdateInventory, isOnline }) => {
    const [newItemId, setNewItemId] = useState('');
    const [newItemName, setNewItemName] = useState('');
    const [newItemType, setNewItemType] = useState('Computer');
    const [newItemImage, setNewItemImage] = useState('');

    const [editItem, setEditItem] = useState<Equipment | null>(null);
    
    // Migration States
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationProgress, setMigrationProgress] = useState(0);
    const [migrationMessage, setMigrationMessage] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        onAddNewEquipment({
            id: newItemId,
            name: newItemName.toUpperCase(),
            type: newItemType,
            status: EquipmentStatus.AVAILABLE,
            imageUrl: newItemImage || 'https://via.placeholder.com/150'
        });
        setNewItemId('');
        setNewItemName('');
        setNewItemImage('');
    };

    const handleMigration = async () => {
        if (!isOnline) return;
        setIsMigrating(true);
        setMigrationProgress(0);
        setMigrationMessage("Iniciando...");

        const result = await seedCloudDatabase((msg, pct) => {
            setMigrationMessage(msg);
            setMigrationProgress(pct);
        });

        if (result.success) {
             setMigrationMessage("¡Completado!");
             setMigrationProgress(100);
             setTimeout(() => setIsMigrating(false), 2000);
        } else {
             setMigrationMessage("Error: " + result.message);
             setTimeout(() => setIsMigrating(false), 4000);
        }
    };

    const handleSaveEdit = () => {
        if (editItem) {
            onEditEquipment(editItem);
            setEditItem(null);
        }
    };

    const handleDelete = (id: string) => {
        if (confirm("¿Estás seguro de eliminar este equipo? Esta acción no se puede deshacer.")) {
            onDeleteEquipment(id);
        }
    };

    const totalEquipment = equipment.length;
    
    return (
        <div className="space-y-6 animate-fade-in">
             {/* Monitor de Integridad */}
             <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-purple-500 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="font-bold text-lg text-sena-dark dark:text-white flex items-center gap-2">
                        <WrenchIcon className="w-5 h-5"/> Monitor de Inventario
                    </h3>
                    <div className="flex items-center gap-2 text-sm mt-1">
                        <span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                        <span className="text-gray-600 dark:text-gray-300">{isOnline ? 'Conectado a Nube (Sincronizado)' : 'Modo Offline (Local)'}</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <span className="block text-2xl font-bold text-purple-600">{totalEquipment}</span>
                        <span className="text-xs uppercase text-gray-500">Items Totales</span>
                    </div>
                     {/* Migration Button: Always show if online, change label based on data */}
                    {isOnline && (
                         <button 
                            onClick={handleMigration}
                            disabled={isMigrating}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all shadow-md"
                        >
                            <UploadIcon className="w-5 h-5" />
                            {isMigrating ? 'Migrando...' : (totalEquipment === 0 ? 'Migración Inicial' : 'Sincronización Forzada')}
                        </button>
                    )}
                </div>
            </div>

            {/* Modal de Progreso Migración */}
            <Modal isOpen={isMigrating} onClose={() => {}} title="Migrando a la Nube">
                <div className="text-center py-6">
                    <Spinner size="12" color="purple-600" />
                    <h3 className="mt-4 text-lg font-bold text-gray-700 dark:text-gray-200">{migrationMessage}</h3>
                    <div className="w-full bg-gray-200 rounded-full h-4 mt-4 overflow-hidden">
                        <div className="bg-purple-600 h-4 rounded-full transition-all duration-300" style={{ width: `${migrationProgress}%` }}></div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{migrationProgress}% completado</p>
                </div>
            </Modal>

            {/* Agregar Equipo */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold text-sena-dark dark:text-white mb-4 flex items-center gap-2">
                    <PlusCircleIcon className="w-5 h-5"/> Agregar Item
                </h3>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input value={newItemId} onChange={e => setNewItemId(e.target.value)} placeholder="Código / Placa" className="p-2 border rounded" required />
                    <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Nombre del Equipo" className="p-2 border rounded" required />
                    <select value={newItemType} onChange={e => setNewItemType(e.target.value)} className="p-2 border rounded">
                        <option value="Computer">Computador</option>
                        <option value="Laptop">Portátil</option>
                        <option value="Camera">Cámara</option>
                        <option value="Accessory">Accesorio</option>
                        <option value="Furniture">Mobiliario</option>
                        <option value="Appliance">Electrodoméstico</option>
                    </select>
                    <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700">Agregar</button>
                </form>
            </div>

            {/* Tabla Inventario */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                        <tr>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Placa</th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {equipment.map(e => (
                            <tr key={e.id}>
                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-mono">{e.id}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{e.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{e.type}</td>
                                <td className="px-6 py-4 text-sm">
                                    <span className={`px-2 py-1 rounded text-xs ${e.status === EquipmentStatus.AVAILABLE ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                        {e.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium flex gap-2">
                                    <button onClick={() => setEditItem(e)} className="text-blue-600 hover:text-blue-900">Editar</button>
                                    <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-900">Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Edición */}
            <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Editar Equipo">
                 {editItem && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-1">Nombre</label>
                            <input value={editItem.name} onChange={e => setEditItem({...editItem, name: e.target.value})} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Tipo</label>
                            <select value={editItem.type} onChange={e => setEditItem({...editItem, type: e.target.value})} className="w-full p-2 border rounded">
                                <option value="Computer">Computador</option>
                                <option value="Laptop">Portátil</option>
                                <option value="Camera">Cámara</option>
                                <option value="Accessory">Accesorio</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1">Estado Manual</label>
                            <select value={editItem.status} onChange={e => setEditItem({...editItem, status: e.target.value as EquipmentStatus})} className="w-full p-2 border rounded">
                                <option value={EquipmentStatus.AVAILABLE}>Disponible</option>
                                <option value={EquipmentStatus.ON_LOAN}>En Préstamo</option>
                            </select>
                        </div>
                        <button onClick={handleSaveEdit} className="w-full bg-blue-600 text-white py-2 rounded font-bold">Guardar Cambios</button>
                    </div>
                 )}
            </Modal>
        </div>
    );
};

const ReportsView: React.FC<DashboardProps> = ({ loans }) => {
    const [analysis, setAnalysis] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const generatePDFReport = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Reporte General de Préstamos - MediaLab", 14, 22);
        doc.setFontSize(11);
        doc.text(`Fecha de corte: ${new Date().toLocaleDateString()}`, 14, 30);
        
        let y = 40;
        loans.forEach((l, i) => {
            if (y > 280) { doc.addPage(); y = 20; }
            const status = l.returnDate ? `Devuelto: ${new Date(l.returnDate).toLocaleDateString()}` : "Activo";
            doc.text(`${i+1}. ${l.equipmentId} - ${l.borrowerId} (${status})`, 14, y);
            y += 7;
        });
        doc.save("Reporte_General.pdf");
    };

    const handleAIAnalysis = async () => {
        setIsGenerating(true);
        const result = await generateLoanReportAnalysis(loans.slice(0, 50)); // Limit analysis to last 50 for tokens
        setAnalysis(result);
        setIsGenerating(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><DocumentReportIcon className="w-5 h-5"/> Reportes Estáticos</h3>
                    <p className="text-gray-500 mb-4">Descarga el historial completo de transacciones.</p>
                    <button onClick={generatePDFReport} className="w-full bg-gray-800 text-white py-3 rounded hover:bg-black transition-colors flex justify-center gap-2">
                        <DownloadIcon className="w-5 h-5" /> Descargar PDF Histórico
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-500"/> Análisis Inteligente</h3>
                    <p className="text-gray-500 mb-4">Pide a la IA que busque patrones y problemas en los préstamos.</p>
                    <button onClick={handleAIAnalysis} disabled={isGenerating} className="w-full bg-purple-600 text-white py-3 rounded hover:bg-purple-700 transition-colors disabled:opacity-50">
                        {isGenerating ? 'Analizando...' : 'Generar Insights con IA'}
                    </button>
                </div>
            </div>

            {analysis && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-t-4 border-purple-500 animate-scale-in">
                    <h3 className="font-bold text-lg mb-4">Resultados del Análisis:</h3>
                    <div className="prose dark:prose-invert max-w-none whitespace-pre-line">
                        {analysis}
                    </div>
                </div>
            )}
        </div>
    );
};

const TabButton: React.FC<{ icon: React.ReactNode, text: string, isActive: boolean, onClick: () => void }> = ({ icon, text, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
      isActive
        ? 'border-sena-green text-sena-green'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
    }`}
  >
    {icon} <span className="hidden sm:inline">{text}</span>
  </button>
);

const InstructorDashboard: React.FC<DashboardProps> = (props) => {
  const [activeTab, setActiveTab] = useState<Tab>('home');

  return (
    <div className="w-full">
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="-mb-px flex space-x-4 sm:space-x-8" aria-label="Tabs">
          <TabButton icon={<HomeIcon className="w-5 h-5"/>} text="Inicio" isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <TabButton icon={<UserPlusIcon className="w-5 h-5"/>} text="Préstamo Manual" isActive={activeTab === 'newLoan'} onClick={() => setActiveTab('newLoan')} />
          <TabButton icon={<ClipboardListIcon className="w-5 h-5"/>} text="Préstamos Activos" isActive={activeTab === 'activeLoans'} onClick={() => setActiveTab('activeLoans')} />
          <TabButton icon={<UserGroupIcon className="w-5 h-5"/>} text="Usuarios" isActive={activeTab === 'manageUsers'} onClick={() => setActiveTab('manageUsers')} />
          <TabButton icon={<CollectionIcon className="w-5 h-5"/>} text="Inventario" isActive={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <TabButton icon={<DocumentReportIcon className="w-5 h-5"/>} text="Reportes" isActive={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
        </nav>
      </div>

      <div className="min-h-[60vh]">
        {activeTab === 'home' && <HomeView {...props} />}
        {activeTab === 'newLoan' && <NewLoanView {...props} />}
        {activeTab === 'activeLoans' && <ActiveLoansView {...props} />}
        {activeTab === 'manageUsers' && <ManageUsersView {...props} />}
        {activeTab === 'inventory' && <InventoryView {...props} />}
        {activeTab === 'reports' && <ReportsView {...props} />}
      </div>
    </div>
  );
};

export default InstructorDashboard;
