/** Closed when fechaCierre is set and now is past that instant. The exact instant stays open. */
export function isRondaClosed(
  fechaCierre: Date | string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (fechaCierre == null) return false;
  const time =
    fechaCierre instanceof Date
      ? fechaCierre.getTime()
      : new Date(fechaCierre).getTime();
  if (Number.isNaN(time)) return false;
  return nowMs > time;
}
