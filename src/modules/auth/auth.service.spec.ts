import { UnauthorizedException } from '@nestjs/common';
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
import { SolicitarActivacionEstado } from './dto/solicitar-activacion-response.dto';
import * as bcrypt from 'bcrypt';

describe('AuthService.issueAspiranteAccessToken', () => {
  let service: AuthService;

  const jwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
  };
  const rondaRepo = {
    findOne: jest.fn(),
  };
  const aspiranteRepo = {
    find: jest.fn(),
    save: jest.fn(async (entity: unknown) => entity),
  };
  const hospitalRepo = {
    findOne: jest.fn(),
  };
  const mailService = {
    sendActivarCuentaEmail: jest.fn(),
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
        { provide: MailService, useValue: mailService },
        { provide: EvaluationFlowService, useValue: {} },
        { provide: getRepositoryToken(UsuarioAdministrativo), useValue: {} },
        { provide: getRepositoryToken(EvaluadorTenant), useValue: {} },
        { provide: getRepositoryToken(Aspirante), useValue: aspiranteRepo },
        { provide: getRepositoryToken(Ronda), useValue: rondaRepo },
        { provide: getRepositoryToken(EvaluationFlowStep), useValue: {} },
        { provide: getRepositoryToken(Hospital), useValue: hospitalRepo },
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

  describe('when the same email and registro exist in more than one ronda', () => {
    const hashA = bcrypt.hashSync('secret-a', 4);
    const hashB = bcrypt.hashSync('secret-b', 4);
    const flowStep = { orderId: 1, descripcion: 'Invitación' };

    function row(overrides: Record<string, unknown>) {
      return {
        id: 'asp-1',
        tenantId: 'tenant-1',
        email: 'juan@example.com',
        registroHospital: 'REG-1',
        nombre: 'Juan',
        apellidos: 'García',
        passwordHash: hashA,
        paymentLink: null,
        rondaEvaluacionId: 'ronda-1',
        active: true,
        evaluationFlowStep: flowStep,
        rondaEvaluacion: { id: 'ronda-1', etiqueta: 'Ronda 2026' },
        ...overrides,
      };
    }

    const prior = row({});
    const later = row({
      id: 'asp-2',
      passwordHash: hashB,
      rondaEvaluacionId: 'ronda-2',
      rondaEvaluacion: { id: 'ronda-2', etiqueta: 'Ronda 2027' },
    });

    beforeEach(() => {
      hospitalRepo.findOne.mockResolvedValue({
        uuid: 'tenant-1',
        slug: 'hospital-test',
        accesoCierraAt: null,
        nombre: 'Hospital Test',
      });
      rondaRepo.findOne.mockImplementation(async (opts: { where: { id: string } }) =>
        opts.where.id === 'ronda-2'
          ? { id: 'ronda-2', etiqueta: 'Ronda 2027' }
          : { id: 'ronda-1', etiqueta: 'Ronda 2026' },
      );
    });

    it('logs into the round whose password matches', async () => {
      aspiranteRepo.find.mockResolvedValue([prior, later]);

      await service.loginAspirante({
        slug: 'hospital-test',
        email: 'juan@example.com',
        registroHospital: 'REG-1',
        password: 'secret-b',
      });

      const payload = jwtService.sign.mock.calls[0][0] as JwtPayloadAspirante;
      expect(payload.sub).toBe('asp-2');
      expect(payload.rondaEtiqueta).toBe('Ronda 2027');
    });

    it('rejects login when the matching aspirante has no ronda', async () => {
      aspiranteRepo.find.mockResolvedValue([
        { ...prior, rondaEvaluacionId: null, rondaEvaluacion: null },
      ]);

      await expect(
        service.loginAspirante({
          slug: 'hospital-test',
          email: 'juan@example.com',
          registroHospital: 'REG-1',
          password: 'secret-a',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('ignores a historical account without ronda when another round matches', async () => {
      aspiranteRepo.find.mockResolvedValue([
        { ...prior, rondaEvaluacionId: null, rondaEvaluacion: null },
        { ...later, passwordHash: hashA },
      ]);

      await service.loginAspirante({
        slug: 'hospital-test',
        email: 'juan@example.com',
        registroHospital: 'REG-1',
        password: 'secret-a',
      });

      const payload = jwtService.sign.mock.calls[0][0] as JwtPayloadAspirante;
      expect(payload.sub).toBe('asp-2');
    });

    it('refuses to pick a round when the password matches more than one active account', async () => {
      aspiranteRepo.find.mockResolvedValue([
        prior,
        { ...later, passwordHash: hashA },
      ]);

      await expect(
        service.loginAspirante({
          slug: 'hospital-test',
          email: 'juan@example.com',
          registroHospital: 'REG-1',
          password: 'secret-a',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('uses rondaEtiqueta to select the account when passwords collide', async () => {
      aspiranteRepo.find.mockResolvedValue([
        prior,
        { ...later, passwordHash: hashA },
      ]);

      await service.loginAspirante({
        slug: 'hospital-test',
        email: 'juan@example.com',
        registroHospital: 'REG-1',
        password: 'secret-a',
        rondaEtiqueta: 'ronda 2027',
      });

      const payload = jwtService.sign.mock.calls[0][0] as JwtPayloadAspirante;
      expect(payload.sub).toBe('asp-2');
      expect(payload.rondaEtiqueta).toBe('Ronda 2027');
    });

    it('does not send activation for an arbitrary round', async () => {
      aspiranteRepo.find.mockResolvedValue([
        { ...prior, active: true },
        { ...later, active: false },
      ]);

      const result = await service.solicitarActivacion({
        slug: 'hospital-test',
        email: 'juan@example.com',
        registroHospital: 'REG-1',
      });

      expect(result.estado).toBe(SolicitarActivacionEstado.RondaRequerida);
      expect(aspiranteRepo.save).not.toHaveBeenCalled();
      expect(mailService.sendActivarCuentaEmail).not.toHaveBeenCalled();
    });

    it('sends activation only for the requested ronda', async () => {
      const inactiveLater = { ...later, active: false, passwordHash: hashB };
      aspiranteRepo.find.mockResolvedValue([prior, inactiveLater]);
      mailService.sendActivarCuentaEmail.mockResolvedValue(undefined);

      const result = await service.solicitarActivacion({
        slug: 'hospital-test',
        email: 'juan@example.com',
        registroHospital: 'REG-1',
        rondaEtiqueta: 'Ronda 2027',
      });

      expect(result.estado).toBe(SolicitarActivacionEstado.ActivacionEnviada);
      expect(aspiranteRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'asp-2', active: false }),
      );
      expect(mailService.sendActivarCuentaEmail).toHaveBeenCalledTimes(1);
    });
  });
});
