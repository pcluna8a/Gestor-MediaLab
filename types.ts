
export enum Role {
  USUARIO_MEDIALAB = 'USUARIO-MEDIALAB',
  INSTRUCTOR_MEDIALAB = 'INSTRUCTOR-MEDIALAB',
}

export enum UserCategory {
  APRENDIZ = 'APRENDIZ',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  INSTRUCTOR_SENA = 'INSTRUCTOR_SENA', // Compañeros SENA de otras áreas
}

export interface User {
  id: string;
  name: string;
  role: Role;
  category?: UserCategory;
  // Security Fields
  email?: string;
  passwordHash?: string; // Stored as SHA-256 hash
  forcePasswordChange?: boolean; // True if user must change password on next login
  photoURL?: string; // Base64 string of the profile picture
}

export enum EquipmentStatus {
  AVAILABLE = 'Disponible',
  ON_LOAN = 'En Préstamo',
}

export interface Equipment {
  id: string; // Correspond to "Placa"
  // name field removed to avoid duplication.
  description: string; // PRIMARY IDENTIFIER (Formerly "Descripción Original")
  currentDescription?: string; // SECONDARY INFO (Formerly "Descripción Actual")
  
  type: string;
  status: EquipmentStatus;
  imageUrl: string;
  
  // Extended Administrative Fields
  regional?: string;
  costCenter?: string; // Centro de Costo
  module?: string;
  model?: string;
  consecutive?: string;
  serial?: string;
  acquisitionDate?: string;
  value?: string; // Valor Ingreso
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
    equipmentName: string; // Kept for AI response mapping, populated by description
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
