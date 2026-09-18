export function findFolderIdByNameCaseInsensitive(
  folders: ReadonlyArray<{ id?: string | null; name?: string | null }>,
  name: string,
): string | null {
  const target = name.trim().toLowerCase();
  if (!target) {
    return null;
  }
  const match = folders.find(
    (folder) => (folder.name ?? '').trim().toLowerCase() === target,
  );
  return match?.id ?? null;
}
