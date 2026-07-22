import {
  formatFechaInformeEspanol,
  formatFechaNacimientoParaInforme,
  mapGeneroParaInforme,
  resolveResultadoPerfilKey,
} from './informe-pdf.utils';

describe('informe-pdf.utils', () => {
  describe('resolveResultadoPerfilKey', () => {
    it('mapea aceptado por código o etiqueta', () => {
      expect(resolveResultadoPerfilKey('aceptado', 'Aceptado')).toBe('aceptado');
      expect(resolveResultadoPerfilKey('apto', 'Apto')).toBe('aceptado');
    });

    it('mapea aceptado con reservas', () => {
      expect(
        resolveResultadoPerfilKey(
          'aceptado_con_reservas',
          'Aceptado con reservas',
        ),
      ).toBe('aceptado_con_reservas');
      expect(resolveResultadoPerfilKey('apto_reservas', 'Apto con reservas')).toBe(
        'aceptado_con_reservas',
      );
    });

    it('mapea no aceptado', () => {
      expect(resolveResultadoPerfilKey('no_aceptado', 'No Aceptado')).toBe(
        'no_aceptado',
      );
      expect(resolveResultadoPerfilKey('no_apto', 'No apto')).toBe('no_aceptado');
    });
  });

  describe('formatFechaInformeEspanol', () => {
    it('formatea la fecha en español', () => {
      expect(
        formatFechaInformeEspanol(new Date(2025, 8, 18)),
      ).toBe('Informe elaborado el 18 de septiembre de 2025');
    });
  });

  describe('mapGeneroParaInforme', () => {
    it('mapea Hombre a Masculino y Mujer a Femenino', () => {
      expect(mapGeneroParaInforme('Hombre')).toBe('Masculino');
      expect(mapGeneroParaInforme('Mujer')).toBe('Femenino');
      expect(mapGeneroParaInforme('hombre')).toBe('Masculino');
      expect(mapGeneroParaInforme(null)).toBe('');
    });
  });

  describe('formatFechaNacimientoParaInforme', () => {
    it('conserva YYYY-MM-DD', () => {
      expect(formatFechaNacimientoParaInforme('1988-05-27')).toBe('1988-05-27');
      expect(formatFechaNacimientoParaInforme('1988-05-27T00:00:00.000Z')).toBe(
        '1988-05-27',
      );
      expect(formatFechaNacimientoParaInforme(null)).toBe('');
    });
  });
});
