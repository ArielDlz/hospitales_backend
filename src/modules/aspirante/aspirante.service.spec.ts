import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AspiranteService } from './aspirante.service';
import { Aspirante } from './aspirante.entity';
import { EvaluationFlowStep } from './evaluation-flow-step.entity';
import { EvaluationFlowService } from './evaluation-flow.service';
import { HospitalService } from '../hospital/hospital.service';
import { MailService } from '../mail/mail.service';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import type { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';

describe('AspiranteService.sendRecordatorioPruebas', () => {
  let service: AspiranteService;

  const aspiranteRepo = {
    find: jest.fn(),
  };
  const evaluationFlowService = {
    countPorEvaluarVsEnabled: jest.fn(),
  };
  const hospitalService = {
    findByUuid: jest.fn(),
  };
  const mailService = {
    sendRecordatorioPruebasEmail: jest.fn(),
  };

  const adminUser = {
    type: 'admin',
    sub: 'admin-1',
    email: 'admin@test.com',
    rol: RolUsuarioAdmin.Administrador,
  } as JwtPayloadAdmin;

  const evaluadorUser = {
    type: 'admin',
    sub: 'eval-1',
    email: 'eval@test.com',
    rol: RolUsuarioAdmin.Evaluador,
    tenants: ['tenant-1'],
  } as JwtPayloadAdmin;

  const tenantId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AspiranteService,
        { provide: getRepositoryToken(Aspirante), useValue: aspiranteRepo },
        {
          provide: getRepositoryToken(EvaluationFlowStep),
          useValue: {},
        },
        {
          provide: getRepositoryToken(UsuarioAdministrativo),
          useValue: {},
        },
        { provide: HospitalService, useValue: hospitalService },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        { provide: DataSource, useValue: {} },
        { provide: EvaluationFlowService, useValue: evaluationFlowService },
      ],
    }).compile();

    service = module.get(AspiranteService);
  });

  it('rechaza evaluadores', async () => {
    await expect(
      service.sendRecordatorioPruebas(
        { email: 'a@test.com', tenantId },
        evaluadorUser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404 si no hay aspirante', async () => {
    aspiranteRepo.find.mockResolvedValue([]);

    await expect(
      service.sendRecordatorioPruebas(
        { email: 'a@test.com', tenantId },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409 si hay varios aspirantes con el mismo email', async () => {
    aspiranteRepo.find.mockResolvedValue([
      { id: '1', evaluationFlowStep: { orderId: 3 } },
      { id: '2', evaluationFlowStep: { orderId: 3 } },
    ]);

    await expect(
      service.sendRecordatorioPruebas(
        { email: 'a@test.com', tenantId },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('400 si el paso no es 3 ni 4', async () => {
    aspiranteRepo.find.mockResolvedValue([
      {
        id: 'asp-1',
        tenantId,
        email: 'a@test.com',
        nombre: 'Juan',
        evaluationFlowStep: { orderId: 5 },
      },
    ]);

    await expect(
      service.sendRecordatorioPruebas(
        { email: 'a@test.com', tenantId },
        adminUser,
      ),
    ).rejects.toThrow('Este aspirante ya concluyó con sus pruebas');
  });

  it('400 si ya tiene suficientes por_evaluar', async () => {
    aspiranteRepo.find.mockResolvedValue([
      {
        id: 'asp-1',
        tenantId,
        email: 'a@test.com',
        nombre: 'Juan',
        evaluationFlowStep: { orderId: 4 },
      },
    ]);
    evaluationFlowService.countPorEvaluarVsEnabled.mockResolvedValue({
      enabledCount: 5,
      porEvaluarCount: 5,
    });

    await expect(
      service.sendRecordatorioPruebas(
        { email: 'a@test.com', tenantId },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('envía el recordatorio cuando es elegible', async () => {
    const aspirante = {
      id: 'asp-1',
      tenantId,
      email: 'a@test.com',
      nombre: 'Juan',
      evaluationFlowStep: { orderId: 3 },
    };
    aspiranteRepo.find.mockResolvedValue([aspirante]);
    evaluationFlowService.countPorEvaluarVsEnabled.mockResolvedValue({
      enabledCount: 5,
      porEvaluarCount: 2,
    });
    hospitalService.findByUuid.mockResolvedValue({
      uuid: tenantId,
      slug: 'hospital-test',
      nombre: 'Hospital Test',
    });
    mailService.sendRecordatorioPruebasEmail.mockResolvedValue(undefined);

    const result = await service.sendRecordatorioPruebas(
      { email: 'A@test.com', tenantId },
      adminUser,
    );

    expect(result).toEqual({
      message: 'Recordatorio enviado correctamente',
      emailEnviado: true,
    });
    expect(mailService.sendRecordatorioPruebasEmail).toHaveBeenCalledWith(
      aspirante,
      expect.objectContaining({ slug: 'hospital-test' }),
    );
    expect(aspiranteRepo.find).toHaveBeenCalledWith({
      where: { tenantId, email: 'a@test.com', active: true },
      relations: ['evaluationFlowStep'],
    });
  });
});
