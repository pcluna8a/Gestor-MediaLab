import React, { useState } from 'react';
import { Role, UserCategory } from '../types';
import { useAuth } from '../contexts/AuthContext';
import Spinner from './Spinner';

export const LoginScreen: React.FC = () => {
    const { loginInstructor, loginStudent, isLoading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<'instructor' | 'student'>('student');

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [studentId, setStudentId] = useState('');
    const [studentCategory, setStudentCategory] = useState<UserCategory | ''>('');
    const [studentName, setStudentName] = useState(''); // Optional, maybe for first time?
    const [error, setError] = useState('');
    const [localLoading, setLocalLoading] = useState(false);

    const handleInstructorLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLocalLoading(true);
        if (!email || !password) {
            setError("Por favor ingresa correo y contraseña");
            setLocalLoading(false);
            return;
        }

        const result = await loginInstructor(email, password);
        if (!result.success) {
            setError(result.error || "Error al iniciar sesión");
        }
        setLocalLoading(false);
    };

    const handleStudentLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLocalLoading(true);
        if (!studentId || !studentCategory) {
            setError("Por favor completa los campos requeridos");
            setLocalLoading(false);
            return;
        }

        const result = await loginStudent(studentId, studentCategory);
        if (!result.success) {
            setError(result.error || "Error al ingresar");
        }
        setLocalLoading(false);
    };

    const isLoading = authLoading || localLoading;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-sena-dark p-4 transition-colors">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg animate-fade-in transition-colors">
                <img src="/logoSena.png" onError={(e) => e.currentTarget.src = "https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png"} alt="SENA Logo" className="w-24 mx-auto mb-6 dark:brightness-0 dark:invert" />
                <h1 className="text-2xl font-bold text-center text-sena-dark dark:text-white mb-2">Gestor MediaLab</h1>
                <p className="text-center text-sena-gray dark:text-gray-300 mb-6">Sistema Integral de Préstamos</p>

                {/* Tabs */}
                <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
                    <button
                        className={`flex-1 py-2 text-center font-medium transition-colors ${activeTab === 'student' ? 'text-sena-green border-b-2 border-sena-green' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        onClick={() => { setActiveTab('student'); setError(''); }}
                    >
                        Aprendiz / Usuario
                    </button>
                    <button
                        className={`flex-1 py-2 text-center font-medium transition-colors ${activeTab === 'instructor' ? 'text-sena-green border-b-2 border-sena-green' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        onClick={() => { setActiveTab('instructor'); setError(''); }}
                    >
                        Instructor / Admin
                    </button>
                </div>

                {activeTab === 'instructor' ? (
                    <form onSubmit={handleInstructorLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo Institucional</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-white focus:ring-2 focus:ring-sena-green transition-colors"
                                placeholder="usuario@sena.edu.co"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-white focus:ring-2 focus:ring-sena-green transition-colors"
                                placeholder="••••••••"
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm py-2">{error}</p>}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-sena-green text-white font-bold py-3 rounded-md hover:bg-opacity-90 transition-colors flex justify-center items-center"
                        >
                            {isLoading ? <Spinner size="5" color="white" /> : 'Ingresar'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleStudentLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
                            <select
                                value={studentCategory}
                                onChange={e => setStudentCategory(e.target.value as UserCategory)}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-white focus:ring-2 focus:ring-sena-green transition-colors"
                            >
                                <option value="" disabled>-- Selecciona --</option>
                                {Object.values(UserCategory).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número de Documento</label>
                            <input
                                type="text"
                                value={studentId}
                                onChange={e => setStudentId(e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sena-dark dark:text-white focus:ring-2 focus:ring-sena-green transition-colors"
                                placeholder="1234567890"
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm py-2">{error}</p>}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-sena-green text-white font-bold py-3 rounded-md hover:bg-opacity-90 transition-colors flex justify-center items-center"
                        >
                            {isLoading ? <Spinner size="5" color="white" /> : 'Acceder'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
