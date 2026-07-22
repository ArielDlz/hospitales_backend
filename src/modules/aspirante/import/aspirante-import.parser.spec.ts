import { GeneroAspirante } from '../../../common/enums/genero-aspirante.enum';
import {
  ASPIRANTE_IMPORT_MAX_ROWS,
  ASPIRANTE_IMPORT_HEADERS,
} from './aspirante-import.constants';
import {
  AspiranteImportFileError,
  excelSerialToIsoDate,
  isValidEmail,
  normalizeFechaNacimiento,
  normalizeGenero,
  parseAspiranteImportBuffer,
} from './aspirante-import.parser';
import ExcelJS from 'exceljs';

describe('aspirante-import.parser', () => {
  describe('normalizeGenero', () => {
    it('maps H/M and full names', () => {
      expect(normalizeGenero('H')).toEqual({ value: GeneroAspirante.Hombre });
      expect(normalizeGenero('m')).toEqual({ value: GeneroAspirante.Mujer });
      expect(normalizeGenero('Hombre')).toEqual({
        value: GeneroAspirante.Hombre,
      });
      expect(normalizeGenero('MUJER')).toEqual({
        value: GeneroAspirante.Mujer,
      });
    });

    it('rejects unknown values', () => {
      expect(normalizeGenero('X')).toEqual({
        error: expect.stringContaining('genero inválido'),
      });
    });
  });

  describe('normalizeFechaNacimiento', () => {
    it('accepts ISO dates in age range', () => {
      expect(normalizeFechaNacimiento('2000-01-15')).toEqual({
        value: '2000-01-15',
      });
    });

    it('rejects future and out-of-range ages', () => {
      expect(normalizeFechaNacimiento('2099-01-01')).toEqual({
        error: expect.stringContaining('futura'),
      });
      expect(normalizeFechaNacimiento('2020-01-01')).toEqual({
        error: expect.stringContaining('15 y 99'),
      });
    });

    it('converts excel serial', () => {
      const iso = excelSerialToIsoDate(36526); // ~2000-01-01
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const result = normalizeFechaNacimiento(36526);
      expect(result).toEqual({ value: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    });
  });

  describe('isValidEmail', () => {
    it('validates basic emails', () => {
      expect(isValidEmail('a@b.co')).toBe(true);
      expect(isValidEmail('not-an-email')).toBe(false);
    });
  });

  describe('parseAspiranteImportBuffer', () => {
    async function buildWorkbook(
      rows: Array<Record<string, string | number>>,
      headers: string[] = [...ASPIRANTE_IMPORT_HEADERS],
    ): Promise<Buffer> {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet('Aspirantes');
      sheet.addRow(headers);
      for (const row of rows) {
        sheet.addRow(headers.map((h) => row[h] ?? ''));
      }
      const arrayBuffer = await wb.xlsx.writeBuffer();
      return Buffer.from(arrayBuffer);
    }

    it('parses valid rows and normalizes H/M', async () => {
      const buffer = await buildWorkbook([
        {
          registro_hospital: 'REG-1',
          documento: 'CURP1',
          especialidad: 'Cardio',
          modalidad: 'presencial',
          nacionalidad: 'Mexicana',
          apellidos: 'García',
          nombre: 'Juan',
          fecha_nacimiento: '1995-03-15',
          genero: 'H',
          email: 'juan@example.com',
          rfc: 'RFC1',
          telefono: '5511111111',
        },
      ]);

      const parsed = await parseAspiranteImportBuffer(buffer);
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.parseErrors).toHaveLength(0);
      expect(parsed.rows[0].genero).toBe(GeneroAspirante.Hombre);
      expect(parsed.rows[0].email).toBe('juan@example.com');
      expect(parsed.rows[0].documento).toBe('CURP1');
    });

    it('lowercases email from the sheet', async () => {
      const buffer = await buildWorkbook([
        {
          registro_hospital: 'REG-1',
          documento: '',
          especialidad: '',
          modalidad: '',
          nacionalidad: '',
          apellidos: 'García',
          nombre: 'Juan',
          fecha_nacimiento: '',
          genero: 'H',
          email: 'Juan.Perez@Example.COM',
          rfc: '',
          telefono: '',
        },
      ]);

      const parsed = await parseAspiranteImportBuffer(buffer);
      expect(parsed.rows[0].email).toBe('juan.perez@example.com');
    });

    it('collects parse errors for invalid genero', async () => {
      const buffer = await buildWorkbook([
        {
          registro_hospital: 'REG-1',
          documento: '',
          especialidad: '',
          modalidad: '',
          nacionalidad: '',
          apellidos: 'García',
          nombre: 'Juan',
          fecha_nacimiento: '',
          genero: 'X',
          email: 'juan@example.com',
          rfc: '',
          telefono: '',
        },
      ]);

      const parsed = await parseAspiranteImportBuffer(buffer);
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.parseErrors[0].messages[0]).toContain('genero inválido');
    });

    it('rejects missing required headers', async () => {
      const buffer = await buildWorkbook([], ['email', 'nombre']);
      await expect(parseAspiranteImportBuffer(buffer)).rejects.toBeInstanceOf(
        AspiranteImportFileError,
      );
    });

    it('accepts files with only required headers (optional columns omitted)', async () => {
      const buffer = await buildWorkbook(
        [
          {
            registro_hospital: 'REG-1',
            email: 'solo@example.com',
            apellidos: 'Pérez',
            nombre: 'Ana',
          },
        ],
        ['registro_hospital', 'email', 'apellidos', 'nombre'],
      );

      const parsed = await parseAspiranteImportBuffer(buffer);
      expect(parsed.rows).toHaveLength(1);
      expect(parsed.parseErrors).toHaveLength(0);
      expect(parsed.rows[0]).toMatchObject({
        registroHospital: 'REG-1',
        email: 'solo@example.com',
        apellidos: 'Pérez',
        nombre: 'Ana',
        documento: null,
        especialidad: null,
        modalidad: null,
        nacionalidad: null,
        rfc: null,
        telefono: null,
        genero: null,
        fechaNacimiento: null,
      });
    });

    it('rejects more than max rows', async () => {
      const rows = Array.from({ length: ASPIRANTE_IMPORT_MAX_ROWS + 1 }, (_, i) => ({
        registro_hospital: `REG-${i}`,
        documento: '',
        especialidad: '',
        modalidad: '',
        nacionalidad: '',
        apellidos: 'Apellido',
        nombre: 'Nombre',
        fecha_nacimiento: '',
        genero: '',
        email: `user${i}@example.com`,
        rfc: '',
        telefono: '',
      }));
      const buffer = await buildWorkbook(rows);
      await expect(parseAspiranteImportBuffer(buffer)).rejects.toThrow(
        /máximo de 500/,
      );
    }, 30000);
  });
});
