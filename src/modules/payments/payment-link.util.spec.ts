import {
  hasBanortePaymentLink,
  resolvePaymentProvider,
} from './payment-link.util';

describe('payment-link.util', () => {
  describe('hasBanortePaymentLink', () => {
    it('es false si está vacío', () => {
      expect(hasBanortePaymentLink(null)).toBe(false);
      expect(hasBanortePaymentLink(undefined)).toBe(false);
      expect(hasBanortePaymentLink('')).toBe(false);
      expect(hasBanortePaymentLink('   ')).toBe(false);
    });

    it('es true si hay URL', () => {
      expect(hasBanortePaymentLink('https://banorte.example/pay')).toBe(true);
    });
  });

  describe('resolvePaymentProvider', () => {
    it('stripe si no hay liga', () => {
      expect(resolvePaymentProvider(null)).toBe('stripe');
      expect(resolvePaymentProvider('')).toBe('stripe');
    });

    it('banorte si hay liga', () => {
      expect(resolvePaymentProvider('https://banorte.example/pay')).toBe(
        'banorte',
      );
    });
  });
});
