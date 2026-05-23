'use strict';

const fs = require('fs');
const path = require('path');

// Load docx from global npm installation
let docxPath = 'docx';
try { require.resolve('docx'); } catch {
  docxPath = 'C:/Users/lopee/AppData/Roaming/npm/node_modules/docx';
}

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageNumber,
  Header,
  Footer,
} = require(docxPath);

// =============================================================================
// Helpers
// =============================================================================

/** Content width for A4 with 2 cm margins on each side (approx 1134 DXA each side) */
const PAGE_WIDTH_DXA = 11906;
const MARGIN_DXA     = 1134; // ~2 cm
const CONTENT_WIDTH  = PAGE_WIDTH_DXA - MARGIN_DXA * 2; // 9638

const BORDER_CELL = { style: BorderStyle.SINGLE, size: 1, color: 'D0D0D0' };
const BORDERS_ALL  = { top: BORDER_CELL, bottom: BORDER_CELL, left: BORDER_CELL, right: BORDER_CELL };

// Cor azul claro para cabeçalho
const HEADER_BG = '2E75B6';
// Verde claro para "Implementado"
const GREEN_BG  = 'E2EFDA';
// Azul claro para "Novo"
const BLUE_BG   = 'DEEAF1';

/** Parágrafo vazio para espaçamento */
function spacer(lines = 1) {
  return Array.from({ length: lines }, () =>
    new Paragraph({ children: [new TextRun('')], spacing: { after: 80 } })
  );
}

/** Célula de cabeçalho de tabela */
function headerCell(text, widthDxa) {
  return new TableCell({
    borders: BORDERS_ALL,
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { fill: HEADER_BG, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 18, font: 'Arial' })],
      }),
    ],
  });
}

/** Célula de dado */
function dataCell(text, widthDxa, bg) {
  return new TableCell({
    borders: BORDERS_ALL,
    width: { size: widthDxa, type: WidthType.DXA },
    shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        children: [new TextRun({ text, size: 18, font: 'Arial' })],
      }),
    ],
  });
}

/** Célula de método (badge colorido) */
function methodCell(method, widthDxa) {
  const colors = {
    GET:    { bg: 'D9EAD3', fg: '274E13' },
    POST:   { bg: 'FCE5CD', fg: '7F3B08' },
    PUT:    { bg: 'FFF2CC', fg: '7D6608' },
    DELETE: { bg: 'F4CCCC', fg: '7B241C' },
  };
  const c = colors[method] ?? { bg: 'EFEFEF', fg: '333333' };
  return new TableCell({
    borders: BORDERS_ALL,
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { fill: c.bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: method, bold: true, size: 18, color: c.fg, font: 'Arial' })],
      }),
    ],
  });
}

/** Célula de status badge */
function statusCell(label, isNew, widthDxa) {
  const bg = isNew ? BLUE_BG : GREEN_BG;
  const color = isNew ? '1F4E79' : '375623';
  return new TableCell({
    borders: BORDERS_ALL,
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: label, bold: true, size: 18, color, font: 'Arial' })],
      }),
    ],
  });
}

// =============================================================================
// Tabela de rotas
// =============================================================================

/**
 * cols: [{ label, width }]
 * rows: [{ method, route, description, isNew }]
 */
function buildRoutesTable(rows, isNewSection) {
  const totalW = CONTENT_WIDTH;
  const colW = {
    method: 900,
    route:  3500,
    desc:   totalW - 900 - 3500 - 1100,
    status: 1100,
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell('Método', colW.method),
      headerCell('Rota', colW.route),
      headerCell('Descrição', colW.desc),
      headerCell('Status', colW.status),
    ],
  });

  const dataRows = rows.map((r) =>
    new TableRow({
      children: [
        methodCell(r.method, colW.method),
        dataCell(r.route, colW.route),
        dataCell(r.description, colW.desc),
        statusCell(r.status ?? (isNewSection ? 'Novo' : 'Implementado'), isNewSection, colW.status),
      ],
    })
  );

  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: [colW.method, colW.route, colW.desc, colW.status],
    rows: [headerRow, ...dataRows],
  });
}

// =============================================================================
// Tabela de webhooks
// =============================================================================

