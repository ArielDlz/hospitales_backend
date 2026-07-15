import { ForbiddenException } from '@nestjs/common';

export const MSG_ACCESO_AUN_NO_ABIERTO = 'Todavía no se abre el acceso';
export const MSG_ACCESO_FINALIZADO =
  'El tiempo para aplicar las pruebas ha finalizado';

export type TenantAccessWindowHospital = {
  accesoAbreAt: Date | null;
  accesoCierraAt: Date | null;
};

/** True when accesoCierraAt is set and now is past that instant. */
export function isTenantAccessClosed(
  hospital: Pick<TenantAccessWindowHospital, 'accesoCierraAt'>,
  nowMs: number = Date.now(),
): boolean {
  if (hospital.accesoCierraAt == null) return false;
  return nowMs > hospital.accesoCierraAt.getTime();
}

/**
 * Fail open when dates are null. Enforce only bounds that exist.
 * - before open → "Todavía no se abre el acceso"
 * - after close → "El tiempo para aplicar las pruebas ha finalizado"
 */
export function assertTenantAccessWindow(
  hospital: TenantAccessWindowHospital,
  nowMs: number = Date.now(),
): void {
  if (
    hospital.accesoAbreAt != null &&
    nowMs < hospital.accesoAbreAt.getTime()
  ) {
    throw new ForbiddenException(MSG_ACCESO_AUN_NO_ABIERTO);
  }
  if (isTenantAccessClosed(hospital, nowMs)) {
    throw new ForbiddenException(MSG_ACCESO_FINALIZADO);
  }
}

/** Aspirante JWT TTL: 1h after close, otherwise 1d. */
export function resolveAspiranteJwtExpiresIn(
  hospital: Pick<TenantAccessWindowHospital, 'accesoCierraAt'>,
  nowMs: number = Date.now(),
): '1d' | '1h' {
  return isTenantAccessClosed(hospital, nowMs) ? '1h' : '1d';
}
