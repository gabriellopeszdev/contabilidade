# Concorrentes de mercado e gaps de funcionalidade do FiscoHub

Pesquisa feita em 14/07/2026, cruzando o que o mercado brasileiro de sistemas contábeis oferece com o que o FiscoHub já tem hoje (ver `FiscoHub-mapeamento-completo.md`).

## 1. Quem foi pesquisado

**Tradicionais/grandes (nuvem + local):** Domínio Sistemas (Thomson Reuters), Alterdata, Mastermaq, Questor.
**Nativos em nuvem, mais recentes:** Onvio (Thomson Reuters), Nibo, LedContábil (Ledware), e-Auditoria.
**Financeiro/PME (adjacentes, não concorrentes diretos de back-office contábil):** Conta Azul, Omie, Contabilizei.

## 2. O que o mercado oferece que o FiscoHub ainda não tem

### Reforma Tributária (CBS/IBS) — maior gap, e o mais urgente
2026 é o ano de transição: desde janeiro, notas fiscais precisam destacar IBS e CBS (caráter informativo); a adaptação do sistema emissor é obrigatória a partir de 3/ago/2026 para Lucro Presumido/Real e até 4/jan/2027 para Simples Nacional/MEI. Praticamente todo concorrente pesquisado (Domínio, LedContábil, e-Auditoria) já cita isso como critério decisivo de compra em 2026 — quem não acompanhar "vira peso morto". O FiscoHub hoje só faz parsing de XML de NF-e sem nenhuma menção a IBS/CBS/IS ou ao Simples Nacional pós-reforma. Isso é o gap mais crítico e com prazo mais curto.

### Integrações fiscais que faltam
- **eSocial** — cadastro/validação de empregados, envio de admissão/rubricas de folha (Domínio, Onvio).
- **e-CAC / Certidões Negativas** — busca, emissão e controle automático de vencimento de certidões (Domínio, Onvio).
- **SPED Contábil/Fiscal** — geração e correção automatizada de arquivos SPED, inclusive correção em lote de erros do PVA (e-Auditoria, Questor).
- **Robôs de captura de NF-e/CT-e/NFS-e/CF-e direto do ambiente da Receita**, não só upload manual de XML (e-Auditoria "Robô NF-e e SIEG", Questor "Quiu").
- **Conciliação bancária automática** cruzando extrato importado com lançamentos (Alterdata, Nibo) — o FiscoHub não tem módulo financeiro/contábil de lançamentos, só documentos e cobrança de honorários.
- **Módulo de Patrimônio/Ativo Imobilizado** (depreciação, amortização) — presente no Questor, ausente no FiscoHub.
- **Folha de pagamento** com cálculo de férias, 13º, adiantamentos — presente em Questor/Alterdata/Domínio, ausente no FiscoHub (que tem só gestão de equipe/funcionários internos, não folha do cliente).

### Automação e IA além do chat
O mercado já foca em: OCR de PDFs/notas fiscais para classificar lançamentos automaticamente, análise preditiva de fluxo de caixa (3-6 meses de antecedência), detecção de inconsistências tributárias, e "robôs" personalizáveis por tipo de documento que o próprio contador configura sem código (Nibo). O FiscoHub tem chat-ia e sugestão de obrigações/regime tributário via IA, mas não tem OCR de classificação automática de lançamentos nem análise preditiva.

### Atendimento via WhatsApp
Nibo e diversos players oferecem atendimento ao cliente integrado ao WhatsApp além do portal web — tendência forte em 2026 para reduzir fricção de comunicação. O FiscoHub tem chat interno + comunicados, mas nada em WhatsApp.

### Simulador de cenário tributário
e-Auditoria oferece simulador comparando carga tributária atual vs. modelo CBS+IBS+IS com dados reais do cliente — ferramenta consultiva que ajuda o contador a vender valor agregado, não só compliance.

## 3. Onde o FiscoHub já está no nível (ou à frente) do mercado

