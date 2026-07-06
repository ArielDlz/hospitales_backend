export function buildInformeFirmadoFilename(
  registroHospital: string,
  nombreCompleto: string,
  hospitalNombre: string,
): string {
  const sanitize = (value: string) =>
    value
      .replace(/[/\\?%*:|"<>]/g, '')
      .replace(/[\x00-\x1f\x7f]/g, '')
      .trim();

  const registro = sanitize(registroHospital);
  const aspirante = sanitize(nombreCompleto);
  const hospital = sanitize(hospitalNombre);

  return `${registro} - ${aspirante} - ${hospital}.pdf`;
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
  registroHospital: string;
  nombre: string;
  apellidos: string;
  hospitalNombre: string | null;
  veredictoInformeUrl: string;
}): string {
  if (params.hospitalNombre?.trim()) {
    const nombreCompleto = `${params.nombre} ${params.apellidos}`.trim();
    return buildInformeFirmadoFilename(
      params.registroHospital,
      nombreCompleto,
      params.hospitalNombre,
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
