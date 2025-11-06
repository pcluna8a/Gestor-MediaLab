export enum Role {
  USUARIO_MEDIALAB = 'USUARIO-MEDIALAB',
  INSTRUCTOR_MEDIALAB = 'INSTRUCTOR-MEDIALAB',
}

export enum UserCategory {
  APRENDIZ = 'APRENDIZ',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  INSTRUCTOR = 'INSTRUCTOR',
}

export interface User {
  id: string;
  name: string;
  role: Role;
  category?: UserCategory;
}

export enum EquipmentStatus {
  AVAILABLE = 'Disponible',
  ON_LOAN = 'En Préstamo',
}

export interface Equipment {
  id:string;
  name: string;
  type: string;
  status: EquipmentStatus;
  imageUrl: string;
}

export interface LoanRecord {
  id: string;
  equipmentId: string;
  borrowerId: string;
  instructorId: string;
  loanDate: Date;
  returnDate: Date | null;
  photos: string[]; // Base64 data URLs - siempre debe ser un array (puede estar vacío [])
  conditionAnalysis: string;
  returnPhotos?: string[]; // Base64 data URLs - opcional
  placa?: string; // Optional SENA inventory plate number
  returnConcept?: string; // Concepto del instructor al momento de la devolución
}

/**
 * Crea un nuevo objeto LoanRecord con valores por defecto seguros y consistentes.
 * @param details - La información esencial para crear un nuevo préstamo.
 * @returns Un objeto LoanRecord completo y listo para ser almacenado.
 */
export const createNewLoan = (details: {
  id: string;
  equipmentId: string;
  borrowerId: string;
  instructorId: string;
  photos: string[];
  conditionAnalysis: string;
  placa?: string;
}): LoanRecord => {
  return {
    ...details,
    loanDate: new Date(),
    returnDate: null,
    // Aseguramos que los campos de devolución estén indefinidos al crear un préstamo
    returnPhotos: undefined, 
    returnConcept: undefined,
  };
};
