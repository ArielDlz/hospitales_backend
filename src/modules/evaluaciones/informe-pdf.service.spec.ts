import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InformePdfService } from './informe-pdf.service';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('InformePdfService', () => {
  let service: InformePdfService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => TINY_PNG.buffer.slice(
        TINY_PNG.byteOffset,
        TINY_PNG.byteOffset + TINY_PNG.byteLength,
      ),
    }) as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InformePdfService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(InformePdfService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('genera un buffer PDF válido', async () => {
    const buffer = await service.buildPdf({
      nombre: 'Juan',
      apellidos: 'García',
      registroHospital: '251156',
      especialidad: 'Enfermedades inflamatorias, autoinmunes y desmielinizantes',
      genero: 'Hombre',
      fechaNacimiento: '1988-05-27',
      emailEvaluador: 'evaluador@hospital.com',
      comentario: 'Informe de prueba con comentario del evaluador.',
      veredictoEtiqueta: 'Aceptado',
      veredictoCodigo: 'aceptado',
      fechaInforme: new Date(2025, 8, 18),
    });

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  });

  it('genera PDF firmado cuando se incluye firma y nombre del firmante', async () => {
    const buffer = await service.buildPdf({
      nombre: 'Juan',
      apellidos: 'García',
      registroHospital: '251156',
      especialidad: 'Cardiología',
      genero: 'Mujer',
      fechaNacimiento: '1995-03-15',
      emailEvaluador: 'evaluador@hospital.com',
      comentario: 'Informe de prueba con comentario del evaluador.',
      veredictoEtiqueta: 'No Aceptado',
      veredictoCodigo: 'no_aceptado',
      fechaInforme: new Date(2025, 8, 18),
      firmaUrl: 'https://example.com/firma.png',
      nombreFirmante: 'Dr. Firmante',
      cedulaProfesional: '6824419',
    });

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('pagina un informe largo sin fallar (múltiples páginas)', async () => {
    const paragraph =
      'El aspirante construye una narrativa enfocada en la resiliencia, la responsabilidad ' +
      'y la vocación de servicio, proyectando una imagen de elevada dedicación, rectitud y ' +
      'compromiso ético. En el área intelectual, obtiene un puntaje de 50, percentil 75, ' +
      'mostrando capacidad de adaptación para modular estrategias cognitivas. En la esfera ' +
      'de la personalidad, la dinámica psíquica se organiza en torno a un Yo estructurado. ';
    const longComentario = Array.from({ length: 12 }, () => paragraph).join('\n');

    const buffer = await service.buildPdf({
      nombre: 'Axel Eduardo',
      apellidos: 'Beltran Martinez',
      registroHospital: 'DI0439',
      especialidad: 'Medicina Interna',
      genero: 'Hombre',
      fechaNacimiento: '2000-07-21',
      emailEvaluador: 'evaluador@hospital.com',
      comentario: longComentario,
      veredictoEtiqueta: 'Aceptado',
      veredictoCodigo: 'aceptado',
      fechaInforme: new Date(2026, 6, 28),
      firmaUrl: 'https://example.com/firma.png',
      nombreFirmante: 'Miguel Sandoval Maza',
      cedulaProfesional: '1373219',
    });

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(2000);

    const pageCount = (
      buffer.toString('latin1').match(/\/Type\s*\/Page(?!s)\b/g) ?? []
    ).length;
    expect(pageCount).toBeGreaterThanOrEqual(2);
  });
});
