import { prisma } from '@/infrastructure/di/Container';

export const FEATURES = {
  CHAT:                  'chat',
  CALENDARIO:            'calendario',
  FINANCEIRO:            'financeiro',
  ASSINATURA_ELETRONICA: 'assinatura_eletronica',
  RELATORIOS:            'relatorios',
  EQUIPE:                'equipe',
  INTEGRACAO_CORA:       'integracao_cora',
  IA:                    'ia',
} as const;

export type PlanFeature = typeof FEATURES[keyof typeof FEATURES];

export interface PlanInfo {
  planoNome: string;
  limiteClientes: number;    // -1 = unlimited
  limiteDocumentos: number;  // -1 = unlimited
  features: string[];
  status: string;
  isRestricted: boolean;     // CANCELADO or SUSPENSO
}

// No subscription = very limited trial
const SEM_PLANO: PlanInfo = {
  planoNome:        'Sem Plano',
  limiteClientes:   5,
  limiteDocumentos: 100,
  features:         ['chat', 'calendario'],
  status:           'SEM_PLANO',
  isRestricted:     false,
};

export async function getPlanInfo(contadorId: string): Promise<PlanInfo> {
  const assinatura = await prisma.assinaturaSaaS.findUnique({
    where:   { escritorioId: contadorId },
    include: { plano: true },
  });

  if (!assinatura) return SEM_PLANO;

  return {
    planoNome:        assinatura.plano.nome,
    limiteClientes:   assinatura.plano.limiteClientes,
    limiteDocumentos: assinatura.plano.limiteDocumentos,
    features:         assinatura.plano.features,
    status:           assinatura.status,
    isRestricted:     ['CANCELADO', 'SUSPENSO'].includes(assinatura.status),
  };
}

export function hasFeature(plan: PlanInfo, feature: PlanFeature): boolean {
  if (plan.isRestricted) return false;
  return plan.features.includes(feature);
}

export async function checkClienteLimit(contadorId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const plan = await getPlanInfo(contadorId);
  if (plan.isRestricted) return { allowed: false, current: 0, limit: 0 };
  if (plan.limiteClientes === -1) return { allowed: true, current: 0, limit: -1 };

  const current = await prisma.contadorCliente.count({ where: { contadorId } });
  return { allowed: current < plan.limiteClientes, current, limit: plan.limiteClientes };
}
