'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Clock, CloudUpload, X } from 'lucide-react';

import { useAuth } from '../../../src/presentation/hooks/useAuth';
import { useDocumentosCliente } from '../../../src/presentation/hooks/useDocumentosCliente';
import { DocumentosTable } from '../../../src/presentation/components/cliente/DocumentosTable';

export default function EnviarPage() {
  const router = useRouter();
  const { usuario, carregando: authCarregando, isCliente, isFuncionarioCliente } = useAuth();

  useEffect(() => {
    if (authCarregando) return;
    if (!usuario || (!isCliente && !isFuncionarioCliente)) router.push('/login');
  }, [authCarregando, usuario, isCliente, isFuncionarioCliente, router]);

  // Busca documentos do cliente filtrados por UPLOAD_CLIENTE (origem)
  const {
    documentos,
    carregando,
    erro,
    total,
    totalPages,
    hasPreviousPage,
    hasNextPage,
    page,
    setor,
    setSetor,
    categoria,
    setCategoria,
    setPage,
    setTermo,
    baixarDocumento,
    baixandoIds,
  } = useDocumentosCliente({ origem: 'UPLOAD_CLIENTE' });

  const [busca, setBusca] = useState('');

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => {
      setTermo(busca || undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [busca, setTermo]);

  if (authCarregando || !usuario) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Clock className="text-primary" size={24} />
            Histórico de Envios
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Veja e pesquise todos os arquivos e documentos que você enviou para o escritório.
          </p>
        </div>
        
        {/* Link / Botão para início para fazer novo upload */}
        <Link
          href="/inicio"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                     bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 active:scale-95 text-white
                     text-sm font-semibold transition-all shadow-md hover:shadow-lg shrink-0 self-start sm:self-center"
        >
          <CloudUpload size={16} />
          Enviar Novo Arquivo
        </Link>
      </div>

      {/* Barra de pesquisa */}
      <div className="relative max-w-md">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar por nome do arquivo..."
          className="w-full pl-11 pr-10 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
        {busca && (
          <button
            onClick={() => setBusca('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Tabela de documentos */}
      <DocumentosTable
        documentos={documentos}
        carregando={carregando}
        erro={erro}
        total={total}
        page={page}
        totalPages={totalPages}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
        setor={setor}
        categoria={categoria}
        baixandoIds={baixandoIds}
        onMudarSetor={setSetor}
        onMudarCategoria={setCategoria}
        onMudarPagina={setPage}
        onBaixar={baixarDocumento}
      />
      
    </div>
  );
}
