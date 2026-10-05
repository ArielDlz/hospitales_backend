import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import ExcelJS from 'exceljs';
import { AspiranteImportService } from './aspirante-import.service';
import { Aspirante } from '../aspirante.entity';
import { EvaluationFlowStep } from '../evaluation-flow-step.entity';
import { Ronda } from '../ronda.entity';
import { HospitalService } from '../../hospital/hospital.service';
import { MailService } from '../../mail/mail.service';
import { ASPIRANTE_IMPORT_HEADERS } from './aspirante-import.constants';
import { GeneroAspirante } from '../../../common/enums/genero-aspirante.enum';

describe('AspiranteImportService', () => {
  let service: AspiranteImportService;

  const hospital = {
    uuid: 'd31f9a19-056d-4c8a-8803-03e63717b392',
    nombre: 'Hospital Test',
    slug: 'hospital-test',
    envioCorreoRegistro: false,
  };

  const existingRonda = {
    id: 'ronda-existing',
    etiqueta: 'Ronda 2026',
    tenantId: hospital.uuid,
  };

  const aspiranteRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const rondaRepo = {
    createQueryBuilder: jest.fn(),
  };
  const flowStepRepo = {
    findOne: jest.fn(),
  };
  const hospitalService = {
    findByUuid: jest.fn(),
  };
  const mailService = {
    sendPrimerAccesoEmail: jest.fn(),
    sendAdminMailFailureAlert: jest.fn(),
  };
  const configService = {
    get: jest.fn().mockReturnValue('pendiente'),
  };
  const dataSource = {
    transaction: jest.fn(),
  };

  function mockRondaLookup(
    ronda: { id: string; etiqueta: string } | null,
  ) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(ronda),
    };
    rondaRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  function mockExistingAspirantes(
    rows: Array<{ email: string; registroHospital: string }>,
  ) {
    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    aspiranteRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  async function buildWorkbook(
    rows: Array<Record<string, string>>,
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Aspirantes');
    sheet.addRow([...ASPIRANTE_IMPORT_HEADERS]);
    for (const row of rows) {
      sheet.addRow(ASPIRANTE_IMPORT_HEADERS.map((h) => row[h] ?? ''));
    }
    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  const baseRow = {
    registro_hospital: 'REG-1',
    documento: 'CURP',
    especialidad: 'Cardio',
    modalidad: 'presencial',
    nacionalidad: 'Mexicana',
    apellidos: 'García',
    nombre: 'Juan',
    fecha_nacimiento: '1995-03-15',
    genero: 'H',
    email: 'juan@example.com',
    rfc: 'RFC',
    telefono: '551111',
    ronda_evaluacion: 'Ronda 2026',
  };

  function mockImportTransaction(existingRondaInTx: { id: string } | null = null) {
    const saved: Array<Record<string, unknown>> = [];
    const rondaSaves: Array<Record<string, unknown>> = [];
    dataSource.transaction.mockImplementation(
      async (cb: (m: unknown) => Promise<void>) => {
        const aspiranteTx = {
          create: jest.fn((data: Record<string, unknown>) => data),
          save: jest.fn(async (entity: Record<string, unknown>) => {
            const withId = { ...entity, id: `id-${saved.length}` };
            saved.push(withId);
            return withId;
          }),
        };
        const rondaTx = {
          createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(existingRondaInTx),
          })),
          create: jest.fn((data: Record<string, unknown>) => data),
          save: jest.fn(async (entity: Record<string, unknown>) => {
            const withId = { ...entity, id: 'ronda-new' };
            rondaSaves.push(withId);
            return withId;
          }),
        };
        await cb({
          getRepository: (entity: unknown) =>
            entity === Ronda ? rondaTx : aspiranteTx,
        });
      },
    );
    return { saved, rondaSaves };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    hospitalService.findByUuid.mockResolvedValue(hospital);
    mockRondaLookup(null);
    mockExistingAspirantes([]);
    flowStepRepo.findOne.mockResolvedValue({ id: 1, orderId: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AspiranteImportService,
        { provide: getRepositoryToken(Aspirante), useValue: aspiranteRepo },
        { provide: getRepositoryToken(Ronda), useValue: rondaRepo },
        {
          provide: getRepositoryToken(EvaluationFlowStep),
          useValue: flowStepRepo,
        },
        { provide: HospitalService, useValue: hospitalService },
        { provide: MailService, useValue: mailService },
        { provide: ConfigService, useValue: configService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(AspiranteImportService);
  });

  it('validate returns ok for clean file', async () => {
    const buffer = await buildWorkbook([baseRow]);
    const report = await service.validate(buffer, hospital.uuid);
    expect(report.ok).toBe(true);
    expect(report.totalRows).toBe(1);
    expect(report.validRows).toBe(1);
    expect(report.invalidRows).toBe(0);
    expect(report.errors).toEqual([]);
  });

  it('validate reports missing required fields and duplicate in file', async () => {
    const buffer = await buildWorkbook([
      { ...baseRow, email: '', nombre: '' },
      baseRow,
      { ...baseRow, registro_hospital: 'REG-1', email: 'juan@example.com' },
    ]);
    const report = await service.validate(buffer, hospital.uuid);
    expect(report.ok).toBe(false);
    expect(report.invalidRows).toBeGreaterThanOrEqual(2);
    expect(report.errors.some((e) => e.messages.some((m) => m.includes('email')))).toBe(
      true,
    );
    expect(
      report.errors.some((e) => e.messages.some((m) => m.includes('Duplicado'))),
    ).toBe(true);
  });

  it('validate reports DB duplicates inside the same ronda', async () => {
    mockRondaLookup(existingRonda);
    const aspiranteQuery = mockExistingAspirantes([
      { email: 'juan@example.com', registroHospital: 'REG-1' },
    ]);
    const buffer = await buildWorkbook([baseRow]);
    const report = await service.validate(buffer, hospital.uuid);
    expect(report.ok).toBe(false);
    expect(report.errors[0].messages[0]).toContain('Ya existe un aspirante');
    expect(aspiranteQuery.andWhere).toHaveBeenCalledWith(
      'a.ronda_evaluacion_id = :rondaId',
      { rondaId: existingRonda.id },
    );
  });

  it('validate detects DB duplicates case-insensitively', async () => {
    mockRondaLookup(existingRonda);
    mockExistingAspirantes([
      { email: 'Juan@Example.com', registroHospital: 'REG-1' },
    ]);
    const buffer = await buildWorkbook([
      { ...baseRow, email: 'JUAN@example.com' },
    ]);
    const report = await service.validate(buffer, hospital.uuid);
    expect(report.ok).toBe(false);
    expect(report.errors[0].messages[0]).toContain('Ya existe un aspirante');
    expect(aspiranteRepo.createQueryBuilder).toHaveBeenCalled();
  });

  it('validate detects in-file duplicates with different email casing', async () => {
    const buffer = await buildWorkbook([
      baseRow,
      { ...baseRow, email: 'Juan@Example.com' },
    ]);
    const report = await service.validate(buffer, hospital.uuid);
    expect(report.ok).toBe(false);
    expect(
      report.errors.some((e) => e.messages.some((m) => m.includes('Duplicado'))),
    ).toBe(true);
  });

  it('import throws BadRequestException with report when invalid', async () => {
    const buffer = await buildWorkbook([{ ...baseRow, email: 'bad' }]);
    await expect(service.import(buffer, hospital.uuid)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('validate rejects a missing ronda_evaluacion', async () => {
    const buffer = await buildWorkbook([{ ...baseRow, ronda_evaluacion: '' }]);
    const report = await service.validate(buffer, hospital.uuid);
    expect(report.ok).toBe(false);
    expect(report.errors[0].messages).toContain('ronda_evaluacion es requerido');
  });

  it('validate rejects mixed ronda_evaluacion values', async () => {
    const buffer = await buildWorkbook([
      baseRow,
      {
        ...baseRow,
        email: 'ana@example.com',
        registro_hospital: 'REG-2',
        ronda_evaluacion: 'Otra ronda',
      },
    ]);
    const report = await service.validate(buffer, hospital.uuid);
    expect(report.ok).toBe(false);
    const mismatched = report.errors.find((e) => e.rowNumber === 3);
    expect(mismatched?.messages).toContain(
      'todas las filas deben tener la misma ronda_evaluacion',
    );
    expect(
      report.errors
        .find((e) => e.rowNumber === 2)
        ?.messages.some((m) => m.includes('misma ronda_evaluacion')),
    ).toBeFalsy();
  });

  it('validate accepts the same etiqueta with different casing', async () => {
    const buffer = await buildWorkbook([
      baseRow,
      {
        ...baseRow,
        email: 'ana@example.com',
        registro_hospital: 'REG-2',
        ronda_evaluacion: 'ronda 2026',
      },
    ]);
    const report = await service.validate(buffer, hospital.uuid);
    expect(report.ok).toBe(true);
  });

  it('validate skips DB duplicates when the ronda does not exist yet', async () => {
    mockRondaLookup(null);
    mockExistingAspirantes([
      { email: 'juan@example.com', registroHospital: 'REG-1' },
    ]);
    const buffer = await buildWorkbook([baseRow]);
    const report = await service.validate(buffer, hospital.uuid);
    expect(report.ok).toBe(true);
    expect(aspiranteRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('import creates all rows in a transaction when valid', async () => {
    const { saved } = mockImportTransaction(null);

    const buffer = await buildWorkbook([
      baseRow,
      { ...baseRow, email: 'ana@example.com', registro_hospital: 'REG-2', genero: 'M' },
    ]);
    const report = await service.import(buffer, hospital.uuid);
    expect(report.ok).toBe(true);
    expect(report.created).toBe(2);
    expect(report.emailsEnviados).toBe(0);
    expect(saved).toHaveLength(2);
    expect((saved[0] as { genero: string }).genero).toBe(GeneroAspirante.Hombre);
    expect((saved[1] as { genero: string }).genero).toBe(GeneroAspirante.Mujer);
    expect(mailService.sendPrimerAccesoEmail).not.toHaveBeenCalled();
  });

  it('import creates a ronda when the etiqueta does not exist', async () => {
    const { saved, rondaSaves } = mockImportTransaction(null);
    const buffer = await buildWorkbook([baseRow]);
    const report = await service.import(buffer, hospital.uuid);
    expect(report.ok).toBe(true);
    expect(rondaSaves).toEqual([
      expect.objectContaining({
        id: 'ronda-new',
        tenantId: hospital.uuid,
        etiqueta: 'Ronda 2026',
      }),
    ]);
    expect(saved[0].rondaEvaluacionId).toBe('ronda-new');
  });

  it('import reuses an existing ronda', async () => {
    mockRondaLookup(existingRonda);
    const { saved, rondaSaves } = mockImportTransaction(existingRonda);
    const buffer = await buildWorkbook([baseRow]);
    const report = await service.import(buffer, hospital.uuid);
    expect(report.ok).toBe(true);
    expect(rondaSaves).toHaveLength(0);
    expect(saved[0].rondaEvaluacionId).toBe(existingRonda.id);
  });

  it('import lowercases emails before saving', async () => {
    const { saved } = mockImportTransaction(null);

    const buffer = await buildWorkbook([
      { ...baseRow, email: 'Juan.Perez@Example.COM' },
    ]);
    const report = await service.import(buffer, hospital.uuid);
    expect(report.ok).toBe(true);
    expect((saved[0] as { email: string }).email).toBe('juan.perez@example.com');
  });

  it('import sends emails when hospital flag is true', async () => {
    hospitalService.findByUuid.mockResolvedValue({
      ...hospital,
      envioCorreoRegistro: true,
    });
    mockImportTransaction(null);
    mailService.sendPrimerAccesoEmail.mockResolvedValue(undefined);

    const buffer = await buildWorkbook([baseRow]);
    const report = await service.import(buffer, hospital.uuid);
    expect(report.emailsEnviados).toBe(1);
    expect(mailService.sendPrimerAccesoEmail).toHaveBeenCalledTimes(1);
  });
});