function buildWebhooksTable(rows) {
  const totalW = CONTENT_WIDTH;
  const colW = {
    event:  3000,
    status: 1800,
    desc:   totalW - 3000 - 1800,
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell('Evento Asaas', colW.event),
      headerCell('Status Interno', colW.status),
      headerCell('Descrição', colW.desc),
    ],
  });

  const dataRows = rows.map((r, i) =>
    new TableRow({
      children: [
        dataCell(r.event,  colW.event,  i % 2 === 0 ? 'F8F8F8' : undefined),
        dataCell(r.status, colW.status, i % 2 === 0 ? 'F8F8F8' : undefined),
        dataCell(r.desc,   colW.desc,   i % 2 === 0 ? 'F8F8F8' : undefined),
      ],
    })
  );

  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: [colW.event, colW.status, colW.desc],
    rows: [headerRow, ...dataRows],
  });
}

// =============================================================================
// Tabela de variáveis de ambiente
// =============================================================================

function buildEnvTable(rows) {
  const totalW = CONTENT_WIDTH;
  const colW = {
    name:  3200,
    desc:  totalW - 3200 - 2000,
    ex:    2000,
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell('Variável', colW.name),
      headerCell('Descrição', colW.desc),
      headerCell('Exemplo', colW.ex),
    ],
  });

  const dataRows = rows.map((r, i) =>
    new TableRow({
      children: [
        dataCell(r.name, colW.name, i % 2 === 0 ? 'F8F8F8' : undefined),
        dataCell(r.desc, colW.desc, i % 2 === 0 ? 'F8F8F8' : undefined),
        dataCell(r.ex,   colW.ex,   i % 2 === 0 ? 'F8F8F8' : undefined),
      ],
    })
  );

  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: [colW.name, colW.desc, colW.ex],
    rows: [headerRow, ...dataRows],
  });
}

// =============================================================================
// Parágrafo de seção
// =============================================================================

function sectionTitle(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, font: 'Arial', color: '1F3864' })],
  });
}

function subTitle(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 22, font: 'Arial', color: '2E75B6' })],
  });
}

function bodyText(text) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 18, font: 'Arial' })],
  });
}

function inlineCode(text) {
  return new Paragraph({
    spacing: { after: 120 },
    shading: { fill: 'F0F0F0', type: ShadingType.CLEAR },
    children: [new TextRun({ text, size: 18, font: 'Courier New', color: 'C7254E' })],
  });
}

// =============================================================================
// DADOS
// =============================================================================

const ROTAS_EXISTENTES = [
  { method: 'PUT',  route: '/api/v1/admin/contadores/[id]/asaas', description: 'Salva/remove chave de API Asaas do contador. Agora tambem registra webhook automaticamente.' },
  { method: 'POST', route: '/api/v1/webhooks/asaas',              description: 'Recebe eventos de pagamento do Asaas e atualiza status dos boletos no banco.' },
  { method: 'GET',  route: '/api/v1/financeiro/boletos',          description: 'Lista boletos de honorarios com paginacao e filtros por status e cliente.' },
  { method: 'POST', route: '/api/v1/financeiro/boletos',          description: 'Cria boleto via Asaas (PIX/Boleto/Indefinido) ou gera PDF local como fallback.' },
  { method: 'GET',  route: '/api/v1/financeiro/boletos/[id]',     description: 'Retorna detalhes de um boleto, incluindo barcode e Pix copia e cola.' },
  { method: 'DELETE', route: '/api/v1/financeiro/boletos/[id]',   description: 'Cancela boleto no Asaas e atualiza status para CANCELADO.' },
];

const ROTAS_NOVAS = [
  { method: 'GET',    route: '/api/v1/financeiro/resumo-asaas',          description: 'Retorna estatisticas e saldo da conta Asaas do contador (pendente, pago, vencido, cancelado).' },
  { method: 'POST',   route: '/api/v1/financeiro/boletos/[id]/estorno',  description: 'Estorna pagamento de boleto ja pago via Asaas e marca como CANCELADO.' },
  { method: 'GET',    route: '/api/v1/financeiro/assinaturas',           description: 'Lista assinaturas recorrentes do escritorio, com filtro por cliente.' },
  { method: 'POST',   route: '/api/v1/financeiro/assinaturas',           description: 'Cria assinatura recorrente no Asaas (BOLETO, PIX ou INDEFINIDO) vinculada ao cliente.' },
  { method: 'DELETE', route: '/api/v1/financeiro/assinaturas/[id]',      description: 'Cancela assinatura no Asaas e marca como INACTIVE no banco de dados.' },
];

