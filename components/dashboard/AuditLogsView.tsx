import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { AuditLog } from '../../types';
import { DocumentReportIcon, SearchIcon, TrashIcon } from '../Icons';
import Spinner from '../Spinner';

const AuditLogsView: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (!db) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'audit_logs'),
            orderBy('timestamp', 'desc'),
            limit(100)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const auditData: AuditLog[] = [];
            snapshot.forEach(doc => {
                auditData.push(doc.data() as AuditLog);
            });
            setLogs(auditData);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    const filteredLogs = logs.filter(log =>
        log.actorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.targetId.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getActionColor = (action: string) => {
        if (action.includes('DELETE')) return 'text-red-400 bg-red-400/10 border-red-400/20';
        if (action.includes('FORCE_EDIT')) return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    };

    const getActionLabel = (action: string) => {
        switch (action) {
            case 'DELETE_EQUIPMENT': return 'Eliminación de Equipo';
            case 'DELETE_USER': return 'Eliminación de Usuario';
            case 'FORCE_EDIT_LOAN': return 'Edición Forzada de Préstamo';
            default: return action;
        }
    };

    return (
        <div className="space-y-6 animate-fade-in text-gray-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <DocumentReportIcon className="w-6 h-6 text-sena-green" /> Auditoría del Sistema (SUPER-ADMIN)
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">Registro inmutable de acciones críticas y destructivas.</p>
                </div>
            </div>

            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h4 className="font-bold text-gray-200">Últimos 100 Registros</h4>
                    <div className="relative w-full md:w-64">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar en logs..."
                            className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-full text-sm text-white placeholder-gray-600 focus:border-sena-green focus:ring-1 focus:ring-sena-green outline-none transition-all"
                        />
                        <div className="absolute left-3.5 top-2.5 text-gray-500">
                            <SearchIcon className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto min-h-[400px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Spinner size="10" color="sena-green" />
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-white/10 text-left">
                            <thead className="bg-black/20 sticky top-0 backdrop-blur-md">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha / Hora</th>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Acción (Evento)</th>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Actor (Super Admin)</th>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">ID Afectado</th>
                                    <th className="px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Metadata Extra</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredLogs.length > 0 ? (
                                    filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-sm font-mono text-gray-400">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`px-2 py-1 rounded text-xs border font-bold tracking-wider ${getActionColor(log.action)}`}>
                                                    {getActionLabel(log.action)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-white font-medium">
                                                {log.actorName} <br />
                                                <span className="text-[10px] text-gray-500 font-mono">{log.actorId}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-gray-400 cursor-pointer hover:text-white transition-colors" title="Copiar ID" onClick={() => navigator.clipboard.writeText(log.targetId)}>
                                                {log.targetId}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-gray-500 font-mono truncate max-w-[200px]" title={JSON.stringify(log.metadata)}>
                                                {JSON.stringify(log.metadata)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">
                                            No se encontraron registros de auditoría.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditLogsView;
