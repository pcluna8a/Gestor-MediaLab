
import React, { useState, useMemo, useEffect } from 'react';
import { User, LoanRecord, Equipment, EquipmentStatus, Role, UserCategory, createNewLoan, MaintenanceSuggestion } from '../types';
import { CameraCapture } from './CameraCapture';
import { analyzeEquipmentCondition, generateMaintenanceSuggestions, generateLoanReportAnalysis } from '../services/geminiService';
import { batchUploadEquipment, uploadLogoToCloud, subscribeToAppConfig } from '../services/firebaseService';
import Spinner from './Spinner';
import Modal from './Modal';
import { CameraIcon, CollectionIcon, DocumentReportIcon, SparklesIcon, DownloadIcon, ClipboardListIcon, ChartBarIcon, UserPlusIcon, PlusCircleIcon, HomeIcon, WrenchIcon, UserGroupIcon, MenuIcon, XIcon, UploadIcon, SearchIcon, CloudIcon } from './Icons';
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

// --- HELPER PARA IMÁGENES ---
const getBase64ImageFromURL = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        // Usar fetch para evitar problemas de CORS con imágenes locales si Image() falla
        if (url.startsWith('/')) {
             fetch(url)
                .then(res => res.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                })
                .catch(reject);
             return;
        }

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }
            ctx.drawImage(img, 0, 0);
            try {
                const dataURL = canvas.toDataURL('image/png');
                resolve(dataURL);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = (error) => reject(error);
    });
};

// --- COMPONENTS INTERNOS DE NAVEGACIÓN ---

// Componente de Botón de Navegación con Estilo Moderno y Degradado de Fusión
const NavButton: React.FC<{ 
    icon: React.ReactNode; 
    label: string; 
    isActive: boolean; 
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`
                group relative w-full flex items-center gap-4 px-4 py-4 mb-3 rounded-2xl transition-all duration-300 ease-out
                overflow-hidden outline-none focus:ring-2 focus:ring-sena-green/50
                ${isActive 
                    ? 'bg-white dark:bg-gray-800 shadow-lg shadow-sena-green/10 translate-x-2' 
                    : 'hover:bg-white/50 dark:hover:bg-gray-800/50 hover:shadow-md hover:translate-x-1'
                }
            `}
        >
            {/* Fondo Degradado Sutil al Hover */}
            <div className={`absolute inset-0 bg-gradient-to-r from-sena-green/5 to-blue-400/5 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

            {/* Línea de Borde Activa (Fusión de Colores SENA - Verde a Azul) */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-r-full bg-gradient-to-b from-sena-green via-green-500 to-sena-blue-light transition-all duration-300 ${isActive ? 'opacity-100 h-full' : 'opacity-0 h-0 group-hover:h-1/2 group-hover:opacity-50 group-hover:top-1/4'}`} />

            {/* Contenedor del Icono con Efecto Glass */}
            <div className={`
                relative z-10 p-2.5 rounded-xl transition-all duration-300 flex-shrink-0
                ${isActive 
                    ? 'bg-gradient-to-br from-sena-green to-green-600 text-white shadow-md shadow-green-200/50 dark:shadow-none scale-110' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:text-sena-green group-hover:bg-green-50 dark:group-hover:bg-gray-600'
                }
            `}>
                {React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" })}
            </div>

            {/* Texto */}
            <div className="flex flex-col items-start relative z-10">
                <span className={`
                    text-sm font-bold tracking-wide transition-colors duration-300
                    ${isActive 
                        ? 'text-gray-800 dark:text-white' 
                        : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'
                    }
                `}>
                    {label}
                </span>
            </div>

            {/* Indicador de Punto Pulsante (Solo Activo) */}
            {isActive && (
                <div className="absolute right-4 w-2 h-2 rounded-full bg-sena-green animate-pulse shadow-[0_0_8px_rgba(57,169,0,0.6)]" />
            )}
        </button>
    );
};

// --- VISTAS DEL DASHBOARD ---

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-4 border-l-4 border-blue-500 transform hover:scale-105 transition-transform">
                    <div className="p-3 bg-blue-100 rounded-full text-blue-600"><CollectionIcon className="w-8 h-8" /></div>
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">Total Equipos</p><p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p></div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-4 border-l-4 border-yellow-500 transform hover:scale-105 transition-transform">
                    <div className="p-3 bg-yellow-100 rounded-full text-yellow-600"><ClipboardListIcon className="w-8 h-8" /></div>
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">En Préstamo</p><p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.onLoan}</p></div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center gap-4 border-l-4 border-green-500 transform hover:scale-105 transition-transform">
                    <div className="p-3 bg-green-100 rounded-full text-green-600"><SparklesIcon className="w-8 h-8" /></div>
                    <div><p className="text-sm text-gray-500 dark:text-gray-400">Disponibles</p><p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.available}</p></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><ChartBarIcon className="w-5 h-5 text-sena-green" /> Tendencia de Préstamos (7 días)</h3>
                    <div className="h-48 flex items-end justify-between gap-2">
                        {chartData.map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center w-full group">
                                <div className="relative w-full flex justify-center items-end h-40">
                                    <div className="w-full max-w-[30px] bg-gradient-to-t from-sena-green to-green-400 rounded-t-md transition-all duration-500 hover:opacity-80 relative" style={{ height: `${(item.count / maxCount) * 100}%` }}>
                                         <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">{item.count}</span>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-500 mt-2 uppercase font-semibold">{item.date}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-500" /> IA - Mantenimiento</h3>
                    {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : suggestions.length > 0 ? (
                        <div className="space-y-3 overflow-y-auto max-h-48 pr-2 custom-scrollbar">{suggestions.map((s, i) => (<div key={i} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800 hover:shadow-sm transition-shadow"><p className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">{s.equipmentName}</p><p className="text-xs text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">{s.suggestion}</p></div>))}</div>
                    ) : <p className="text-sm text-gray-500 italic text-center py-4">El sistema IA está analizando los patrones de uso...</p>}
                </div>
            </div>
        </div>
    );
};

