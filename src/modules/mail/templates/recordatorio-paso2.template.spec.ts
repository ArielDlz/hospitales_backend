import { buildRecordatorioPaso2Email } from './recordatorio-paso2.template';

describe('buildRecordatorioPaso2Email', () => {
  it('should include subject, body, WhatsApp and login CTA', () => {
    const { subject, html, text } = buildRecordatorioPaso2Email({
      nombre: 'Juan',
      loginUrl: 'https://hospital-test.arieldelao.dev/login',
    });

    expect(subject).toBe(
      'El periodo de evaluación psicométrica está por finalizar.',
    );
    expect(html).toContain('Hola, Juan');
    expect(html).toContain('no has avanzado en el proceso de evaluaciones psicométricas');
    expect(html).toContain('Presentar pruebas');
    expect(html).toContain('https://hospital-test.arieldelao.dev/login');
    expect(html).toContain('+525527592438');
    expect(html).toContain(
      'Estamos para apoyarte a que concluyas tus pruebas de manera exitosa.',
    );
    expect(text).toContain('no has avanzado en el proceso');
    expect(text).toContain('+525527592438');
  });
});
