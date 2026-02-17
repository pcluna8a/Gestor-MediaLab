import React, { useState } from 'react';
import { LoanRecord } from '../../types';
import { DocumentReportIcon, SparklesIcon, DownloadIcon } from '../Icons';
import { generateLoanReportAnalysis } from '../../services/geminiService';
import jsPDF from 'jspdf';

interface ReportsViewProps {
    loans: LoanRecord[];
}

const ReportsView: React.FC<ReportsViewProps> = ({ loans }) => {
    const [analysis, setAnalysis] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const generatePDFReport = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Reporte General de Préstamos - MediaLab", 14, 22);
        doc.setFontSize(11);
        doc.text(`Fecha de corte: ${new Date().toLocaleDateString()}`, 14, 30);

        let y = 40;
        loans.forEach((l, i) => {
            if (y > 280) { doc.addPage(); y = 20; }
            const status = l.returnDate ? `Devuelto: ${new Date(l.returnDate).toLocaleDateString()}` : "Activo";
            doc.text(`${i + 1}. ${l.equipmentId} - ${l.borrowerId} (${status})`, 14, y);
            y += 7;
        });
        doc.save("Reporte_General.pdf");
    };

    const handleAIAnalysis = async () => {
        setIsGenerating(true);
        const result = await generateLoanReportAnalysis(loans.slice(0, 50)); // Limit analysis to last 50 for tokens
        setAnalysis(result);
        setIsGenerating(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><DocumentReportIcon className="w-5 h-5" /> Reportes Estáticos</h3>
                    <p className="text-gray-500 mb-4">Descarga el historial completo de transacciones.</p>
                    <button onClick={generatePDFReport} className="w-full bg-gray-800 text-white py-3 rounded hover:bg-black transition-colors flex justify-center gap-2">
                        <DownloadIcon className="w-5 h-5" /> Descargar PDF Histórico
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-purple-500" /> Análisis Inteligente</h3>
                    <p className="text-gray-500 mb-4">Pide a la IA que busque patrones y problemas en los préstamos.</p>
                    <button onClick={handleAIAnalysis} disabled={isGenerating} className="w-full bg-purple-600 text-white py-3 rounded hover:bg-purple-700 transition-colors disabled:opacity-50">
                        {isGenerating ? 'Analizando...' : 'Generar Insights con IA'}
                    </button>
                </div>
            </div>

            {analysis && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-t-4 border-purple-500 animate-scale-in">
                    <h3 className="font-bold text-lg mb-4">Resultados del Análisis:</h3>
                    <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
                        {analysis}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsView;
