import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { InformePdfService } from './informe-pdf.service';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function bufferAsArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('InformePdfService', () => {
  let service: InformePdfService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => bufferAsArrayBuffer(TINY_PNG),
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

  it('recorta padding transparente de la firma y la embebe a tamaño usable', async () => {
    // Mimics S3 firmas: large transparent canvas with ink only in a band.
    const paddedFirma = await sharp({
      create: {
        width: 1920,
        height: 1280,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="800" height="200" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 140 C120 40 280 40 380 120 S620 200 780 80"
                    fill="none" stroke="#222" stroke-width="10"/>
            </svg>`,
          ),
          top: 200,
          left: 400,
        },
      ])
      .png()
      .toBuffer();

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => bufferAsArrayBuffer(TINY_PNG),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => bufferAsArrayBuffer(paddedFirma),
      }) as unknown as typeof fetch;

    const buffer = await service.buildPdf({
      nombre: 'Axel',
      apellidos: 'Beltran',
      registroHospital: 'DI0439',
      especialidad: 'Medicina Interna',
      genero: 'Hombre',
      fechaNacimiento: '2000-07-21',
      emailEvaluador: 'evaluador@hospital.com',
      comentario: 'Informe con firma padded.',
      veredictoEtiqueta: 'Aceptado',
      veredictoCodigo: 'aceptado',
      fechaInforme: new Date(2026, 6, 28),
      firmaUrl: 'https://example.com/Firma+Lourdes.png',
      nombreFirmante: 'Dra. Lourdes Quiroga Etienne',
      cedulaProfesional: '1582998',
    });

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.toString('latin1')).toContain('/Subtype /Image');
  });

  it('convierte firma JPEG a PNG para evitar el bug DeviceGray de PDFKit', async () => {
    const jpegFirma = await sharp({
      create: {
        width: 200,
        height: 60,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="200" height="60" xmlns="http://www.w3.org/2000/svg">
              <text x="20" y="40" font-size="28" fill="black">Firma</text>
            </svg>`,
          ),
        },
      ])
      .jpeg()
      .toBuffer();

    expect(jpegFirma[0]).toBe(0xff);
    expect(jpegFirma[1]).toBe(0xd8);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => bufferAsArrayBuffer(TINY_PNG),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => bufferAsArrayBuffer(jpegFirma),
      }) as unknown as typeof fetch;

    const buffer = await service.buildPdf({
      nombre: 'Cesar',
      apellidos: 'Barreda Sanchez',
      registroHospital: 'DI0671',
      especialidad: 'Oftalmología',
      genero: 'Hombre',
      fechaNacimiento: '1985-10-17',
      emailEvaluador: 'evaluador@hospital.com',
      comentario: 'Informe de prueba con firma JPEG.',
      veredictoEtiqueta: 'Aceptado',
      veredictoCodigo: 'aceptado',
      fechaInforme: new Date(2026, 6, 28),
      firmaUrl: 'https://example.com/Miguel+Sandoval+Maza.jpg',
      nombreFirmante: 'Miguel Sandoval Maza',
      cedulaProfesional: '1373219',
    });

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    const pdfText = buffer.toString('latin1');
    // JPEG must not be embedded as DeviceGray+DCTDecode (PDFKit SOF bug).
    expect(pdfText).not.toMatch(
      /\/ColorSpace\s*\/DeviceGray[\s\S]{0,120}\/Filter\s*\/DCTDecode/,
    );
    expect(pdfText).toContain('/Subtype /Image');
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
