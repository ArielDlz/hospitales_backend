import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Aspirante } from '../aspirante.entity';
import { EvaluationFlowStep } from '../evaluation-flow-step.entity';
import { HospitalService } from '../../hospital/hospital.service';
import { MailService } from '../../mail/mail.service';
import { Hospital } from '../../hospital/hospital.entity';
import {
  AspiranteImportFileError,
  isValidEmail,
  parseAspiranteImportBuffer,
} from './aspirante-import.parser';
import type {
  AspiranteImportParsedRow,
  AspiranteImportReport,
  AspiranteImportRowError,
} from './aspirante-import.types';

interface ValidationContext {
  hospital: Hospital;
  rows: AspiranteImportParsedRow[];
  report: AspiranteImportReport;
}

@Injectable()
export class AspiranteImportService {
  private readonly logger = new Logger(AspiranteImportService.name);

  constructor(
    @InjectRepository(Aspirante)
    private readonly aspiranteRepository: Repository<Aspirante>,
    @InjectRepository(EvaluationFlowStep)
    private readonly evaluationFlowStepRepository: Repository<EvaluationFlowStep>,
    private readonly hospitalService: HospitalService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async validate(buffer: Buffer, tenantId: string): Promise<AspiranteImportReport> {
    const ctx = await this.buildValidationContext(buffer, tenantId);
    return ctx.report;
  }

  async import(buffer: Buffer, tenantId: string): Promise<AspiranteImportReport> {
    const ctx = await this.buildValidationContext(buffer, tenantId);
    if (!ctx.report.ok) {
      throw new BadRequestException(ctx.report);
    }

    const pasoInvitacion = await this.evaluationFlowStepRepository.findOne({
      where: { orderId: 1 },
    });
    if (!pasoInvitacion) {
      throw new InternalServerErrorException(
        'Catálogo evaluation_flow_steps no inicializado (falta paso order_id = 1)',
      );
    }

    const placeholder =
      this.configService.get<string>('PRIMER_ACCESO_PLACEHOLDER') || 'pendiente';
    const passwordHash = await bcrypt.hash(placeholder, 10);
    const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    type PendingInvite = {
      aspirante: Aspirante;
      token: string;
    };

    const pending: PendingInvite[] = [];

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Aspirante);
      for (const row of ctx.rows) {
        const token = crypto.randomBytes(32).toString('hex');
        const aspirante = repo.create({
          tenantId: ctx.hospital.uuid,
          email: row.email,
          registroHospital: row.registroHospital.trim(),
          passwordHash,
          apellidos: row.apellidos.trim(),
          nombre: row.nombre.trim(),
          telefono: row.telefono,
          modalidad: row.modalidad,
          especialidad: row.especialidad,
          nacionalidad: row.nacionalidad,
          rfc: row.rfc,
          documento: row.documento,
          genero: row.genero,
          fechaNacimiento: row.fechaNacimiento,
          active: false,
          primerAccesoToken: token,
          primerAccesoExpira: expira,
          evaluationFlowId: pasoInvitacion.id,
        });
        const saved = await repo.save(aspirante);
        pending.push({ aspirante: saved, token });
      }
    });

    let emailsEnviados = 0;
    if (ctx.hospital.envioCorreoRegistro) {
      for (const { aspirante, token } of pending) {
        try {
          await this.mailService.sendPrimerAccesoEmail(
            aspirante,
            token,
            ctx.hospital,
          );
          emailsEnviados += 1;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Fallo envío correo primer acceso (aspirante ${aspirante.id}): ${errorMessage}`,
          );
          try {
            await this.mailService.sendAdminMailFailureAlert({
              aspiranteId: aspirante.id,
              aspiranteEmail: aspirante.email,
              hospitalNombre: ctx.hospital.nombre,
              errorMessage,
            });
          } catch (alertErr) {
            const alertMessage =
              alertErr instanceof Error ? alertErr.message : String(alertErr);
            this.logger.error(
              `Fallo envío alerta admin por correo (aspirante ${aspirante.id}): ${alertMessage}`,
            );
          }
        }
      }
    }

    return {
      ok: true,
      totalRows: ctx.report.totalRows,
      validRows: ctx.report.validRows,
      invalidRows: 0,
      errors: [],
      created: pending.length,
      emailsEnviados,
    };
  }

  private async buildValidationContext(
    buffer: Buffer,
    tenantId: string,
  ): Promise<ValidationContext> {
    if (!tenantId?.trim()) {
      throw new BadRequestException('tenantId es requerido');
    }

    const hospital = await this.hospitalService.findByUuid(tenantId.trim());
    if (!hospital) {
      throw new BadRequestException('Hospital no encontrado');
    }

    let parsed;
    try {
      parsed = await parseAspiranteImportBuffer(buffer);
    } catch (err) {
      if (err instanceof AspiranteImportFileError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    const errorMap = new Map<number, AspiranteImportRowError>();

    const addError = (
      rowNumber: number,
      message: string,
      extras?: { email?: string; registroHospital?: string },
    ) => {
      const existing = errorMap.get(rowNumber);
      if (existing) {
        existing.messages.push(message);
        if (extras?.email) existing.email = extras.email;
        if (extras?.registroHospital) {
          existing.registroHospital = extras.registroHospital;
        }
      } else {
        errorMap.set(rowNumber, {
          rowNumber,
          email: extras?.email,
          registroHospital: extras?.registroHospital,
          messages: [message],
        });
      }
    };

    for (const pe of parsed.parseErrors) {
      for (const message of pe.messages) {
        addError(pe.rowNumber, message);
      }
    }

    const seenKeys = new Map<string, number>();

    for (const row of parsed.rows) {
      const extras = {
        email: row.email || undefined,
        registroHospital: row.registroHospital || undefined,
      };

      const existingErr = errorMap.get(row.rowNumber);
      if (existingErr) {
        if (extras.email) existingErr.email = extras.email;
        if (extras.registroHospital) {
          existingErr.registroHospital = extras.registroHospital;
        }
      }

      if (!row.registroHospital.trim()) {
        addError(row.rowNumber, 'registro_hospital es requerido', extras);
      }
      if (!row.email.trim()) {
        addError(row.rowNumber, 'email es requerido', extras);
      } else if (!isValidEmail(row.email)) {
        addError(row.rowNumber, 'email con formato inválido', extras);
      }
      if (!row.apellidos.trim()) {
        addError(row.rowNumber, 'apellidos es requerido', extras);
      }
      if (!row.nombre.trim()) {
        addError(row.rowNumber, 'nombre es requerido', extras);
      }

      if (row.email.trim() && row.registroHospital.trim()) {
        const key = `${row.email}|${row.registroHospital.trim()}`;
        const firstRow = seenKeys.get(key);
        if (firstRow != null) {
          addError(
            row.rowNumber,
            `Duplicado en el archivo (misma combinación email + registro_hospital que la fila ${firstRow})`,
            extras,
          );
        } else {
          seenKeys.set(key, row.rowNumber);
        }
      }
    }

    const candidateKeys = parsed.rows
      .filter((r) => r.email.trim() && r.registroHospital.trim())
      .map((r) => ({
        email: r.email,
        registroHospital: r.registroHospital.trim(),
        rowNumber: r.rowNumber,
      }));

    if (candidateKeys.length > 0) {
      const emails = [...new Set(candidateKeys.map((c) => c.email))];
      const existing = await this.aspiranteRepository.find({
        where: {
          tenantId: hospital.uuid,
          email: In(emails),
        },
        select: ['email', 'registroHospital'],
      });

      const existingSet = new Set(
        existing.map(
          (e) => `${e.email.toLowerCase()}|${e.registroHospital.trim()}`,
        ),
      );

      for (const c of candidateKeys) {
        const key = `${c.email}|${c.registroHospital}`;
        if (existingSet.has(key)) {
          addError(
            c.rowNumber,
            'Ya existe un aspirante con este email y registro en este hospital',
            {
              email: c.email,
              registroHospital: c.registroHospital,
            },
          );
        }
      }
    }

    const errors = [...errorMap.values()].sort(
      (a, b) => a.rowNumber - b.rowNumber,
    );
    const invalidRows = errors.length;
    const totalRows = parsed.rows.length;
    const validRows = totalRows - invalidRows;

    return {
      hospital,
      rows: parsed.rows,
      report: {
        ok: invalidRows === 0,
        totalRows,
        validRows,
        invalidRows,
        errors,
      },
    };
  }
}
