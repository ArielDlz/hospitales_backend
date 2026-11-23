import {
  buildInformeExtendidoFilename,
  buildInformeFirmadoFilename,
  buildInformeFirmadoS3Key,
  filenameFromInformeUrl,
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

  describe('filenameFromInformeUrl', () => {
    it('toma el nombre del objeto en S3', () => {
      expect(
        filenameFromInformeUrl(
          'https://bucket.s3.amazonaws.com/informes-firmados/hospital-general/cardiologia/asp-uuid-1/PEGJ880527HDFRRL09_2_A_25_2027.pdf',
        ),
      ).toBe('PEGJ880527HDFRRL09_2_A_25_2027.pdf');
    });

    it('conserva el nombre de un informe extendido', () => {
      expect(
        filenameFromInformeUrl(
          'https://bucket.s3.amazonaws.com/informes-firmados/PEGJ880527HDFRRL09_2_A_25_2027_extendido_20260926T201500.pdf',
        ),
      ).toBe('PEGJ880527HDFRRL09_2_A_25_2027_extendido_20260926T201500.pdf');
    });
  });

  describe('buildInformeFirmadoFilename', () => {
    it('arma CURP_2_{A|N}_25_2027.pdf', () => {
      expect(
        buildInformeFirmadoFilename('PEGJ880527HDFRRL09', 'aceptado', 'Aceptado'),
      ).toBe('PEGJ880527HDFRRL09_2_A_25_2027.pdf');
      expect(
        buildInformeFirmadoFilename('PEGJ880527HDFRRL09', 'no_aceptado', 'No Aceptado'),
      ).toBe('PEGJ880527HDFRRL09_2_N_25_2027.pdf');
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
      ).toBe('PEGJ880527HDFRRL09_2_A_25_2027_extendido_20260926T201500.pdf');
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
    const filename = 'PEGJ880527HDFRRL09_2_A_25_2027.pdf';
    const aspiranteId = 'asp-uuid-1';

    it('arma informes-firmados/{slug}/{especialidad}/{aspiranteId}/{filename}', () => {
      expect(
        buildInformeFirmadoS3Key({
          slug: 'hospital-general',
          especialidad: 'Medicina Interna',
          aspiranteId,
          filename,
        }),
      ).toBe(
        `informes-firmados/hospital-general/medicina-interna/${aspiranteId}/${filename}`,
      );
    });

    it('usa sin-especialidad si especialidad está vacía', () => {
      expect(
        buildInformeFirmadoS3Key({
          slug: 'hospital-general',
          especialidad: null,
          aspiranteId,
          filename,
        }),
      ).toBe(
        `informes-firmados/hospital-general/sin-especialidad/${aspiranteId}/${filename}`,
      );
      expect(
        buildInformeFirmadoS3Key({
          slug: 'hospital-general',
          especialidad: '   ',
          aspiranteId,
          filename,
        }),
      ).toBe(
        `informes-firmados/hospital-general/sin-especialidad/${aspiranteId}/${filename}`,
      );
    });

    it('separa dos aspirantes con el mismo CURP', () => {
      const first = buildInformeFirmadoS3Key({
        slug: 'hospital-general',
        especialidad: 'Cardiología',
        aspiranteId: 'asp-ronda-1',
        filename,
      });
      const second = buildInformeFirmadoS3Key({
        slug: 'hospital-general',
        especialidad: 'Cardiología',
        aspiranteId: 'asp-ronda-2',
        filename,
      });
      expect(first).not.toBe(second);
    });

    it('rechaza un aspiranteId vacío', () => {
      expect(() =>
        buildInformeFirmadoS3Key({
          slug: 'hospital-general',
          especialidad: 'Cardiología',
          aspiranteId: '   ',
          filename,
        }),
      ).toThrow('aspiranteId is required for the signed informe key');
    });
  });
});
