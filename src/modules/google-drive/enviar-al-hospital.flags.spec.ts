import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import { buildEnviarAlHospitalFlags } from './enviar-al-hospital.flags';

const ENABLED = ['72ec5b8b-75e9-4956-b17d-85c946856a2d'];

const signed = {
  tenantId: '72ec5b8b-75e9-4956-b17d-85c946856a2d',
  veredictoInforme: 'https://s3.example/informe.pdf',
  modalidad: 'presencial',
  especialidad: 'Cardiología',
  documento: 'PEGJ880527HDFRRL09',
  googleDriveFileId: null as string | null,
  googleDriveFileUrl: null as string | null,
  enviadoAlHospitalAt: null as Date | null,
};

describe('buildEnviarAlHospitalFlags', () => {
  it('habilita el botón para administrador con informe firmado y datos completos', () => {
    const flags = buildEnviarAlHospitalFlags(
      signed,
      RolUsuarioAdmin.Administrador,
      ENABLED,
    );
    expect(flags.canEnviarAlHospital).toBe(true);
    expect(flags.enviadoAlHospital).toBe(false);
  });

  it('deshabilita el botón para evaluador', () => {
    expect(
      buildEnviarAlHospitalFlags(signed, RolUsuarioAdmin.Evaluador, ENABLED)
        .canEnviarAlHospital,
    ).toBe(false);
  });

  it('deshabilita el botón si el tenant no está en la lista', () => {
    expect(
      buildEnviarAlHospitalFlags(
        { ...signed, tenantId: 'other-tenant' },
        RolUsuarioAdmin.Administrador,
        ENABLED,
      ).canEnviarAlHospital,
    ).toBe(false);
  });

  it('deshabilita el botón si ya se envió', () => {
    const flags = buildEnviarAlHospitalFlags(
      {
        ...signed,
        googleDriveFileId: 'file-1',
        googleDriveFileUrl: 'https://drive.google.com/file/d/file-1/view',
        enviadoAlHospitalAt: new Date('2026-09-18T12:00:00.000Z'),
      },
      RolUsuarioAdmin.Administrador,
      ENABLED,
    );
    expect(flags.canEnviarAlHospital).toBe(false);
    expect(flags.enviadoAlHospital).toBe(true);
    expect(flags.googleDriveFileId).toBe('file-1');
  });

  it('deshabilita el botón sin modalidad, especialidad, documento o PDF firmado', () => {
    expect(
      buildEnviarAlHospitalFlags(
        { ...signed, modalidad: '  ' },
        RolUsuarioAdmin.Administrador,
        ENABLED,
      ).canEnviarAlHospital,
    ).toBe(false);
    expect(
      buildEnviarAlHospitalFlags(
        { ...signed, especialidad: null },
        RolUsuarioAdmin.Administrador,
        ENABLED,
      ).canEnviarAlHospital,
    ).toBe(false);
    expect(
      buildEnviarAlHospitalFlags(
        { ...signed, documento: null },
        RolUsuarioAdmin.Administrador,
        ENABLED,
      ).canEnviarAlHospital,
    ).toBe(false);
    expect(
      buildEnviarAlHospitalFlags(
        { ...signed, veredictoInforme: null },
        RolUsuarioAdmin.Administrador,
        ENABLED,
      ).canEnviarAlHospital,
    ).toBe(false);
  });
});
