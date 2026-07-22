export type ResultadoPerfilKey =
  | 'aceptado'
  | 'aceptado_con_reservas'
  | 'no_aceptado';

export const RESULTADO_PERFIL_OPTIONS: ReadonlyArray<{
  key: ResultadoPerfilKey;
  label: string;
  fillColor: string;
}> = [
  { key: 'aceptado', label: 'Aceptado', fillColor: '#16A34A' },
  {
    key: 'aceptado_con_reservas',
    label: 'Aceptado con reservas',
    fillColor: '#EAB308',
  },
  { key: 'no_aceptado', label: 'No Aceptado', fillColor: '#DC2626' },
];

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
];

export function resolveResultadoPerfilKey(
  codigo?: string,
  etiqueta?: string,
): ResultadoPerfilKey {
  const raw = `${codigo ?? ''} ${etiqueta ?? ''}`.toLowerCase();
  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (/no[\s_-]*(acept|apto)/.test(normalized)) {
    return 'no_aceptado';
  }
  if (/reserv/.test(normalized)) {
    return 'aceptado_con_reservas';
  }
  return 'aceptado';
}

export function formatFechaInformeEspanol(date: Date): string {
  return `Informe elaborado el ${date.getDate()} de ${MESES_ES[date.getMonth()]} de ${date.getFullYear()}`;
}

/** Maps DB genero (Hombre/Mujer) to informe labels (Masculino/Femenino). */
export function mapGeneroParaInforme(
  genero: string | null | undefined,
): string {
  if (!genero?.trim()) {
    return '';
  }
  const normalized = genero.trim().toLowerCase();
  if (normalized === 'hombre') {
    return 'Masculino';
  }
  if (normalized === 'mujer') {
    return 'Femenino';
  }
  return genero.trim();
}

/** Keeps fecha_nacimiento as YYYY-MM-DD for the PDF. */
export function formatFechaNacimientoParaInforme(
  fecha: string | Date | null | undefined,
): string {
  if (fecha == null || fecha === '') {
    return '';
  }
  const raw = typeof fecha === 'string' ? fecha : String(fecha);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (match) {
    return match[1];
  }
  if (fecha instanceof Date && !Number.isNaN(fecha.getTime())) {
    const y = fecha.getUTCFullYear();
    const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const d = String(fecha.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}
