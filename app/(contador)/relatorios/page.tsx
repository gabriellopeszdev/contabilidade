'use client';

const relatorios = [
  { titulo: 'Documentos Fiscais',   href: '/api/v1/relatorios/documentos', descricao: 'Lista completa de documentos enviados por clientes' },
  { titulo: 'Financeiro / Boletos', href: '/api/v1/relatorios/financeiro',  descricao: 'Histórico de cobranças e status de pagamento' },
  { titulo: 'Carteira de Clientes', href: '/api/v1/relatorios/clientes',    descricao: 'Lista de clientes do escritório com dados de contato' },
];

export default function RelatoriosPage() {
  function exportar(href: string, format: 'pdf' | 'excel') {
    window.open(`${href}?format=${format}`, '_blank');
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Relatórios</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {relatorios.map((r) => (
          <div key={r.href} className="border rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">{r.titulo}</h2>
            <p className="text-sm text-muted-foreground">{r.descricao}</p>
            <div className="flex gap-2">
              <button onClick={() => exportar(r.href, 'pdf')}   className="flex-1 border rounded px-3 py-1.5 text-sm hover:bg-gray-50">PDF</button>
              <button onClick={() => exportar(r.href, 'excel')} className="flex-1 bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700">Excel</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
