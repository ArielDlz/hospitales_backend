import {
  buildInformeFirmadoFilename,
  resolveVeredictoInicial,
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

    it('devuelve N para no aceptado', () => {
      expect(resolveVeredictoInicial('no_aceptado', 'No Aceptado')).toBe('N');
      expect(resolveVeredictoInicial('no_apto', 'No apto')).toBe('N');
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
});
