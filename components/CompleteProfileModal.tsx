import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserCategory, isValidUserFullName, isValidUserEmail } from '../types';
import { checkIsEquipmentId, checkExistingUserById } from '../services/firebaseService';
import Spinner from './Spinner';

interface CompleteProfileModalProps {
    onClose?: () => void;
    forceEdit?: boolean;
}

export const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({ onClose, forceEdit }) => {
    const { pendingProfileUser, currentUser, completeProfile, updateProfileData, logout } = useAuth();

    const activeUser = currentUser || pendingProfileUser;

    // Prefill Document ID if existing user is updating their profile
    const [idInput, setIdInput] = useState(() => currentUser?.id || '');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState(() => activeUser?.email || '');
    const [category, setCategory] = useState<UserCategory | ''>(() => (currentUser?.category as UserCategory) || '');

    const [isCheckingId, setIsCheckingId] = useState(false);
    const [idError, setIdError] = useState('');
    const [verifiedExistingName, setVerifiedExistingName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Pre-populate name fields if activeUser has a non-generic display name
    useEffect(() => {
        if (currentUser && isValidUserFullName(currentUser.name)) {
            const parts = currentUser.name.trim().split(/\s+/);
            if (parts.length >= 2) {
                setFirstName(parts.slice(0, Math.ceil(parts.length / 2)).join(' '));
                setLastName(parts.slice(Math.ceil(parts.length / 2)).join(' '));
            } else {
                setFirstName(currentUser.name);
            }
        } else if (pendingProfileUser?.displayName && isValidUserFullName(pendingProfileUser.displayName)) {
            const parts = pendingProfileUser.displayName.trim().split(/\s+/);
            if (parts.length >= 2) {
                setFirstName(parts.slice(0, Math.ceil(parts.length / 2)).join(' '));
                setLastName(parts.slice(Math.ceil(parts.length / 2)).join(' '));
            } else {
                setFirstName(pendingProfileUser.displayName);
            }
        }
    }, [currentUser, pendingProfileUser]);

    // Validate ID on change / debounce
    useEffect(() => {
        const cleanId = idInput.trim().replace(/[^0-9]/g, '');
        if (!cleanId || cleanId.length < 5) {
            setIdError('');
            setVerifiedExistingName('');
            return;
        }

        let isCancelled = false;
        const timer = setTimeout(async () => {
            setIsCheckingId(true);
            setIdError('');

            // 1. Validar si el ID corresponde a un equipo del inventario
            const eqCheck = await checkIsEquipmentId(cleanId);
            if (isCancelled) return;

            if (eqCheck.isEquipment) {
                setIdError(`❌ El número "${cleanId}" corresponde al equipo "${eqCheck.equipmentName}" del inventario. No puedes utilizar un código de equipo como documento de identidad.`);
                setVerifiedExistingName('');
                setIsCheckingId(false);
                return;
            }

            // 2. Verificar si el ID ya existe en la base de datos de usuarios
            const userCheck = await checkExistingUserById(cleanId);
            if (isCancelled) return;

            if (userCheck.exists && userCheck.user) {
                const existing = userCheck.user;
                if (isValidUserFullName(existing.name)) {
                    setVerifiedExistingName(existing.name);
                    // Pre-fill if fields are empty
                    if (!firstName && !lastName) {
                        const parts = existing.name.trim().split(/\s+/);
                        setFirstName(parts.slice(0, Math.ceil(parts.length / 2)).join(' '));
                        setLastName(parts.slice(Math.ceil(parts.length / 2)).join(' '));
                    }
                    if (existing.email && !email) {
                        setEmail(existing.email);
                    }
                    if (existing.category && !category) {
                        setCategory(existing.category as UserCategory);
                    }
                } else {
                    setVerifiedExistingName('');
                }
            } else {
                setVerifiedExistingName('');
            }

            setIsCheckingId(false);
        }, 500);

        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [idInput]);

    if (!pendingProfileUser && !currentUser && !forceEdit) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const cleanId = idInput.trim().replace(/[^0-9]/g, '');
        if (!cleanId || cleanId.length < 5) {
            setError("Por favor ingresa un número de documento válido (mínimo 5 dígitos numéricos).");
            return;
        }

        if (idError) {
            setError("Debes solucionar el conflicto con el documento de identidad antes de continuar.");
            return;
        }

        const trimmedFirstName = firstName.trim();
        const trimmedLastName = lastName.trim();

        if (trimmedFirstName.length < 2) {
            setError("Por favor ingresa tu(s) Nombre(s) correctamente (mínimo 2 caracteres).");
            return;
        }

        if (trimmedLastName.length < 2) {
            setError("Por favor ingresa tu(s) Apellido(s) correctamente (mínimo 2 caracteres).");
            return;
        }

        const fullName = `${trimmedFirstName} ${trimmedLastName}`;
        if (!isValidUserFullName(fullName)) {
            setError("Debes ingresar Nombre y Apellido completos válidos. No se permiten nombres genéricos.");
            return;
        }

        const trimmedEmail = email.trim();
        if (!isValidUserEmail(trimmedEmail)) {
            setError("Por favor ingresa una dirección de correo electrónico válida (ej: nombre@sena.edu.co).");
            return;
        }

        if (!category) {
            setError("Por favor selecciona tu categoría Institucional.");
            return;
        }

        setLoading(true);

        try {
            if (currentUser) {
                // Updating logged-in user with incomplete profile
                const result = await updateProfileData({
                    firstName: trimmedFirstName,
                    lastName: trimmedLastName,
                    email: trimmedEmail,
                    category: category as UserCategory
                });

                if (!result.success) {
                    setError(result.error || "Error al actualizar tus datos.");
                    setLoading(false);
                    return;
                }
                if (onClose) onClose();
            } else if (pendingProfileUser) {
                // First time onboarding
                const result = await completeProfile({
                    id: cleanId,
                    firstName: trimmedFirstName,
                    lastName: trimmedLastName,
                    email: trimmedEmail,
                    category: category as UserCategory
                });

                if (!result.success) {
                    setError(result.error || "Ocurrió un error al vincular tu perfil.");
                    setLoading(false);
                    return;
                }
            }
        } catch (err: any) {
            setError(err.message || "Error al procesar el registro.");
        } finally {
            setLoading(false);
        }
    };

    const isReadOnlyId = Boolean(currentUser && currentUser.id);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
            <div className="bg-[#002235] border border-white/10 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative my-8">
                <div className="text-center mb-6">
                    <img
                        src="/logoSena.png"
                        onError={(e) => e.currentTarget.src = "https://www.sena.edu.co/Style%20Library/alayout/images/logoSena.png"}
                        alt="SENA"
                        className="w-14 h-14 mx-auto mb-3 rounded-full bg-white p-2 border-2 border-sena-green shadow-lg"
                    />
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                        {currentUser ? 'Actualizar Datos de Usuario' : 'Registro de Datos Personales'}
                    </h2>
                    <p className="text-xs text-gray-300 mt-1">
                        Para acceder al sistema de préstamos de MediaLab es obligatorio contar con tu <span className="text-sena-green font-bold">Nombre</span>, <span className="text-sena-green font-bold">Apellido</span>, <span className="text-sena-green font-bold">Documento</span> y <span className="text-sena-green font-bold">Correo</span> registrados.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Documento de Identidad */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                            <span>Documento de Identidad (ID)</span>
                            {isCheckingId && <span className="text-sena-green text-[10px] lowercase font-normal flex items-center gap-1"><Spinner size="3" color="sena-green" /> verificando...</span>}
                        </label>
                        <input
                            type="text"
                            value={idInput}
                            disabled={isReadOnlyId}
                            onChange={(e) => setIdInput(e.target.value)}
                            placeholder="Ej: 1075215351 (Solo números)"
                            className={`w-full p-3 bg-black/30 border rounded-xl text-white focus:ring-2 focus:ring-sena-green transition-all outline-none font-mono text-sm ${
                                idError ? 'border-red-500/80 bg-red-500/10' : 'border-white/15'
                            } ${isReadOnlyId ? 'opacity-70 cursor-not-allowed' : ''}`}
                            required
                        />
                        {idError && (
                            <p className="text-red-400 text-xs mt-1.5 p-2 bg-red-950/40 border border-red-800/50 rounded-lg">
                                {idError}
                            </p>
                        )}
                        {verifiedExistingName && !idError && (
                            <p className="text-sena-green text-xs mt-1.5 p-2 bg-sena-green/10 border border-sena-green/30 rounded-lg font-semibold flex items-center gap-1.5">
                                <span>✓ Pre-registrado:</span> <span>{verifiedExistingName}</span>
                            </p>
                        )}
                    </div>

                    {/* Nombres y Apellidos en dos columnas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                                Nombre(s)
                            </label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Ej: Carlos Andrés"
                                className="w-full p-3 bg-black/30 border border-white/15 rounded-xl text-white focus:ring-2 focus:ring-sena-green transition-all outline-none text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                                Apellido(s)
                            </label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Ej: Fernández González"
                                className="w-full p-3 bg-black/30 border border-white/15 rounded-xl text-white focus:ring-2 focus:ring-sena-green transition-all outline-none text-sm"
                                required
                            />
                        </div>
                    </div>

                    {/* Correo Electrónico */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                            Correo Electrónico (Institucional o Personal)
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="ejemplo@sena.edu.co o @gmail.com"
                            className="w-full p-3 bg-black/30 border border-white/15 rounded-xl text-white focus:ring-2 focus:ring-sena-green transition-all outline-none text-sm font-mono"
                            required
                        />
                    </div>

                    {/* Categoría Institucional */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                            Rol / Categoría SENA
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as UserCategory)}
                            className="w-full p-3 bg-black/30 border border-white/15 rounded-xl text-white focus:ring-2 focus:ring-sena-green transition-all outline-none text-sm"
                            required
                        >
                            <option value="" disabled className="bg-gray-900 text-gray-400">Selecciona tu categoría...</option>
                            <option value={UserCategory.APRENDIZ} className="bg-gray-900 text-white">APRENDIZ</option>
                            <option value={UserCategory.INSTRUCTOR_SENA} className="bg-gray-900 text-white">INSTRUCTOR-SENA</option>
                            <option value={UserCategory.ADMINISTRATIVO} className="bg-gray-900 text-white">ADMINISTRATIVO</option>
                            <option value={UserCategory.ADMIN} className="bg-gray-900 text-white">ADMINISTRADOR</option>
                        </select>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-950/60 border border-red-500/50 text-red-300 rounded-xl text-xs leading-relaxed animate-shake">
                            {error}
                        </div>
                    )}

                    <div className="pt-3 flex flex-col gap-2.5">
                        <button
                            type="submit"
                            disabled={loading || Boolean(idError)}
                            className="w-full bg-sena-green hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl hover:shadow-[0_0_20px_rgba(57,169,0,0.5)] transition-all flex justify-center items-center h-12 text-sm uppercase tracking-wider"
                        >
                            {loading ? <Spinner size="5" color="white" /> : (currentUser ? 'Guardar y Continuar' : 'Completar Registro y Acceder')}
                        </button>

                        {onClose ? (
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="w-full text-gray-400 hover:text-white text-xs font-semibold py-2 transition-colors"
                            >
                                Cancelar
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={logout}
                                disabled={loading}
                                className="w-full text-gray-400 hover:text-red-400 text-xs font-semibold py-2 transition-colors"
                            >
                                Salir y cerrar sesión
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};
