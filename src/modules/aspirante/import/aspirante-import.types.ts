import { GeneroAspirante } from '../../../common/enums/genero-aspirante.enum';

export interface AspiranteImportParsedRow {
  rowNumber: number;
  registroHospital: string;
  documento: string | null;
  especialidad: string | null;
  modalidad: string | null;
  nacionalidad: string | null;
  apellidos: string;
  nombre: string;
  fechaNacimiento: string | null;
  genero: GeneroAspirante | null;
  email: string;
  rfc: string | null;
  telefono: string | null;
}

export interface AspiranteImportRowError {
  rowNumber: number;
  email?: string;
  registroHospital?: string;
  messages: string[];
}

export interface AspiranteImportReport {
  ok: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: AspiranteImportRowError[];
  created?: number;
  emailsEnviados?: number;
}
