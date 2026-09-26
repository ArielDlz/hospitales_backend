import {
  buildInformeDriveFilename,
  buildInformeExtendidoFilename,
  buildInformeFirmadoFilename,
  buildInformeFirmadoS3Key,
  resolveVeredictoInicial,
  slugifyPathSegment,
} from './informe-firmado-filename.util';

describe('informe-firmado-filename.util', () => {
  describe('resolveVeredictoInicial', () => {
    it('devuelve A para aceptado / apto', () => {
      expect(resolveVeredictoInicial('aceptado', 'Aceptado')).toBe('A');
      expect(resolveVeredictoInicial('apto', 'Apto')).toBe('A');
      expect(
        resolveVeredictoInicial('aceptado_con_reservas', 'Aceptado con reservas'),
      ).toBe('A');
    });

    it('devuelve N para no aceptado / rechazado', () => {
      expect(resolveVeredictoInicial('no_aceptado', 'No Aceptado')).toBe('N');
      expect(resolveVeredictoInicial('no_apto', 'No apto')).toBe('N');
      expect(resolveVeredictoInicial('rechazado', 'Rechazado')).toBe('N');
    });
  });

  describe('buildInformeDriveFilename', () => {
    it('arma CURP_especialidad_YYYY.pdf conservando acentos y espacios', () => {
      expect(
        buildInformeDriveFilename(
          'PEGJ880527HDFRRL09',
          'Medicina Interna',
          2026,
        ),
      ).toBe('PEGJ880527HDFRRL09_Medicina Interna_2026.pdf');
    });

    it('elimina caracteres ilegales de especialidad', () => {
      expect(
        buildInformeDriveFilename('PEGJ880527HDFRRL09', 'Cardio/Logía', 2026),
      ).toBe('PEGJ880527HDFRRL09_CardioLogía_2026.pdf');
    });
  });

  describe('buildInformeFirmadoFilename', () => {
    it('arma CURP_1_{A|N}_25_2027.pdf', () => {
      expect(
        buildInformeFirmadoFilename('PEGJ880527HDFRRL09', 'aceptado', 'Aceptado'),
      ).toBe('PEGJ880527HDFRRL09_1_A_25_2027.pdf');
      expect(
        buildInformeFirmadoFilename('PEGJ880527HDFRRL09', 'no_aceptado', 'No Aceptado'),
      ).toBe('PEGJ880527HDFRRL09_1_N_25_2027.pdf');
    });
  });

  describe('buildInformeExtendidoFilename', () => {
    it('agrega el sufijo extendido con timestamp UTC', () => {
      expect(
        buildInformeExtendidoFilename(
          'PEGJ880527HDFRRL09',
          'aceptado',
          'Aceptado',
          new Date('2026-09-26T20:15:00.000Z'),
        ),
      ).toBe('PEGJ880527HDFRRL09_1_A_25_2027_extendido_20260926T201500.pdf');
    });
  });

  describe('slugifyPathSegment', () => {
    it('quita acentos y pasa a minúsculas', () => {
      expect(slugifyPathSegment('Oftalmología')).toBe('oftalmologia');
    });

    it('reemplaza espacios por guiones', () => {
      expect(slugifyPathSegment('Medicina Interna')).toBe('medicina-interna');
    });
  });

  describe('buildInformeFirmadoS3Key', () => {
    const filename = 'PEGJ880527HDFRRL09_1_A_25_2027.pdf';

    it('arma informes-firmados/{slug}/{especialidad}/{filename}', () => {
      expect(
        buildInformeFirmadoS3Key({
          slug: 'hospital-general',
          especialidad: 'Medicina Interna',
          filename,
        }),
      ).toBe(
        `informes-firmados/hospital-general/medicina-interna/${filename}`,
      );
    });

    it('usa sin-especialidad si especialidad está vacía', () => {
      expect(
        buildInformeFirmadoS3Key({
          slug: 'hospital-general',
          especialidad: null,
          filename,
        }),
      ).toBe(
        `informes-firmados/hospital-general/sin-especialidad/${filename}`,
      );
      expect(
        buildInformeFirmadoS3Key({
          slug: 'hospital-general',
          especialidad: '   ',
          filename,
        }),
      ).toBe(
        `informes-firmados/hospital-general/sin-especialidad/${filename}`,
      );
    });
  });
});
