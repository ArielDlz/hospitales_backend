import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import ExcelJS from 'exceljs';
import { AspiranteImportService } from './aspirante-import.service';
import { Aspirante } from '../aspirante.entity';
import { EvaluationFlowStep } from '../evaluation-flow-step.entity';
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

  const aspiranteRepo = {
    find: jest.fn(),
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
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    hospitalService.findByUuid.mockResolvedValue(hospital);
    mockExistingAspirantes([]);
    flowStepRepo.findOne.mockResolvedValue({ id: 1, orderId: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AspiranteImportService,
        { provide: getRepositoryToken(Aspirante), useValue: aspiranteRepo },
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

  it('validate reports DB duplicates', async () => {
    mockExistingAspirantes([
      { email: 'juan@example.com', registroHospital: 'REG-1' },
    ]);
    const buffer = await buildWorkbook([baseRow]);
    const report = await service.validate(buffer, hospital.uuid);
    expect(report.ok).toBe(false);
    expect(report.errors[0].messages[0]).toContain('Ya existe un aspirante');
  });

  it('validate detects DB duplicates case-insensitively', async () => {
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

  it('import creates all rows in a transaction when valid', async () => {
    const saved: unknown[] = [];
    dataSource.transaction.mockImplementation(async (cb: (m: unknown) => Promise<void>) => {
      const repo = {
        create: jest.fn((data: Record<string, unknown>) => data),
        save: jest.fn(async (entity: Record<string, unknown>) => {
          const withId = { ...entity, id: `id-${saved.length}` };
          saved.push(withId);
          return withId;
        }),
      };
      await cb({ getRepository: () => repo });
    });

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

  it('import lowercases emails before saving', async () => {
    const saved: unknown[] = [];
    dataSource.transaction.mockImplementation(async (cb: (m: unknown) => Promise<void>) => {
      const repo = {
        create: jest.fn((data: Record<string, unknown>) => data),
        save: jest.fn(async (entity: Record<string, unknown>) => {
          const withId = { ...entity, id: `id-${saved.length}` };
          saved.push(withId);
          return withId;
        }),
      };
      await cb({ getRepository: () => repo });
    });

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
    dataSource.transaction.mockImplementation(async (cb: (m: unknown) => Promise<void>) => {
      const repo = {
        create: jest.fn((data: Record<string, unknown>) => data),
        save: jest.fn(async (entity: Record<string, unknown>) => ({
          ...entity,
          id: 'asp-1',
        })),
      };
      await cb({ getRepository: () => repo });
    });
    mailService.sendPrimerAccesoEmail.mockResolvedValue(undefined);

    const buffer = await buildWorkbook([baseRow]);
    const report = await service.import(buffer, hospital.uuid);
    expect(report.emailsEnviados).toBe(1);
    expect(mailService.sendPrimerAccesoEmail).toHaveBeenCalledTimes(1);
  });
});
