export const MSG_FIRMANTE_DELEGADO_NO_DISPONIBLE =
  'No hay firmante delegado disponible';

export type InformeSignerDelegateRule = {
  actingUserId: string;
  tenantId: string;
  substituteUserIds: readonly string[];
};

export const INFORME_SIGNER_DELEGATE_RULES: readonly InformeSignerDelegateRule[] =
  [
    {
      actingUserId: '5bfca89b-3331-424c-b8e1-60312f1fcfaf',
      tenantId: '72ec5b8b-75e9-4956-b17d-85c946856a2d',
      substituteUserIds: [
        'e4c4333a-fb4f-4bca-8dbb-57ed2525a1ee',
        'ff6b3094-b607-4408-a084-bd0c5a38c961',
      ],
    },
  ];

export type InformeSignerCandidates =
  | { delegated: false }
  | { delegated: true; candidateIds: readonly string[] };

export function resolveInformeSignerCandidates(
  actingUserId: string,
  tenantId: string,
): InformeSignerCandidates {
  const rule = INFORME_SIGNER_DELEGATE_RULES.find(
    (r) => r.actingUserId === actingUserId && r.tenantId === tenantId,
  );
  if (!rule) {
    return { delegated: false };
  }
  return { delegated: true, candidateIds: rule.substituteUserIds };
}

export function pickRandomItem<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pickRandomItem requires a non-empty list');
  }
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}
