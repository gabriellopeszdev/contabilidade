# FiscoHub — Roadmap de expansão por porte de cliente

Roadmap para evoluir o FiscoHub de gestão documental/comunicação para sistema contábil completo, seguindo a ordem: pequenas empresas → médias empresas → grandes empresas. Baseado no mapeamento do FiscoHub e na pesquisa de concorrentes (ver `FiscoHub-mapeamento-completo.md` e `Concorrentes-e-gaps-FiscoHub.md`).

## Como usar este documento

Cada fase lista o perfil de cliente-alvo, o que o FiscoHub já cobre bem para esse perfil, o que falta adicionar, e uma prioridade (Alta/Média/Baixa) com estimativa de esforço relativo (Baixo/Médio/Alto). Itens de Alta prioridade e Baixo esforço são os melhores pontos de partida.

---

## Urgente e transversal — antes de qualquer fase

### Rastreador de decisão IBS/CBS do Simples Nacional (prazo: setembro/2026)

Toda empresa do Simples Nacional precisa decidir, entre 1 e 30/set/2026, se recolhe IBS/CBS dentro do DAS ou pelo regime regular fora dele — decisão que vale a partir de 1/jan/2027 e só pode ser revertida até 30/nov/2026. Afeta a carteira inteira de clientes pequenos/médios de uma vez.

- **Prioridade:** Alta. **Esforço:** Baixo.
- Reaproveita `ObrigacaoFiscal`/`Comunicado`: criar um tipo de item específico com status por cliente (pendente/decidido) e um comunicado em massa avisando o prazo.
- Sem isso, é o gap com prazo mais curto de todo o roadmap.

---

## Fase 1 — Pequenas empresas (MEI e Simples Nacional)

**Perfil do cliente:** MEI e Simples Nacional simples, geralmente prestador de serviço ou pequeno comércio. Poucas obrigações, baixa complexidade fiscal, dono da empresa pouco familiarizado com jargão contábil.

**Já coberto pelo FiscoHub:** portal de documentos com upload/download e versionamento, comunicados com confirmação de leitura, cobrança de honorários via Asaas/Cora (boleto/PIX), assinatura eletrônica, chat contador↔cliente, calendário de obrigações fiscais (genérico, cadastro manual), onboarding com checklist e NPS.

| # | Item | Prioridade | Esforço | Observação |
|---|---|---|---|---|
| 1 | Rastreador de decisão IBS/CBS (ver acima) | Alta | Baixo | Prazo real em set/2026 |
| 2 | Modelo pré-cadastrado de obrigação "DAS MEI" (lembrete automático, vencimento dia 20) | Alta | Baixo | Reaproveita `ObrigacaoFiscal` com recorrência mensal já existente; só falta um template pronto |
| 3 | Modelo pré-cadastrado de obrigação "DASN-SIMEI" (declaração anual do MEI) | Alta | Baixo | Mesmo mecanismo do item 2, recorrência anual |
| 4 | Notificações via WhatsApp (além de email/in-app) | Alta | Médio | Público MEI usa WhatsApp no dia a dia mais que portal web; maior ganho de percepção do roadmap por esforço |
| 5 | Geração/cálculo automático da guia DAS (PGMEI) | Média | Alto | Exige integração com sistema da Receita (scraping ou robô); alto valor mas maior complexidade técnica e de manutenção (o serviço do governo muda sem aviso) |
| 6 | Emissão de NFS-e para MEI/Simples prestadores de serviço | Média | Alto | Hoje o FiscoHub só importa/analisa NF-e recebida, não emite; decidir se está no escopo do produto ou se é integração com emissor externo |

---

## Fase 2 — Médias empresas (Simples Nacional maior / Lucro Presumido)

**Perfil do cliente:** empresas com mais movimento financeiro, folha de funcionários, eventual apuração de ISS/ICMS. Já espera relatórios mais robustos e integração bancária.

**Pré-requisito:** Fase 1 estável e em uso real com clientes pequenos.

| # | Item | Prioridade | Esforço | Observação |
|---|---|---|---|---|
| 7 | Conciliação bancária automática (importar extrato, cruzar com lançamentos) | Alta | Alto | Diferencial citado por Alterdata/Nibo como essencial; exige módulo de lançamentos contábeis que o FiscoHub ainda não tem |
| 8 | Integração com eSocial (cadastro/admissão de empregados) | Alta | Alto | Depende de folha de pagamento mínima ou de integração com sistema de folha externo |
| 9 | Busca/emissão automática de Certidões Negativas (e-CAC) | Média | Médio | Robô de consulta periódica + alerta de vencimento; não depende de módulo de lançamentos |
| 10 | Apuração simplificada de ISS/ICMS | Média | Alto | Cálculo específico por município/estado; validar se compensa construir vs. integrar com serviço de terceiro |
| 11 | Relatórios consultivos (não só obrigatórios) — DRE simplificado, indicadores | Média | Médio | Mercado (Ledware, Domínio) cita isso como diferencial de retenção de cliente |
| 12 | Simulador de cenário tributário (regime atual vs. IBS/CBS) | Baixa | Alto | Alto valor consultivo (visto no e-Auditoria), mas complexo e menos urgente que os itens acima nesta fase |

---

## Fase 3 — Grandes empresas (Lucro Real / Presumido complexo)

**Perfil do cliente:** apuração tributária federal completa, obrigações acessórias pesadas, exigência de auditoria e rastreabilidade.

**Pré-requisito:** módulo de lançamentos contábeis e conciliação bancária da Fase 2 já maduros.

| # | Item | Prioridade | Esforço | Observação |
|---|---|---|---|---|
| 13 | Geração e correção de SPED Contábil/Fiscal (incl. correção em lote de erros do PVA) | Alta | Alto | Praticamente obrigatório para Lucro Real; e-Auditoria e Questor têm isso como núcleo do produto |
| 14 | Apuração de tributos federais (IRPJ, CSLL, PIS, COFINS) | Alta | Alto | Núcleo do módulo Fiscal de Questor/Domínio/Alterdata |
| 15 | Módulo de Patrimônio / Ativo Imobilizado (depreciação, amortização) | Média | Alto | Relevante só a partir de empresas com ativo imobilizado relevante |
| 16 | Folha de pagamento completa (férias, 13º, adiantamentos, encargos) | Média | Alto | Pode continuar sendo integração com sistema de folha especializado em vez de construir do zero |
| 17 | Auditoria digital contínua (cruzamento automático de SPED, detecção de inconsistências) | Baixa | Alto | Recurso mais avançado (e-Auditoria); faz sentido só depois que os módulos base (13–14) estiverem sólidos |

---

## Resumo visual de prioridade × esforço

**Fazer primeiro (Alta prioridade + Baixo/Médio esforço):** rastreador IBS/CBS, templates de obrigação DAS/DASN-SIMEI, notificação via WhatsApp.

**Planejar com calma (Alta prioridade + Alto esforço):** conciliação bancária, eSocial, SPED, apuração de tributos federais — todos exigem construir um módulo de lançamentos contábeis que hoje não existe no FiscoHub; vale desenhar esse módulo pensando já nas Fases 2 e 3 juntas, para não refazer a base duas vezes.

**Avaliar build vs. buy:** geração automática de guia DAS, emissão de NFS-e, apuração de ISS/ICMS, simulador tributário, auditoria digital — todos têm players especializados no mercado (SIEG, Contmatic, e-Auditoria) que já resolvem isso via integração; pode valer mais integrar do que construir, dependendo do orçamento e prazo.
