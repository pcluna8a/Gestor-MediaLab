
import React, { useState, useEffect } from 'react';
import { Role, User, LoanRecord, Equipment, UserCategory } from './types';
import { INITIAL_USERS } from './constants';
import InstructorDashboard from './components/InstructorDashboard';
import UserDashboard from './components/AprendizDashboard';
import { LogoutIcon, SaveIcon } from './components/Icons';
import { Toast, useToast } from './components/Toast';
import Spinner from './components/Spinner';
import Modal from './components/Modal';
import { 
  subscribeToCollection, 
  registerNewLoanInCloud, 
  registerReturnInCloud, 
  addUserToCloud, 
  addEquipmentToCloud, 
  updateEquipmentImageInCloud,
  checkCloudConnection,
  updateEquipmentInCloud,
  deleteEquipmentInCloud,
  updateUserCredentials,
  updateUserInCloud,
  hashPassword,
  forceCloudSync
} from './services/firebaseService';

const getGreetingName = (fullName: string): string => {
  if (!fullName) return 'Usuario';
  const cleanName = fullName.trim().replace(/\s+/g, ' ');
  const parts = cleanName.split(' ');
  let firstName = parts[0];
  let lastName = '';
  if (parts.length >= 3) {
      lastName = parts[parts.length - 2];
  } else if (parts.length === 2) {
      lastName = parts[1];
  }
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  firstName = capitalize(firstName);
  if (lastName) {
      lastName = capitalize(lastName);
      return `${firstName} ${lastName}`;
  }
  return firstName;
};

