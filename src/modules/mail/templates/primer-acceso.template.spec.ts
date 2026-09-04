import { buildPrimerAccesoEmail } from './primer-acceso.template';

describe('buildPrimerAccesoEmail', () => {
  it('should use fixed subject and include aspirante data (invitacion default)', () => {
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
    expect(html).toContain(
      'Has sido seleccionado para continuar con tu proceso de selección. Continuarás con la evaluación psicométrica de Psique y Cultura.',
    );
    expect(html).toContain(
      'Para activar tu cuenta y establecer tu contraseña, haz clic en el siguiente enlace:',
    );
    expect(html).toContain('29 de agosto de 2026');
    expect(html).not.toContain('Por favor completa tu registro');
    expect(html).not.toContain(
      'Notamos que aún no has ingresado a la plataforma',
    );
    expect(html).toContain('REG-2024-001');
    expect(html).toContain('Activar mi cuenta');
    expect(text).toContain(
      'Has sido seleccionado para continuar con tu proceso de selección. Continuarás con la evaluación psicométrica de Psique y Cultura. Por favor ten en cuenta que la plataforma se habilitará al iniciar el día 29 de agosto de 2026. Para activar tu cuenta y establecer tu contraseña, haz clic en el siguiente enlace:',
    );
    expect(text).toContain('García López');
    expect(text).toContain('5551234567');
  });

  it('should use recordatorio intro copy with same subject and CTA', () => {
    const { subject, html, text } = buildPrimerAccesoEmail({
      nombre: 'Juan',
      apellidos: 'García López',
      telefono: '5551234567',
      registroHospital: 'REG-2024-001',
      activacionUrl: 'https://h.example.com/confirmar?token=1',
      variant: 'recordatorio',
    });

    expect(subject).toBe(
      'Confirma tu registro a la plataforma de pruebas psicométricas',
    );
    expect(html).toContain('Hola, Juan');
    expect(html).toContain(
      'Notamos que aún no has ingresado a la plataforma a realizar tu proceso de evaluación psicométrica, este mensaje es un recordatorio, ya que el proceso está a punto de concluir. Por favor activa tu cuenta accediendo desde el siguiente botón:',
    );
    expect(html).toContain('Activar mi cuenta');
    expect(html).toContain('REG-2024-001');
    expect(html).not.toContain('29 de agosto de 2026');
    expect(html).not.toContain(
      'Has sido seleccionado para continuar con tu proceso de selección',
    );
    expect(text).toContain(
      'Notamos que aún no has ingresado a la plataforma a realizar tu proceso de evaluación psicométrica',
    );
    expect(text).toContain('Este enlace caduca en 7 días.');
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
