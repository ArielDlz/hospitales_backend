import {
  buildPrimerAccesoEmail,
  formatFechaAperturaPlataforma,
} from './primer-acceso.template';

const ACCESO_ABRE_AT = '2026-11-06 00:00:00.000 -0600';
const FECHA_APERTURA = '06 de noviembre de 2026';
const INTRO_INVITACION = `Has sido seleccionado para continuar con tu proceso de selección. Continuarás con la evaluación psicométrica de Psique y Cultura. Por favor ten en cuenta que la plataforma se habilitará al iniciar el día ${FECHA_APERTURA}. Para activar tu cuenta y establecer tu contraseña, haz clic en el siguiente enlace:`;

describe('formatFechaAperturaPlataforma', () => {
  it('formats acceso_abre_at as the Mexico City calendar day', () => {
    expect(formatFechaAperturaPlataforma(ACCESO_ABRE_AT)).toBe(FECHA_APERTURA);
    expect(
      formatFechaAperturaPlataforma(new Date('2026-11-06T06:00:00.000Z')),
    ).toBe(FECHA_APERTURA);
  });

  it('keeps the local day when the instant is already the next UTC date', () => {
    expect(formatFechaAperturaPlataforma('2026-11-06 22:00:00.000 -0600')).toBe(
      FECHA_APERTURA,
    );
  });

  it('returns null when the hospital has no opening instant', () => {
    expect(formatFechaAperturaPlataforma(null)).toBeNull();
    expect(formatFechaAperturaPlataforma(undefined)).toBeNull();
    expect(formatFechaAperturaPlataforma('')).toBeNull();
    expect(formatFechaAperturaPlataforma('no-es-fecha')).toBeNull();
  });
});

describe('buildPrimerAccesoEmail', () => {
  it('should use fixed subject and include aspirante data (invitacion default)', () => {
    const { subject, html, text } = buildPrimerAccesoEmail({
      nombre: 'Juan',
      apellidos: 'García López',
      telefono: '5551234567',
      registroHospital: 'REG-2024-001',
      activacionUrl: 'https://h.example.com/confirmar?token=1',
      accesoAbreAt: ACCESO_ABRE_AT,
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
    expect(html).toContain(FECHA_APERTURA);
    expect(html).not.toContain('29 de agosto de 2026');
    expect(html).not.toContain('Por favor completa tu registro');
    expect(html).not.toContain(
      'Notamos que aún no has ingresado a la plataforma',
    );
    expect(html).toContain('REG-2024-001');
    expect(html).toContain('Activar mi cuenta');
    expect(text).toContain(INTRO_INVITACION);
    expect(html).toContain(INTRO_INVITACION);
    expect(text).toContain('García López');
    expect(text).toContain('5551234567');
    expect(html).not.toContain('Este enlace caduca');
    expect(html).not.toContain('puedes ignorar este correo');
    expect(text).not.toContain('Este enlace caduca');
    expect(text).not.toContain('puedes ignorar este correo');
  });

  it('should use recordatorio intro copy with same subject and CTA', () => {
    const { subject, html, text } = buildPrimerAccesoEmail({
      nombre: 'Juan',
      apellidos: 'García López',
      telefono: '5551234567',
      registroHospital: 'REG-2024-001',
      activacionUrl: 'https://h.example.com/confirmar?token=1',
      variant: 'recordatorio',
      accesoAbreAt: ACCESO_ABRE_AT,
    });

    expect(subject).toBe(
      'Confirma tu registro a la plataforma de pruebas psicométricas',
    );
    expect(html).toContain('Hola, Juan');
    expect(html).toContain(
      'Notamos que aún no has ingresado a la plataforma a realizar tu proceso de evaluación psicométrica, este mensaje es un recordatorio, ya que el proceso está a punto de concluir. Por favor activa tu cuenta accediendo desde el siguiente botón:',
    );
    expect(html).toContain('Activar mi cuenta');
    expect(html).toContain('+525527592438');
    expect(html).toContain(
      'Si tienes dudas o presentaste algún problema por favor comunícate vía whatsApp al +525527592438.',
    );
    expect(text).toContain('+525527592438');
    expect(html).toContain('REG-2024-001');
    expect(html).not.toContain(FECHA_APERTURA);
    expect(html).not.toContain('29 de agosto de 2026');
    expect(html).not.toContain('se habilitará al iniciar el día');
    expect(html).not.toContain(
      'Has sido seleccionado para continuar con tu proceso de selección',
    );
    expect(text).toContain(
      'Notamos que aún no has ingresado a la plataforma a realizar tu proceso de evaluación psicométrica',
    );
    expect(html).not.toContain('Este enlace caduca');
    expect(html).not.toContain('puedes ignorar este correo');
    expect(text).not.toContain('Este enlace caduca');
    expect(text).not.toContain('puedes ignorar este correo');
  });

  it('should omit the opening-day sentence when acceso_abre_at is missing', () => {
    const { html, text } = buildPrimerAccesoEmail({
      nombre: 'Juan',
      apellidos: 'García López',
      telefono: '5551234567',
      registroHospital: 'REG-2024-001',
      activacionUrl: 'https://h.example.com/confirmar?token=1',
      accesoAbreAt: null,
    });

    const introSinFecha =
      'Has sido seleccionado para continuar con tu proceso de selección. Continuarás con la evaluación psicométrica de Psique y Cultura. Para activar tu cuenta y establecer tu contraseña, haz clic en el siguiente enlace:';

    expect(text).toContain(introSinFecha);
    expect(html).toContain(introSinFecha);
    expect(html).not.toContain('se habilitará al iniciar el día');
    expect(html).not.toContain('29 de agosto de 2026');
  });

  it('should omit the WhatsApp support line on the invitation', () => {
    const { html, text } = buildPrimerAccesoEmail({
      nombre: 'Juan',
      apellidos: 'García López',
      telefono: '5551234567',
      registroHospital: 'REG-2024-001',
      activacionUrl: 'https://h.example.com/confirmar?token=1',
      accesoAbreAt: ACCESO_ABRE_AT,
    });

    expect(html).not.toContain('+525527592438');
    expect(text).not.toContain('+525527592438');
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
