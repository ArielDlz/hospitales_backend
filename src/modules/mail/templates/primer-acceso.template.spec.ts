import { buildPrimerAccesoEmail } from './primer-acceso.template';

describe('buildPrimerAccesoEmail', () => {
  it('should use fixed subject and include aspirante data', () => {
    const { subject, html, text } = buildPrimerAccesoEmail({
      nombre: 'Juan',
      apellidos: 'García López',
      telefono: '5551234567',
      registroHospital: 'REG-2024-001',
      activacionUrl: 'https://h.example.com/confirmar?token=1',
    });

    expect(subject).toBe(
      'Confirma tu registro a la plataforma de pruebas psicométricas',
    );
    expect(html).toContain('Plataforma de pruebas psicométricas de Psique y Cultura');
    expect(html).toContain('Hola, Juan');
    expect(html).toContain('REG-2024-001');
    expect(html).toContain('Activar mi cuenta');
    expect(text).toContain('García López');
    expect(text).toContain('5551234567');
  });

  it('should show placeholder when telefono is null', () => {
    const { html, text } = buildPrimerAccesoEmail({
      nombre: 'Ana',
      apellidos: 'Pérez',
      telefono: null,
      registroHospital: 'REG-1',
      activacionUrl: 'https://example.com',
    });

    expect(html).toContain('No indicado');
    expect(text).toContain('Teléfono: No indicado');
  });
});
