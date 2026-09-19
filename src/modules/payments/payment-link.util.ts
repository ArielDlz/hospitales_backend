export function hasBanortePaymentLink(
  link: string | null | undefined,
): boolean {
  return Boolean(link?.trim());
}

export function resolvePaymentProvider(
  link: string | null | undefined,
): 'stripe' | 'banorte' {
  return hasBanortePaymentLink(link) ? 'banorte' : 'stripe';
}

