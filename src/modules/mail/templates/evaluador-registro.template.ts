export interface EvaluadorRegistroEmailParams {
  nombre: string;
  password: string;
  loginUrl: string;
}

export interface EvaluadorRegistroEmailContent {
  subject: string;
  html: string;
  text: string;
}

const SUBJECT = 'Registro como evaluador - Psique y Cultura';

const PLATFORM_TITLE = 'Plataforma de Psique y Cultura';

export function buildEvaluadorRegistroEmail(
  params: EvaluadorRegistroEmailParams,
): EvaluadorRegistroEmailContent {
  const { nombre, password, loginUrl } = params;

  const text = [
    PLATFORM_TITLE,
    '',
    `Hola ${nombre},`,
    '',
    'Has sido registrado como evaluador en la plataforma de psique y cultura, aquí está tu contraseña de acceso:',
    password,
    '',
    'Accede ahora:',
    loginUrl,
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
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hola ${escapeHtml(nombre)},</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">
                Has sido registrado como evaluador en la plataforma de psique y cultura, aquí está tu contraseña de acceso:
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.5;font-weight:600;">${escapeHtml(password)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 32px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="border-radius:6px;background-color:#2563eb;">
                          <a href="${escapeHtml(loginUrl)}" target="_blank" rel="noopener noreferrer"
                             style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">
                            Accede ahora
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#4b5563;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;word-break:break-all;">
                <a href="${escapeHtml(loginUrl)}" style="color:#2563eb;">${escapeHtml(loginUrl)}</a>
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
