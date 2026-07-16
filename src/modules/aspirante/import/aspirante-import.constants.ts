export const ASPIRANTE_IMPORT_MAX_ROWS = 500;

export const ASPIRANTE_IMPORT_HEADERS = [
  'registro_hospital',
  'documento',
  'especialidad',
  'modalidad',
  'nacionalidad',
  'apellidos',
  'nombre',
  'fecha_nacimiento',
  'genero',
  'email',
  'rfc',
  'telefono',
] as const;

export type AspiranteImportHeader = (typeof ASPIRANTE_IMPORT_HEADERS)[number];

export const ASPIRANTE_IMPORT_REQUIRED_HEADERS: AspiranteImportHeader[] = [
  'registro_hospital',
  'email',
  'apellidos',
  'nombre',
];
