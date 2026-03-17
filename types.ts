
export enum Role {
  USUARIO_MEDIALAB = 'USUARIO-MEDIALAB',
  INSTRUCTOR_MEDIALAB = 'INSTRUCTOR-MEDIALAB',
}

export enum UserCategory {
  APRENDIZ = 'APRENDIZ',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  INSTRUCTOR = 'INSTRUCTOR',
  SUPER_ADMIN = 'SUPER-ADMIN',
}

export interface User {
  id: string;
  name: string;
  role: Role;
  category?: UserCategory;
  // Security Fields
  uid?: string; // Firebase Auth UID
  email?: string;
  emailGoogle?: string;
  passwordHash?: string; // Stored as SHA-256 hash
  forcePasswordChange?: boolean; // True if user must change password on next login
  photoURL?: string; // Profile picture (Base64)
  isSuperAdmin?: boolean; // True if user has SUPER-ADMIN capabilities
}

export interface AuditLog {
  id: string;
  action: string; // e.g., 'DELETE_EQUIPMENT', 'FORCE_EDIT_LOAN', 'DELETE_USER'
  actorId: string; // The ID of the Super Admin who performed the action
  actorName: string;
  targetId: string; // The ID of the affected document
  timestamp: string; // ISO String
  metadata?: any; // Extra details about the action
}

export interface SystemSettings {
  maintenanceMode: boolean;
  termsAndConditions: string;
}

export enum EquipmentStatus {
  AVAILABLE = 'Disponible',
  ON_LOAN = 'En Préstamo',
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  status: EquipmentStatus;
  imageUrl: string;
  description?: string;
  currentDescription?: string;
}

export interface LoanRecord {
  id: string;
  equipmentId: string;
  borrowerId: string;
  instructorId: string;
  loanDate: Date;
  returnDate: Date | null;
  photos: string[]; // Base64 data URLs
  conditionAnalysis: string;
  placa?: string; // Numero de inventario SENA
  returnPhotos?: string[]; // Base64 data URLs - opcional
  returnConditionAnalysis?: string;
  returnConcept?: string;
  returnStatus?: string; // Excelente, Bueno, Aceptable, Regular, Malo
}

export interface MaintenanceSuggestion {
  equipmentId: string;
  equipmentName: string;
  suggestion: string;
}

export const createNewLoan = (data: Partial<LoanRecord>): LoanRecord => {
  return {
    id: data.id || `L${Date.now()}`,
    equipmentId: data.equipmentId || '',
    borrowerId: data.borrowerId || '',
    instructorId: data.instructorId || '',
    loanDate: data.loanDate || new Date(),
    returnDate: null,
    photos: data.photos || [],
    conditionAnalysis: data.conditionAnalysis || '',
    placa: data.placa,
    returnStatus: '',
  };
};
