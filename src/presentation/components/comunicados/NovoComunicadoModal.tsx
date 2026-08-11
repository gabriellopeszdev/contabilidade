'use client';

import { useState, useCallback, useEffect, useReducer } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import {
  X, Send, Loader2, Bold, Italic, List, ListOrdered,
  Link2, Users, Building2, CheckSquare, Paperclip,
} from 'lucide-react';

type Targeting = 'TODOS' | 'SETOR' | 'SELECIONADOS';
type SetorTipo = 'FISCAL' | 'PESSOAL' | 'CONTABIL';

interface Cliente {
  id:   string;
  nome: string;
}

interface NovoComunicadoModalProps {
  aberto:    boolean;
  token:     string;
  onFechar:  () => void;
  onSucesso: () => void;
}

function ToolbarButton({
  onClick, ativo, title, children,
}: { onClick: () => void; ativo?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded text-sm transition-colors ${
        ativo
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

export function NovoComunicadoModal({ aberto, token, onFechar, onSucesso }: NovoComunicadoModalProps) {
  const [titulo, setTitulo]               = useState('');
  const [targeting, setTargeting]         = useState<Targeting>('TODOS');
  const [setor, setSetor]                 = useState<SetorTipo>('FISCAL');
  const [clientesSelecionados, setCs]     = useState<string[]>([]);
  const [exigeConfirmacao, setExige]      = useState(false);
  const [anexo, setAnexo]                 = useState<File | null>(null);
  const [clientes, setClientes]           = useState<Cliente[]>([]);
  const [enviando, setEnviando]           = useState(false);
  const [erro, setErro]                   = useState<string | null>(null);

  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'min-h-[160px] p-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none',
      },
    },
    onTransaction:     forceUpdate,
  });

  useEffect(() => {
    if (targeting !== 'SELECIONADOS' || clientes.length > 0) return;
    fetch('/api/v1/clientes', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: { clientes?: Cliente[] }) => {
        setClientes(d.clientes ?? []);
      })
      .catch(() => {});
  }, [targeting, token, clientes.length]);

  const handleFechar = useCallback(() => {
    if (enviando) return;
    setTitulo('');
    setTargeting('TODOS');
    setSetor('FISCAL');
    setCs([]);
    setExige(false);
    setAnexo(null);
    setErro(null);
    editor?.commands.clearContent();
    onFechar();
  }, [enviando, editor, onFechar]);

  const toggleCliente = (id: string) => {
    setCs((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const adicionarLink = () => {
    const url = window.prompt('URL do link:');
    if (!url) return;
    editor?.chain().focus().setLink({ href: url }).run();
  };

  const handleEnviar = useCallback(async () => {
    const conteudo = editor?.getHTML() ?? '';
    if (!titulo.trim()) { setErro('Título obrigatório.'); return; }
    if (!conteudo || conteudo === '<p></p>') { setErro('Conteúdo obrigatório.'); return; }
    if (targeting === 'SELECIONADOS' && clientesSelecionados.length === 0) {
      setErro('Selecione ao menos um cliente.');
      return;
    }

    setEnviando(true);
    setErro(null);

    try {
      const form = new FormData();
      form.set('titulo',           titulo.trim());
      form.set('conteudo',         conteudo);
      form.set('exigeConfirmacao', String(exigeConfirmacao));
      form.set('targeting',        targeting);
      if (targeting === 'SETOR') form.set('setor', setor);
      clientesSelecionados.forEach((id) => form.append('clienteIds', id));
      if (anexo) form.set('anexo', anexo);

      const res = await fetch('/api/v1/comunicados', {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });

      const body = await res.json().catch(() => ({})) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? `Erro HTTP ${res.status}`);

      onSucesso();
      handleFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao publicar.');
    } finally {
      setEnviando(false);
    }
  }, [titulo, editor, targeting, setor, clientesSelecionados, exigeConfirmacao, anexo, token, onSucesso, handleFechar]);

  const dialogRef = useDialogA11y(aberto, handleFechar);

  if (!aberto) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-novo-comunicado-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleFechar} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[100dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h3 id="modal-novo-comunicado-titulo" className="text-base font-bold text-gray-900 dark:text-gray-100">Novo Comunicado</h3>
          <button type="button" onClick={handleFechar} disabled={enviando} aria-label="Fechar"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Mudança de prazo IRPF 2026"
              maxLength={255}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Editor Tiptap */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Conteúdo</label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50">
              <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  ativo={
                    editor?.isActive('bold') ||
                    !!editor?.state.storedMarks?.some(m => m.type.name === 'bold')
                  }
                  title="Negrito"
                >
                  <Bold size={14} />
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  ativo={
                    editor?.isActive('italic') ||
                    !!editor?.state.storedMarks?.some(m => m.type.name === 'italic')
                  }
                  title="Itálico"
                >
                  <Italic size={14} />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor?.chain().focus().toggleBulletList().run()} ativo={editor?.isActive('bulletList')} title="Lista">
                  <List size={14} />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor?.chain().focus().toggleOrderedList().run()} ativo={editor?.isActive('orderedList')} title="Lista numerada">
                  <ListOrdered size={14} />
                </ToolbarButton>
                <ToolbarButton onClick={adicionarLink} ativo={editor?.isActive('link')} title="Link">
                  <Link2 size={14} />
                </ToolbarButton>
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Targeting */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Destinatários</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { value: 'TODOS' as Targeting, label: 'Todos os clientes', icon: <Users size={14} /> },
                { value: 'SETOR' as Targeting, label: 'Por setor',         icon: <Building2 size={14} /> },
                { value: 'SELECIONADOS' as Targeting, label: 'Selecionar', icon: <CheckSquare size={14} /> },
              ] as const).map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => setTargeting(opt.value)}
                  className={`flex items-center justify-center sm:justify-start gap-2 min-h-[44px] rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                    targeting === opt.value
                      ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  {opt.icon}{opt.label}
                </button>
              ))}
            </div>

            {targeting === 'SETOR' && (
              <div className="mt-2">
                <select value={setor} onChange={(e) => setSetor(e.target.value as SetorTipo)}
                  aria-label="Filtrar por setor"
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="FISCAL">Fiscal</option>
                  <option value="PESSOAL">Pessoal</option>
                  <option value="CONTABIL">Contábil</option>
                </select>
              </div>
            )}

            {targeting === 'SELECIONADOS' && (
              <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-50 dark:divide-gray-800">
                {clientes.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-400">Carregando clientes…</p>
                ) : clientes.map((c) => {
                  const selecionado = clientesSelecionados.includes(c.id);
                  return (
                    <label key={c.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                      selecionado
                        ? 'bg-primary/10 dark:bg-primary/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                      <input type="checkbox" checked={selecionado}
                        onChange={() => toggleCliente(c.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary accent-primary" />
                      <span className={`text-xs font-medium ${selecionado ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>
                        {c.nome}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Exigir confirmação */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={exigeConfirmacao} onChange={(e) => setExige(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Exigir confirmação de leitura</span>
          </label>

          {/* Anexo */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Anexo (opcional, máx 50 MB)</label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary transition-colors">
                <Paperclip size={14} />
                {anexo ? anexo.name : 'Selecionar arquivo'}
                <input type="file" className="hidden" onChange={(e) => setAnexo(e.target.files?.[0] ?? null)} />
              </label>
              {anexo && (
                <button type="button" onClick={() => setAnexo(null)}
                  className="text-xs text-gray-400 hover:text-red-500">
                  Remover
                </button>
              )}
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
              {erro}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <button type="button" onClick={handleFechar} disabled={enviando}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={handleEnviar} disabled={enviando}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors disabled:opacity-50">
            {enviando ? <><Loader2 size={14} className="animate-spin" />Publicando…</> : <><Send size={14} />Publicar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
