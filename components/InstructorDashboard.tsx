
import React, { useState, Suspense } from 'react';
import { User, LoanRecord, Equipment } from '../types';
import Spinner from './Spinner';
import { HomeIcon, PlusCircleIcon, ClipboardListIcon, UserGroupIcon, WrenchIcon, DocumentReportIcon } from './Icons';

// Lazy Load Sub-components
const HomeView = React.lazy(() => import('./dashboard/HomeView'));
const NewLoanView = React.lazy(() => import('./dashboard/NewLoanView'));
const ActiveLoansView = React.lazy(() => import('./dashboard/ActiveLoansView'));
const ManageUsersView = React.lazy(() => import('./dashboard/ManageUsersView'));
const InventoryView = React.lazy(() => import('./dashboard/InventoryView'));
const ReportsView = React.lazy(() => import('./dashboard/ReportsView'));

type Tab = 'home' | 'newLoan' | 'activeLoans' | 'manageUsers' | 'inventory' | 'reports';

interface DashboardProps {
    currentUser: User;
    loans: LoanRecord[];
    equipment: Equipment[];
    users: User[];
    onNewLoan: (loan: LoanRecord) => void;
    onReturn: (loanId: string, returnConcept: string, returnStatus: string, returnPhoto?: string[], returnAnalysis?: string) => void;
    onUpdateInventory: (newEquipment: Equipment[]) => void;
    onAddNewUser: (newUser: User) => { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
    onUpdateUser?: (user: User) => void;
    onAddNewEquipment: (newItem: Equipment) => void;
    onUpdateEquipmentImage: (equipmentId: string, newImageUrl: string) => void;
    onEditEquipment: (updatedItem: Equipment) => void;
    onDeleteEquipment: (itemId: string) => void;
    checkpointTimestamp: string | null;
    onCreateCheckpoint: () => void;
    isOnline: boolean;
}

const TabButton: React.FC<{ icon: React.ReactNode, text: string, isActive: boolean, onClick: () => void }> = ({ icon, text, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 py-4 px-3 border-b-2 font-medium text-sm transition-colors ${isActive
                ? 'border-sena-green text-sena-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
            }`}
    >
        {icon} <span className="hidden sm:inline">{text}</span>
    </button>
);

const InstructorDashboard: React.FC<DashboardProps> = (props) => {
    const [activeTab, setActiveTab] = useState<Tab>('home');

    // Fix for async onAddNewUser prop mismatch if necessary (handled by just passing it as is, types adjusted in interface)

    return (
        <div className="w-full">
            <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-6 overflow-x-auto whitespace-nowrap" aria-label="Tabs">
                    <TabButton icon={<HomeIcon className="w-5 h-5" />} text="Inicio" isActive={activeTab === 'home'} onClick={() => setActiveTab('home')} />
                    <TabButton icon={<PlusCircleIcon className="w-5 h-5" />} text="Nuevo Préstamo" isActive={activeTab === 'newLoan'} onClick={() => setActiveTab('newLoan')} />
                    <TabButton icon={<ClipboardListIcon className="w-5 h-5" />} text="Préstamos Activos" isActive={activeTab === 'activeLoans'} onClick={() => setActiveTab('activeLoans')} />
                    <TabButton icon={<UserGroupIcon className="w-5 h-5" />} text="Usuarios" isActive={activeTab === 'manageUsers'} onClick={() => setActiveTab('manageUsers')} />
                    <TabButton icon={<WrenchIcon className="w-5 h-5" />} text="Inventario" isActive={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
                    <TabButton icon={<DocumentReportIcon className="w-5 h-5" />} text="Reportes" isActive={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
                </nav>
            </div>

            <div className="min-h-[400px]">
                <Suspense fallback={<div className="flex justify-center items-center h-64"><Spinner size="12" color="sena-green" /></div>}>
                    {activeTab === 'home' && <HomeView loans={props.loans} equipment={props.equipment} />}
                    {activeTab === 'newLoan' && <NewLoanView users={props.users} equipment={props.equipment} onNewLoan={props.onNewLoan} currentUser={props.currentUser} />}
                    {activeTab === 'activeLoans' && <ActiveLoansView loans={props.loans} equipment={props.equipment} users={props.users} onReturn={props.onReturn} />}
                    {activeTab === 'manageUsers' && (
                        // Cast prop to handle mismatch if needed, but updated interface above.
                        <ManageUsersView
                            users={props.users}
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
                            onUpdateInventory={props.onUpdateInventory}
                            isOnline={props.isOnline}
                        />
                    )}
                    {activeTab === 'reports' && <ReportsView loans={props.loans} />}
                </Suspense>
            </div>
        </div>
    );
};

export default InstructorDashboard;
