import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { RolUsuarioAdmin } from '../../common/enums/rol-usuario-admin.enum';
import { JwtPayloadAdmin } from '../../common/interfaces/jwt-payload.interface';
import { ReplaceRondaEvaluadoresDto } from './dto/replace-ronda-evaluadores.dto';
import { UpdateRondaEvaluacionDto } from './dto/update-ronda-evaluacion.dto';
import { UpdateRondaFechaCierreDto } from './dto/update-ronda-fecha-cierre.dto';
import { RondaEvaluador } from './ronda-evaluador.entity';
import { Ronda } from './ronda.entity';
import { UsuarioAdministrativo } from '../usuario-administrativo/entities/usuario-administrativo.entity';

@Injectable()
export class RondaService {
  constructor(
    @InjectRepository(Ronda)
    private readonly rondaRepository: Repository<Ronda>,
    @InjectRepository(UsuarioAdministrativo)
    private readonly usuarioRepository: Repository<UsuarioAdministrativo>,
    private readonly dataSource: DataSource,
  ) {}

  async updateFechaCierre(
    id: string,
    dto: UpdateRondaFechaCierreDto,
    user: JwtPayloadAdmin,
  ): Promise<Pick<Ronda, 'id' | 'tenantId' | 'etiqueta' | 'fechaCierre'>> {
    if (user.rol !== RolUsuarioAdmin.Administrador) {
      throw new ForbiddenException(
        'Solo los administradores pueden cerrar una ronda',
      );
    }

    const ronda = await this.rondaRepository.findOne({ where: { id } });
    if (!ronda) {
      throw new NotFoundException('Ronda no encontrada');
    }

    ronda.fechaCierre = dto.fechaCierre == null ? null : new Date(dto.fechaCierre);
    if (
      ronda.fechaCierre != null &&
      Number.isNaN(ronda.fechaCierre.getTime())
    ) {
      throw new BadRequestException('fechaCierre no es una fecha válida');
    }

    const saved = await this.rondaRepository.save(ronda);
    return {
      id: saved.id,
      tenantId: saved.tenantId,
      etiqueta: saved.etiqueta,
      fechaCierre: saved.fechaCierre,
    };
  }

  async updatePuedeEvaluar(
    id: string,
    dto: UpdateRondaEvaluacionDto,
    user: JwtPayloadAdmin,
  ): Promise<{ id: string; puedeEvaluar: boolean }> {
    this.assertAdministrador(user);
    const ronda = await this.findRondaOrThrow(id);
    ronda.puedeEvaluar = dto.puedeEvaluar;
    const saved = await this.rondaRepository.save(ronda);
    return { id: saved.id, puedeEvaluar: saved.puedeEvaluar };
  }

  async replaceEvaluadores(
    id: string,
    dto: ReplaceRondaEvaluadoresDto,
    user: JwtPayloadAdmin,
  ): Promise<{ rondaId: string; usuarioIds: string[] }> {
    this.assertAdministrador(user);
    await this.findRondaOrThrow(id);

    const usuarioIds = [...new Set(dto.usuarioIds)];
    if (usuarioIds.length > 0) {
      const usuarios = await this.usuarioRepository.find({
        where: { id: In(usuarioIds) },
        select: ['id', 'rol'],
      });
      const rolById = new Map(usuarios.map((usuario) => [usuario.id, usuario.rol]));
      const invalid = usuarioIds.some(
        (usuarioId) => rolById.get(usuarioId) !== RolUsuarioAdmin.Evaluador,
      );
      if (invalid) {
        throw new BadRequestException(
          'Cada usuario debe existir y tener rol evaluador',
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RondaEvaluador);
      await repo.delete({ rondaId: id });
      if (usuarioIds.length > 0) {
        await repo.insert(
          usuarioIds.map((usuarioId) => ({ rondaId: id, usuarioId })),
        );
      }
    });

    return { rondaId: id, usuarioIds };
  }

  private assertAdministrador(user: JwtPayloadAdmin): void {
    if (user.rol !== RolUsuarioAdmin.Administrador) {
      throw new ForbiddenException(
        'Solo los administradores pueden modificar una ronda',
      );
    }
  }

  private async findRondaOrThrow(id: string): Promise<Ronda> {
    const ronda = await this.rondaRepository.findOne({ where: { id } });
    if (!ronda) {
      throw new NotFoundException('Ronda no encontrada');
    }
    return ronda;
  }
}
