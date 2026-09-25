export interface RecordatorioPaso2EmailParams {
  nombre: string;
  loginUrl: string;
}

export interface RecordatorioPaso2EmailContent {
  subject: string;
  html: string;
  text: string;
}

const SUBJECT =
  'El periodo de evaluación psicométrica está por finalizar.';

const PLATFORM_TITLE =
  'Plataforma de pruebas psicométricas de Psique y Cultura';

const BODY =
  'Notamos que no has avanzado en el proceso de evaluaciones psicométricas, el periodo establecido para finalizar las pruebas está por llegar a su fin. La plataforma se bloqueará y no podrás realizar tus pruebas una vez que el periodo establecido por el Hospital llegue a su fin.';

const SUPPORT_LINE =
  'Si tienes dudas o presentaste algún problema por favor comunícate vía whatsApp al +525527592438.';

const CLOSING =
  'Estamos para apoyarte a que concluyas tus pruebas de manera exitosa.';

const BUTTON_LABEL = 'Presentar pruebas';

export function buildRecordatorioPaso2Email(
  params: RecordatorioPaso2EmailParams,
): RecordatorioPaso2EmailContent {
  const { nombre, loginUrl } = params;

  const text = [
    PLATFORM_TITLE,
    '',
    `Hola, ${nombre}`,
    '',
    BODY,
    '',
    SUPPORT_LINE,
    '',
    CLOSING,
    '',
    `${BUTTON_LABEL}:`,
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
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hola, ${escapeHtml(nombre)}</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">
                ${escapeHtml(BODY)}
              </p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">
                ${escapeHtml(SUPPORT_LINE)}
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">
                ${escapeHtml(CLOSING)}
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 32px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="border-radius:6px;background-color:#2563eb;">
                          <a href="${escapeHtml(loginUrl)}" target="_blank" rel="noopener noreferrer"
                             style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">
                            ${escapeHtml(BUTTON_LABEL)}
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