const WEBHOOKS = [
  { event: 'PAYMENT_RECEIVED',              status: 'PAGO',      desc: 'Pagamento recebido e confirmado pelo banco.' },
  { event: 'PAYMENT_CONFIRMED',             status: 'PAGO',      desc: 'Pagamento confirmado (alias de RECEIVED em alguns contextos).' },
  { event: 'PAYMENT_OVERDUE',               status: 'VENCIDO',   desc: 'Cobranca ultrapassou a data de vencimento sem pagamento.' },
  { event: 'PAYMENT_DELETED',               status: 'CANCELADO', desc: 'Cobranca excluida manualmente no Asaas.' },
  { event: 'PAYMENT_REFUNDED',              status: 'CANCELADO', desc: 'Pagamento estornado ao cliente.' },
  { event: 'PAYMENT_CHARGEBACK_REQUESTED',  status: 'CANCELADO', desc: 'Cliente abriu chargeback junto ao banco.' },
  { event: 'PAYMENT_CREATED',               status: 'PENDENTE',  desc: 'Nova cobranca gerada automaticamente por assinatura recorrente. Cria BoletoHonorario no banco.' },
];

const ENV_VARS = [
  { name: 'ASAAS_ENV',              desc: 'Controla o ambiente: "production" usa API real; qualquer outro valor usa sandbox.', ex: 'sandbox' },
  { name: 'ASAAS_WEBHOOK_TOKEN',    desc: 'Token de autenticacao do webhook (header asaas-access-token). Registrado automaticamente na conta Asaas.', ex: 'meu-token-secreto' },
  { name: 'NEXT_PUBLIC_APP_URL',    desc: 'URL publica da aplicacao. Usada para montar a URL do webhook ao salvar a chave Asaas.', ex: 'https://app.meudominio.com.br' },
];

// =============================================================================
// BUILD DOCUMENT
// =============================================================================

