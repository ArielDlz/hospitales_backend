import { ForbiddenException } from '@nestjs/common';

export const MSG_ACCESO_AUN_NO_ABIERTO = 'Todavía no se abre el acceso';
export const MSG_ACCESO_FINALIZADO =
  'El tiempo para aplicar las pruebas ha finalizado';

/** Minimum evaluation_flow_steps.order_id allowed to take pruebas after acceso_cierra_at. */
export const MIN_FLOW_ORDER_AFTER_CLOSE = 3;

export type TenantAccessEstado = 'no_abierto' | 'abierto' | 'cerrado';

export type TenantAccessWindowHospital = {
  accesoAbreAt: Date | null;
  accesoCierraAt: Date | null;
};

/** True when accesoAbreAt is set and now is before that instant. */
export function isTenantAccessNotOpened(
  hospital: Pick<TenantAccessWindowHospital, 'accesoAbreAt'>,
  nowMs: number = Date.now(),
): boolean {
  if (hospital.accesoAbreAt == null) return false;
  return nowMs < hospital.accesoAbreAt.getTime();
}

/** True when accesoCierraAt is set and now is past that instant. */
export function isTenantAccessClosed(
  hospital: Pick<TenantAccessWindowHospital, 'accesoCierraAt'>,
  nowMs: number = Date.now(),
): boolean {
  if (hospital.accesoCierraAt == null) return false;
  return nowMs > hospital.accesoCierraAt.getTime();
}

/** Public UI status: not opened wins over closed when both bounds exist. */
export function resolveTenantAccessEstado(
  hospital: TenantAccessWindowHospital,
  nowMs: number = Date.now(),
): TenantAccessEstado {
  if (isTenantAccessNotOpened(hospital, nowMs)) return 'no_abierto';
  if (isTenantAccessClosed(hospital, nowMs)) return 'cerrado';
  return 'abierto';
}

/** Fail open when accesoAbreAt is null. Before open → MSG_ACCESO_AUN_NO_ABIERTO. */
export function assertTenantAccessOpened(
  hospital: Pick<TenantAccessWindowHospital, 'accesoAbreAt'>,
  nowMs: number = Date.now(),
): void {
  if (isTenantAccessNotOpened(hospital, nowMs)) {
    throw new ForbiddenException(MSG_ACCESO_AUN_NO_ABIERTO);
  }
}

/** Fail open when accesoCierraAt is null. After close → MSG_ACCESO_FINALIZADO. */
export function assertTenantNotClosed(
  hospital: Pick<TenantAccessWindowHospital, 'accesoCierraAt'>,
  nowMs: number = Date.now(),
): void {
  if (isTenantAccessClosed(hospital, nowMs)) {
    throw new ForbiddenException(MSG_ACCESO_FINALIZADO);
  }
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
  assertTenantAccessOpened(hospital, nowMs);
  assertTenantNotClosed(hospital, nowMs);
}

/**
 * After close, login is allowed only for aspirantes with orderId >= MIN_FLOW_ORDER_AFTER_CLOSE.
 * Call after credentials are validated.
 */
export function assertLoginAllowedAfterClose(
  hospital: Pick<TenantAccessWindowHospital, 'accesoCierraAt'>,
  evaluationFlowOrderId: number,
  nowMs: number = Date.now(),
): void {
  if (
    isTenantAccessClosed(hospital, nowMs) &&
    evaluationFlowOrderId < MIN_FLOW_ORDER_AFTER_CLOSE
  ) {
    throw new ForbiddenException(MSG_ACCESO_FINALIZADO);
  }
}

/** Aspirante JWT TTL: always 1d (paid aspirantes are not rushed after close). */
export function resolveAspiranteJwtExpiresIn(): '1d' {
  return '1d';
}
