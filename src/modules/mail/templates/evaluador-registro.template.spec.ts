import { buildEvaluadorRegistroEmail } from './evaluador-registro.template';

describe('buildEvaluadorRegistroEmail', () => {
  it('should include nombre, password and login button', () => {
    const { subject, html, text } = buildEvaluadorRegistroEmail({
      nombre: 'María',
      password: 'SecurePass123',
      loginUrl: 'https://admin.arieldelao.dev',
    });

    expect(subject).toBe('Registro como evaluador - Psique y Cultura');
    expect(html).toContain('Hola María,');
    expect(html).toContain('SecurePass123');
    expect(html).toContain('Accede ahora');
    expect(html).toContain('https://admin.arieldelao.dev');
    expect(text).toContain('Has sido registrado como evaluador');
    expect(text).toContain('SecurePass123');
  });
});
