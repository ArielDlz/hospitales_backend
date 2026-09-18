import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import { isTenantDriveEnabled } from './google-drive-tenants';

export type EnviarAlHospitalAspiranteFields = {
  tenantId: string;
  veredictoInforme: string | null | undefined;
  modalidad: string | null | undefined;
  especialidad: string | null | undefined;
  documento: string | null | undefined;
  googleDriveFileId: string | null | undefined;
  googleDriveFileUrl: string | null | undefined;
  enviadoAlHospitalAt: Date | null | undefined;
};

export type EnviarAlHospitalFlags = {
  canEnviarAlHospital: boolean;
  enviadoAlHospital: boolean;
  googleDriveFileId: string | null;
  googleDriveFileUrl: string | null;
  enviadoAlHospitalAt: Date | null;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function isEnviadoAlHospital(
  aspirante: Pick<
    EnviarAlHospitalAspiranteFields,
    'googleDriveFileId' | 'enviadoAlHospitalAt'
  >,
): boolean {
  return (
    hasText(aspirante.googleDriveFileId) ||
    aspirante.enviadoAlHospitalAt != null
  );
}

export function buildEnviarAlHospitalFlags(
  aspirante: EnviarAlHospitalAspiranteFields,
  rol: RolUsuarioAdmin,
  enabledTenantIds: string[],
): EnviarAlHospitalFlags {
  const enviadoAlHospital = isEnviadoAlHospital(aspirante);
  const canEnviarAlHospital =
    rol === RolUsuarioAdmin.Administrador &&
    isTenantDriveEnabled(aspirante.tenantId, enabledTenantIds) &&
    hasText(aspirante.veredictoInforme) &&
    hasText(aspirante.modalidad) &&
    hasText(aspirante.especialidad) &&
    hasText(aspirante.documento) &&
    !enviadoAlHospital;

  return {
    canEnviarAlHospital,
    enviadoAlHospital,
    googleDriveFileId: aspirante.googleDriveFileId?.trim() || null,
    googleDriveFileUrl: aspirante.googleDriveFileUrl?.trim() || null,
    enviadoAlHospitalAt: aspirante.enviadoAlHospitalAt ?? null,
  };
}
