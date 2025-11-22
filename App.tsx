
import React, { useState, useEffect, useCallback } from 'react';
import { Role, User, LoanRecord, Equipment, EquipmentStatus, UserCategory } from './types';
import { INITIAL_USERS } from './constants';
import InstructorDashboard from './components/InstructorDashboard';
import UserDashboard from './components/AprendizDashboard';
import { LogoutIcon, SunIcon, MoonIcon, SaveIcon } from './components/Icons';
import { Toast, useToast } from './components/Toast';
import Spinner from './components/Spinner';
import Modal from './components/Modal';
// Importar servicios de nube
import { 
  subscribeToCollection, 
  registerNewLoanInCloud, 
  registerReturnInCloud, 
  addUserToCloud, 
  addEquipmentToCloud, 
  updateEquipmentImageInCloud,
  initializeCloudDatabase,
  checkCloudConnection,
  updateEquipmentInCloud,
  deleteEquipmentInCloud,
  updateUserCredentials,
  updateUserInCloud,
  hashPassword
} from './services/firebaseService';

const getGreetingName = (fullName: string): string => {
  if (!fullName) return 'Usuario';
  
  // 1. Limpieza: Trim y espacios múltiples
  const cleanName = fullName.trim().replace(/\s+/g, ' ');
  
  // 2. Split por espacios
  const parts = cleanName.split(' ');
  
  // 3. Lógica de nombres
  // Si tiene 3 o 4 partes, asumimos (Nombre [Nombre] Apellido Apellido)
  // Tomamos la primera parte (Primer Nombre) y la penúltima (Primer Apellido) si es largo, 
  // o simplemente el primero y el segundo si son pocos.
  
  let firstName = parts[0];
  let lastName = '';

  if (parts.length >= 3) {
      // Ej: Juan Carlos Perez Rodriguez -> Juan Perez
      // Ej: Juan Perez Rodriguez -> Juan Perez
      lastName = parts[parts.length - 2];
  } else if (parts.length === 2) {
      lastName = parts[1];
  }

  // 4. Capitalización (Primera mayúscula, resto minúscula)
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

    // Este modal no tiene botón de cierre (onClose) para obligar al usuario
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
                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            placeholder="usuario@sena.edu.co"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Nueva Contraseña</label>
                        <input 
                            type="password" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Confirmar Contraseña</label>
                        <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
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
                        {isLoading ? <Spinner size="5" color="white" /> : 'Actualizar Credenciales y Continuar'}
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
        
        // Simulación de retardo de red
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

        // Si coincide, pasamos al paso 2
        setStep(2);
        setIsLoading(false);
    };

    const handleReset = async () => {
        if (newPassword.length < 6) { setError("Mínimo 6 caracteres."); return; }
        if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden."); return; }
        
        setIsLoading(true);
        try {
            const newHash = await hashPassword(newPassword);
            // No cambiamos el email, solo la pass
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
                            <input type="text" value={id} onChange={e => setId(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" placeholder="Número de documento" />
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
  const [password, setPassword] = React.useState(''); // Campo para contraseña
  const [rememberMe, setRememberMe] = React.useState(false); // Nuevo estado Remember Me
  const [showForgotModal, setShowForgotModal] = React.useState(false); // Estado modal forgot
  
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Cargar credenciales guardadas al inicio
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
    if (selectedRole === Role.INSTRUCTOR_MEDIALAB && !password) {
        setError('Por favor, ingresa tu contraseña.');
        return;
    }

    setIsLoading(true);
    const effectiveUsers = users.length > 0 ? users : INITIAL_USERS;

    // 1. Buscar Usuario
    const user = effectiveUsers.find(u =>
      u.id === userId &&
      u.role === selectedRole &&
      (selectedRole === Role.INSTRUCTOR_MEDIALAB || u.category === selectedCategory)
    );

    if (!user) {
        setError('Usuario no encontrado. Verifica tus credenciales.');
        setIsLoading(false);
        return;
    }

    // 2. Validación de Contraseña para Instructor
    if (selectedRole === Role.INSTRUCTOR_MEDIALAB) {
        let isValid = false;
        let requiresChange = false;

        if (user.passwordHash) {
            // Usuario ya tiene hash, verificar
            const inputHash = await hashPassword(password);
            isValid = inputHash === user.passwordHash;
            requiresChange = !!user.forcePasswordChange;
        } else {
            // Fallback (Legacy o Primer Ingreso): Validar si password es igual al ID
            isValid = password === user.id;
            if (isValid) {
                // Si entró con el ID, MARCAMOS que requiere cambio, pero LO DEJAMOS ENTRAR
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

    // 3. Guardar en LocalStorage si Remember Me está activo
    if (rememberMe) {
        localStorage.setItem('ml_saved_role', selectedRole);
        if (selectedCategory) localStorage.setItem('ml_saved_cat', selectedCategory);
        localStorage.setItem('ml_saved_id', userId);
    } else {
        localStorage.removeItem('ml_saved_role');
        localStorage.removeItem('ml_saved_cat');
        localStorage.removeItem('ml_saved_id');
    }

    // Login Exitoso
    setError('');
    setIsLoading(false);
    onSelect(user);
  };

  const roleOrder: Role[] = [
    Role.USUARIO_MEDIALAB,
    Role.INSTRUCTOR_MEDIALAB,
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
                {selectedRole === Role.INSTRUCTOR_MEDIALAB ? 'Usuario (ID)' : 'Número de Identificación'}
            </label>
            <input
              type="text"
              id="user-id"
              value={userId}
              onChange={(e) => setUserId(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Ingresa tu número de documento"
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-gray-200 focus:ring-2 focus:ring-sena-green focus:border-sena-green transition-colors"
            />
          </div>

          {selectedRole === Role.INSTRUCTOR_MEDIALAB && (
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

// --- COMPONENTE PRINCIPAL APP ---
function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Estados de Conexión
  const [isOnline, setIsOnline] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const { toast, showToast, closeToast } = useToast();

  // Inicialización y Network Watchdog
  useEffect(() => {
      const validateConnection = async () => {
          const online = await checkCloudConnection();
          setIsOnline(online);
          setIsCheckingConnection(false);
          if(online) setLastSync(new Date());
      };

      validateConnection();
      if (initializeCloudDatabase) initializeCloudDatabase(); // Try to trigger internal check

      // 1. Watchdog Activo (Intervalo de 30s)
      const heartbeat = setInterval(async () => {
          const online = await checkCloudConnection();
          if (online !== isOnline) {
              setIsOnline(online);
              if (online) {
                  showToast("Conexión restablecida", "success");
                  setLastSync(new Date());
              } else {
                  showToast("Sin conexión a servidor", "error");
              }
          }
      }, 30000);

      // 2. Listeners de Eventos de Navegador
      const handleOnline = () => { 
          setIsOnline(true); 
          checkCloudConnection(); // Forzar validación real
      };
      const handleOffline = () => setIsOnline(false);
      
      // 3. Re-check al volver a la pestaña (Focus)
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
              checkCloudConnection().then(online => setIsOnline(online));
          }
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
          clearInterval(heartbeat);
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [isOnline]);

  // Data Subscriptions
  useEffect(() => {
    // Solo suscribirse si creemos estar online o para iniciar la caché local
    // subscribeToCollection maneja internamente el modo offline/online
    
    const unsubscribeEquipment = subscribeToCollection('equipment', (data) => {
        // Detectar cambios remotos si ya teníamos datos
        if (equipment.length > 0 && JSON.stringify(data) !== JSON.stringify(equipment) && isOnline) {
             // Opcional: showToast("Inventario actualizado remotamente", "info");
        }
        setEquipment(data as Equipment[]);
        setLastSync(new Date());
    });

    const unsubscribeLoans = subscribeToCollection('loans', (data) => {
        const parsedLoans = data.map((loan: any) => ({
            ...loan,
            loanDate: loan.loanDate ? new Date(loan.loanDate) : new Date(),
            returnDate: loan.returnDate ? new Date(loan.returnDate) : null
        }));
        
        // Comparar longitudes para detectar nuevos préstamos de otros usuarios
        if (loans.length > 0 && parsedLoans.length !== loans.length && isOnline) {
             showToast("Datos de préstamos actualizados", "info");
        }
        
        setLoans(parsedLoans as LoanRecord[]);
        setLastSync(new Date());
    });

    const unsubscribeUsers = subscribeToCollection('users', (data) => {
        setUsers(data as User[]);
    });

    return () => {
        unsubscribeEquipment();
        unsubscribeLoans();
        unsubscribeUsers();
    };
  }, [isOnline]); // Re-suscribir si el estado online cambia para asegurar fresh socket

  // Dark Mode logic
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);


  // Handlers
  const handleNewLoan = async (loan: LoanRecord) => {
    const result = await registerNewLoanInCloud(loan);
    if (result.success) {
        showToast("Préstamo registrado exitosamente", "success");
    } else {
        showToast(result.error || "Error al registrar préstamo", "error");
    }
  };

  const handleReturn = async (loanId: string, concept: string, status: string, photos: string[] = [], analysis: string = '') => {
      const loan = loans.find(l => l.id === loanId);
      if (!loan) return;

      const result = await registerReturnInCloud(loanId, loan.equipmentId, {
          concept,
          status,
          photos,
          analysis
      });

      if (result.success) {
          showToast("Devolución registrada exitosamente", "success");
      } else {
          showToast(result.error || "Error al registrar devolución", "error");
      }
  };

  const handleAddNewUser = (newUser: User) => {
    const exists = users.some(u => u.id === newUser.id);
    if (exists) return { success: false, message: 'El usuario ya existe.' };
    
    addUserToCloud(newUser);
    showToast("Usuario agregado correctamente", "success");
    return { success: true, message: 'Usuario agregado.' };
  };

  const handleUpdateUser = async (updatedUser: User) => {
     await updateUserInCloud(updatedUser);
     showToast("Usuario actualizado", "success");
  };

  const handleAddNewEquipment = (item: Equipment) => {
      const exists = equipment.some(e => e.id === item.id);
      if (exists) {
          showToast("El código de equipo ya existe", "error");
          return;
      }
      addEquipmentToCloud(item);
      showToast("Equipo agregado al inventario", "success");
  };

  const handleUpdateEquipmentImage = (id: string, url: string) => {
      updateEquipmentImageInCloud(id, url);
      showToast("Imagen actualizada", "success");
  };

  const handleEditEquipment = async (item: Equipment) => {
      const result = await updateEquipmentInCloud(item);
      if (result.success) {
          showToast("Equipo actualizado", "success");
      } else {
          showToast("Error al actualizar equipo", "error");
      }
  };

  const handleDeleteEquipment = async (id: string) => {
      const result = await deleteEquipmentInCloud(id);
      if (result.success) {
          showToast("Equipo eliminado", "success");
      } else {
          showToast("Error al eliminar equipo", "error");
      }
  };

  const handlePasswordUpdateSuccess = (newEmail: string, newHash: string) => {
      if (currentUser) {
          // Actualizamos el estado local para quitar el bloqueo inmediatamente
          setCurrentUser({
              ...currentUser,
              email: newEmail,
              passwordHash: newHash,
              forcePasswordChange: false
          });
          showToast("Credenciales actualizadas correctamente", "success");
      }
  };

  // Render
  if (!currentUser) {
    return (
        <>
            {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
            <RoleSelector users={users} onSelect={setCurrentUser} />
        </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-sena-dark transition-colors duration-300 relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      
      {/* MODAL DE CAMBIO DE CONTRASEÑA FORZADO - Solo aparece si el usuario ya entró y requiere cambio */}
      {currentUser.role === Role.INSTRUCTOR_MEDIALAB && currentUser.forcePasswordChange && (
          <ForcePasswordChangeModal user={currentUser} onUpdateSuccess={handlePasswordUpdateSuccess} />
      )}
      
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logoSena.png" onError={(e) => e.currentTarget.src = "https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png"} alt="SENA" className="h-10 w-10 dark:brightness-0 dark:invert" />
            <div>
              <h1 className="text-xl font-bold text-sena-green">MediaLab</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Gestor de Préstamos - CIES</p>
            </div>
          </div>

          {/* Status Bar for Connectivity */}
          <div className="hidden md:flex items-center gap-4 px-4 py-1 rounded-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
               <div className="flex items-center gap-2">
                   <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                   <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                       {isOnline ? 'CONECTADO A LA NUBE' : 'MODO LOCAL (OFFLINE)'}
                   </span>
               </div>
               {isOnline && lastSync && (
                   <span className="text-[10px] text-gray-400 border-l pl-3 border-gray-300 dark:border-gray-500">
                       Última sync: {lastSync.toLocaleTimeString()}
                   </span>
               )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{getGreetingName(currentUser.name)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser.role.replace(/_/g, ' ')}</p>
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
              {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            <button onClick={() => setCurrentUser(null)} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors" title="Cerrar Sesión">
              <LogoutIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Mobile Status Bar */}
        <div className={`md:hidden h-1 w-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentUser.role === Role.INSTRUCTOR_MEDIALAB ? (
          <InstructorDashboard
            currentUser={currentUser}
            loans={loans}
            equipment={equipment}
            users={users}
            onNewLoan={handleNewLoan}
            onReturn={handleReturn}
            onUpdateInventory={() => {}} 
            onAddNewUser={handleAddNewUser}
            onUpdateUser={handleUpdateUser}
            onAddNewEquipment={handleAddNewEquipment}
            onUpdateEquipmentImage={handleUpdateEquipmentImage}
            onEditEquipment={handleEditEquipment}
            onDeleteEquipment={handleDeleteEquipment}
            checkpointTimestamp={null}
            onCreateCheckpoint={() => {}}
            isOnline={isOnline}
          />
        ) : (
          <UserDashboard
            currentUser={currentUser}
            loans={loans}
            equipment={equipment}
            users={users}
            onNewLoan={handleNewLoan}
          />
        )}
      </main>
    </div>
  );
}

export default App;
