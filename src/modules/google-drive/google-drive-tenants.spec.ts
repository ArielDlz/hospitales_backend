import { parseEnabledTenantIds, isTenantDriveEnabled } from './google-drive-tenants';

describe('google-drive-tenants', () => {
  it('parsea UUIDs separados por coma y los normaliza a minúsculas', () => {
    expect(
      parseEnabledTenantIds(
        ' 72EC5B8B-75E9-4956-B17D-85C946856A2D , other-id ',
      ),
    ).toEqual([
      '72ec5b8b-75e9-4956-b17d-85c946856a2d',
      'other-id',
    ]);
  });

  it('devuelve vacío si el env está vacío', () => {
    expect(parseEnabledTenantIds('')).toEqual([]);
    expect(parseEnabledTenantIds(undefined)).toEqual([]);
  });

  it('compara tenant de forma case-insensitive', () => {
    const enabled = parseEnabledTenantIds(
      '72ec5b8b-75e9-4956-b17d-85c946856a2d',
    );
    expect(
      isTenantDriveEnabled('72EC5B8B-75E9-4956-B17D-85C946856A2D', enabled),
    ).toBe(true);
    expect(isTenantDriveEnabled('other-tenant', enabled)).toBe(false);
  });
});