- **Portal do cliente com upload/download, versionamento de documentos, confirmação de leitura** — equivalente ao que Domínio/Alterdata/Onvio oferecem.
- **Assinatura eletrônica com múltiplos providers (interno/DocSeal/SignatureAPI)** — poucos concorrentes pesquisados detalham isso tão explicitamente; é um diferencial.
- **Kanban de tarefas com atribuição por setor/funcionário** — comparável ao "estruture processos, tarefas recorrentes" do Nibo.
- **Calendário de obrigações fiscais com recorrência e lembretes automáticos por email** — equivalente ao módulo de obrigações do Nibo/Domínio.
- **Self-hosted via Docker com custo zero de licença e foco em LGPD** — é um diferencial de posicionamento que nenhum dos concorrentes pesquisados oferece (todos são SaaS multi-tenant hospedados pelo próprio fornecedor); vale explorar isso como argumento de venda para escritórios que querem dados 100% sob seu controle.
- **Multi-provider de IA configurável por escritório** — não vi isso em nenhum concorrente (a maioria embute um único motor de IA proprietário).

## 4. Prioridades sugeridas (se for expandir)

1. **Suporte a IBS/CBS na NF-e e nas obrigações** — prazo real já em agosto/2026 para Lucro Presumido/Real; é o que decide contratos este ano.
2. **eSocial + certidões negativas** — segunda dor mais citada como diferencial competitivo.
3. **Conciliação bancária** — abre caminho para o FiscoHub deixar de ser só "gestão documental + kanban" e virar sistema contábil completo (concorre de fato com Domínio/Alterdata/Questor).
4. **OCR/classificação automática de lançamentos** — reforça o time de IA que o projeto já tem como base.
5. **Canal de atendimento via WhatsApp** — ganho de percepção rápido, esforço técnico relativamente baixo comparado aos itens acima.

## Fontes

- [Top 5 sistemas contábeis do Brasil em 2026 — N2F](https://www.n2f.com/blog/pt/top-5-sistemas-contabeis-do-brasil/)
- [Comparativo de sistemas contábeis para escritórios em 2026: Domínio, Alterdata, Mastermaq e LedContábil — Ledware](https://www.ledware.com.br/2026/04/28/comparativo-sistemas-contabeis-escritorios-2026-dominio-alterdata-mastermaq-ledcontabil/)
- [Domínio Portal do Cliente — Thomson Reuters](https://www.dominiosistemas.com.br/solucoes/evolucao-em-nuvem/portal-do-cliente/)
- [Questor Docs — Fiscal](https://docs.questor.com.br/pt-br/Produtos/Gest%C3%A3oCont%C3%A1bil/Fiscal)
- [Módulos adicionais e ferramentas integradas — Questor](https://www.questor.com.br/modulos-adicionais-e-ferramentas-integradas-conheca-as-possibilidades-e-como-podem-impulsionar-o-seu-sistema-contabil/)
- [Onvio — Portal do Cliente](https://onvio.com.br/clientcenter/)
- [Thomson Reuters lança Onvio — sala de imprensa](https://www.thomsonreuters.com.br/pt/sala-de-imprensa/thomson-reuters-lanca-onvio-a-primeira-plataforma-do-seu-portfolio-para-profissionais-contabeis-disponivel-na-nuvem.html)
- [Alterdata Contábil](https://www.alterdata.com.br/contabil/alterdata-contabil)
- [Alterdata — sistema para empresa contábil](https://blog.alterdata.com.br/alterdata-sistema-para-empresa-contabil/)
- [Nibo — funcionalidades de obrigações](https://www.nibo.com.br/contador/funcionalidades/obrigacoes)
- [Nibo — gerenciador financeiro](https://www.nibo.com.br/contador/funcionalidades/gerenciador-financeiro)
- [e-Auditoria — soluções](https://www.e-auditoria.com.br/solucoes/)
- [IA na contabilidade: o que é, funções, benefícios — e-Auditoria](https://www.e-auditoria.com.br/blog/ia-na-contabilidade-o-que-e-funcoes-beneficios/)
- [Inteligência Artificial para contadores 2026 — Domínio Sistemas](https://www.dominiosistemas.com.br/blog/inteligencia-artificial-para-contadores/)
- [Reforma tributária: IBS e CBS mudam a rotina das empresas em 2026 — Fenacon](https://fenacon.org.br/reforma-tributaria/reforma-tributaria-ibs-e-cbs-mudam-a-rotina-das-empresas-em-2026/)
- [NF-e Reforma Tributária: Novos Campos IBS, CBS e IS 2026 — Contmatic](https://simplifique.contmatic.com.br/blogs/nf-e-novos-campos-reforma-tributaria-2026)
- [Reforma tributária: empresas devem adaptar sistemas — Anefac](https://www.anefac.org.br/radar-anefac/reforma-tributaria-empresas-devem-adaptar-sistemas-para-emissao-de-notas-fiscais-com-ibs-e-cbs-em-2026/)
