
import React, { useState, useMemo, useEffect } from 'react';
import { User, LoanRecord, Equipment, Role, EquipmentStatus, createNewLoan } from '../types';
import { CameraCapture } from './CameraCapture';
import { readInventoryLabel } from '../services/geminiService';
import Spinner from './Spinner';
import { CameraIcon, DownloadIcon, HistoryIcon } from './Icons';
import jsPDF from 'jspdf';

type Tab = 'myLoans' | 'newLoan';

interface UserDashboardProps {
  currentUser: User;
  loans: LoanRecord[];
  equipment: Equipment[];
  users: User[];
  onNewLoan: (loan: LoanRecord) => void;
}

const TabButton: React.FC<{ icon: React.ReactNode, text: string, isActive: boolean, onClick: () => void }> = ({ icon, text, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 py-4 px-3 border-b-2 font-medium text-sm transition-colors ${
        isActive
          ? 'border-sena-green text-sena-green'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
      }`}
    >
      {icon} {text}
    </button>
);

const MyLoansView: React.FC<Pick<UserDashboardProps, 'currentUser' | 'loans' | 'equipment' | 'users'>> = ({ currentUser, loans, equipment, users }) => {
    const myLoans = (loans || []).filter(loan => loan.borrowerId === currentUser.id).sort((a,b) => b.loanDate.getTime() - a.loanDate.getTime());
  
    return (
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold text-sena-dark dark:text-white mb-4">Mis Préstamos de Equipo</h2>
        {myLoans.length === 0 ? (
          <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
            <p className="text-gray-500 dark:text-gray-400">No tienes préstamos actuales o pasados.</p>
            <p className="mt-2 text-sm text-gray-400">Puedes solicitar un equipo en la pestaña "Solicitar Préstamo".</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myLoans.map(loan => {
              const equipmentItem = (equipment || []).find(e => e.id === loan.equipmentId);
              const instructor = users.find(i => i.id === loan.instructorId && i.role === Role.INSTRUCTOR_MEDIALAB);
  
              return (
                <div key={loan.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <img src={equipmentItem?.imageUrl || 'https://via.placeholder.com/150'} alt={equipmentItem?.name} className="w-32 h-32 object-cover rounded-md flex-shrink-0"/>
                  <div className="flex-grow">
                    <h2 className="text-xl font-bold">{equipmentItem?.name}</h2>
                    <p className="text-sm font-mono text-gray-500 dark:text-gray-400">Código: {equipmentItem?.id}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Prestado el: {loan.loanDate.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Instructor a cargo: {instructor?.name || 'No Aplica'}</p>
                    {loan.returnDate && loan.returnConcept && (
                        <p className="text-xs mt-2 italic text-blue-600 dark:text-blue-300">
                            <span className="font-semibold">Concepto del Instructor:</span> "{loan.returnConcept}"
                        </p>
                    )}
                     {loan.returnStatus && (
                         <p className="text-xs mt-1">
                            <span className="font-semibold">Estado Devolución:</span> <span className={`px-2 py-0.5 rounded ${loan.returnStatus === 'Excelente' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{loan.returnStatus}</span>
                         </p>
                     )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {loan.returnDate ? (
                       <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Devuelto
                       </span>
                    ) : (
                      <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          En Préstamo
                      </span>
                    )}
                     {loan.returnDate && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Devuelto: {loan.returnDate.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
};

const NewLoanRequestForm: React.FC<Pick<UserDashboardProps, 'currentUser' | 'equipment' | 'users' | 'onNewLoan'> & { setActiveTab: (tab: Tab) => void }> = ({ currentUser, equipment, users, onNewLoan, setActiveTab }) => {
    const [selectedInstructor, setSelectedInstructor] = useState('');
    const [inventoryCode, setInventoryCode] = useState('');
    const [foundEquipment, setFoundEquipment] = useState<Equipment | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanningError, setScanningError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionSuccess, setSubmissionSuccess] = useState(false);
    
    const instructors = useMemo(() => (users || []).filter(u => u.role === Role.INSTRUCTOR_MEDIALAB), [users]);
    
    // Effect to find equipment when code changes
    useEffect(() => {
        if (inventoryCode.length > 4) { // Basic threshold to start searching
            const eq = equipment.find(e => e.id === inventoryCode);
            setFoundEquipment(eq || null);
        } else {
            setFoundEquipment(null);
        }
    }, [inventoryCode, equipment]);

    const handleScanLabel = async (photo: string) => {
        setIsScanning(true);
        setScanningError('');
        // Call Gemini to extract code
        const code = await readInventoryLabel(photo);
        if (code && code !== "NO_FOUND" && code !== "ERROR") {
            setInventoryCode(code);
        } else {
            setScanningError("No se pudo identificar un código numérico claro. Intenta ingresarlo manualmente.");
        }
        setIsScanning(false);
    };

    const resetForm = () => {
        setSelectedInstructor('');
        setInventoryCode('');
        setFoundEquipment(null);
        setScanningError('');
        setIsSubmitting(false);
        setSubmissionSuccess(false);
    };

    const getBase64ImageFromURL = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = url;
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

    const generatePDF = async (loanId: string, equipmentItem: Equipment, instructorName: string) => {
        const doc = new jsPDF();
        const margin = 20;
        let y = margin;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // 1. LOGO SENA
        let logoBase64: string | null = null;
        try {
            // Priority 1: Local file from public folder
            try {
                logoBase64 = await getBase64ImageFromURL("/logoSena.png");
            } catch (localErr) {
                console.warn("Logo local (/logoSena.png) no encontrado, intentando remoto...");
                
                // Priority 2: External URL backup
                try {
                    const externalUrl = "https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png"; 
                    logoBase64 = await getBase64ImageFromURL(externalUrl);
                } catch (remoteErr) {
                     console.warn("Logo remoto no pudo ser cargado.", remoteErr);
                }
            }

            if (logoBase64) {
                // Centrado, tamaño aprox 25x25
                const imgWidth = 25;
                const imgHeight = 25;
                const x = (pageWidth - imgWidth) / 2;
                doc.addImage(logoBase64, 'PNG', x, y, imgWidth, imgHeight);
                y += 30; 
            } else {
                 // Fallback text header if logo fails
                 doc.setFontSize(18);
                 doc.setFont("helvetica", "bold");
                 doc.setTextColor(57, 169, 0); // SENA Green
                 doc.text("SENA - MEDIALAB", pageWidth / 2, y + 10, { align: "center" });
                 y += 25;
            }
        } catch (e) {
            console.warn("Error general procesando logo", e);
            y += 20;
        }

        // 2. TITULO CENTRAL
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("COMPROBANTE DE PRÉSTAMO", pageWidth / 2, y, { align: "center" });
        y += 7;

        // 3. SUBTITULO
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        doc.text("MEDIALAB - CIES", pageWidth / 2, y, { align: "center" });
        y += 15;

        // DATOS GENERALES
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha: ${new Date().toLocaleString()}`, margin, y);
        doc.text(`ID Préstamo: ${loanId}`, pageWidth - margin, y, { align: "right" });
        y += 10;

        // 4. DATOS EXISTENTES
        // Section 1: Borrower
        doc.setFillColor(240, 240, 240); // Gris claro
        doc.setDrawColor(0); // Sin borde
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(57, 169, 0); // SENA Green aproximado
        doc.text("DATOS DEL SOLICITANTE", margin + 2, y + 6);
        y += 12;

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`ID: ${currentUser.id}`, margin, y);
        doc.text(`Nombre: ${currentUser.name}`, margin, y + 5);
        doc.text(`Categoría: ${currentUser.category || 'N/A'}`, margin, y + 10);
        y += 20;

        // Section 2: Equipment
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(57, 169, 0);
        doc.text("DATOS DEL EQUIPO", margin + 2, y + 6);
        y += 12;

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Equipo: ${equipmentItem.name}`, margin, y);
        doc.text(`Código Inventario (Placa): ${equipmentItem.id}`, margin, y + 5);
        doc.text(`Tipo: ${equipmentItem.type}`, margin, y + 10);
        y += 20;

        // Section 3: Responsibility
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y, pageWidth - (margin * 2), 8, 'F');
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(57, 169, 0);
        doc.text("RESPONSABILIDAD", margin + 2, y + 6);
        y += 12;

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Instructor Responsable: ${instructorName}`, margin, y);
        y += 20;

        // 5. NOTA LEGAL ACTUALIZADA
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.setFont("helvetica", "italic");
        const disclaimer = "Al generarse este documento digital, el solicitante se hace responsable del cuidado y buen uso del equipo descrito, comprometiéndose a devolverlo en las mismas o mejores condiciones en que fue recibido.";
        const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - (margin * 2));
        doc.text(splitDisclaimer, margin, y);

        // 6. PIE DE PAGINA
        const footerY = pageHeight - 15;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text("Centro de la Industria, la Empresa y los Servicios", pageWidth / 2, footerY, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.text("Regional Huila - SENA, Neiva", pageWidth / 2, footerY + 5, { align: "center" });

        // Save
        doc.save(`Prestamo_MediaLab_${loanId}.pdf`);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInstructor || !inventoryCode || !foundEquipment) return;

        setIsSubmitting(true);
        
        const loanId = `L${Date.now()}`;
        
        const newLoan = createNewLoan({
            id: loanId,
            borrowerId: currentUser.id,
            instructorId: selectedInstructor,
            equipmentId: foundEquipment.id,
            placa: inventoryCode,
            photos: [foundEquipment.imageUrl],
            conditionAnalysis: "Asignado vía Sistema (Verificado por Código de Inventario)",
        });

        onNewLoan(newLoan);
        
        const instructorName = users.find(u => u.id === selectedInstructor)?.name || "Instructor";
        generatePDF(loanId, foundEquipment, instructorName);

        setSubmissionSuccess(true);
        setIsSubmitting(false);
    };

    if (submissionSuccess) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center animate-scale-in">
                <div className="flex justify-center mb-4">
                    <div className="bg-green-100 p-4 rounded-full">
                        <DownloadIcon className="w-12 h-12 text-sena-green" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-sena-green">¡Préstamo Registrado y PDF Generado!</h2>
                <p className="text-gray-600 dark:text-gray-300">
                    El préstamo ha sido registrado exitosamente. Se ha descargado un comprobante PDF en tu dispositivo como evidencia.
                </p>
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button
                        onClick={resetForm}
                        className="px-6 py-2 bg-sena-green text-white font-bold rounded-lg hover:bg-opacity-80 transition-colors"
                    >
                        Solicitar otro préstamo
                    </button>
                    <button
                        onClick={() => setActiveTab('myLoans')}
                        className="px-6 py-2 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Ver mis préstamos
                    </button>
                </div>
            </div>
        )
    }
    
    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
            <div>
                <h2 className="text-2xl font-bold text-sena-dark dark:text-white">Solicitar Préstamo de Equipo</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Completa los datos para generar tu comprobante digital.</p>
            </div>
            
            {/* Section 1: Instructor */}
            <div>
                <label htmlFor="instructor-select" className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">1. Instructor Responsable</label>
                <select
                    id="instructor-select"
                    value={selectedInstructor}
                    onChange={e => setSelectedInstructor(e.target.value)}
                    required
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-sena-green outline-none transition-all"
                >
                    <option value="" disabled>-- Selecciona quién autoriza el préstamo --</option>
                    {instructors.map(instructor => (
                        <option key={instructor.id} value={instructor.id}>{instructor.name}</option>
                    ))}
                </select>
            </div>

            {/* Section 2: Equipment Identification */}
            <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">2. Identificación del Equipo</label>
                
                <div className="flex flex-col md:flex-row gap-4 items-start">
                    <div className="w-full md:w-1/2 space-y-2">
                         <p className="text-xs text-gray-500 dark:text-gray-400">Ingresa el código numérico del sticker SENA o escanéalo usando la cámara.</p>
                         <div className="flex gap-2">
                            <input
                                type="text"
                                value={inventoryCode}
                                onChange={(e) => setInventoryCode(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="Ej: 10100113..."
                                className="flex-grow p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-sena-green outline-none font-mono text-lg tracking-wider"
                            />
                         </div>
                         {/* Scan Button Area */}
                         <div className="mt-2">
                            {!isScanning ? (
                                <button 
                                    type="button" 
                                    onClick={() => setIsScanning(true)}
                                    className="flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    <CameraIcon className="w-5 h-5" /> Escanear etiqueta con IA
                                </button>
                            ) : (
                                <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900">
                                    <p className="text-xs text-center mb-2 font-semibold text-sena-dark dark:text-white">Apunta al código de barras/número</p>
                                    <CameraCapture 
                                        onCapture={(photo) => handleScanLabel(photo)} 
                                        maxCaptures={1} 
                                        captures={[]} 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => { setIsScanning(false); setScanningError(''); }}
                                        className="mt-2 w-full py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                    >
                                        Cancelar Escaneo
                                    </button>
                                </div>
                            )}
                             {scanningError && <p className="text-red-500 text-xs mt-1 animate-pulse">{scanningError}</p>}
                         </div>
                    </div>

                    {/* Equipment Preview Card */}
                    <div className="w-full md:w-1/2">
                        {foundEquipment ? (
                            <div className="border-2 border-sena-green bg-green-50 dark:bg-green-900/20 p-4 rounded-lg flex gap-4 items-center animate-scale-in">
                                <img 
                                    src={foundEquipment.imageUrl} 
                                    alt={foundEquipment.name} 
                                    className="w-24 h-24 object-cover rounded-md bg-white"
                                />
                                <div>
                                    <p className="text-xs font-bold text-sena-green uppercase tracking-wide">Equipo Identificado</p>
                                    <h3 className="font-bold text-lg leading-tight">{foundEquipment.name}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">{foundEquipment.type}</p>
                                    <p className="text-xs text-gray-500 mt-1">Estado: {foundEquipment.status}</p>
                                    {foundEquipment.status !== EquipmentStatus.AVAILABLE && (
                                        <p className="text-red-600 font-bold text-xs mt-1">¡ADVERTENCIA! Este equipo ya figura como prestado.</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            inventoryCode.length > 4 ? (
                                <div className="h-full flex items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-400 text-center text-sm">
                                    Buscando equipo en base de datos... <br/> Si no aparece, verifica el código.
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-400 text-center text-sm">
                                    La información del equipo aparecerá aquí
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md">
                    * Al registrar, se generará un PDF con la imagen oficial del equipo. No es necesario tomar fotos adicionales.
                </p>
                <button 
                    type="submit" 
                    disabled={ 
                        isSubmitting || 
                        !selectedInstructor || 
                        !foundEquipment || 
                        foundEquipment.status !== EquipmentStatus.AVAILABLE 
                    } 
                    className="w-full sm:w-auto px-8 py-3 bg-sena-green text-white font-bold rounded-lg hover:bg-opacity-90 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:transform-none flex items-center justify-center gap-2 shadow-lg"
                >
                    {isSubmitting ? (
                        <><Spinner size="5" color="white" /> Procesando...</>
                    ) : (
                        "Registrar y Descargar PDF"
                    )}
                </button>
            </div>
        </form>
    );
};


const UserDashboard: React.FC<UserDashboardProps> = ({ currentUser, loans, equipment, users, onNewLoan }) => {
  const [activeTab, setActiveTab] = useState<Tab>('newLoan');

  return (
    <div className="w-full">
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-6 overflow-x-auto whitespace-nowrap" aria-label="Tabs">
          <TabButton icon={<CameraIcon className="w-5 h-5"/>} text="Solicitar Préstamo" isActive={activeTab === 'newLoan'} onClick={() => setActiveTab('newLoan')} />
          <TabButton icon={<HistoryIcon className="w-5 h-5"/>} text="Mis Préstamos" isActive={activeTab === 'myLoans'} onClick={() => setActiveTab('myLoans')} />
        </nav>
      </div>

      <div>
        {activeTab === 'myLoans' && <MyLoansView currentUser={currentUser} loans={loans} equipment={equipment} users={users} />}
        {activeTab === 'newLoan' && <NewLoanRequestForm currentUser={currentUser} equipment={equipment} users={users} onNewLoan={onNewLoan} setActiveTab={setActiveTab} />}
      </div>
    </div>
  );
};

export default UserDashboard;
