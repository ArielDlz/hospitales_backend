import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import type { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { Ronda } from './ronda.entity';
import { RondaService } from './ronda.service';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';

describe('RondaService.updateFechaCierre', () => {
  let service: RondaService;

  const rondaRepo = {
    findOne: jest.fn(),
    save: jest.fn(async (entity: unknown) => entity),
  };
  const usuarioRepo = {
    find: jest.fn(),
  };
  const evaluadorLinkRepo = {
    delete: jest.fn(),
    insert: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (fn: (manager: unknown) => Promise<void>) =>
      fn({ getRepository: () => evaluadorLinkRepo }),
    ),
  };

  const admin: JwtPayloadAdmin = {
    sub: 'admin-1',
    type: 'admin',
    rol: RolUsuarioAdmin.Administrador,
    signature: false,
    supervisorId: null,
    supervisedUserIds: [],
  };

  const ronda = {
    id: 'ronda-1',
    tenantId: 'tenant-1',
    etiqueta: 'Ronda 2026',
    fechaCierre: null as Date | null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RondaService,
        { provide: getRepositoryToken(Ronda), useValue: rondaRepo },
        {
          provide: getRepositoryToken(UsuarioAdministrativo),
          useValue: usuarioRepo,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(RondaService);
    rondaRepo.findOne.mockResolvedValue({ ...ronda });
  });

  it('saves fechaCierre and does not touch aspirantes', async () => {
    const result = await service.updateFechaCierre(
      'ronda-1',
      { fechaCierre: '2026-12-01T06:00:00.000Z' },
      admin,
    );

    expect(rondaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ronda-1',
        fechaCierre: new Date('2026-12-01T06:00:00.000Z'),
      }),
    );
    expect(result.fechaCierre).toEqual(new Date('2026-12-01T06:00:00.000Z'));
    expect(rondaRepo.save).toHaveBeenCalledTimes(1);
  });

  it('clears fechaCierre when the value is null', async () => {
    rondaRepo.findOne.mockResolvedValue({
      ...ronda,
      fechaCierre: new Date('2026-12-01T06:00:00.000Z'),
    });

    const result = await service.updateFechaCierre(
      'ronda-1',
      { fechaCierre: null },
      admin,
    );

    expect(rondaRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ronda-1', fechaCierre: null }),
    );
    expect(result.fechaCierre).toBeNull();
  });

  it('rejects an evaluador', async () => {
    await expect(
      service.updateFechaCierre('ronda-1', { fechaCierre: null }, {
        ...admin,
        rol: RolUsuarioAdmin.Evaluador,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(rondaRepo.save).not.toHaveBeenCalled();
  });

  it('returns 404 when the ronda does not exist', async () => {
    rondaRepo.findOne.mockResolvedValue(null);

    await expect(
      service.updateFechaCierre(
        'ronda-1',
        { fechaCierre: '2026-12-01T06:00:00.000Z' },
        admin,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(rondaRepo.save).not.toHaveBeenCalled();
  });

  const pedro = '550e8400-e29b-41d4-a716-446655440001';
  const pablo = '550e8400-e29b-41d4-a716-446655440002';

  it('replaces the evaluador allow-list and drops duplicates', async () => {
    usuarioRepo.find.mockResolvedValue([
      { id: pedro, rol: RolUsuarioAdmin.Evaluador },
      { id: pablo, rol: RolUsuarioAdmin.Evaluador },
    ]);

    const result = await service.replaceEvaluadores(
      'ronda-1',
      { usuarioIds: [pedro, pablo, pedro] },
      admin,
    );

    expect(result.usuarioIds).toEqual([pedro, pablo]);
    expect(evaluadorLinkRepo.delete).toHaveBeenCalledWith({ rondaId: 'ronda-1' });
    expect(evaluadorLinkRepo.insert).toHaveBeenCalledWith([
      { rondaId: 'ronda-1', usuarioId: pedro },
      { rondaId: 'ronda-1', usuarioId: pablo },
    ]);
  });

  it('rejects a non-evaluador and leaves the previous rows', async () => {
    usuarioRepo.find.mockResolvedValue([
      { id: pedro, rol: RolUsuarioAdmin.Administrador },
    ]);

    await expect(
      service.replaceEvaluadores('ronda-1', { usuarioIds: [pedro] }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(evaluadorLinkRepo.delete).not.toHaveBeenCalled();
  });

  it('clears the allow-list when usuarioIds is empty', async () => {
    const result = await service.replaceEvaluadores(
      'ronda-1',
      { usuarioIds: [] },
      admin,
    );

    expect(result.usuarioIds).toEqual([]);
    expect(usuarioRepo.find).not.toHaveBeenCalled();
    expect(evaluadorLinkRepo.delete).toHaveBeenCalledWith({ rondaId: 'ronda-1' });
    expect(evaluadorLinkRepo.insert).not.toHaveBeenCalled();
  });
});
