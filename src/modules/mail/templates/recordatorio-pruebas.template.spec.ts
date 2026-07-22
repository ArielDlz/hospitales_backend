import { buildRecordatorioPruebasEmail } from './recordatorio-pruebas.template';

describe('buildRecordatorioPruebasEmail', () => {
  it('should include subject, greeting, WhatsApp and login CTA without registration data', () => {
    const { subject, html, text } = buildRecordatorioPruebasEmail({
      nombre: 'Juan',
      loginUrl: 'https://hospital-test.arieldelao.dev/login',
    });

    expect(subject).toBe(
      'Tiene evaluaciones pendientes y el plazo está por finalizar.',
    );
    expect(html).toContain('Hola, Juan');
    expect(html).toContain('Ir a mis pruebas');
    expect(html).toContain('https://hospital-test.arieldelao.dev/login');
    expect(html).toContain('+525527592438');
    expect(html).not.toContain('Número de registro');
    expect(html).not.toContain('Apellido(s)');
    expect(text).toContain('evaluaciones que no has realizado o están incompletas');
    expect(text).toContain('+525527592438');
  });
});
