import {
  INFORME_SIGNER_DELEGATE_RULES,
  pickRandomItem,
  resolveInformeSignerCandidates,
} from './informe-signer-delegate';

describe('informe-signer-delegate', () => {
  const rule = INFORME_SIGNER_DELEGATE_RULES[0];

  describe('resolveInformeSignerCandidates', () => {
    it('returns delegated candidates when acting user and tenant match', () => {
      expect(
        resolveInformeSignerCandidates(rule.actingUserId, rule.tenantId),
      ).toEqual({
        delegated: true,
        candidateIds: rule.substituteUserIds,
      });
    });

    it('does not delegate when the tenant does not match', () => {
      expect(
        resolveInformeSignerCandidates(
          rule.actingUserId,
          '00000000-0000-0000-0000-000000000000',
        ),
      ).toEqual({ delegated: false });
    });

    it('does not delegate when the acting user does not match', () => {
      expect(
        resolveInformeSignerCandidates(
          '00000000-0000-0000-0000-000000000000',
          rule.tenantId,
        ),
      ).toEqual({ delegated: false });
    });
  });

  describe('pickRandomItem', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('picks the first item when Math.random is 0', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0);
      expect(pickRandomItem(['a', 'b', 'c'])).toBe('a');
    });

    it('picks the last item when Math.random is just below 1', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.999);
      expect(pickRandomItem(['a', 'b', 'c'])).toBe('c');
    });

    it('throws on an empty list', () => {
      expect(() => pickRandomItem([])).toThrow(
        'pickRandomItem requires a non-empty list',
      );
    });
  });
});
