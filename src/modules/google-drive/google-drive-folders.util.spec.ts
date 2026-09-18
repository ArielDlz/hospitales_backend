import { findFolderIdByNameCaseInsensitive } from './google-drive-folders.util';

describe('findFolderIdByNameCaseInsensitive', () => {
  const folders = [
    { id: '1', name: 'presencial' },
    { id: '2', name: 'Medicina-Interna' },
  ];

  it('reusa la primera carpeta cuyo nombre coincide ignorando mayúsculas', () => {
    expect(findFolderIdByNameCaseInsensitive(folders, 'Presencial')).toBe('1');
    expect(findFolderIdByNameCaseInsensitive(folders, 'medicina-interna')).toBe(
      '2',
    );
  });

  it('devuelve null si no hay coincidencia', () => {
    expect(findFolderIdByNameCaseInsensitive(folders, 'en-linea')).toBeNull();
  });

  it('devuelve null si el nombre objetivo está vacío', () => {
    expect(findFolderIdByNameCaseInsensitive(folders, '  ')).toBeNull();
  });
});