// --- COMPONENTE: MODAL DE CAMBIO DE CONTRASEÑA (DENTRO DEL DASHBOARD) ---
const ForcePasswordChangeModal: React.FC<{ user: User; onUpdateSuccess: (newEmail: string, newHash: string) => void }> = ({ user, onUpdateSuccess }) => {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newEmail, setNewEmail] = useState(user.email || '');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        setError('');
        if (newPassword.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Las contraseñas no coinciden.");
            return;
        }
        if (newPassword === user.id) {
            setError("Por seguridad, la nueva contraseña no puede ser igual a tu ID.");
            return;
        }
        if (!newEmail.includes('@')) {
            setError("Ingresa un correo válido.");
            return;
        }

        setIsLoading(true);
        try {
            const newHash = await hashPassword(newPassword);
            const result = await updateUserCredentials(user.id, newEmail, newHash);
            
            if (result.success) {
                onUpdateSuccess(newEmail, newHash);
            } else {
                setError("Error al actualizar: " + result.error);
            }
        } catch (e) {
            setError("Error inesperado.");
        }
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-[60] flex justify-center items-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-8 animate-scale-in border-2 border-sena-green">
                <div className="text-center mb-6">
                     <div className="mx-auto bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <SaveIcon className="w-8 h-8 text-orange-600" />
                     </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Actualización Requerida</h2>
                    <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm">
                        Hemos detectado que estás usando la contraseña por defecto (tu ID). 
                        Para continuar utilizando el panel de Instructor, debes establecer una contraseña segura.
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Correo Institucional</label>
                        <input 
                            type="email" 
                            value={newEmail} 
                            onChange={e => setNewEmail(e.target.value)} 
                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="usuario@sena.edu.co"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nueva Contraseña</label>
                        <input 
                            type="password" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Confirmar Contraseña</label>
                        <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>
                    
                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 text-sm" role="alert">
                            <p>{error}</p>
                        </div>
                    )}

                    <button 
                        onClick={handleSubmit} 
                        disabled={isLoading} 
                        className="w-full bg-sena-green text-white py-3 rounded-lg font-bold hover:bg-opacity-90 transition-all shadow-lg transform hover:scale-[1.02]"
                    >
                        {isLoading ? <Spinner size="5" color="white" /> : 'Actualizar credenciales y continuar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE: MODAL OLVIDÉ MI CONTRASEÑA ---
const ForgotPasswordModal: React.FC<{ isOpen: boolean; onClose: () => void; users: User[] }> = ({ isOpen, onClose, users }) => {
    const [step, setStep] = useState<1 | 2>(1); // 1: Verificar, 2: Resetear
    const [id, setId] = useState('');
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleVerify = async () => {
        setError('');
        setIsLoading(true);
        await new Promise(r => setTimeout(r, 1000));

        const user = users.find(u => u.id === id);
        if (!user) {
            setError("Usuario no encontrado.");
            setIsLoading(false);
            return;
        }

        if (!user.email) {
            setError("Este usuario no tiene un correo registrado. Contacta al Super Administrador.");
            setIsLoading(false);
            return;
        }

        if (user.email.toLowerCase().trim() !== email.toLowerCase().trim()) {
            setError("El correo no coincide con nuestros registros.");
            setIsLoading(false);
            return;
        }

        setStep(2);
        setIsLoading(false);
    };

    const handleReset = async () => {
        if (newPassword.length < 6) { setError("Mínimo 6 caracteres."); return; }
        if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
        
        setIsLoading(true);
        try {
            const newHash = await hashPassword(newPassword);
            await updateUserCredentials(id, email, newHash);
            setSuccessMsg("¡Contraseña restablecida con éxito! Ya puedes ingresar.");
            setTimeout(() => {
                onClose();
                setStep(1);
                setId('');
                setEmail('');
                setNewPassword('');
                setConfirmPassword('');
                setSuccessMsg('');
            }, 2000);
        } catch (e) {
            setError("Error al actualizar.");
        }
        setIsLoading(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Recuperar Acceso">
            <div className="space-y-4 p-2">
                {step === 1 ? (
                    <>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Ingresa tu ID y el correo institucional registrado para verificar tu identidad.
                        </p>
                        <div>
                            <label className="block text-sm font-bold dark:text-gray-300">ID Usuario</label>
                            <input 
                                type="text" 
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={id} 
                                onChange={e => setId(e.target.value.replace(/[^0-9]/g, ''))} 
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" 
                                placeholder="Número de documento" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold dark:text-gray-300">Correo Institucional</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" placeholder="ejemplo@sena.edu.co" />
                        </div>
                        {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}
                        <button onClick={handleVerify} disabled={isLoading} className="w-full bg-sena-green text-white py-2 rounded font-bold hover:bg-opacity-90 flex justify-center">
                            {isLoading ? <Spinner size="5" color="white" /> : "Verificar Datos"}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="bg-green-50 border border-green-200 p-3 rounded text-sm text-green-800 mb-4">
                            ✓ Identidad verificada. Establece tu nueva contraseña.
                        </div>
                        <div>
                            <label className="block text-sm font-bold dark:text-gray-300">Nueva Contraseña</label>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold dark:text-gray-300">Confirmar Contraseña</label>
                            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                        </div>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        {successMsg && <p className="text-green-600 font-bold text-center">{successMsg}</p>}
                        {!successMsg && (
                            <button onClick={handleReset} disabled={isLoading} className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-opacity-90 flex justify-center">
                                {isLoading ? <Spinner size="5" color="white" /> : "Restablecer Contraseña"}
                            </button>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
};

// --- COMPONENTE: LOGIN / SELECCION DE ROL ---
const RoleSelector: React.FC<{ users: User[]; onSelect: (user: User) => void }> = ({ users, onSelect }) => {
  const [selectedRole, setSelectedRole] = React.useState<Role | ''>('');
  const [selectedCategory, setSelectedCategory] = React.useState<UserCategory | ''>('');
  const [userId, setUserId] = React.useState('');
  const [password, setPassword] = React.useState(''); 
  const [rememberMe, setRememberMe] = React.useState(false); 
  const [showForgotModal, setShowForgotModal] = React.useState(false); 
  
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  
  useEffect(() => {
      const savedRole = localStorage.getItem('ml_saved_role');
      const savedCat = localStorage.getItem('ml_saved_cat');
      const savedId = localStorage.getItem('ml_saved_id');
      
      if (savedRole) setSelectedRole(savedRole as Role);
      if (savedCat) setSelectedCategory(savedCat as UserCategory);
      if (savedId) {
          setUserId(savedId);
          setRememberMe(true);
      }
  }, []);

  useEffect(() => {
    if (selectedRole !== Role.USUARIO_MEDIALAB) {
      setSelectedCategory('');
    }
    setError('');
  }, [selectedRole]);

  const handleLogin = async () => {
    if (!selectedRole || !userId) {
      setError('Por favor, selecciona un rol e ingresa tu ID.');
      return;
    }
    if (selectedRole === Role.USUARIO_MEDIALAB && !selectedCategory) {
      setError('Por favor, selecciona una categoría.');
      return;
    }
    const isPrivileged = selectedRole === Role.INSTRUCTOR_MEDIALAB || selectedRole === Role.SUPER_ADMIN;
    if (isPrivileged && !password) {
        setError('Por favor, ingresa tu contraseña.');
        return;
    }

    setIsLoading(true);
    const effectiveUsers = users.length > 0 ? users : INITIAL_USERS;

    // 1. Buscar Usuario
    const user = effectiveUsers.find(u =>
      u.id === userId &&
      u.role === selectedRole &&
      (!isPrivileged || u.category === selectedCategory || !u.category)
    );

    if (!user) {
        setError('Usuario no encontrado. Verifica tus credenciales.');
        setIsLoading(false);
        return;
    }

    // 2. Validación de Contraseña para Instructor/Admin
    if (isPrivileged) {
        let isValid = false;
        let requiresChange = false;

        if (user.passwordHash) {
            const inputHash = await hashPassword(password);
            isValid = inputHash === user.passwordHash;
            requiresChange = !!user.forcePasswordChange;
        } else {
            // Fallback (Legacy o Primer Ingreso): Validar si password es igual al ID
            isValid = password === user.id;
            // SPECIAL CHECK FOR INITIAL CONSTANTS
            // If the user is in INITIAL_USERS and has an initialPassword, check that too
            const constantUser = INITIAL_USERS.find(u => u.id === user.id);
            if (constantUser && constantUser.initialPassword) {
                isValid = password === constantUser.initialPassword;
            }

            if (isValid) {
                requiresChange = true;
            }
        }

        if (!isValid) {
            setError('Contraseña incorrecta.');
            setIsLoading(false);
            return;
        }

        if (requiresChange) {
            user.forcePasswordChange = true; 
        }
    }

    if (rememberMe) {
        localStorage.setItem('ml_saved_role', selectedRole);
        if (selectedCategory) localStorage.setItem('ml_saved_cat', selectedCategory);
        localStorage.setItem('ml_saved_id', userId);
    } else {
        localStorage.removeItem('ml_saved_role');
        localStorage.removeItem('ml_saved_cat');
        localStorage.removeItem('ml_saved_id');
    }

    setError('');
    setIsLoading(false);
    onSelect(user);
  };

  const roleOrder: Role[] = [
    Role.USUARIO_MEDIALAB,
    Role.INSTRUCTOR_MEDIALAB,
    Role.SUPER_ADMIN
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-sena-dark p-4">
      <ForgotPasswordModal isOpen={showForgotModal} onClose={() => setShowForgotModal(false)} users={users} />
      
      <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg text-center animate-fade-in">
        <img src="/logoSena.png" onError={(e) => e.currentTarget.src = "https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png"} alt="SENA Logo" className="w-32 mx-auto mb-6 dark:brightness-0 dark:invert" />
        <h1 className="text-2xl font-bold text-sena-dark dark:text-white mb-2">Gestor MediaLab</h1>
        <p className="text-sena-gray dark:text-gray-300 mb-8">Sistema Integral de Préstamos</p>
        
        <div className="space-y-4 text-left">
          <div>
            <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
            <select
              id="role-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as Role)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-gray-200 focus:ring-2 focus:ring-sena-green focus:border-sena-green transition-colors"
            >
              <option value="" disabled>-- Selecciona tu rol --</option>
              {roleOrder.map(role => (
                <option key={role} value={role}>{role.replace(/_/g, '-')}</option>
              ))}
            </select>
          </div>
          {selectedRole === Role.USUARIO_MEDIALAB && (
            <div className="animate-fade-in">
              <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
              <select
                id="category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as UserCategory)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-gray-200 focus:ring-2 focus:ring-sena-green focus:border-sena-green transition-colors"
              >
                <option value="" disabled>-- Selecciona tu categoría --</option>
                {Object.values(UserCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="user-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {(selectedRole === Role.INSTRUCTOR_MEDIALAB || selectedRole === Role.SUPER_ADMIN) ? 'Usuario (ID)' : 'Número de Identificación'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              id="user-id"
              value={userId}
              onChange={(e) => setUserId(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Ingresa tu número de documento"
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-gray-200 focus:ring-2 focus:ring-sena-green focus:border-sena-green transition-colors font-mono tracking-wide"
            />
          </div>

          {(selectedRole === Role.INSTRUCTOR_MEDIALAB || selectedRole === Role.SUPER_ADMIN) && (
             <div className="animate-fade-in">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-gray-200 focus:ring-2 focus:ring-sena-green focus:border-sena-green transition-colors"
                />
                <div className="flex justify-between items-center mt-2">
                    <button 
                        onClick={() => setShowForgotModal(true)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        ¿Olvidaste tu contraseña?
                    </button>
                    <p className="text-xs text-gray-500">Primer ingreso: usa tu ID</p>
                </div>
             </div>
          )}

          {/* Remember Me Checkbox */}
          <div className="flex items-center gap-2 mt-2">
              <input 
                type="checkbox" 
                id="rememberMe" 
                checked={rememberMe} 
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-sena-green border-gray-300 rounded focus:ring-sena-green"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600 dark:text-gray-300 select-none">
                  Recordar mis datos
              </label>
          </div>

          {error && <p className="text-red-500 text-sm animate-pulse">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full bg-sena-green text-white font-bold py-3 rounded-md hover:bg-opacity-90 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {isLoading ? <Spinner size="5" color="white"/> : 'Ingresar al Sistema'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]); 
  const [users, setUsers] = useState<User[]>([]); 
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const { toast, showToast, closeToast } = useToast();

  // Initial Data Load & Network Monitoring
  useEffect(() => {
    const init = async () => {
       const connected = await checkCloudConnection();
       setIsOnline(connected);
       setLoading(false);
    };
    init();

    // Setup Subscriptions
    const unsubEq = subscribeToCollection('equipment', (data) => {
        setEquipment(data as Equipment[]);
    });
    const unsubUsers = subscribeToCollection('users', (data) => {
        setUsers(data as User[]);
    });
    const unsubLoans = subscribeToCollection('loans', (data) => {
        const parsedLoans = data.map(l => ({
            ...l,
            loanDate: new Date(l.loanDate), // Ensure Date object
            returnDate: l.returnDate ? new Date(l.returnDate) : null
        }));
        setLoans(parsedLoans as LoanRecord[]);
    });

    // Network Watchdog
    const handleFocus = () => { checkCloudConnection().then(setIsOnline); };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => { checkCloudConnection().then(setIsOnline); }, 30000);

    return () => {
        unsubEq();
        unsubUsers();
        unsubLoans();
        window.removeEventListener('focus', handleFocus);
        clearInterval(interval);
    }
  }, []);

  const handleLogin = (user: User) => {
      setCurrentUser(user);
      if ((user.role === Role.INSTRUCTOR_MEDIALAB || user.role === Role.SUPER_ADMIN) && user.forcePasswordChange) {
          setShowPasswordChangeModal(true);
      }
  };

  const handleLogout = () => {
      setCurrentUser(null);
      localStorage.removeItem('ml_saved_id'); 
  };

  const handlePasswordUpdateSuccess = (newEmail: string, newHash: string) => {
      if (currentUser) {
          const updatedUser = { ...currentUser, email: newEmail, passwordHash: newHash, forcePasswordChange: false };
          setCurrentUser(updatedUser);
          setShowPasswordChangeModal(false);
          showToast("Contraseña actualizada correctamente.");
      }
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center bg-gray-100 dark:bg-sena-dark"><Spinner /></div>;

  if (!currentUser) {
      return (
          <>
            <RoleSelector users={users.length > 0 ? users : INITIAL_USERS} onSelect={handleLogin} />
            {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
          </>
      );
  }

  return (
      <div className="min-h-screen bg-gray-100 dark:bg-sena-dark transition-colors duration-300">
          <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-30">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                      <img src="/logoSena.png" alt="SENA" className="h-10 w-10 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                      <div>
                          <h1 className="text-xl font-bold text-sena-green">MediaLab</h1>
                          <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Centro de la Industria, la Empresa y los Servicios</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                          <p className="text-sm font-bold text-gray-800 dark:text-white">{getGreetingName(currentUser.name)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser.role.replace(/_/g, ' ')}</p>
                      </div>
                      <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-500 transition-colors" title="Cerrar Sesión">
                          <LogoutIcon className="w-6 h-6" />
                      </button>
                  </div>
              </div>
          </header>

          <main className="p-4">
              {currentUser.role === Role.USUARIO_MEDIALAB ? (
                  <UserDashboard 
                      currentUser={currentUser}
                      loans={loans}
                      equipment={equipment}
                      users={users}
                      onNewLoan={async (loan) => {
                          const res = await registerNewLoanInCloud(loan);
                          if(res.success) showToast("Préstamo registrado exitosamente");
                          else showToast("Error al registrar préstamo", 'error');
                      }}
                  />
              ) : (
                  <InstructorDashboard 
                      currentUser={currentUser}
                      loans={loans}
                      equipment={equipment}
                      users={users}
                      isOnline={isOnline}
                      onNewLoan={async (loan) => {
                          const res = await registerNewLoanInCloud(loan);
                          if(res.success) showToast("Préstamo registrado");
                          else showToast("Error: " + res.error, 'error');
                      }}
                      onReturn={async (loanId, concept, status, photos, analysis) => {
                          const loan = loans.find(l => l.id === loanId);
                          if (!loan) return;
                          const res = await registerReturnInCloud(loanId, loan.equipmentId, { concept, status, photos, analysis });
                          if(res.success) showToast("Devolución registrada");
                          else showToast("Error devolución", 'error');
                      }}
                      onAddNewUser={async (newUser) => {
                          await addUserToCloud(newUser);
                          return { success: true, message: "Usuario creado" };
                      }}
                      onUpdateUser={async (u) => {
                          await updateUserInCloud(u);
                          showToast("Usuario actualizado");
                      }}
                      onAddNewEquipment={async (e) => {
                          await addEquipmentToCloud(e);
                          showToast("Equipo agregado");
                      }}
                      onUpdateEquipmentImage={async (id, url) => {
                          await updateEquipmentImageInCloud(id, url);
                      }}
                      onEditEquipment={async (e) => {
                          await updateEquipmentInCloud(e);
                          showToast("Equipo actualizado");
                      }}
                      onDeleteEquipment={async (id) => {
                          await deleteEquipmentInCloud(id);
                          showToast("Equipo eliminado");
                      }}
                      onForceSync={async (onProgress) => {
                          const res = await forceCloudSync(onProgress);
                          if (res.success) showToast(res.message || "Sincronización completa");
                          else showToast("Error: " + res.message, 'error');
                      }}
                      onUpdateInventory={() => {}}
                      checkpointTimestamp={null}
                      onCreateCheckpoint={() => {}}
                  />
              )}
          </main>

          {showPasswordChangeModal && (
              <ForcePasswordChangeModal user={currentUser} onUpdateSuccess={handlePasswordUpdateSuccess} />
          )}
          
          {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      </div>
  );
};
