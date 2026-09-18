export function parseEnabledTenantIds(raw: string | undefined | null): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
}

export function isTenantDriveEnabled(
  tenantId: string,
  enabledTenantIds: string[],
): boolean {
  return enabledTenantIds.includes(tenantId.trim().toLowerCase());
}
