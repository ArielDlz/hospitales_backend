import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { Aspirante } from '../aspirante/aspirante.entity';
import { Ronda } from '../aspirante/ronda.entity';
import { EvaluationFlowStep } from '../aspirante/evaluation-flow-step.entity';
import { EvaluationFlowService } from '../aspirante/evaluation-flow.service';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';
import { EvaluadorTenant } from '../usuario-administrativo/entities/evaluador-tenant.entity';
import { Hospital } from '../hospital/hospital.entity';
import { MailService } from '../mail/mail.service';
import type { JwtPayloadAspirante } from '../../common/interfaces/jwt-payload.interface';

describe('AuthService.issueAspiranteAccessToken', () => {
  let service: AuthService;

  const jwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
  };
  const rondaRepo = {
    findOne: jest.fn(),
  };

  const aspirante = {
    id: 'asp-1',
    tenantId: 'tenant-1',
    registroHospital: 'REG-1',
    nombre: 'Juan',
    apellidos: 'García',
    paymentLink: null,
    rondaEvaluacionId: null as string | null,
  };

  const flowStep = { orderId: 1, descripcion: 'Invitación' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MailService, useValue: {} },
        { provide: EvaluationFlowService, useValue: {} },
        { provide: getRepositoryToken(UsuarioAdministrativo), useValue: {} },
        { provide: getRepositoryToken(EvaluadorTenant), useValue: {} },
        { provide: getRepositoryToken(Aspirante), useValue: {} },
        { provide: getRepositoryToken(Ronda), useValue: rondaRepo },
        { provide: getRepositoryToken(EvaluationFlowStep), useValue: {} },
        { provide: getRepositoryToken(Hospital), useValue: {} },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('puts the ronda etiqueta on the token when the aspirante has a ronda', async () => {
    rondaRepo.findOne.mockResolvedValue({ id: 'ronda-1', etiqueta: 'Ronda 2026' });

    await service.issueAspiranteAccessToken({
      aspirante: { ...aspirante, rondaEvaluacionId: 'ronda-1' },
      hospitalSlug: 'hospital-test',
      accesoCierraAt: null,
      flowStep,
    });

    const payload = jwtService.sign.mock.calls[0][0] as JwtPayloadAspirante;
    expect(payload.rondaEtiqueta).toBe('Ronda 2026');
    expect(rondaRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'ronda-1' },
      select: ['id', 'etiqueta'],
    });
  });

  it('sets rondaEtiqueta to null when the aspirante has no ronda', async () => {
    await service.issueAspiranteAccessToken({
      aspirante,
      hospitalSlug: 'hospital-test',
      accesoCierraAt: null,
      flowStep,
    });

    const payload = jwtService.sign.mock.calls[0][0] as JwtPayloadAspirante;
    expect(payload.rondaEtiqueta).toBeNull();
    expect(rondaRepo.findOne).not.toHaveBeenCalled();
  });
});
