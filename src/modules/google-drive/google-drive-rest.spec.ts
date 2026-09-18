import { listChildFolders, uploadPdf } from './google-drive-rest';

describe('google-drive-rest', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lista carpetas hijas con paginación', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          nextPageToken: 'p2',
          files: [{ id: '1', name: 'presencial' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [{ id: '2', name: 'en-linea' }],
        }),
      }) as unknown as typeof fetch;

    const folders = await listChildFolders('token', 'root');

    expect(folders).toEqual([
      { id: '1', name: 'presencial' },
      { id: '2', name: 'en-linea' },
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('sube PDF multipart y devuelve id + webViewLink', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'file-1',
        webViewLink: 'https://drive.google.com/file/d/file-1/view',
      }),
    }) as unknown as typeof fetch;

    const result = await uploadPdf({
      accessToken: 'token',
      parentId: 'folder-1',
      filename: 'CURP_Cardio_2026.pdf',
      buffer: Buffer.from('%PDF'),
    });

    expect(result).toEqual({
      fileId: 'file-1',
      webViewLink: 'https://drive.google.com/file/d/file-1/view',
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('uploadType=multipart');
    expect(init.headers.Authorization).toBe('Bearer token');
    expect(init.headers['Content-Type']).toMatch(/multipart\/related/);
  });
});
