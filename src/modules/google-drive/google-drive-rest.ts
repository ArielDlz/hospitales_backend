const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type DriveFolder = { id?: string | null; name?: string | null };

export class GoogleDriveHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleDriveHttpError';
  }
}

async function driveJson<T>(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new GoogleDriveHttpError(
      res.status,
      `Google Drive HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`,
    );
  }
  return (await res.json()) as T;
}

export async function getAboutEmail(accessToken: string): Promise<string | null> {
  const data = await driveJson<{ user?: { emailAddress?: string } }>(
    accessToken,
    `${DRIVE_API}/about?fields=user(emailAddress)`,
  );
  return data.user?.emailAddress ?? null;
}

export async function listChildFolders(
  accessToken: string,
  parentId: string,
): Promise<DriveFolder[]> {
  const folders: DriveFolder[] = [];
  let pageToken: string | undefined;
  const escapedParent = parentId.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `'${escapedParent}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
  );

  do {
    const page = pageToken
      ? `&pageToken=${encodeURIComponent(pageToken)}`
      : '';
    const data = await driveJson<{
      nextPageToken?: string;
      files?: DriveFolder[];
    }>(
      accessToken,
      `${DRIVE_API}/files?q=${q}&fields=nextPageToken,files(id,name)&pageSize=1000&spaces=drive${page}`,
    );
    folders.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return folders;
}

export async function createFolder(
  accessToken: string,
  parentId: string,
  name: string,
): Promise<string> {
  const data = await driveJson<{ id?: string }>(
    accessToken,
    `${DRIVE_API}/files?fields=id,name`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        parents: [parentId],
      }),
    },
  );
  const id = data.id?.trim();
  if (!id) {
    throw new Error('Google Drive no pudo crear la carpeta');
  }
  return id;
}

export async function uploadPdf(params: {
  accessToken: string;
  parentId: string;
  filename: string;
  buffer: Buffer;
}): Promise<{ fileId: string; webViewLink: string }> {
  const boundary = `hospitales_drive_${Date.now()}`;
  const metadata = JSON.stringify({
    name: params.filename,
    parents: [params.parentId],
  });
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
  );
  const closing = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([preamble, params.buffer, closing]);

  const data = await driveJson<{ id?: string; webViewLink?: string }>(
    params.accessToken,
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const fileId = data.id?.trim();
  const webViewLink = data.webViewLink?.trim();
  if (!fileId || !webViewLink) {
    throw new Error('Google Drive no devolvió el archivo subido');
  }
  return { fileId, webViewLink };
}
