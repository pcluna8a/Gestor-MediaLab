
import React, { useState, useEffect } from 'react';
import { Role, User, LoanRecord, Equipment, EquipmentStatus, UserCategory } from './types';
import { INITIAL_USERS } from './constants';
import { DEFAULT_EQUIPMENT } from './services/initialData';
import InstructorDashboard from './components/InstructorDashboard';
import UserDashboard from './components/AprendizDashboard';
import { LogoutIcon, SunIcon, MoonIcon } from './components/Icons';

const RoleSelector: React.FC<{ users: User[]; onSelect: (user: User) => void }> = ({ users, onSelect }) => {
  const [selectedRole, setSelectedRole] = React.useState<Role | ''>('');
  const [selectedCategory, setSelectedCategory] = React.useState<UserCategory | ''>('');
  const [userId, setUserId] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (selectedRole !== Role.USUARIO_MEDIALAB) {
      setSelectedCategory('');
    }
  }, [selectedRole]);

  const handleLogin = () => {
    if (!selectedRole || !userId) {
      setError('Por favor, selecciona un rol e ingresa tu ID.');
      return;
    }
    if (selectedRole === Role.USUARIO_MEDIALAB && !selectedCategory) {
      setError('Por favor, selecciona una categoría.');
      return;
    }

    const user = users.find(u =>
      u.id === userId &&
      u.role === selectedRole &&
      (selectedRole === Role.INSTRUCTOR_MEDIALAB || u.category === selectedCategory)
    );

    if (user) {
      setError('');
      onSelect(user);
    } else {
      setError('Credenciales incorrectas. Verifica tu ID, rol y categoría.');
    }
  };
  
  const roleOrder: Role[] = [
    Role.USUARIO_MEDIALAB,
    Role.INSTRUCTOR_MEDIALAB,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-sena-dark p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg text-center">
        <img src="https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png" alt="SENA Logo" className="w-32 mx-auto mb-6 dark:brightness-0 dark:invert" />
        <h1 className="text-2xl font-bold text-sena-dark dark:text-white mb-2">Gestor MediaLab</h1>
        <p className="text-sena-gray dark:text-gray-300 mb-8">Por favor, identifícate para continuar.</p>
        <div className="space-y-4 text-left">
          <div>
            <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
            <select
              id="role-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as Role)}
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-gray-200 focus:ring-2 focus:ring-sena-green focus:border-sena-green"
            >
              <option value="" disabled>-- Selecciona tu rol --</option>
              {roleOrder.map(role => (
                <option key={role} value={role}>{role.replace(/_/g, '-')}</option>
              ))}
            </select>
          </div>
          {selectedRole === Role.USUARIO_MEDIALAB && (
            <div>
              <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
              <select
                id="category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as UserCategory)}
                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-gray-200 focus:ring-2 focus:ring-sena-green focus:border-sena-green"
              >
                <option value="" disabled>-- Selecciona tu categoría --</option>
                {Object.values(UserCategory).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="user-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID de Usuario</label>
            <input
              type="text"
              id="user-id"
              value={userId}
              onChange={(e) => {
                  const val = e.target.value;
                  if (/^\d*$/.test(val)) {
                      setUserId(val);
                  }
              }}
              placeholder="Ingresa tu ID numérico"
              className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-gray-200 focus:ring-2 focus:ring-sena-green focus:border-sena-green"
            />
          </div>
        </div>
        {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
        <div className="mt-6">
          <button
            onClick={handleLogin}
            className="w-full bg-sena-green text-white font-bold py-3 rounded-lg hover:bg-opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectedRole || !userId || (selectedRole === Role.USUARIO_MEDIALAB && !selectedCategory)}
          >
            Ingresar
          </button>
        </div>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [loans, setLoans] = React.useState<LoanRecord[]>([]);
  const [equipment, setEquipment] = React.useState<Equipment[]>(DEFAULT_EQUIPMENT);
  const [users, setUsers] = React.useState<User[]>(INITIAL_USERS);
  const [isLoading, setIsLoading] = React.useState(true);
  const [checkpointTimestamp, setCheckpointTimestamp] = React.useState<string | null>(null);


  const [theme, setTheme] = React.useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedPrefs = window.localStorage.getItem('theme');
      if (storedPrefs) {
        return storedPrefs;
      }
      const userMedia = window.matchMedia('(prefers-color-scheme: dark)');
      if (userMedia.matches) {
        return 'dark';
      }
    }
    return 'light';
  });
  
  /**
   * Efecto para cargar el estado de la aplicación desde el último checkpoint
   * en localStorage al iniciar la aplicación. Mejora la persistencia de datos.
   */
  useEffect(() => {
    try {
      const checkpointData = localStorage.getItem('mediaLabCheckpoint');
      if (checkpointData) {
        const parsedData = JSON.parse(checkpointData);
        if (parsedData.users) setUsers(parsedData.users);
        if (parsedData.equipment) setEquipment(parsedData.equipment);
        // Las fechas se deben convertir de string a objeto Date al cargar desde JSON
        if (parsedData.loans) {
          const loadedLoans = parsedData.loans.map((l: any) => ({
            ...l,
            loanDate: new Date(l.loanDate),
            returnDate: l.returnDate ? new Date(l.returnDate) : null,
          }));
          setLoans(loadedLoans);
        }
        if (parsedData.timestamp) setCheckpointTimestamp(parsedData.timestamp);
        console.log("Estado restaurado desde el último checkpoint.");
      }
    } catch (error) {
      console.error("No se pudo restaurar el estado desde localStorage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleSelectUser = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };
  
  const handleNewLoan = (loan: LoanRecord) => {
    setLoans(prevLoans => [...prevLoans, loan]);
    setEquipment(prevEquipment => 
      prevEquipment.map(item => 
        item.id === loan.equipmentId ? { ...item, status: EquipmentStatus.ON_LOAN } : item
      )
    );
  };
  
  const handleReturn = (loanId: string, returnConcept: string, returnPhoto?: string) => {
    let equipmentIdToUpdate: string | null = null;
    
    setLoans(prevLoans => 
      prevLoans.map(loan => {
        if (loan.id === loanId) {
          equipmentIdToUpdate = loan.equipmentId;
          const updatedLoan: LoanRecord = {
            ...loan,
            returnDate: new Date(),
            returnConcept: returnConcept,
          };
          if (returnPhoto) {
            updatedLoan.returnPhotos = [...(loan.returnPhotos || []), returnPhoto];
          }
          return updatedLoan;
        }
        return loan;
      })
    );

    if (equipmentIdToUpdate) {
      setEquipment(prevEquipment => 
        prevEquipment.map(item => 
          item.id === equipmentIdToUpdate ? { ...item, status: EquipmentStatus.AVAILABLE } : item
        )
      );
    }
  };
  
  const handleUpdateInventory = (newEquipment: Equipment[]) => {
    const onLoanEquipmentIds = new Set(
      loans.filter(l => !l.returnDate).map(l => l.equipmentId)
    );

    const updatedEquipment = newEquipment.map(item => ({
        ...item,
        status: onLoanEquipmentIds.has(item.id) ? EquipmentStatus.ON_LOAN : EquipmentStatus.AVAILABLE,
    }));
    setEquipment(updatedEquipment);
  };

  const handleAddNewUser = (newUser: User): { success: boolean, message: string } => {
    if (users.some(u => u.id === newUser.id)) {
        return { success: false, message: 'El ID de usuario ya existe.' };
    }
    setUsers(prevUsers => [...prevUsers, newUser].sort((a,b) => a.name.localeCompare(b.name)));
    return { success: true, message: 'Usuario agregado con éxito.' };
  };

  const handleAddNewEquipment = (newItem: Equipment) => {
    setEquipment(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleUpdateEquipmentImage = (equipmentId: string, newImageUrl: string) => {
    setEquipment(prev => prev.map(item => 
      item.id === equipmentId ? { ...item, imageUrl: newImageUrl } : item
    ));
  };
  
  const handleCreateCheckpoint = () => {
      try {
          const timestamp = new Date().toISOString();
          const checkpointData = {
              timestamp,
              loans,
              equipment,
              users,
          };
          localStorage.setItem('mediaLabCheckpoint', JSON.stringify(checkpointData));
          setCheckpointTimestamp(timestamp);
          alert(`Punto de recuperación creado con éxito a las ${new Date(timestamp).toLocaleTimeString()}`);
      } catch (error) {
          console.error("Error al crear el checkpoint:", error);
          alert("No se pudo guardar el punto de recuperación. Es posible que el almacenamiento esté lleno.");
      }
  };

  const getGreetingName = (fullName: string): string => {
    const parts = fullName.split(' ');
    const nameParts = parts.length > 2 ? parts.slice(0, parts.length - 2) : [parts[0]];
    const name = nameParts.join(' ');
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const renderDashboard = () => {
    if (!currentUser) return null;

    switch (currentUser.role) {
      case Role.INSTRUCTOR_MEDIALAB:
        return <InstructorDashboard
          currentUser={currentUser}
          loans={loans}
          equipment={equipment}
          users={users}
          onNewLoan={handleNewLoan}
          onReturn={handleReturn}
          onUpdateInventory={handleUpdateInventory}
          onAddNewUser={handleAddNewUser}
          onAddNewEquipment={handleAddNewEquipment}
          onUpdateEquipmentImage={handleUpdateEquipmentImage}
          checkpointTimestamp={checkpointTimestamp}
          onCreateCheckpoint={handleCreateCheckpoint}
        />;
      case Role.USUARIO_MEDIALAB:
        return <UserDashboard
            currentUser={currentUser}
            loans={loans}
            equipment={equipment}
            users={users}
            onNewLoan={handleNewLoan}
        />;
      default:
        return (
          <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold">Bienvenido, {getGreetingName(currentUser.name)}</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Actualmente no hay un panel de control específico para tu rol.
            </p>
          </div>
        );
    }
  };


  if (!currentUser) {
    return <RoleSelector users={users} onSelect={handleSelectUser} />;
  }
  
  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-sena-dark">
            <p className="text-lg text-sena-dark dark:text-gray-200">Cargando aplicación...</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-sena-dark text-sena-dark dark:text-gray-200">
       <header className="bg-white dark:bg-gray-800 shadow-md p-4 flex flex-wrap justify-between items-center gap-y-4">
        <div className="flex items-center gap-3">
            <img src="https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png" alt="SENA Logo" className="h-10 dark:brightness-0 dark:invert" />
            <h1 className="text-xl font-bold text-sena-dark dark:text-white">Gestor MediaLab</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={handleToggleTheme} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label="Cambiar tema">
              {theme === 'light' ? (
                <MoonIcon className="w-6 h-6 text-sena-gray dark:text-gray-300" />
              ) : (
                <SunIcon className="w-6 h-6 text-sena-green" />
              )}
            </button>
            <div className="text-right">
                <p className="font-semibold text-sm sm:text-base truncate">{currentUser.name}</p>
                <p className="text-xs sm:text-sm text-sena-green font-medium">{currentUser.role}{currentUser.category ? ` (${currentUser.category})` : ''}</p>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" aria-label="Cerrar sesión">
                <LogoutIcon className="w-6 h-6 text-sena-gray dark:text-gray-300" />
            </button>
        </div>
      </header>
      <main className="p-4 sm:p-6 lg:p-8">
        <h1 className="text-3xl font-bold text-sena-dark dark:text-white mb-6">¡Hola, {getGreetingName(currentUser.name)}!</h1>
        {renderDashboard()}
      </main>
    </div>
  );
};

export default App;