import { ForbiddenException } from '@nestjs/common';
import {
  assertLoginAllowedAfterClose,
  assertTenantAccessOpened,
  assertTenantAccessWindow,
  assertTenantNotClosed,
  isTenantAccessClosed,
  MSG_ACCESO_AUN_NO_ABIERTO,
  MSG_ACCESO_FINALIZADO,
  resolveAspiranteJwtExpiresIn,
} from './tenant-access-window';

describe('tenant-access-window', () => {
  const abre = new Date('2026-07-16T06:00:00.000Z'); // 00:00 CDMX
  const cierra = new Date('2026-08-31T05:59:59.000Z');

  describe('assertTenantAccessOpened', () => {
    it('blocks before open', () => {
      expect(() =>
        assertTenantAccessOpened({ accesoAbreAt: abre }, abre.getTime() - 1),
      ).toThrow(MSG_ACCESO_AUN_NO_ABIERTO);
    });

    it('allows after open even if closed', () => {
      expect(() =>
        assertTenantAccessOpened({ accesoAbreAt: abre }, cierra.getTime() + 1),
      ).not.toThrow();
    });
  });

  describe('assertTenantNotClosed', () => {
    it('allows before close', () => {
      expect(() =>
        assertTenantNotClosed({ accesoCierraAt: cierra }, cierra.getTime()),
      ).not.toThrow();
    });

    it('blocks after close', () => {
      expect(() =>
        assertTenantNotClosed({ accesoCierraAt: cierra }, cierra.getTime() + 1),
      ).toThrow(MSG_ACCESO_FINALIZADO);
    });
  });

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

    it('allows when only abre is null and now before close', () => {
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

  describe('assertLoginAllowedAfterClose', () => {
    it('allows any step when not closed', () => {
      expect(() =>
        assertLoginAllowedAfterClose(
          { accesoCierraAt: cierra },
          1,
          cierra.getTime(),
        ),
      ).not.toThrow();
    });

    it('blocks step < 3 after close', () => {
      expect(() =>
        assertLoginAllowedAfterClose(
          { accesoCierraAt: cierra },
          2,
          cierra.getTime() + 1,
        ),
      ).toThrow(MSG_ACCESO_FINALIZADO);
    });

    it('allows step >= 3 after close', () => {
      expect(() =>
        assertLoginAllowedAfterClose(
          { accesoCierraAt: cierra },
          3,
          cierra.getTime() + 1,
        ),
      ).not.toThrow();
      expect(() =>
        assertLoginAllowedAfterClose(
          { accesoCierraAt: cierra },
          5,
          cierra.getTime() + 1,
        ),
      ).not.toThrow();
    });
  });

  describe('isTenantAccessClosed / resolveAspiranteJwtExpiresIn', () => {
    it('is false when cierra is null; JWT always 1d', () => {
      expect(isTenantAccessClosed({ accesoCierraAt: null })).toBe(false);
      expect(resolveAspiranteJwtExpiresIn()).toBe('1d');
    });

    it('is false before close; JWT always 1d', () => {
      expect(
        isTenantAccessClosed({ accesoCierraAt: cierra }, cierra.getTime()),
      ).toBe(false);
      expect(resolveAspiranteJwtExpiresIn()).toBe('1d');
    });

    it('is true after close; JWT still 1d', () => {
      const after = cierra.getTime() + 1;
      expect(isTenantAccessClosed({ accesoCierraAt: cierra }, after)).toBe(true);
      expect(resolveAspiranteJwtExpiresIn()).toBe('1d');
    });
  });
});
