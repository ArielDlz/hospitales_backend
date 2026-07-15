import { ForbiddenException } from '@nestjs/common';
import {
  assertTenantAccessWindow,
  isTenantAccessClosed,
  MSG_ACCESO_AUN_NO_ABIERTO,
  MSG_ACCESO_FINALIZADO,
  resolveAspiranteJwtExpiresIn,
} from './tenant-access-window';

describe('tenant-access-window', () => {
  const abre = new Date('2026-07-16T06:00:00.000Z'); // 00:00 CDMX
  const cierra = new Date('2026-08-31T05:59:59.000Z');

  describe('assertTenantAccessWindow', () => {
    it('allows when both dates are null', () => {
      expect(() =>
        assertTenantAccessWindow({ accesoAbreAt: null, accesoCierraAt: null }),
      ).not.toThrow();
    });

    it('blocks before open', () => {
      expect(() =>
        assertTenantAccessWindow(
          { accesoAbreAt: abre, accesoCierraAt: cierra },
          abre.getTime() - 1,
        ),
      ).toThrow(ForbiddenException);
      try {
        assertTenantAccessWindow(
          { accesoAbreAt: abre, accesoCierraAt: cierra },
          abre.getTime() - 1,
        );
      } catch (e) {
        expect((e as ForbiddenException).message).toBe(MSG_ACCESO_AUN_NO_ABIERTO);
      }
    });

    it('allows at open instant', () => {
      expect(() =>
        assertTenantAccessWindow(
          { accesoAbreAt: abre, accesoCierraAt: cierra },
          abre.getTime(),
        ),
      ).not.toThrow();
    });

    it('allows during the window', () => {
      expect(() =>
        assertTenantAccessWindow(
          { accesoAbreAt: abre, accesoCierraAt: cierra },
          abre.getTime() + 1000,
        ),
      ).not.toThrow();
    });

    it('blocks after close', () => {
      try {
        assertTenantAccessWindow(
          { accesoAbreAt: abre, accesoCierraAt: cierra },
          cierra.getTime() + 1,
        );
        fail('expected ForbiddenException');
      } catch (e) {
        expect(e).toBeInstanceOf(ForbiddenException);
        expect((e as ForbiddenException).message).toBe(MSG_ACCESO_FINALIZADO);
      }
    });

    it('allows when only abre is null and now before a phantom close is irrelevant', () => {
      expect(() =>
        assertTenantAccessWindow(
          { accesoAbreAt: null, accesoCierraAt: cierra },
          cierra.getTime() - 1,
        ),
      ).not.toThrow();
    });

    it('blocks after close even if abre is null', () => {
      expect(() =>
        assertTenantAccessWindow(
          { accesoAbreAt: null, accesoCierraAt: cierra },
          cierra.getTime() + 1,
        ),
      ).toThrow(MSG_ACCESO_FINALIZADO);
    });

    it('blocks before open even if cierra is null', () => {
      expect(() =>
        assertTenantAccessWindow(
          { accesoAbreAt: abre, accesoCierraAt: null },
          abre.getTime() - 1,
        ),
      ).toThrow(MSG_ACCESO_AUN_NO_ABIERTO);
    });
  });

  describe('isTenantAccessClosed / resolveAspiranteJwtExpiresIn', () => {
    it('is false and 1d when cierra is null', () => {
      expect(isTenantAccessClosed({ accesoCierraAt: null })).toBe(false);
      expect(resolveAspiranteJwtExpiresIn({ accesoCierraAt: null })).toBe('1d');
    });

    it('is false and 1d before close', () => {
      expect(
        isTenantAccessClosed({ accesoCierraAt: cierra }, cierra.getTime()),
      ).toBe(false);
      expect(
        resolveAspiranteJwtExpiresIn({ accesoCierraAt: cierra }, cierra.getTime()),
      ).toBe('1d');
    });

    it('is true and 1h after close', () => {
      const after = cierra.getTime() + 1;
      expect(isTenantAccessClosed({ accesoCierraAt: cierra }, after)).toBe(true);
      expect(resolveAspiranteJwtExpiresIn({ accesoCierraAt: cierra }, after)).toBe(
        '1h',
      );
    });
  });
});