async function main() {
  const outputPath = path.resolve(
    'C:/Users/lopee/OneDrive/Desktop/contabilidade/asaas-rotas.docx'
  );

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 20 } },
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1',
          basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: '1F3864' },
          paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2',
          basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: '2E75B6' },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH_DXA, height: 16838 },
            margin: { top: MARGIN_DXA, right: MARGIN_DXA, bottom: MARGIN_DXA, left: MARGIN_DXA },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E75B6', space: 1 } },
                children: [
                  new TextRun({ text: 'Integracao Asaas — Documentacao de Rotas', bold: true, font: 'Arial', size: 18, color: '2E75B6' }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 1 } },
                children: [
                  new TextRun({ text: 'Pagina ', size: 16, font: 'Arial', color: '888888' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '888888' }),
                  new TextRun({ text: ' de ', size: 16, font: 'Arial', color: '888888' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Arial', color: '888888' }),
                ],
              }),
            ],
          }),
        },
        children: [
          // ============================================================
          // CAPA
          // ============================================================
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 1400, after: 200 },
            children: [
              new TextRun({ text: 'Integracao Asaas', bold: true, size: 56, font: 'Arial', color: '1F3864' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({ text: 'Documentacao de Rotas', size: 36, font: 'Arial', color: '2E75B6' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [
              new TextRun({ text: 'Sistema de Gestao Contabil — SaaS', size: 22, font: 'Arial', color: '666666' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '2E75B6', space: 1 } },
            spacing: { after: 400 },
            children: [
              new TextRun({ text: 'Gerado em: ' + new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), size: 18, font: 'Arial', color: '888888' }),
            ],
          }),

          ...spacer(1),

          // ============================================================
          // SECAO 1 — Rotas ja implementadas
          // ============================================================
          sectionTitle('1. Rotas Ja Implementadas'),
          bodyText('Rotas existentes que foram mantidas e/ou atualizadas nesta versao. O campo tipoPagamento (BOLETO | PIX | INDEFINIDO) foi adicionado ao POST de boletos, e o registro automatico de webhook foi inserido no PUT de chave Asaas.'),
          ...spacer(1),
          buildRoutesTable(ROTAS_EXISTENTES, false),
          ...spacer(2),

          // ============================================================
          // SECAO 2 — Rotas novas
          // ============================================================
          sectionTitle('2. Rotas Novas Implementadas'),
          bodyText('Novas rotas adicionadas para suportar resumo financeiro Asaas, estorno de boletos e assinaturas recorrentes.'),
          ...spacer(1),
          buildRoutesTable(ROTAS_NOVAS, true),
          ...spacer(2),

          // ============================================================
          // SECAO 3 — Detalhes das novas rotas
          // ============================================================
          sectionTitle('3. Detalhes das Novas Rotas'),

          subTitle('3.1 GET /api/v1/financeiro/resumo-asaas'),
          bodyText('Retorna estatisticas consolidadas da conta Asaas do contador autenticado.'),
          bodyText('Acesso: ACCOUNTANT, ADMIN, EMPLOYEE (vinculado ao escritorio).'),
          bodyText('Resposta de sucesso (200):'),
          inlineCode('{ "configurado": true, "dados": { "pendente": { "quantidade": 5, "valor": 1500.00 }, "pago": { "quantidade": 20, "valor": 6000.00 }, "vencido": { "quantidade": 2, "valor": 800.00 }, "cancelado": { "quantidade": 1, "valor": 300.00 }, "saldo": 4200.00 } }'),
          bodyText('Se a integracao Asaas nao estiver configurada: { "configurado": false, "dados": null }'),
          ...spacer(1),

          subTitle('3.2 POST /api/v1/financeiro/boletos/[id]/estorno'),
          bodyText('Estorna um pagamento ja recebido diretamente no Asaas e atualiza o status do boleto para CANCELADO.'),
          bodyText('Acesso: ACCOUNTANT, ADMIN (apenas dono do escritorio pode estornar).'),
          bodyText('Body (opcional):'),
          inlineCode('{ "valor": 250.00 }  // estorno parcial; omitir para estorno total'),
          bodyText('Validacoes: boleto deve existir, pertencer ao escritorio, estar com status PAGO e ter asaasId preenchido.'),
          ...spacer(1),

          subTitle('3.3 GET /api/v1/financeiro/assinaturas'),
          bodyText('Lista todas as assinaturas recorrentes do escritorio com dados do cliente.'),
          bodyText('Acesso: ACCOUNTANT, ADMIN (ve todas), CLIENT/EMPLOYEE-CLIENTE (ve as proprias).'),
          bodyText('Query params: ?clienteId=uuid (opcional, filtra por cliente).'),
          bodyText('Campos retornados: id, clienteId, clienteNome, clienteCnpj, valor, ciclo, tipoPagamento, descricao, asaasId, asaasStatus, proximoVencimento, createdAt.'),
          ...spacer(1),

          subTitle('3.4 POST /api/v1/financeiro/assinaturas'),
          bodyText('Cria uma assinatura recorrente no Asaas e registra no banco de dados.'),
          bodyText('Acesso: ACCOUNTANT, ADMIN.'),
          bodyText('Body obrigatorio:'),
          inlineCode('{ "clienteId": "uuid", "valor": "350.00", "nextDueDate": "2026-06-01", "ciclo": "MONTHLY", "tipoPagamento": "BOLETO", "descricao": "Honorarios mensais" }'),
          bodyText('Ciclos disponiveis: WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, SEMIANNUALLY, YEARLY.'),
          bodyText('Tipos de pagamento: BOLETO, PIX, INDEFINIDO (mapeado para UNDEFINED no Asaas).'),
          bodyText('Fluxo: verifica vinculo contador-cliente, cria/busca cliente no Asaas, cria assinatura no Asaas, salva AssinaturaHonorario no banco.'),
          ...spacer(1),

          subTitle('3.5 DELETE /api/v1/financeiro/assinaturas/[id]'),
          bodyText('Cancela uma assinatura recorrente. O cancelamento e feito no Asaas e o status local e atualizado para INACTIVE.'),
          bodyText('Acesso: ACCOUNTANT, ADMIN (apenas dono do escritorio).'),
          bodyText('Nota: boletos ja gerados pela assinatura nao sao cancelados automaticamente.'),
          ...spacer(2),

          // ============================================================
          // SECAO 4 — Webhooks
          // ============================================================
          sectionTitle('4. Webhooks Asaas'),
          bodyText('O webhook e registrado automaticamente ao salvar a chave Asaas do contador (PUT /api/v1/admin/contadores/[id]/asaas). A URL do webhook e construida a partir de NEXT_PUBLIC_APP_URL.'),
          bodyText('URL do webhook: {NEXT_PUBLIC_APP_URL}/api/v1/webhooks/asaas'),
          bodyText('Autenticacao: header "asaas-access-token" comparado com ASAAS_WEBHOOK_TOKEN.'),
          ...spacer(1),
          buildWebhooksTable(WEBHOOKS),
          ...spacer(1),
          bodyText('Comportamento especial do PAYMENT_CREATED: quando o evento inclui o campo "subscription", o sistema busca a AssinaturaHonorario correspondente e cria automaticamente um BoletoHonorario no banco, sem interacao do usuario.'),
          ...spacer(2),

          // ============================================================
          // SECAO 5 — Schema Prisma
          // ============================================================
          sectionTitle('5. Atualizacoes no Schema Prisma'),

          subTitle('5.1 Novo enum TipoPagamento'),
          inlineCode('enum TipoPagamento { BOLETO  PIX  INDEFINIDO }'),
          ...spacer(1),

          subTitle('5.2 Campos adicionados em BoletoHonorario'),
          inlineCode('tipoPagamento       TipoPagamento  @default(BOLETO)'),
          inlineCode('asaasSubscriptionId String?        @db.VarChar(100)'),
          ...spacer(1),

          subTitle('5.3 Novo model AssinaturaHonorario'),
          bodyText('Tabela: assinatura_honorario'),
          bodyText('Campos principais: id (UUID), clienteId, escritorioId, valor (Decimal 12,2), ciclo (VarChar 20), tipoPagamento, descricao, asaasId (unique), asaasStatus, proximoVencimento (Date), createdAt, updatedAt.'),
          bodyText('Relacoes: belongs to UsuarioCliente e UsuarioContador.'),
          bodyText('Indices: clienteId, escritorioId, asaasId.'),
          ...spacer(1),

          subTitle('5.4 Migracao'),
          inlineCode('npx prisma migrate dev --name add_asaas_subscriptions_and_pix'),
          ...spacer(2),

          // ============================================================
          // SECAO 6 — Configuracao
          // ============================================================
          sectionTitle('6. Configuracao e Variaveis de Ambiente'),

          subTitle('6.1 URLs da API Asaas'),
          bodyText('Sandbox:    https://sandbox.asaas.com/api/v3'),
          bodyText('Producao:   https://api.asaas.com/v3'),
          bodyText('Controle de ambiente: variavel ASAAS_ENV=production (qualquer outro valor usa sandbox).'),
          ...spacer(1),

          subTitle('6.2 Variaveis de ambiente necessarias'),
          ...spacer(1),
          buildEnvTable(ENV_VARS),
          ...spacer(2),

          // ============================================================
          // SECAO 7 — Controle de acesso
          // ============================================================
          sectionTitle('7. Controle de Acesso por Rota'),
          bodyText('Todas as rotas usam o middleware withAuth que valida o JWT e injeta o objeto auth com: sub (userId), role, vinculo, superiorId.'),
          ...spacer(1),

          (() => {
            const totalW = CONTENT_WIDTH;
            const colW = { rota: 3800, roles: totalW - 3800 };
            const rows = [
              { rota: 'GET  /financeiro/resumo-asaas',     roles: 'ACCOUNTANT, ADMIN, EMPLOYEE (escritorio)' },
              { rota: 'POST /financeiro/boletos/[id]/estorno', roles: 'ACCOUNTANT, ADMIN' },
              { rota: 'GET  /financeiro/assinaturas',      roles: 'ACCOUNTANT, ADMIN, CLIENT, EMPLOYEE' },
              { rota: 'POST /financeiro/assinaturas',      roles: 'ACCOUNTANT, ADMIN' },
              { rota: 'DELETE /financeiro/assinaturas/[id]', roles: 'ACCOUNTANT, ADMIN' },
              { rota: 'PUT  /admin/contadores/[id]/asaas', roles: 'ADMIN' },
              { rota: 'POST /webhooks/asaas',              roles: 'Publico (autenticado por token)' },
            ];
            const headerRow = new TableRow({
              tableHeader: true,
              children: [headerCell('Rota', colW.rota), headerCell('Roles Permitidas', colW.roles)],
            });
            const dataRows = rows.map((r, i) =>
              new TableRow({ children: [
                dataCell(r.rota,  colW.rota,  i % 2 === 0 ? 'F8F8F8' : undefined),
                dataCell(r.roles, colW.roles, i % 2 === 0 ? 'F8F8F8' : undefined),
              ]})
            );
            return new Table({
              width: { size: totalW, type: WidthType.DXA },
              columnWidths: [colW.rota, colW.roles],
              rows: [headerRow, ...dataRows],
            });
          })(),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log('DOCX gerado com sucesso:', outputPath);
  console.log('Tamanho:', (buffer.byteLength / 1024).toFixed(1), 'KB');
}

main().catch((err) => {
  console.error('Erro ao gerar DOCX:', err);
  process.exit(1);
});
