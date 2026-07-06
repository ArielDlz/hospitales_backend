export const CM_TO_PT = 72 / 2.54;

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;

export const MARGIN_PT = 0.5 * CM_TO_PT;

export const BRAND_COLOR = '#00177D';
export const BRAND_COLOR_RGB: [number, number, number] = [0, 23, 125];
export const ACCENT_COLOR = '#0B7A7A';

export const DEFAULT_LOGO_URL =
  'https://hospitales-assets.s3.us-east-2.amazonaws.com/logos/psique_y_cultura.png';

export const WATERMARK_OPACITY = 0.15;
export const WATERMARK_SIZE_PT = 220;

export const HEADER_ORG_LINE =
  'Psique y Cultura, Asociación de Estudios Transdisciplinarios, A.C.';
export const HEADER_REPORT_TITLE = 'Informe de evaluación psicológica';
export const HEADER_REPORT_SUBTITLE =
  'para aspirantes a residencias médicas';

export const SIGNATURE_BLOCK_HEIGHT_PT = 5 * CM_TO_PT;

/** Space reserved at the bottom of every page for the page number. */
export const PAGE_NUMBER_BOTTOM_OFFSET_PT = 14;

export const RESULTADO_SECTION_TITLE = 'Resultado del perfil psicológico';
export const COMENTARIO_SECTION_TITLE = 'Resultado de la evaluación psicométrica';
export const ESPECIALISTA_RESPONSABLE_LABEL = 'Especialista responsable:';

/** Extra inset from the main content margin for the informe body text only. */
export const COMENTARIO_EXTRA_INSET_PT = 0.75 * CM_TO_PT;
/** Padding between the bordered box and the justified informe text. */
export const COMENTARIO_BOX_PADDING_PT = 0.5 * CM_TO_PT;

/** Fraction of content width used for the signature underline (centered). */
export const SIGNATURE_LINE_WIDTH_RATIO = 0.32;
