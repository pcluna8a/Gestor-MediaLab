import React, { useState, useEffect } from 'react';
import { Role, User, LoanRecord, Equipment } from './types';
import InstructorDashboard from './components/InstructorDashboard';
import UserDashboard from './components/AprendizDashboard';
import { LogoutIcon, SunIcon, MoonIcon } from './components/Icons';
import { Toast, useToast } from './components/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { LoginScreen } from './components/LoginScreen';

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

const MainApp: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const {
    equipment,
    loans,
    users,
    isOnline,
    lastSync,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    updateEquipmentImage,
    registerLoan,
    registerReturn,
    addUser
  } = useData();

  const { toast, showToast, closeToast } = useToast();
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Dark Mode Logic
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

  // Adapters for Toast (Context methods return promises with {success, error})
  // We wrap them to show toasts here.

  const handleNewLoan = async (loan: LoanRecord) => {
    const result = await registerLoan(loan);
    if (result.success) showToast("Préstamo registrado exitosamente", "success");
    else showToast(result.error || "Error al registrar préstamo", "error");
  };

  const handleReturn = async (loanId: string, concept: string, status: string, photos: string[], analysis: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (!loan) return;
    const result = await registerReturn(loanId, loan.equipmentId, { concept, status, photos, analysis });
    if (result.success) showToast("Devolución registrada exitosamente", "success");
    else showToast(result.error || "Error al registrar devolución", "error");
  };

  const handleAddNewUser = async (newUser: User) => {
    const exists = users.some(u => u.id === newUser.id);
    if (exists) return { success: false, message: 'El usuario ya existe.' };
    await addUser(newUser);
    showToast("Usuario agregado correctamente", "success");
    return { success: true, message: 'Usuario agregado.' };
  };

  const handleUpdateUser = async (updatedUser: User) => {
    await addUser(updatedUser); // Reuse add for update/merge logic
    showToast("Usuario actualizado", "success");
  };

  const handleAddNewEquipment = async (item: Equipment) => {
    const exists = equipment.some(e => e.id === item.id);
    if (exists) {
      showToast("El código de equipo ya existe", "error");
      return;
    }
    await addEquipment(item);
    showToast("Equipo agregado al inventario", "success");
  };

  const handleUpdateEquipmentImage = async (id: string, url: string) => {
    await updateEquipmentImage(id, url);
    showToast("Imagen actualizada", "success");
  };

  const handleEditEquipment = async (item: Equipment) => {
    const result = await updateEquipment(item);
    if (result.success) showToast("Equipo actualizado", "success");
    else showToast("Error al actualizar equipo", "error");
  };

  const handleDeleteEquipment = async (id: string) => {
    const result = await deleteEquipment(id);
    if (result.success) showToast("Equipo eliminado", "success");
    else showToast("Error al eliminar equipo", "error");
  };


  if (!currentUser) {
    return (
      <>
        {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
        <LoginScreen />
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

          {/* Status Bar */}


          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{getGreetingName(currentUser.name)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{currentUser.role.replace(/_/g, ' ')}</p>
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
              {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            <button onClick={logout} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors" title="Cerrar Sesión">
              <LogoutIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

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
            onUpdateInventory={() => { }} // Legacy?
            onAddNewUser={handleAddNewUser}
            onUpdateUser={handleUpdateUser}
            onAddNewEquipment={handleAddNewEquipment}
            onUpdateEquipmentImage={handleUpdateEquipmentImage}
            onEditEquipment={handleEditEquipment}
            onDeleteEquipment={handleDeleteEquipment}
            checkpointTimestamp={null}
            onCreateCheckpoint={() => { }}
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
};

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <MainApp />
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
