import React, { useState, useEffect } from 'react';
import { Role, User, LoanRecord, Equipment } from './types';
import InstructorDashboard from './components/InstructorDashboard';
import UserDashboard from './components/AprendizDashboard';
import { LogoutIcon, SunIcon, MoonIcon } from './components/Icons';
import { Toast, useToast } from './components/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider, useData } from './contexts/DataContext';
import { LoginScreen } from './components/LoginScreen';
import GlassCard from './components/GlassCard';

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
    addEquipment,
    updateEquipment,
    deleteEquipment,
    updateEquipmentImage,
    registerLoan,
    registerReturn,
    addUser
  } = useData();

  const { toast, showToast, closeToast } = useToast();
  // Dark mode is now default/forced by design "Futurismo Institucional", but we keep state for toggle if user really wants light mode (though design specs say Dark/Glass).
  // Actually specs say "Environment digital oscuro (Dark Mode)". Let's default to true and maybe hide toggle or keep it.
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Force dark mode class for Tailwind
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

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
    await addUser(updatedUser);
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
    <div className="min-h-screen font-sans text-gray-100 transition-colors duration-300 relative overflow-hidden">
      {/* Background Gradients for "Futurismo" effect */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-sena-green/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}

      {/* Glass Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#00324D]/60 border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-sena-green/50 rounded-full blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
              <img src="/logoSena.png" onError={(e) => e.currentTarget.src = "https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png"} alt="SENA" className="relative h-12 w-12 drop-shadow-lg" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Media<span className="text-sena-green">Lab</span></h1>
              <p className="text-xs text-gray-300 hidden sm:block font-light tracking-wider">GESTOR DE PRÉSTAMOS - CIES</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-white">{getGreetingName(currentUser.name)}</p>
              <p className="text-[10px] uppercase tracking-widest text-sena-green font-bold">{currentUser.role.replace(/_/g, ' ')}</p>
            </div>

            <button onClick={logout} className="p-2 rounded-full hover:bg-white/10 text-red-400 hover:text-red-300 transition-all border border-transparent hover:border-red-500/30" title="Cerrar Sesión">
              <LogoutIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="animate-fade-in">
          {currentUser.role === Role.INSTRUCTOR_MEDIALAB ? (
            <InstructorDashboard
              currentUser={currentUser}
              loans={loans}
              equipment={equipment}
              users={users}
              onNewLoan={handleNewLoan}
              onReturn={handleReturn}
              onUpdateInventory={() => { }}
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
        </div>
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
