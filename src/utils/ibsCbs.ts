export type StatusIbsCbs = 'PENDENTE' | 'DENTRO_DAS' | 'FORA_DAS' | 'NAO_SE_APLICA';
export type TipoJanelaIbsCbs = 'SETEMBRO' | 'MARCO';
export type FaseJanelaIbsCbs = 'ANTES' | 'ABERTA' | 'REVERSAO' | 'ENCERRADA';

export interface JanelaIbsCbs {
  tipo: TipoJanelaIbsCbs;
  /** YYYY-MM-DD */
  prazoInicio: string;
  prazoFim: string;
  reversaoAte: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  /** Ex.: 2027-S1 (jan–jun) ou 2027-S2 (jul–dez) */
  competencia: string;
  fase: FaseJanelaIbsCbs;
}

/** Primeira janela legal: Resolução CGSN nº 186/2026 (opção set/2026 → 1º sem/2027). */
const PRIMEIRA_JANELA = '2026-09-01';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function faseDaJanela(
  prazoInicio: string,
  prazoFim: string,
  reversaoAte: string,
  hojeYmd: string,
): FaseJanelaIbsCbs {
  if (hojeYmd < prazoInicio) return 'ANTES';
  if (hojeYmd <= prazoFim) return 'ABERTA';
  if (hojeYmd <= reversaoAte) return 'REVERSAO';
  return 'ENCERRADA';
}

/** Setembro do ano Y: efeitos jan–jun de Y+1. Reversão até 30/nov (CGSN 186). */
function janelaSetembro(anoOpcao: number, hojeYmd: string): Omit<JanelaIbsCbs, 'fase'> & { fase?: FaseJanelaIbsCbs } {
  const vigenciaAno = anoOpcao + 1;
  const prazoInicio = `${anoOpcao}-09-01`;
  const prazoFim    = `${anoOpcao}-09-30`;
  const reversaoAte = `${anoOpcao}-11-30`;
  return {
    tipo: 'SETEMBRO',
    prazoInicio,
    prazoFim,
    reversaoAte,
    vigenciaInicio: `${vigenciaAno}-01-01`,
    vigenciaFim:    `${vigenciaAno}-06-30`,
    competencia:    `${vigenciaAno}-S1`,
    fase: faseDaJanela(prazoInicio, prazoFim, reversaoAte, hojeYmd),
  };
}

/**
 * Março do ano Y: efeitos jul–dez de Y.
 * Janela seguinte prevista após set/2026 (comentários à CGSN 186/189).
 * Reversão espelha o +2 meses de set→nov; o CGSN pode confirmar a data exata.
 */
function janelaMarco(anoOpcao: number, hojeYmd: string): Omit<JanelaIbsCbs, 'fase'> & { fase?: FaseJanelaIbsCbs } {
  const prazoInicio = `${anoOpcao}-03-01`;
  const prazoFim    = `${anoOpcao}-03-31`;
  const reversaoAte = `${anoOpcao}-05-31`;
  return {
    tipo: 'MARCO',
    prazoInicio,
    prazoFim,
    reversaoAte,
    vigenciaInicio: `${anoOpcao}-07-01`,
    vigenciaFim:    `${anoOpcao}-12-31`,
    competencia:    `${anoOpcao}-S2`,
    fase: faseDaJanela(prazoInicio, prazoFim, reversaoAte, hojeYmd),
  };
}

/**
 * Janela de opção vigente ou a próxima.
 * Não trava em 2026: depois de nov/2026 passa a março/2027, depois set/2027, e assim por diante.
 */
export function obterJanelaIbsCbs(hoje: Date = new Date()): JanelaIbsCbs {
  const hojeYmd = ymd(hoje);
  const y = hoje.getFullYear();

  const candidatas = [
    janelaSetembro(y - 1, hojeYmd),
    janelaMarco(y, hojeYmd),
    janelaSetembro(y, hojeYmd),
    janelaMarco(y + 1, hojeYmd),
    janelaSetembro(y + 1, hojeYmd),
  ]
    .filter((j) => j.prazoInicio >= PRIMEIRA_JANELA)
    .map((j) => ({ ...j, fase: j.fase as FaseJanelaIbsCbs }));

  const aindaNaJanela = candidatas
    .filter((j) => hojeYmd <= j.reversaoAte)
    .sort((a, b) => a.prazoInicio.localeCompare(b.prazoInicio));

  return aindaNaJanela[0]
    ?? candidatas.sort((a, b) => b.prazoInicio.localeCompare(a.prazoInicio))[0];
}

/** Atalhos da janela atual — mudam sozinhos quando o calendário avança. */
export function prazosIbsCbs(hoje: Date = new Date()) {
  const j = obterJanelaIbsCbs(hoje);
  return {
    prazoInicio:    j.prazoInicio,
    prazoFim:       j.prazoFim,
    reversaoAte:    j.reversaoAte,
    vigencia:       j.vigenciaInicio,
    vigenciaFim:    j.vigenciaFim,
    competencia:    j.competencia,
    tipo:           j.tipo,
    fase:           j.fase,
  };
}

export function regimeAplicaIbsCbs(regime: string | null | undefined): boolean {
  const r = (regime ?? '').toUpperCase().replace(/\s+/g, '_');
  return r === 'MEI' || r === 'SIMPLES_NACIONAL' || r.includes('SIMPLES');
}

export function statusEfetivoIbsCbs(
  regime: string | null | undefined,
  status: StatusIbsCbs,
): StatusIbsCbs {
  if (!regimeAplicaIbsCbs(regime) && status === 'PENDENTE') return 'NAO_SE_APLICA';
  return status;
}