const NewLoanView: React.FC<DashboardProps> = ({ users, equipment, onNewLoan, currentUser }) => {
  const [userSearch, setUserSearch] = useState('');
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [cart, setCart] = useState<Equipment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalLogo, setGlobalLogo] = useState<string | null>(null);

  useEffect(() => {
      const unsubscribe = subscribeToAppConfig((config) => {
          if (config && config.logoBase64) {
              setGlobalLogo(config.logoBase64);
          }
      });
      return () => unsubscribe();
  }, []);

  const availableEquipment = useMemo(() => equipment.filter(e => e.status === EquipmentStatus.AVAILABLE), [equipment]);
  const eligibleUsers = useMemo(() => users.filter(u => u.role === Role.USUARIO_MEDIALAB), [users]);

  const filteredUsers = useMemo(() => {
      if (!userSearch) return [];
      const terms = userSearch.toLowerCase().split(' ').filter(t => t.trim() !== '');
      return eligibleUsers.filter(u => {
          const name = u.name ? u.name.toLowerCase() : '';
          const id = u.id ? u.id.toLowerCase() : '';
          return terms.every(term => name.includes(term) || id.includes(term));
      }).slice(0, 5);
  }, [userSearch, eligibleUsers]);

  const filteredEquipment = useMemo(() => {
      if (!equipmentSearch) return [];
      const terms = equipmentSearch.toLowerCase().split(' ').filter(t => t.trim() !== '');
      
      return availableEquipment.filter(e => {
          const desc = e.description ? e.description.toLowerCase() : '';
          const id = e.id ? e.id.toLowerCase() : '';
          const type = e.type ? String(e.type).toLowerCase() : '';
          const currentDesc = e.currentDescription ? e.currentDescription.toLowerCase() : '';
          const model = e.model ? e.model.toLowerCase() : '';
          
          return terms.every(term => 
            desc.includes(term) || 
            id.includes(term) || 
            type.includes(term) ||
            currentDesc.includes(term) ||
            model.includes(term)
          );
      }).slice(0, 10);
  }, [equipmentSearch, availableEquipment]);

  const handleAddToList = (equipmentId: string) => {
      const item = equipment.find(e => e.id === equipmentId);
      if (!item) return;
      if (cart.some(e => e.id === equipmentId)) { alert("Este equipo ya está en la lista."); setEquipmentSearch(''); return; }
      setCart([...cart, item]);
      setEquipmentSearch('');
  };

  const handleRemoveFromList = (equipmentId: string) => {
      setCart(cart.filter(e => e.id !== equipmentId));
  };

  const generateConsolidatedPDF = async (loansData: {id: string, item: Equipment}[], borrower: User) => {
      const doc = new jsPDF();
      const margin = 20;
      let y = margin;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      let logoBase64: string | null = globalLogo;
      if (!logoBase64) {
          try {
              const response = await fetch('/logoSena.png');
              const blob = await response.blob();
              logoBase64 = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
              });
          } catch {
              // Fallback
          }
      }

      if (logoBase64) {
          const imgWidth = 25; const imgHeight = 25; const x = (pageWidth - imgWidth) / 2;
          try { doc.addImage(logoBase64, 'PNG', x, y, imgWidth, imgHeight); } catch(e) { console.error("Error adding logo to PDF", e); }
          y += 30; 
      } else {
           doc.setFontSize(18); doc.setTextColor(57, 169, 0); doc.text("SENA - MEDIALAB", pageWidth / 2, y + 10, { align: "center" }); y += 25;
      }

      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 0);
      doc.text("COMPROBANTE DE PRÉSTAMO (CONSOLIDADO)", pageWidth / 2, y, { align: "center" }); y += 7;
      doc.setFontSize(12); doc.setTextColor(50, 50, 50);
      doc.text("MEDIALAB - CIES", pageWidth / 2, y, { align: "center" }); y += 15;

      doc.setFontSize(10); doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal");
      doc.text(`Fecha: ${new Date().toLocaleString()}`, margin, y); y += 10;

      doc.setFillColor(240, 240, 240); doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(57, 169, 0);
      doc.text("DATOS DEL SOLICITANTE", margin + 2, y + 6); y += 12;
      doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(`Nombre: ${borrower.name}`, margin, y);
      doc.text(`Identificación: ${borrower.id}`, margin, y + 5);
      doc.text(`Rol: ${borrower.role} ${borrower.category ? `(${borrower.category})` : ''}`, margin, y + 10);
      y += 20;

      doc.setFillColor(240, 240, 240); doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(57, 169, 0);
      doc.text(`EQUIPOS EN PRÉSTAMO (${loansData.length})`, margin + 2, y + 6); y += 12;
      doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      loansData.forEach((entry, index) => {
          if (y > pageHeight - 40) { doc.addPage(); y = 20; }
          doc.setFont("helvetica", "bold");
          doc.text(`${index + 1}. ${entry.item.description}`, margin, y);
          doc.setFont("helvetica", "normal");
          const modelInfo = entry.item.model ? ` - Modelo: ${entry.item.model}` : '';
          doc.text(`   Placa: ${entry.item.id} - Tipo: ${entry.item.type}${modelInfo}`, margin, y + 5);
          
          if (entry.item.currentDescription) {
              doc.setFontSize(9);
              doc.setTextColor(80, 80, 80);
              const descLines = doc.splitTextToSize(`Detalle: ${entry.item.currentDescription}`, pageWidth - (margin * 2) - 20);
              doc.text(descLines, margin + 5, y + 10);
              y += (descLines.length * 4) + 2;
              doc.setFontSize(10);
              doc.setTextColor(0, 0, 0);
          } else {
              y += 5;
          }
          
          doc.text(`   ID Préstamo: ${entry.id}`, pageWidth - margin, y - 5, { align: "right" });
          y += 7;
      });
      y += 5;

      doc.setFillColor(240, 240, 240); doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(57, 169, 0);
      doc.text("RESPONSABILIDAD", margin + 2, y + 6); y += 12;
      doc.setTextColor(0, 0, 0); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(`Autoriza Instructor: ${currentUser.name}`, margin, y); y += 20;

      doc.setFontSize(9); doc.setTextColor(80, 80, 80); doc.setFont("helvetica", "italic");
      const disclaimer = "Al generarse este documento digital, el solicitante se hace responsable del cuidado y buen uso de los equipos descritos, comprometiéndose a devolverlos en las mismas o mejores condiciones en que fueron recibidos.";
      const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - (margin * 2));
      doc.text(splitDisclaimer, margin, y);

      const footerY = pageHeight - 15; doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(100, 100, 100);
      doc.text("Centro de la Industria, la Empresa y los Servicios", pageWidth / 2, footerY, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text("Regional Huila - SENA, Neiva", pageWidth / 2, footerY + 5, { align: "center" });

      doc.save(`Prestamo_MediaLab_Instructor_${Date.now()}.pdf`);
  };

  const handleFinalizeLoan = async () => {
    if (!selectedUserId || cart.length === 0) return;
    setIsSubmitting(true);
    const borrower = users.find(u => u.id === selectedUserId);
    if (!borrower) { alert("Usuario no válido"); setIsSubmitting(false); return; }
    const loansGenerated: {id: string, item: Equipment}[] = [];
    for (const item of cart) {
        const loanId = `L${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const newLoan = createNewLoan({
            id: loanId, equipmentId: item.id, borrowerId: selectedUserId, instructorId: currentUser.id,
            conditionAnalysis: "Préstamo Manual Instructor (Múltiple)", photos: [item.imageUrl], placa: item.id
        });
        onNewLoan(newLoan);
        loansGenerated.push({ id: loanId, item: item });
        await new Promise(r => setTimeout(r, 50));
    }
    await generateConsolidatedPDF(loansGenerated, borrower);
    setIsSubmitting(false); setCart([]); setSelectedUserId(''); setUserSearch(''); alert("Préstamo múltiple registrado exitosamente.");
  };

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md animate-fade-in">
      <h2 className="text-2xl font-bold text-sena-dark dark:text-white mb-2">Registrar Préstamo (Lista Múltiple)</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-6">Selecciona un usuario, crea una lista de equipos y genera un solo comprobante.</p>
      <div className="space-y-6">
        <div className="relative">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">1. Buscar Aprendiz / Usuario</label>
          <div className="flex gap-2">
              <input type="text" value={selectedUserId ? `${users.find(u=>u.id===selectedUserId)?.name} (${selectedUserId})` : userSearch} onChange={(e) => { if (cart.length > 0 && selectedUserId) { if(!confirm("Si cambias de usuario, se vaciará la lista actual. ¿Continuar?")) return; setCart([]); } setUserSearch(e.target.value); if(selectedUserId) setSelectedUserId(''); }} placeholder="Escribe nombre, apellido o ID..." className={`flex-grow p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-sena-blue-light ${selectedUserId ? 'bg-green-50 dark:bg-green-900/30 border-green-500 font-bold' : ''}`} />
              {selectedUserId && (<button onClick={() => { if (cart.length > 0 && !confirm("Se vaciará la lista. ¿Seguro?")) return; setCart([]); setSelectedUserId(''); setUserSearch(''); }} className="px-4 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">✕</button>)}
          </div>
          {!selectedUserId && userSearch && filteredUsers.length > 0 && (<ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-b-lg shadow-lg max-h-60 overflow-y-auto">{filteredUsers.map(u => (<li key={u.id} onClick={() => { setSelectedUserId(u.id); setUserSearch(''); }} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b last:border-0 dark:border-gray-600"><p className="font-bold text-sm text-gray-800 dark:text-white">{u.name}</p><p className="text-xs text-gray-500 dark:text-gray-300">{u.category} - ID: {u.id}</p></li>))}</ul>)}
        </div>
        <div className={`relative transition-opacity ${!selectedUserId ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">2. Agregar Equipos a la Lista</label>
          <input type="text" value={equipmentSearch} onChange={(e) => setEquipmentSearch(e.target.value)} placeholder="Descripción, Placa, Modelo..." className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-sena-blue-light" />
          {equipmentSearch && filteredEquipment.length > 0 && (<ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-b-lg shadow-lg max-h-60 overflow-y-auto">{filteredEquipment.map(e => (<li key={e.id} onClick={() => handleAddToList(e.id)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b last:border-0 dark:border-gray-600 flex items-center gap-3 group"><img src={e.imageUrl} className="w-10 h-10 rounded object-cover" alt="" /><div className="flex-grow"><p className="font-bold text-sm text-gray-800 dark:text-white group-hover:text-sena-green">{e.description}</p>{e.currentDescription && <p className="text-xs text-gray-400 italic">{e.currentDescription}</p>}<p className="text-xs text-gray-500 dark:text-gray-300">{e.type} - Placa: {e.id}</p></div><PlusCircleIcon className="w-6 h-6 text-gray-400 group-hover:text-sena-green" /></li>))}</ul>)}
        </div>
        {selectedUserId && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-bold text-gray-700 dark:text-white mb-3 flex items-center gap-2"><ClipboardListIcon className="w-5 h-5" /> Lista de Préstamo ({cart.length})</h3>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 min-h-[100px]">
                    {cart.length === 0 ? (<p className="text-center text-gray-400 text-sm italic py-4">Busca y agrega equipos para armar el paquete de préstamo.</p>) : (
                        <ul className="space-y-2">{cart.map((item, idx) => (<li key={item.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 shadow-sm"><div className="flex items-center gap-3"><span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold px-2 py-1 rounded-full">{idx + 1}</span><img src={item.imageUrl} className="w-8 h-8 rounded object-cover" alt=""/><div><p className="font-bold text-sm text-gray-800 dark:text-white">{item.description}</p><p className="text-xs text-gray-500 dark:text-gray-400">Placa: {item.id}</p></div></div><button onClick={() => handleRemoveFromList(item.id)} className="text-red-500 hover:text-red-700 font-bold text-xs px-2 py-1 hover:bg-red-50 rounded">Quitar</button></li>))}</ul>
                    )}
                </div>
            </div>
        )}
        <button type="button" onClick={handleFinalizeLoan} disabled={!selectedUserId || cart.length === 0 || isSubmitting} className="w-full bg-sena-green text-white font-bold py-4 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex justify-center items-center gap-2">
          {isSubmitting ? <><Spinner size="5" color="white"/> Registrando...</> : <><DocumentReportIcon className="w-5 h-5"/> Registrar Préstamos y Generar PDF</>}
        </button>
      </div>
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

  const openReturnModal = (loan: LoanRecord) => { setSelectedLoan(loan); setReturnConcept(''); setReturnStatus('Bueno'); setReturnPhotos([]); setAiAnalysis(''); setIsCameraOpen(false); };
  const handleCaptureReturnPhoto = async (photo: string) => { setReturnPhotos([photo]); setIsCameraOpen(false); setIsAnalyzing(true); const analysis = await analyzeEquipmentCondition(photo, "Analiza brevemente el estado físico del equipo en esta foto. ¿Se ve en buen estado o hay daños visibles?"); setAiAnalysis(analysis); setIsAnalyzing(false); };
  const submitReturn = () => { if (selectedLoan) { onReturn(selectedLoan.id, returnConcept, returnStatus, returnPhotos, aiAnalysis); setSelectedLoan(null); } };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-sena-dark dark:text-white">Préstamos Activos</h2>
      <Modal isOpen={!!selectedLoan} onClose={() => setSelectedLoan(null)} title="Registrar Devolución">
          <div className="space-y-4">
             {selectedLoan && (<div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-sm"><p><span className="font-bold">Equipo:</span> {equipment.find(e => e.id === selectedLoan.equipmentId)?.description}</p><p><span className="font-bold">Usuario:</span> {users.find(u => u.id === selectedLoan.borrowerId)?.name}</p></div>)}
             <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estado Actual (Devolución)</label><div className="grid grid-cols-3 gap-2">{['Excelente', 'Bueno', 'Aceptable', 'Regular', 'Malo'].map(status => (<button key={status} onClick={() => setReturnStatus(status)} className={`py-2 px-1 text-sm rounded border ${returnStatus === status ? 'bg-sena-green text-white border-sena-green' : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500'}`}>{status}</button>))}</div></div>
             <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Verificación Visual (Opcional)</label>{returnPhotos.length > 0 ? (<div className="relative"><img src={returnPhotos[0]} alt="Evidencia" className="w-full h-48 object-cover rounded-lg" /><button onClick={() => setReturnPhotos([])} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 text-xs">✕</button>{isAnalyzing && <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white"><Spinner color="white" /> Analizando...</div>}</div>) : (!isCameraOpen ? <button onClick={() => setIsCameraOpen(true)} className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center gap-2 text-gray-500 hover:border-sena-green hover:text-sena-green transition-colors"><CameraIcon className="w-5 h-5" /> Agregar Foto Evidencia (Opcional)</button> : <CameraCapture onCapture={handleCaptureReturnPhoto} maxCaptures={1} captures={[]} />)}</div>
             <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones / Concepto Final</label><textarea value={returnConcept} onChange={e => setReturnConcept(e.target.value)} className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-sena-blue-light" rows={3} placeholder="Observaciones adicionales sobre la devolución..." /></div>
             <button onClick={submitReturn} className="w-full bg-sena-green text-white font-bold py-3 rounded-lg hover:bg-opacity-90 transition-colors">Confirmar Devolución</button>
          </div>
      </Modal>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700"><thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Equipo</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Usuario</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Fecha</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acción</th></tr></thead><tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">{activeLoans.length === 0 ? <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No hay préstamos activos.</td></tr> : activeLoans.map((loan) => { const eq = equipment.find(e => e.id === loan.equipmentId); const usr = users.find(u => u.id === loan.borrowerId); return (<tr key={loan.id}><td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white flex items-center gap-3">{eq ? <><img src={eq.imageUrl} className="w-8 h-8 rounded object-cover" /><div><div className="font-bold">{eq.description}</div><div className="text-xs text-gray-500">{eq.id}</div></div></> : 'Desconocido'}</td><td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{usr ? usr.name : loan.borrowerId}</td><td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{loan.loanDate.toLocaleDateString()}</td><td className="px-6 py-4 text-sm font-medium"><button onClick={() => openReturnModal(loan)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 font-bold">Registrar Devolución</button></td></tr>);})}</tbody></table></div>
    </div>
  );
};

const ManageUsersView: React.FC<DashboardProps> = ({ users, onAddNewUser, onUpdateUser, isOnline }) => {
    const [newUserId, setNewUserId] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState(''); 
    const [selectedProfileType, setSelectedProfileType] = useState<'APRENDIZ' | 'ADMINISTRATIVO' | 'INSTRUCTOR_SENA' | 'ADMIN_MEDIALAB'>('APRENDIZ');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPhoto, setEditPhoto] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        const terms = searchTerm.toLowerCase().split(' ').filter(t => t);
        return users.filter(u => {
            const searchString = `${u.name} ${u.id} ${u.role} ${u.category || ''}`.toLowerCase();
            return terms.every(term => searchString.includes(term));
        });
    }, [users, searchTerm]);

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        let role: Role; let category: UserCategory | undefined;
        switch (selectedProfileType) {
            case 'APRENDIZ': role = Role.USUARIO_MEDIALAB; category = UserCategory.APRENDIZ; break;
            case 'ADMINISTRATIVO': role = Role.USUARIO_MEDIALAB; category = UserCategory.ADMINISTRATIVO; break;
            case 'INSTRUCTOR_SENA': role = Role.USUARIO_MEDIALAB; category = UserCategory.INSTRUCTOR_SENA; break;
            case 'ADMIN_MEDIALAB': role = Role.INSTRUCTOR_MEDIALAB; category = undefined; break;
            default: role = Role.USUARIO_MEDIALAB; category = UserCategory.APRENDIZ;
        }
        const newUser: User = { id: newUserId, name: newUserName.toUpperCase(), role: role, category: category, email: role === Role.INSTRUCTOR_MEDIALAB ? newUserEmail : undefined };
        const result = onAddNewUser(newUser);
        if (result.success) { setNewUserId(''); setNewUserName(''); setNewUserEmail(''); setSelectedProfileType('APRENDIZ'); } else { alert(result.message); }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; const reader = new FileReader(); reader.onloadend = () => { if (typeof reader.result === 'string') { setEditPhoto(reader.result); } }; reader.readAsDataURL(file); } };
    const usersCount = users.length;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800"><div><h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2"><UserGroupIcon className="w-5 h-5"/> Gestión de Usuarios</h3><p className="text-sm text-blue-600 dark:text-blue-400">Base de datos de aprendices e instructores.</p></div><div className="flex items-center gap-4 text-right"><div className={`px-3 py-1 rounded-full text-xs font-bold ${isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>{isOnline ? '● ONLINE' : '○ LOCAL'}</div><div><p className="text-2xl font-bold text-gray-800 dark:text-white">{usersCount}</p><p className="text-xs uppercase text-gray-500">Registrados</p></div></div></div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md"><h3 className="text-lg font-bold text-sena-dark dark:text-white mb-4 flex items-center gap-2"><UserPlusIcon className="w-5 h-5"/> Agregar Nuevo Usuario</h3><form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4"><input type="text" value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="ID (Cédula/TI)" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-sena-blue-light" required /><input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Nombre Completo" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-sena-blue-light" required /><div className="md:col-span-2"><label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Tipo de Perfil</label><div className="grid grid-cols-2 md:grid-cols-4 gap-2"><button type="button" onClick={() => setSelectedProfileType('APRENDIZ')} className={`p-2 text-sm rounded border ${selectedProfileType === 'APRENDIZ' ? 'bg-sena-green text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>Usuario / Aprendiz</button><button type="button" onClick={() => setSelectedProfileType('ADMINISTRATIVO')} className={`p-2 text-sm rounded border ${selectedProfileType === 'ADMINISTRATIVO' ? 'bg-sena-green text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>Usuario / Administrativo</button><button type="button" onClick={() => setSelectedProfileType('INSTRUCTOR_SENA')} className={`p-2 text-sm rounded border ${selectedProfileType === 'INSTRUCTOR_SENA' ? 'bg-sena-green text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>Usuario / Instructor SENA</button><button type="button" onClick={() => setSelectedProfileType('ADMIN_MEDIALAB')} className={`p-2 text-sm rounded border ${selectedProfileType === 'ADMIN_MEDIALAB' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>INSTRUCTOR-MEDIALAB (Admin)</button></div></div>{selectedProfileType === 'ADMIN_MEDIALAB' && (<input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="Correo Institucional" className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 md:col-span-2 dark:text-sena-blue-light" />)}<button type="submit" className="bg-sena-green text-white font-bold py-2 px-4 rounded hover:bg-opacity-90 md:col-span-2">Registrar Usuario</button></form></div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-gray-700 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                        Directorio de Usuarios ({filteredUsers.length})
                    </h3>
                    <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-sena-green focus:border-transparent sm:text-sm dark:text-white transition duration-150 ease-in-out"
                            placeholder="Buscar por nombre o ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Foto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Nombre</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Rol</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-800">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {u.photoURL ? (
                                                <img src={u.photoURL} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-300 font-bold text-xs">
                                                    {u.name.substring(0, 2)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-mono">{u.id}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 font-medium">{u.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.role === Role.INSTRUCTOR_MEDIALAB ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
                                                {u.role === Role.INSTRUCTOR_MEDIALAB ? 'ADMIN' : u.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium">
                                            <button 
                                                onClick={() => { setEditingUser(u); setEditName(u.name); setEditEmail(u.email || ''); setEditPhoto(u.photoURL || ''); }} 
                                                className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1 rounded hover:bg-blue-100 transition-colors dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        No se encontraron usuarios que coincidan con "{searchTerm}".
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

             <Modal isOpen={!!editingUser} onClose={() => setEditingUser(null)} title="Editar Perfil de Usuario"><div className="space-y-4"><div className="flex flex-col items-center justify-center gap-4 mb-6"><div className="relative w-24 h-24">{editPhoto ? (<img src={editPhoto} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-gray-100 dark:border-gray-700 shadow-sm" />) : (<div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-2xl text-gray-400 font-bold">{editName ? editName.substring(0,2) : 'User'}</div>)}<label htmlFor="photo-upload" className="absolute bottom-0 right-0 bg-sena-green text-white p-2 rounded-full cursor-pointer hover:bg-green-700 shadow-md transition-colors"><CameraIcon className="w-4 h-4" /><input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload}/></label></div><p className="text-xs text-gray-500">Click en la cámara para cambiar foto</p></div><div><label className="block text-sm font-bold mb-1 dark:text-gray-300">Nombre Completo</label><input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light dark:border-gray-600" /></div>{editingUser?.role === Role.INSTRUCTOR_MEDIALAB && (<div><label className="block text-sm font-bold mb-1 dark:text-gray-300">Correo Institucional</label><input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light dark:border-gray-600" /></div>)}<div className="pt-4 flex gap-2"><button onClick={() => setEditingUser(null)} className="w-1/2 bg-gray-300 text-gray-800 py-2 rounded font-bold hover:bg-gray-400 transition-colors">Cancelar</button><button onClick={() => { if(editingUser && onUpdateUser) { onUpdateUser({ ...editingUser, name: editName.toUpperCase(), email: editEmail, photoURL: editPhoto }); setEditingUser(null); } }} className="w-1/2 bg-sena-green text-white py-2 rounded font-bold hover:bg-opacity-90 transition-colors">Guardar Cambios</button></div></div></Modal>
        </div>
    );
};

const InventoryView: React.FC<DashboardProps> = ({ equipment, onAddNewEquipment, onEditEquipment, onDeleteEquipment, isOnline }) => {
    const [newItemId, setNewItemId] = useState('');
    const [newItemDescription, setNewItemDescription] = useState('');
    const [newItemType, setNewItemType] = useState('Computer');
    const [newItemImage, setNewItemImage] = useState('');
    
    // Extended fields state for adding new item
    const [newItemRegional, setNewItemRegional] = useState('');
    const [newItemCostCenter, setNewItemCostCenter] = useState('');
    const [newItemSerial, setNewItemSerial] = useState('');
    const [newItemValue, setNewItemValue] = useState('');

    const [editItem, setEditItem] = useState<Equipment | null>(null);
    
    // Import JSON State
    const [showImportModal, setShowImportModal] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [importing, setImporting] = useState(false);
    const [importStatus, setImportStatus] = useState('');

    // View Details State
    const [viewItem, setViewItem] = useState<Equipment | null>(null);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        onAddNewEquipment({ 
            id: newItemId, 
            description: newItemDescription.toUpperCase(),
            type: newItemType, 
            status: EquipmentStatus.AVAILABLE, 
            imageUrl: newItemImage || 'https://via.placeholder.com/150',
            regional: newItemRegional,
            costCenter: newItemCostCenter,
            serial: newItemSerial,
            value: newItemValue
        });
        setNewItemId(''); setNewItemDescription(''); setNewItemImage('');
        setNewItemRegional(''); setNewItemCostCenter(''); setNewItemSerial(''); setNewItemValue('');
    };

    const handleSaveEdit = () => { if (editItem) { onEditEquipment(editItem); setEditItem(null); } };
    const handleDelete = (id: string) => { if (confirm("¿Estás seguro de eliminar este equipo?")) onDeleteEquipment(id); };

    const handleProcessJson = async () => {
        if (!jsonInput) return;
        setImporting(true);
        setImportStatus("Procesando JSON...");

        try {
            const rawData = JSON.parse(jsonInput);
            if (!Array.isArray(rawData)) throw new Error("El JSON debe ser una lista (array) de objetos.");

            const parsedEquipment: Equipment[] = rawData.map((row: any) => ({
                id: row["Placa"] ? String(row["Placa"]) : (row["id"] || `TEMP_${Math.random()}`),
                // La "Descripción Original" es ahora el campo description principal
                description: (row["Descripción"] || row["name"] || "Sin Descripción").toUpperCase(),
                // La "Descripción Actual" es información complementaria
                currentDescription: row["Descripción Actual"] || "",
                type: String(row["Tipo"] || row["type"] || "General"), 
                status: EquipmentStatus.AVAILABLE, 
                imageUrl: row["imageUrl"] || 'https://via.placeholder.com/150',
                regional: row["Regional"] || "",
                costCenter: row["Centro de Costo"] ? String(row["Centro de Costo"]) : "",
                module: row["Modulo"] || "",
                model: row["Modelo"] || "",
                consecutive: row["Consecutivo"] ? String(row["Consecutivo"]) : "",
                serial: row["Serial"] || "",
                acquisitionDate: row["Fecha Adquisición"] || "",
                value: row["Valor Ingreso"] ? String(row["Valor Ingreso"]) : ""
            })).filter(e => e.id);

            setImportStatus(`Subiendo ${parsedEquipment.length} registros...`);
            
            const result = await batchUploadEquipment(parsedEquipment, (count, total) => {
                setImportStatus(`Progreso: ${count} / ${total}`);
            });

            if (result.success) {
                setImportStatus("¡Importación exitosa!");
                setTimeout(() => {
                    setShowImportModal(false);
                    setJsonInput('');
                    setImportStatus('');
                    setImporting(false);
                }, 1500);
            } else {
                setImportStatus("Error: " + result.message);
                setImporting(false);
            }

        } catch (e: any) {
            setImportStatus("Error de formato JSON: " + e.message);
            setImporting(false);
        }
    };

    const handleSyncLogo = async () => {
        try {
            // Usamos fetch en lugar de Image/Canvas para evitar problemas de CORS locales
            const response = await fetch('/logoSena.png');
            if (!response.ok) {
                throw new Error(`No se pudo cargar la imagen. Status: ${response.status}`);
            }
            const blob = await response.blob();
            
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                if (base64data) {
                    await uploadLogoToCloud(base64data);
                    alert("Logo sincronizado exitosamente a la nube.");
                }
            };
        } catch (e: any) {
            console.error("Error sync logo:", e);
            alert(`Error al sincronizar logo: ${e.message}. Asegúrate de que 'logoSena.png' esté en la carpeta public.`);
        }
    };

    const totalEquipment = equipment.length;
    
    return (
        <div className="space-y-6 animate-fade-in">
             <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-purple-500 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div><h3 className="font-bold text-lg text-sena-dark dark:text-white flex items-center gap-2"><WrenchIcon className="w-5 h-5"/> Monitor de Inventario</h3><div className="flex items-center gap-2 text-sm mt-1"><span className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span><span className="text-gray-600 dark:text-gray-300">{isOnline ? 'Conectado a Nube (Sincronizado)' : 'Modo Offline (Local)'}</span></div></div>
                <div className="flex items-center gap-4">
                    <button onClick={handleSyncLogo} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600" title="Sincronizar Logo Corporativo"><CloudIcon className="w-4 h-4" /> Sincronizar Logo</button>
                    <button onClick={() => setShowImportModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2"><UploadIcon className="w-4 h-4" /> Importar JSON</button>
                    <div className="text-center border-l pl-4 border-gray-300"><span className="block text-2xl font-bold text-purple-600">{totalEquipment}</span><span className="text-xs uppercase text-gray-500">Items Totales</span></div>
                </div>
            </div>
            
            {/* Add Item Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold text-sena-dark dark:text-white mb-4 flex items-center gap-2"><PlusCircleIcon className="w-5 h-5"/> Agregar Item Manualmente</h3>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input value={newItemId} onChange={e => setNewItemId(e.target.value)} placeholder="Código / Placa *" className="p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light" required />
                    <input value={newItemDescription} onChange={e => setNewItemDescription(e.target.value)} placeholder="Descripción Original *" className="p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light" required />
                    <select value={newItemType} onChange={e => setNewItemType(e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light"><option value="Computer">Computador</option><option value="Laptop">Portátil</option><option value="Camera">Cámara</option><option value="Accessory">Accesorio</option><option value="Furniture">Mobiliario</option><option value="Appliance">Electrodoméstico</option></select>
                    <input value={newItemSerial} onChange={e => setNewItemSerial(e.target.value)} placeholder="Serial" className="p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light" />
                    <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 md:col-span-4 lg:col-span-1">Agregar</button>
                </form>
            </div>

            {/* Inventory Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Placa</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{equipment.map(e => (<tr key={e.id}><td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-mono">{e.id}</td><td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{e.description}</td><td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">{e.type}</td><td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded text-xs ${e.status === EquipmentStatus.AVAILABLE ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{e.status}</span></td><td className="px-6 py-4 text-sm font-medium flex gap-2"><button onClick={() => setViewItem(e)} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white" title="Ver Detalles">👁️</button><button onClick={() => setEditItem(e)} className="text-blue-600 hover:text-blue-900">Editar</button><button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-900">Eliminar</button></td></tr>))}</tbody>
                </table>
            </div>

            {/* Edit Modal */}
            <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Editar Equipo">
                 {editItem && (<div className="space-y-4 max-h-[70vh] overflow-y-auto">
                    <div><label className="block text-sm font-bold mb-1">Descripción Original</label><input value={editItem.description} onChange={e => setEditItem({...editItem, description: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light" /></div>
                    <div><label className="block text-sm font-bold mb-1">Descripción Actual</label><input value={editItem.currentDescription || ''} onChange={e => setEditItem({...editItem, currentDescription: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light" /></div>
                    <div><label className="block text-sm font-bold mb-1">Tipo</label><select value={editItem.type} onChange={e => setEditItem({...editItem, type: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light"><option value="Computer">Computador</option><option value="Laptop">Portátil</option><option value="Camera">Cámara</option><option value="Accessory">Accesorio</option></select></div>
                    <div><label className="block text-sm font-bold mb-1">Serial</label><input value={editItem.serial || ''} onChange={e => setEditItem({...editItem, serial: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light" /></div>
                    <div><label className="block text-sm font-bold mb-1">Centro Costo</label><input value={editItem.costCenter || ''} onChange={e => setEditItem({...editItem, costCenter: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light" /></div>
                    <div><label className="block text-sm font-bold mb-1">Estado Manual</label><select value={editItem.status} onChange={e => setEditItem({...editItem, status: e.target.value as EquipmentStatus})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-sena-blue-light"><option value={EquipmentStatus.AVAILABLE}>Disponible</option><option value={EquipmentStatus.ON_LOAN}>En Préstamo</option></select></div>
                    <button onClick={handleSaveEdit} className="w-full bg-blue-600 text-white py-2 rounded font-bold">Guardar Cambios</button>
                 </div>)}
            </Modal>

            {/* Details Modal */}
            <Modal isOpen={!!viewItem} onClose={() => setViewItem(null)} title="Ficha Técnica del Activo">
                {viewItem && (
                    <div className="space-y-4 text-sm dark:text-gray-200">
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700 p-4 rounded">
                            <div><span className="font-bold block text-gray-500 dark:text-gray-400">Placa (ID)</span>{viewItem.id}</div>
                            <div><span className="font-bold block text-gray-500 dark:text-gray-400">Serial</span>{viewItem.serial || 'N/A'}</div>
                            <div><span className="font-bold block text-gray-500 dark:text-gray-400">Tipo</span>{viewItem.type}</div>
                            <div><span className="font-bold block text-gray-500 dark:text-gray-400">Estado</span>{viewItem.status}</div>
                        </div>
                        <div><span className="font-bold block text-gray-500 dark:text-gray-400">Descripción Original</span><p className="border p-2 rounded bg-white dark:bg-gray-800">{viewItem.description}</p></div>
                        <div><span className="font-bold block text-gray-500 dark:text-gray-400">Descripción Actual</span><p className="border p-2 rounded bg-white dark:bg-gray-800">{viewItem.currentDescription || 'N/A'}</p></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><span className="font-bold">Regional:</span> {viewItem.regional || 'N/A'}</div>
                            <div><span className="font-bold">C. Costo:</span> {viewItem.costCenter || 'N/A'}</div>
                            <div><span className="font-bold">Modelo:</span> {viewItem.model || 'N/A'}</div>
                        </div>
                    </div>
                )}
            </Modal>
            
            {/* Import JSON Modal */}
            {showImportModal && (
                 <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Importar JSON">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">Pega aquí tu array JSON de equipos. Asegúrate de que las llaves coincidan (Placa, Descripción, Tipo, etc).</p>
                        <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} rows={10} className="w-full p-2 border rounded font-mono text-xs dark:bg-gray-700 dark:text-white dark:border-gray-600"></textarea>
                        {importStatus && <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{importStatus}</p>}
                        <button onClick={handleProcessJson} disabled={importing} className="w-full bg-blue-600 text-white py-2 rounded font-bold disabled:opacity-50 hover:bg-blue-700">{importing ? <><Spinner size="4" color="white"/> Procesando...</> : "Importar Datos"}</button>
                    </div>
                 </Modal>
            )}
        </div>
    );
};

const InstructorDashboard: React.FC<DashboardProps> = (props) => {
    const [activeTab, setActiveTab] = useState<Tab>('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const renderContent = () => {
        switch(activeTab) {
            case 'home': return <HomeView {...props} />;
            case 'newLoan': return <NewLoanView {...props} />;
            case 'activeLoans': return <ActiveLoansView {...props} />;
            case 'manageUsers': return <ManageUsersView {...props} />;
            case 'inventory': return <InventoryView {...props} />;
            case 'reports': return <HomeView {...props} />; 
            default: return <HomeView {...props} />;
        }
    };
    
    const menuItems = [
        { id: 'home', label: 'Inicio / Reportes', icon: <HomeIcon /> },
        { id: 'newLoan', label: 'Nuevo Préstamo', icon: <PlusCircleIcon /> },
        { id: 'activeLoans', label: 'Préstamos Activos', icon: <ClipboardListIcon /> },
        { id: 'inventory', label: 'Inventario', icon: <CollectionIcon /> },
        { id: 'manageUsers', label: 'Usuarios', icon: <UserGroupIcon /> },
    ];

    return (
        <div className="flex min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
             {/* Mobile Menu Button */}
             <button className="md:hidden fixed bottom-6 right-6 bg-sena-green text-white p-4 rounded-full shadow-2xl z-50 hover:scale-110 transition-transform" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                {isSidebarOpen ? <XIcon className="w-6 h-6" /> : <MenuIcon className="w-6 h-6" />}
             </button>

             {/* Sidebar (Desktop: Sticky / Mobile: Drawer) */}
             <aside 
                className={`
                    fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 
                    transform transition-transform duration-300 ease-in-out
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
                    md:translate-x-0 md:sticky md:top-16
                    overflow-y-auto
                `}
             >
                <div className="p-6">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 px-2">Menú Principal</h2>
                    <nav className="space-y-1">
                        {menuItems.map(item => (
                            <NavButton
                                key={item.id}
                                icon={item.icon}
                                label={item.label}
                                isActive={activeTab === item.id}
                                onClick={() => { setActiveTab(item.id as Tab); setIsSidebarOpen(false); }}
                            />
                        ))}
                    </nav>
                </div>
                
                <div className="absolute bottom-0 w-full p-6 bg-gradient-to-t from-white via-white to-transparent dark:from-gray-900 dark:via-gray-900">
                    <div className="bg-blue-50 dark:bg-gray-800 rounded-xl p-4 border border-blue-100 dark:border-gray-700 shadow-sm">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">Estado del Sistema</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Versión 3.0.0 (Ultra Modern)</p>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 dark:bg-gray-700 overflow-hidden">
                            <div className="bg-gradient-to-r from-sena-green to-blue-400 h-1.5 rounded-full w-full animate-pulse"></div>
                        </div>
                    </div>
                </div>
             </aside>

             {/* Main Content Area */}
             <div className="flex-1 p-4 md:p-8 overflow-x-hidden">
                <div className="max-w-7xl mx-auto">
                    {renderContent()}
                </div>
             </div>

             {/* Overlay for Mobile Drawer */}
             {isSidebarOpen && (
                 <div 
                    className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                 />
             )}
        </div>
    );
};

export default InstructorDashboard;
