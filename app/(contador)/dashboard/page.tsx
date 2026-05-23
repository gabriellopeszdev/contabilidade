'use client';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { DashboardContadorDono } from '../../../src/presentation/components/dashboard/DashboardContadorDono';
import { DashboardContadorFuncionario } from '../../../src/presentation/components/dashboard/DashboardContadorFuncionario';

// =============================================================================
// Dashboard — Renderização Condicional por Perfil
//
// Contador (dono)          → visão completa com métricas, gráficos, kanban,
//                            ações rápidas e feed de atividade.
// Funcionário (escritório) → visão restrita com métricas do seu escopo,
//                            kanban filtrado e feed de atividade.
// =============================================================================

export default function DashboardPage() {
  const { token, isFuncionarioEscritorio, usuario } = useAuth();

  if (isFuncionarioEscritorio) {
    return (
      <DashboardContadorFuncionario
        token={token}
        setores={usuario?.setores}
      />
    );
  }

  return <DashboardContadorDono token={token} />;
}
