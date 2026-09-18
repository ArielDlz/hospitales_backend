export function hasBanortePaymentLink(
  link: string | null | undefined,
): boolean {
  return Boolean(link?.trim());
}
