
import React, { useState, useEffect, useCallback } from 'react';
import { Role, User, LoanRecord, Equipment, EquipmentStatus, UserCategory } from './types';
import { INITIAL_USERS } from './constants';
import InstructorDashboard from './components/InstructorDashboard';
import UserDashboard from './components/AprendizDashboard';
import { LogoutIcon, SunIcon, MoonIcon } from './components/Icons';
import { Toast, useToast } from './components/Toast';
import Spinner from './components/Spinner';
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

const RoleSelector: React.FC<{ users: User[]; onSelect: (user: User) => void }> = ({ users, onSelect }) => {
  const [selectedRole, setSelectedRole] = React.useState<Role | ''>('');
  const [selectedCategory, setSelectedCategory] = React.useState<UserCategory | ''>('');
  const [userId, setUserId] = React.useState('');
  const [password, setPassword] = React.useState(''); // Campo para contraseña
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  
  // Estados para cambio de contraseña (Primer Ingreso)
  const [showPasswordChange, setShowPasswordChange] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');

  React.useEffect(() => {
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

    // 2. Lógica de Contraseña para Instructor
    if (selectedRole === Role.INSTRUCTOR_MEDIALAB) {
        // Caso A: Usuario Migrado sin hash aún (Legacy) o Primer Ingreso por defecto
        // Asumimos que la contraseña inicial es el ID
        let isValid = false;

        if (user.passwordHash) {
            const inputHash = await hashPassword(password);
            isValid = inputHash === user.passwordHash;
        } else {
            // Fallback: Si no tiene hash en DB, verificamos si password == ID (comportamiento por defecto)
            isValid = password === user.id;
            // Si entra así, DEBE cambiar contraseña
            if (isValid) {
                user.forcePasswordChange = true; 
            }
        }

        if (!isValid) {
            setError('Contraseña incorrecta.');
            setIsLoading(false);
            return;
        }

        // Caso B: Requiere Cambio de Contraseña Obligatorio
        if (user.forcePasswordChange) {
            setShowPasswordChange(true);
            setIsLoading(false);
            return; // Detener login, mostrar modal
        }
    }

    // Login Exitoso (Aprendiz o Instructor Validado)
    setError('');
    setIsLoading(false);
    onSelect(user);
  };

  const handleChangePassword = async () => {
      if (newPassword.length < 6) {
          setError("La contraseña debe tener al menos 6 caracteres.");
          return;
      }
      if (newPassword !== confirmPassword) {
          setError("Las contraseñas no coinciden.");
          return;
      }
      if (!newEmail.includes('@')) {
          setError("Ingresa un correo válido.");
          return;
      }
      
      setIsLoading(true);
      const newHash = await hashPassword(newPassword);
      
      // Actualizar en la nube
      const result = await updateUserCredentials(userId, newEmail, newHash);
      
      if (result.success) {
          // Actualizar objeto local temporalmente para login inmediato
          const updatedUser = users.find(u => u.id === userId);
          if (updatedUser) {
              updatedUser.email = newEmail;
              updatedUser.passwordHash = newHash;
              updatedUser.forcePasswordChange = false;
              onSelect(updatedUser);
          } else {
              // Fallback si es InitialUser
              onSelect({ 
                  id: userId, 
                  name: 'Usuario', 
                  role: Role.INSTRUCTOR_MEDIALAB, 
                  email: newEmail 
              }); 
          }
      } else {
          setError("Error al actualizar credenciales: " + result.error);
          setIsLoading(false);
      }
  };
  
  const roleOrder: Role[] = [
    Role.USUARIO_MEDIALAB,
    Role.INSTRUCTOR_MEDIALAB,
  ];

  if (showPasswordChange) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-sena-dark p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg text-center animate-fade-in">
                <img src="/logoSena.png" onError={(e) => e.currentTarget.src = "https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png"} alt="SENA Logo" className="w-24 mx-auto mb-6 dark:brightness-0 dark:invert" />
                <h2 className="text-xl font-bold text-sena-dark dark:text-white mb-2">Primer Ingreso / Seguridad</h2>
                <p className="text-sm text-gray-500 mb-6">Por seguridad, debes cambiar tu contraseña inicial y registrar tu correo institucional.</p>
                
                <div className="space-y-4 text-left">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo Institucional</label>
                        <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nueva Contraseña</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar Contraseña</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button onClick={handleChangePassword} disabled={isLoading} className="w-full bg-sena-green text-white py-2 rounded font-bold mt-2 hover:bg-opacity-90 transition-colors">
                        {isLoading ? <Spinner size="5" color="white" /> : 'Actualizar y Acceder'}
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-sena-dark p-4">
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
                <p className="text-xs text-gray-500 mt-1 text-right">Primer ingreso: usa tu número de ID</p>
             </div>
          )}

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
      const init = async () => {
          const online = await checkCloudConnection();
          setIsOnline(online);
          setIsCheckingConnection(false);
          
          // Inicializar DB si está vacía (solo si hay conexión)
          if (online) {
              await initializeCloudDatabase();
          }
      };
      init();

      // Network Listeners
      const handleOnline = async () => {
          console.log("Network Status: Online");
          const connected = await checkCloudConnection();
          if (connected) {
              setIsOnline(true);
              showToast("Conexión a la nube restablecida", "success");
          }
      };
      
      const handleOffline = () => {
          console.log("Network Status: Offline");
          setIsOnline(false);
          showToast("Sin conexión. Pasando a modo offline.", "info");
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);

  // Data Subscriptions
  useEffect(() => {
    const unsubscribeEquipment = subscribeToCollection('equipment', (data) => {
        setEquipment(data as Equipment[]);
        setLastSync(new Date());
    });
    const unsubscribeLoans = subscribeToCollection('loans', (data) => {
        setLoans(data as LoanRecord[]);
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
  }, []);

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
    <div className="min-h-screen bg-gray-100 dark:bg-sena-dark transition-colors duration-300">
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      
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
                   <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                   <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                       {isOnline ? 'CONECTADO A LA NUBE' : 'MODO LOCAL (OFFLINE)'}
                   </span>
               </div>
               {isOnline && lastSync && (
                   <span className="text-[10px] text-gray-400 border-l pl-3 border-gray-300 dark:border-gray-500">
                       Sincronizado: {lastSync.toLocaleTimeString()}
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
