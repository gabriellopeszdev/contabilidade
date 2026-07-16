import { NextResponse } from 'next/server';

import { withAuth } from '../../../../../../src/infrastructure/http/middlewares/withAuth';
import { toCSV }   from '../../../../../../src/utils/csv';

// =============================================================================
// Configuração do runtime
// =============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// =============================================================================
// GET /api/v1/clientes/importar/template
//
// Retorna um arquivo CSV de modelo para importação de clientes em massa.
// O arquivo contém o cabeçalho correto e 2 linhas de exemplo.
//
// Respostas:
//   200 OK → CSV como attachment
// =============================================================================

export const GET = withAuth(async () => {
  const headers = ['Nome', 'Email', 'CNPJ', 'Telefone', 'CNAE', 'Regime Tributário'];
  const rows = [
    ['Empresa Exemplo Ltda', 'empresa@exemplo.com.br',  '11222333000181', '(11) 99999-9999', '4711301', 'SIMPLES NACIONAL'],
    ['Consultoria ABC ME',   'abc@consultoria.com.br',  '22333444000100', '',                '6201500', 'LUCRO PRESUMIDO' ],
  ];

  const csv = toCSV(headers, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="template-importacao-clientes.csv"',
    },
  });
}, ['ACCOUNTANT', 'ADMIN']);
