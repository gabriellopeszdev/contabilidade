'use client';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
import DashboardClienteDono from '../../../src/presentation/components/dashboard/DashboardClienteDono';
import DashboardClienteFuncionario from '../../../src/presentation/components/dashboard/DashboardClienteFuncionario';

// =============================================================================
// Página: /documentos — Renderização Condicional por Perfil
//
// Cliente (dono)              → visão completa com gráficos e gestão de docs.
// Funcionário (empresa)       → visão restrita com documentos do seu setor.
// =============================================================================

export default function DocumentosPage() {
  const { isFuncionarioCliente } = useAuth();

  if (isFuncionarioCliente) {
    return <DashboardClienteFuncionario />;
  }

  return <DashboardClienteDono />;
}
