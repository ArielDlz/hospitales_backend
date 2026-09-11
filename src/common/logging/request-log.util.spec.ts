import {
  BadRequestException,
  HttpException,
  StreamableFile,
} from '@nestjs/common';
import { RolUsuarioAdmin } from '../enums/rol-usuario-admin.enum';
import {
  JwtPayloadAdmin,
  JwtPayloadAspirante,
} from '../interfaces/jwt-payload.interface';
import {
  describeHttpError,
  formatActor,
  resolveIncomingRequestId,
  serializeForLog,
} from './request-log.util';

describe('request-log.util', () => {
  describe('formatActor', () => {
    it('formats aspirante with id and email', () => {
      const user: JwtPayloadAspirante = {
        sub: 'asp-1',
        type: 'aspirante',
        email: 'ana@hospital.com',
        tenantId: 't1',
        slug: 'hospitalgeneral',
        registro: '260276',
        nombre: 'ANA PATRICIA',
        evaluationFlowOrderId: 4,
      };
      expect(formatActor(user)).toBe(
        'actor=aspirante id=asp-1 email=ana@hospital.com nombre=ANA PATRICIA slug=hospitalgeneral registro=260276 flowOrderId=4',
      );
    });

    it('formats evaluador with id and email', () => {
      const user: JwtPayloadAdmin = {
        sub: 'eval-1',
        type: 'admin',
        email: 'eva@hospital.com',
        rol: RolUsuarioAdmin.Evaluador,
        signature: false,
        supervisorId: null,
        supervisedUserIds: [],
      };
      expect(formatActor(user)).toBe(
        'actor=evaluador id=eval-1 email=eva@hospital.com rol=evaluador',
      );
    });

    it('formats administrador with id and email', () => {
      const user: JwtPayloadAdmin = {
        sub: 'adm-1',
        type: 'admin',
        email: 'admin@hospital.com',
        rol: RolUsuarioAdmin.Administrador,
        signature: true,
        supervisorId: null,
        supervisedUserIds: [],
      };
      expect(formatActor(user)).toBe(
        'actor=administrador id=adm-1 email=admin@hospital.com rol=administrador',
      );
    });

    it('uses (n/a) when email is missing from legacy tokens', () => {
      const user: JwtPayloadAspirante = {
        sub: 'asp-1',
        type: 'aspirante',
        tenantId: 't1',
        slug: 'h',
        registro: '1',
        nombre: 'Ana',
      };
      expect(formatActor(user)).toContain('email=(n/a)');
    });

    it('uses email from login body when anonymous', () => {
      expect(
        formatActor(undefined, { email: 'ana@hospital.com', password: 'x' }),
      ).toBe('actor=anonymous email=ana@hospital.com');
    });
  });

  describe('serializeForLog', () => {
    it('redacts secrets and tokens', () => {
      const serialized = serializeForLog({
        email: 'ana@hospital.com',
        password: 'secret',
        accessToken: 'jwt-here',
        nested: { primerAccesoToken: 'abc' },
      });
      expect(serialized).toContain('"email":"ana@hospital.com"');
      expect(serialized).toContain('"password":"[redacted]"');
      expect(serialized).toContain('"accessToken":"[redacted]"');
      expect(serialized).toContain('"primerAccesoToken":"[redacted]"');
      expect(serialized).not.toContain('secret');
      expect(serialized).not.toContain('jwt-here');
    });

    it('describes StreamableFile instead of dumping bytes', () => {
      const file = new StreamableFile(Buffer.from('pdf'), {
        type: 'application/pdf',
      });
      expect(serializeForLog(file)).toMatch(
        /^\[StreamableFile type=application\/pdf/,
      );
    });

    it('truncates large payloads', () => {
      const huge = { data: 'x'.repeat(8000) };
      const serialized = serializeForLog(huge);
      expect(serialized).toContain('truncated');
      expect(serialized.length).toBeLessThan(4500);
    });
  });

  describe('describeHttpError', () => {
    it('extracts status and body from HttpException', () => {
      const err = new BadRequestException('Ya existe respuesta');
      expect(describeHttpError(err)).toEqual({
        status: 400,
        name: 'BadRequestException',
        message: 'Ya existe respuesta',
        response: err.getResponse(),
      });
    });

    it('treats unknown errors as 500', () => {
      const err = new Error('boom');
      const described = describeHttpError(err);
      expect(described.status).toBe(500);
      expect(described.name).toBe('Error');
      expect(described.message).toBe('boom');
    });

    it('handles HttpException subclasses', () => {
      const err = new HttpException({ code: 'X', message: 'nope' }, 409);
      expect(describeHttpError(err).status).toBe(409);
      expect(describeHttpError(err).response).toEqual({
        code: 'X',
        message: 'nope',
      });
    });
  });

  describe('resolveIncomingRequestId', () => {
    it('accepts x-request-id', () => {
      expect(
        resolveIncomingRequestId({
          headers: { 'x-request-id': 'client-123' },
        }),
      ).toBe('client-123');
    });

    it('rejects malformed ids', () => {
      expect(
        resolveIncomingRequestId({
          headers: { 'x-request-id': 'has spaces' },
        }),
      ).toBeUndefined();
    });
  });
});
