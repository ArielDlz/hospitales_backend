export type PrimerAccesoEmailVariant = 'invitacion' | 'recordatorio';

export interface PrimerAccesoEmailParams {
  nombre: string;
  apellidos: string;
  telefono: string | null;
  registroHospital: string;
  activacionUrl: string;
  variant?: PrimerAccesoEmailVariant;
  /** hospitales.acceso_abre_at. Invitation copy uses the Mexico City calendar day. */
  accesoAbreAt?: Date | string | null;
}

export interface PrimerAccesoEmailContent {
  subject: string;
  html: string;
  text: string;
}

const SUBJECT =
  'Confirma tu registro a la plataforma de pruebas psicométricas';

const PLATFORM_TITLE =
  'Plataforma de pruebas psicométricas de Psique y Cultura';

const INTRO_INVITACION_SELECCION =
  'Has sido seleccionado para continuar con tu proceso de selección. Continuarás con la evaluación psicométrica de Psique y Cultura.';

const INTRO_INVITACION_CTA =
  'Para activar tu cuenta y establecer tu contraseña, haz clic en el siguiente enlace:';

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** acceso_abre_at is an absolute instant; the email states the local opening day. */
const APERTURA_TIME_ZONE = 'America/Mexico_City';

export function formatFechaAperturaPlataforma(
  value: Date | string | null | undefined,
): string | null {
  if (value == null || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APERTURA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);

  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;
  const monthName = month ? MESES_ES[Number(month) - 1] : undefined;
  if (!day || !monthName || !year) {
    return null;
  }

  return `${day} de ${monthName} de ${year}`;
}

function buildIntroInvitacion(accesoAbreAt?: Date | string | null): string {
  const fecha = formatFechaAperturaPlataforma(accesoAbreAt);
  if (!fecha) {
    return `${INTRO_INVITACION_SELECCION} ${INTRO_INVITACION_CTA}`;
  }

  return `${INTRO_INVITACION_SELECCION} Por favor ten en cuenta que la plataforma se habilitará al iniciar el día ${fecha}. ${INTRO_INVITACION_CTA}`;
}

const INTRO_RECORDATORIO =
  'Notamos que aún no has ingresado a la plataforma a realizar tu proceso de evaluación psicométrica, este mensaje es un recordatorio, ya que el proceso está a punto de concluir. Por favor activa tu cuenta accediendo desde el siguiente botón:';

const SUPPORT_LINE =
  'Si tienes dudas o presentaste algún problema por favor comunícate vía whatsApp al +525527592438.';

export function buildPrimerAccesoEmail(
  params: PrimerAccesoEmailParams,
): PrimerAccesoEmailContent {
  const {
    nombre,
    apellidos,
    telefono,
    registroHospital,
    activacionUrl,
    variant = 'invitacion',
    accesoAbreAt,
  } = params;

  const telefonoDisplay = telefono?.trim() || 'No indicado';
  const isRecordatorio = variant === 'recordatorio';
  const intro = isRecordatorio
    ? INTRO_RECORDATORIO
    : buildIntroInvitacion(accesoAbreAt);

  const text = [
    PLATFORM_TITLE,
    '',
    `Hola, ${nombre}`,
    '',
    intro,
    ...(isRecordatorio ? ['', SUPPORT_LINE] : []),
    '',
    activacionUrl,
    '',
    'Aquí están los datos que servirán para que puedas completar tu registro:',
    '',
    `Nombre(s): ${nombre}`,
    `Apellido(s): ${apellidos}`,
    `Teléfono: ${telefonoDisplay}`,
    `Número de registro: ${registroHospital}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background-color:#1e3a5f;padding:24px 32px;">
              <h1 style="margin:0;font-size:18px;font-weight:600;color:#ffffff;line-height:1.4;text-align:center;">
                ${escapeHtml(PLATFORM_TITLE)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hola, ${escapeHtml(nombre)}</p>
              <p style="margin:0 0 ${isRecordatorio ? '16' : '24'}px;font-size:16px;line-height:1.5;">
                ${escapeHtml(intro)}
              </p>
              ${
                isRecordatorio
                  ? `<p style="margin:0 0 24px;font-size:16px;line-height:1.5;">
                ${escapeHtml(SUPPORT_LINE)}
              </p>`
                  : ''
              }
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 32px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="border-radius:6px;background-color:#2563eb;">
                          <a href="${escapeHtml(activacionUrl)}" target="_blank" rel="noopener noreferrer"
                             style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">
                            Activar mi cuenta
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:16px;line-height:1.5;font-weight:600;">
                Aquí están los datos que servirán para que puedas completar tu registro:
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;font-size:15px;line-height:1.6;">
                <tr>
                  <td style="padding:4px 0;color:#4b5563;width:140px;vertical-align:top;">Nombre(s)</td>
                  <td style="padding:4px 0;">${escapeHtml(nombre)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#4b5563;vertical-align:top;">Apellido(s)</td>
                  <td style="padding:4px 0;">${escapeHtml(apellidos)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#4b5563;vertical-align:top;">Teléfono</td>
                  <td style="padding:4px 0;">${escapeHtml(telefonoDisplay)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#4b5563;vertical-align:top;">Número de registro</td>
                  <td style="padding:4px 0;">${escapeHtml(registroHospital)}</td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#4b5563;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;">
                <a href="${escapeHtml(activacionUrl)}" style="color:#2563eb;">${escapeHtml(activacionUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                Correo automático. Por favor no respondas a este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: SUBJECT, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
