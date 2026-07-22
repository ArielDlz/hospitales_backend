import { resolveResultadoPerfilKey } from './informe-pdf.utils';

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim();
}

/** A = Aceptado (incluye con reservas); N = No aceptado. */
export function resolveVeredictoInicial(
  codigo?: string | null,
  etiqueta?: string | null,
): 'A' | 'N' {
  return resolveResultadoPerfilKey(codigo ?? undefined, etiqueta ?? undefined) ===
    'no_aceptado'
    ? 'N'
    : 'A';
}

/**
 * Signed informe S3 filename:
 * `{CURP}_1_{veredicto_inicial}_25_2027.pdf`
 * CURP from aspirante.documento; veredicto_inicial is A or N.
 */
export function buildInformeFirmadoFilename(
  documento: string | null | undefined,
  veredictoCodigo?: string | null,
  veredictoEtiqueta?: string | null,
): string {
  const curp = sanitizeFilenamePart(documento ?? '');
  const inicial = resolveVeredictoInicial(veredictoCodigo, veredictoEtiqueta);
  return `${curp}_1_${inicial}_25_2027.pdf`;
}

export function filenameFromInformeUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').pop();
    return last ? decodeURIComponent(last) : 'informe-firmado.pdf';
  } catch {
    return 'informe-firmado.pdf';
  }
}

export function resolveInformeFirmadoFilename(params: {
  documento: string | null | undefined;
  veredictoCodigo?: string | null;
  veredictoEtiqueta?: string | null;
  veredictoInformeUrl: string;
}): string {
  if (params.documento?.trim()) {
    return buildInformeFirmadoFilename(
      params.documento,
      params.veredictoCodigo,
      params.veredictoEtiqueta,
    );
  }
  return filenameFromInformeUrl(params.veredictoInformeUrl);
}

/** RFC 5987-friendly Content-Disposition for filenames with spaces/accents. */
export function buildContentDispositionAttachment(filename: string): string {
  const asciiFallback = filename
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/\\/g, '_')
    .replace(/"/g, "'");
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
