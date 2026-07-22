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
});
