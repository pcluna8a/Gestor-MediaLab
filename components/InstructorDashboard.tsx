
import React, { useState, Suspense } from 'react';
import { User, LoanRecord, Equipment } from '../types';
import Spinner from './Spinner';
import GlassCard from './GlassCard';
import { HomeIcon, PlusCircleIcon, ClipboardListIcon, UserGroupIcon, WrenchIcon, DocumentReportIcon, CogIcon } from './Icons';

// Lazy Load Sub-components
const HomeView = React.lazy(() => import('./dashboard/HomeView'));
const NewLoanView = React.lazy(() => import('./dashboard/NewLoanView'));
const ActiveLoansView = React.lazy(() => import('./dashboard/ActiveLoansView'));
const ManageUsersView = React.lazy(() => import('./dashboard/ManageUsersView'));
const InventoryView = React.lazy(() => import('./dashboard/InventoryView'));
const ReportsView = React.lazy(() => import('./dashboard/ReportsView'));
const AuditLogsView = React.lazy(() => import('./dashboard/AuditLogsView'));
const SystemSettingsView = React.lazy(() => import('./dashboard/SystemSettingsView'));

type Tab = 'home' | 'newLoan' | 'activeLoans' | 'manageUsers' | 'inventory' | 'reports' | 'auditData' | 'systemSettings';

interface DashboardProps {
    currentUser: User;
    loans: LoanRecord[];
    equipment: Equipment[];
    users: User[];
    onNewLoan: (loan: LoanRecord) => void;
    onReturn: (loanId: string, returnConcept: string, returnStatus: string, returnPhoto?: string[], returnAnalysis?: string) => void;
    onAddNewUser: (newUser: User) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
    onUpdateUser?: (user: User) => void;
    onAddNewEquipment: (newItem: Equipment) => void;
    onUpdateEquipmentImage: (equipmentId: string, newImageUrl: string) => void;
    onEditEquipment: (updatedItem: Equipment) => void;
    onDeleteEquipment: (itemId: string) => void;
    isOnline: boolean;
}

const TabButton: React.FC<{ icon: React.ReactNode, text: string, isActive: boolean, onClick: () => void }> = ({ icon, text, isActive, onClick }) => (
    <button
        onClick={onClick}
        aria-label={text}
        className={`flex items-center gap-3 py-3 px-5 rounded-full font-medium text-sm transition-all duration-300 relative overflow-hidden group ${isActive
            ? 'bg-sena-green text-white shadow-[0_0_15px_rgba(57,169,0,0.6)] border border-sena-green'
            : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10'
            }`}
    >
        <span className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</span>
        <span className="relative z-10 hidden md:inline">{text}</span>

        {/* Neon Glow Hover Effect */}
        <span className="absolute inset-0 rounded-full bg-sena-green/20 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300"></span>
    </button>
);

const InstructorDashboard: React.FC<DashboardProps> = (props) => {
    const [activeTab, setActiveTab] = useState<Tab>('home');

    return (
        <div className="w-full space-y-6">
            {/* Navigation Tabs - Floating Glass Bar */}
            <div className="flex justify-center">
                <div className="inline-flex p-1.5 bg-[#002b42]/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl overflow-x-auto max-w-full">
                    <nav className="flex space-x-2" aria-label="Tabs">
                        <TabButton icon={<HomeIcon className="w-5 h-5" />} text="Inicio" isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} />
                        <TabButton icon={<PlusCircleIcon className="w-5 h-5" />} text="Préstamo" isActive={activeTab === 'newLoan'} onClick={() => setActiveTab('newLoan')} />
                        <TabButton icon={<ClipboardListIcon className="w-5 h-5" />} text="Activos" isActive={activeTab === 'activeLoans'} onClick={() => setActiveTab('activeLoans')} />
                        <TabButton icon={<UserGroupIcon className="w-5 h-5" />} text="Usuarios" isActive={activeTab === 'manageUsers'} onClick={() => setActiveTab('manageUsers')} />
                        <TabButton icon={<WrenchIcon className="w-5 h-5" />} text="Inventario" isActive={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
                        <TabButton icon={<DocumentReportIcon className="w-5 h-5" />} text="Reportes" isActive={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
                        {props.currentUser?.isSuperAdmin && (
                            <>
                                <TabButton icon={<DocumentReportIcon className="w-5 h-5" />} text="Auditoría" isActive={activeTab === 'auditData'} onClick={() => setActiveTab('auditData')} />
                                <TabButton icon={<CogIcon className="w-5 h-5" />} text="Ajustes" isActive={activeTab === 'systemSettings'} onClick={() => setActiveTab('systemSettings')} />
                            </>
                        )}
                    </nav>
                </div>
            </div>

            {/* Main Content Area */}
            <GlassCard className="min-h-[500px] p-6 animate-slide-up relative z-0">
                <Suspense fallback={<div className="flex justify-center items-center h-64"><Spinner size="12" color="sena-green" /></div>}>
                    {activeTab === 'home' && <HomeView loans={props.loans} equipment={props.equipment} onTabChange={setActiveTab} />}
                    {activeTab === 'newLoan' && <NewLoanView users={props.users} equipment={props.equipment} onNewLoan={props.onNewLoan} currentUser={props.currentUser} />}
                    {activeTab === 'activeLoans' && <ActiveLoansView loans={props.loans} equipment={props.equipment} users={props.users} onReturn={props.onReturn} />}
                    {activeTab === 'manageUsers' && (
                        <ManageUsersView
                            users={props.users}
                            currentUser={props.currentUser}
                            onAddNewUser={props.onAddNewUser as any}
                            onUpdateUser={props.onUpdateUser || (() => { })}
                            isOnline={props.isOnline}
                        />
                    )}
                    {activeTab === 'inventory' && (
                        <InventoryView
                            equipment={props.equipment}
                            onAddNewEquipment={props.onAddNewEquipment}
                            onEditEquipment={props.onEditEquipment}
                            onDeleteEquipment={props.onDeleteEquipment}
                            isOnline={props.isOnline}
                        />
                    )}
                    {activeTab === 'reports' && <ReportsView loans={props.loans} equipment={props.equipment} />}
                    {activeTab === 'auditData' && props.currentUser?.isSuperAdmin && <AuditLogsView />}
                    {activeTab === 'systemSettings' && props.currentUser?.isSuperAdmin && <SystemSettingsView />}
                </Suspense>
            </GlassCard>
        </div>
    );
};

export default InstructorDashboard;
