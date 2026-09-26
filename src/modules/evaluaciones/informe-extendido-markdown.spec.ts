import { parseInformeExtendidoMarkdown } from './informe-extendido-markdown';

describe('parseInformeExtendidoMarkdown', () => {
  it('arma párrafos, encabezados, negritas, cursivas y viñetas', () => {
    const blocks = parseInformeExtendidoMarkdown(
      '# Título\n\nTexto **importante** e *itálica*.\n\n- Un punto\n- Otro',
    );

    expect(blocks).toEqual([
      {
        type: 'heading',
        level: 1,
        spans: [{ text: 'Título', bold: false, italic: false }],
      },
      {
        type: 'paragraph',
        spans: [
          { text: 'Texto ', bold: false, italic: false },
          { text: 'importante', bold: true, italic: false },
          { text: ' e ', bold: false, italic: false },
          { text: 'itálica', bold: false, italic: true },
          { text: '.', bold: false, italic: false },
        ],
      },
      {
        type: 'bullet',
        spans: [{ text: 'Un punto', bold: false, italic: false }],
      },
      {
        type: 'bullet',
        spans: [{ text: 'Otro', bold: false, italic: false }],
      },
    ]);
  });

  it('convierte enlaces en su etiqueta y descarta imágenes y tablas', () => {
    const blocks = parseInformeExtendidoMarkdown(
      'Ver [el hospital](https://example.com).\n\n![logo](https://example.com/a.png)\n\n| a | b |\n| --- | --- |\n| 1 | 2 |',
    );

    expect(blocks).toEqual([
      {
        type: 'paragraph',
        spans: [
          { text: 'Ver el hospital.', bold: false, italic: false },
        ],
      },
    ]);
  });
});
