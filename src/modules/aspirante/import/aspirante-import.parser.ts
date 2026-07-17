import ExcelJS from 'exceljs';
import { GeneroAspirante } from '../../../common/enums/genero-aspirante.enum';
import {
  ASPIRANTE_IMPORT_HEADERS,
  ASPIRANTE_IMPORT_MAX_ROWS,
  ASPIRANTE_IMPORT_REQUIRED_HEADERS,
  type AspiranteImportHeader,
} from './aspirante-import.constants';
import type { AspiranteImportParsedRow } from './aspirante-import.types';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AspiranteImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AspiranteImportFileError';
  }
}

export interface ParsedAspiranteImportSheet {
  rows: AspiranteImportParsedRow[];
  /** Row-level parse issues (genero/fecha) collected before DB checks */
  parseErrors: Array<{ rowNumber: number; messages: string[] }>;
}

function cellToRawString(value: ExcelJS.CellValue): string {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) {
    return formatDateYmd(value);
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      return value.text.trim();
    }
    if ('result' in value && value.result != null) {
      return cellToRawString(value.result as ExcelJS.CellValue);
    }
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((p) => p.text).join('').trim();
    }
  }
  return String(value).trim();
}

function formatDateYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Excel serial date (days since 1899-12-30) → YYYY-MM-DD */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial)) {
    return null;
  }
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return formatDateYmd(date);
}

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_REGEX.test(value)) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function calculateAge(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
}

export function normalizeGenero(
  raw: string,
): { value: GeneroAspirante | null } | { error: string } {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) {
    return { value: null };
  }
  if (normalized === 'h' || normalized === 'hombre') {
    return { value: GeneroAspirante.Hombre };
  }
  if (normalized === 'm' || normalized === 'mujer') {
    return { value: GeneroAspirante.Mujer };
  }
  return {
    error: `genero inválido "${raw}" (usa H, M, Hombre o Mujer)`,
  };
}

export function normalizeFechaNacimiento(
  raw: string | number | Date | null | undefined,
): { value: string | null } | { error: string } {
  if (raw == null || raw === '') {
    return { value: null };
  }

  let iso: string | null = null;

  if (raw instanceof Date) {
    iso = formatDateYmd(raw);
  } else if (typeof raw === 'number') {
    iso = excelSerialToIsoDate(raw);
  } else {
    const trimmed = String(raw).trim();
    if (!trimmed) {
      return { value: null };
    }
    if (ISO_DATE_REGEX.test(trimmed)) {
      iso = trimmed;
    } else if (/^\d+(\.\d+)?$/.test(trimmed)) {
      iso = excelSerialToIsoDate(Number(trimmed));
    } else {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        iso = formatDateYmd(parsed);
      }
    }
  }

  if (!iso) {
    return {
      error:
        'fecha_nacimiento inválida (usa YYYY-MM-DD o una fecha Excel válida)',
    };
  }

  const birthDate = parseIsoDate(iso);
  if (!birthDate) {
    return {
      error:
        'fecha_nacimiento inválida (usa YYYY-MM-DD o una fecha Excel válida)',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (birthDate > today) {
    return { error: 'fecha_nacimiento no puede ser futura' };
  }

  const age = calculateAge(birthDate, today);
  if (age < 15 || age > 99) {
    return { error: 'fecha_nacimiento: edad debe estar entre 15 y 99 años' };
  }

  return { value: iso };
}

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

export async function parseAspiranteImportBuffer(
  buffer: Buffer,
): Promise<ParsedAspiranteImportSheet> {
  const workbook = new ExcelJS.Workbook();
  // exceljs typings expect Buffer-like; Node Buffer is fine at runtime
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new AspiranteImportFileError('El archivo no contiene hojas');
  }

  const headerRow = sheet.getRow(1);
  const headerIndex = new Map<AspiranteImportHeader, number>();

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normalizeHeader(cellToRawString(cell.value));
    if ((ASPIRANTE_IMPORT_HEADERS as readonly string[]).includes(header)) {
      headerIndex.set(header as AspiranteImportHeader, colNumber);
    }
  });

  const missingRequired = ASPIRANTE_IMPORT_REQUIRED_HEADERS.filter(
    (h) => !headerIndex.has(h),
  );
  if (missingRequired.length > 0) {
    throw new AspiranteImportFileError(
      `Faltan columnas requeridas en el encabezado: ${missingRequired.join(', ')}`,
    );
  }

  const rows: AspiranteImportParsedRow[] = [];
  const parseErrors: Array<{ rowNumber: number; messages: string[] }> = [];

  const lastRow = sheet.actualRowCount || sheet.rowCount;
  for (let rowNumber = 2; rowNumber <= lastRow; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const get = (header: AspiranteImportHeader): ExcelJS.CellValue => {
      const col = headerIndex.get(header);
      if (col == null) {
        return null;
      }
      return row.getCell(col).value;
    };

    const registroHospital = cellToRawString(get('registro_hospital'));
    const email = cellToRawString(get('email')).toLowerCase();
    const apellidos = cellToRawString(get('apellidos'));
    const nombre = cellToRawString(get('nombre'));
    const documento = cellToRawString(get('documento')) || null;
    const especialidad = cellToRawString(get('especialidad')) || null;
    const modalidad = cellToRawString(get('modalidad')) || null;
    const nacionalidad = cellToRawString(get('nacionalidad')) || null;
    const rfc = cellToRawString(get('rfc')) || null;
    const telefono = cellToRawString(get('telefono')) || null;

    const rawGenero = cellToRawString(get('genero'));
    const rawFechaCell = get('fecha_nacimiento');
    const rawFechaForNorm: string | number | Date | null =
      rawFechaCell instanceof Date
        ? rawFechaCell
        : typeof rawFechaCell === 'number'
          ? rawFechaCell
          : cellToRawString(rawFechaCell) || null;

    const isEmptyRow =
      !registroHospital &&
      !email &&
      !apellidos &&
      !nombre &&
      !documento &&
      !especialidad &&
      !modalidad &&
      !nacionalidad &&
      !rfc &&
      !telefono &&
      !rawGenero &&
      (rawFechaForNorm == null || rawFechaForNorm === '');

    if (isEmptyRow) {
      continue;
    }

    const messages: string[] = [];
    let genero: GeneroAspirante | null = null;
    let fechaNacimiento: string | null = null;

    if (rawGenero) {
      const g = normalizeGenero(rawGenero);
      if ('error' in g) {
        messages.push(g.error);
      } else {
        genero = g.value;
      }
    }

    const f = normalizeFechaNacimiento(rawFechaForNorm);
    if ('error' in f) {
      messages.push(f.error);
    } else {
      fechaNacimiento = f.value;
    }

    if (messages.length > 0) {
      parseErrors.push({ rowNumber, messages });
    }

    rows.push({
      rowNumber,
      registroHospital,
      documento,
      especialidad,
      modalidad,
      nacionalidad,
      apellidos,
      nombre,
      fechaNacimiento,
      genero,
      email,
      rfc,
      telefono,
    });
  }

  if (rows.length === 0) {
    throw new AspiranteImportFileError('El archivo no contiene filas de datos');
  }

  if (rows.length > ASPIRANTE_IMPORT_MAX_ROWS) {
    throw new AspiranteImportFileError(
      `El archivo supera el máximo de ${ASPIRANTE_IMPORT_MAX_ROWS} filas (recibidas: ${rows.length})`,
    );
  }

  return { rows, parseErrors };
}
