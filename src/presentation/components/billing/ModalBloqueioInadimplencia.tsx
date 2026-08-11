'use client';

import { useState } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { Lock, QrCode, CreditCard, FileText, Check, Copy, LogOut, RefreshCw, Loader2, CreditCard as CardIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface CobrancaInfo {
  id: string;
  valor: number;
  vencimento: string;
  asaasBoletoUrl: string | null;
  asaasInvoiceUrl: string | null;
  asaasPixPayload: string | null;
  asaasBarcode: string | null;
}

interface ModalBloqueioInadimplenciaProps {
  cobranca: CobrancaInfo | null;
  onCheckStatus: () => Promise<boolean>;
}

export function ModalBloqueioInadimplencia({ cobranca, onCheckStatus }: ModalBloqueioInadimplenciaProps) {
  const { logout, role, token } = useAuth();
  const [copiadoPix, setCopiadoPix] = useState(false);
  const [copiadoBarcode, setCopiadoBarcode] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [checkErro, setCheckErro] = useState<string | null>(null);

  // Estados do formulário de cartão de crédito
  const [showCardForm, setShowCardForm] = useState(false);
  const [salvandoCartao, setSalvandoCartao] = useState(false);
  const [cartaoErro, setCartaoErro] = useState<string | null>(null);
  const [cartaoSucesso, setCartaoSucesso] = useState(false);

  // Form fields
  const [holderName, setHolderName] = useState('');
  const [number, setNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [phone, setPhone] = useState('');

  const isClientOrEmployeeClient = role === 'Cliente';
  const dialogRef = useDialogA11y(true, undefined, true);

  const copyToClipboard = (text: string, type: 'pix' | 'barcode') => {
    navigator.clipboard.writeText(text);
    if (type === 'pix') {
      setCopiadoPix(true);
      setTimeout(() => setCopiadoPix(false), 2000);
    } else {
      setCopiadoBarcode(true);
      setTimeout(() => setCopiadoBarcode(false), 2000);
    }
  };

  const handleCheckStatus = async () => {
    setVerificando(true);
    setCheckErro(null);
    try {
      const isUnlocked = await onCheckStatus();
      if (!isUnlocked) {
        setCheckErro(
          'Ainda não identificamos o pagamento. Se pagou por boleto, a compensação pode levar até 24h. Pagamentos via PIX são liberados em poucos minutos.'
        );
      }
    } catch {
      setCheckErro('Erro ao verificar status. Tente novamente em alguns instantes.');
    } finally {
      setVerificando(false);
    }
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSalvandoCartao(true);
    setCartaoErro(null);
    setCartaoSucesso(false);

    try {
      const res = await fetch('/api/v1/minha-assinatura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          holderName,
          number,
          expiryMonth,
          expiryYear,
          ccv,
          name,
          email,
          cpfCnpj,
          postalCode,
          addressNumber,
          phone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCartaoErro(data.message ?? 'Falha ao salvar dados do cartão.');
        return;
      }

      setCartaoSucesso(true);
      // Aguarda 1 segundo e tenta verificar o status de desbloqueio automaticamente
      setTimeout(() => {
        handleCheckStatus();
      }, 1500);
    } catch {
      setCartaoErro('Erro de rede ao salvar cartão. Verifique sua conexão e tente novamente.');
    } finally {
      setSalvandoCartao(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-bloqueio-titulo"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900/80 backdrop-blur-md p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto border border-gray-100 my-8">
        
        {/* Renderização para Clientes do escritório */}
        {isClientOrEmployeeClient ? (
          <div className="text-center space-y-6 py-6">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto text-amber-600 animate-pulse">
              <Lock size={32} />
            </div>
            <div className="space-y-2">
              <h2 id="modal-bloqueio-titulo" className="text-2xl font-bold text-gray-900">Acesso Suspenso Temporariamente</h2>
              <p className="text-sm text-gray-500">
                O acesso à plataforma FiscoHub foi interrompido temporariamente para este escritório.
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 text-sm text-gray-700 leading-relaxed max-w-md mx-auto">
              O acesso de sua empresa à plataforma está suspenso enquanto seu escritório contábil realiza a regularização dos serviços com a FiscoHub. 
              <br />
              <strong className="text-gray-900 font-semibold block mt-2">Seus arquivos e dados continuam salvos e em total segurança.</strong>
              Por favor, entre em contato com o responsável do seu escritório contábil para mais esclarecimentos.
            </div>
            <div className="pt-4 max-w-xs mx-auto">
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-3 text-sm font-semibold transition-all"
              >
                <LogOut size={16} />
                Sair da Conta
              </button>
            </div>
          </div>
        ) : (
          /* Renderização para Contadores (Dono/Funcionário do escritório) */
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <Lock size={24} />
              </div>
              <div className="space-y-1">
                <h2 id="modal-bloqueio-titulo" className="text-xl font-bold text-gray-900">Assinatura Vencida — Acesso Bloqueado</h2>
                <p className="text-sm text-gray-500">
                  Identificamos uma pendência financeira em sua assinatura mensal do FiscoHub. Regularize para reestabelecer o acesso imediatamente.
                </p>
              </div>
            </div>

            {/* Fatura Info */}
            {cobranca && (
              <div className="bg-red-50/50 rounded-2xl p-5 border border-red-100/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-red-600 block">Fatura Pendente</span>
                  <span className="text-2xl font-black text-gray-900">R$ {cobranca.valor.toFixed(2)}</span>
                </div>
                <div className="text-sm text-gray-600 sm:text-right">
                  <span className="block">Vencimento: <strong className="text-gray-900 font-semibold">{cobranca.vencimento.split('-').reverse().join('/')}</strong></span>
                  <span className="text-xs text-gray-500">Liberação imediata no PIX ou Cartão de Crédito.</span>
                </div>
              </div>
            )}

            {/* Formas de Pagamento */}
            {cobranca && !showCardForm && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pix Card */}
                {cobranca.asaasPixPayload && (
                  <div className="bg-violet-50/50 rounded-xl p-5 border border-violet-100 flex flex-col justify-between space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">
                        <QrCode size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-gray-900">Pagar via PIX</h3>
                        <p className="text-[11px] text-gray-500">Confirmação automática em 2 minutos</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => copyToClipboard(cobranca.asaasPixPayload!, 'pix')}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all border ${
                        copiadoPix 
                          ? 'bg-green-600 text-white border-green-600' 
                          : 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700'
                      }`}
                    >
                      {copiadoPix ? (
                        <>
                          <Check size={14} />
                          Copiado com sucesso!
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Copiar PIX Copia e Cola
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Boleto Card */}
                {cobranca.asaasBoletoUrl && (
                  <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100 flex flex-col justify-between space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                        <FileText size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-gray-900">Boleto Bancário</h3>
                        <p className="text-[11px] text-gray-500">Compensação em até 1 dia útil</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <a
                        href={cobranca.asaasBoletoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold transition-all text-center"
                      >
                        Visualizar Boleto
                      </a>
                      
                      {cobranca.asaasBarcode && (
                        <button
                          onClick={() => copyToClipboard(cobranca.asaasBarcode!, 'barcode')}
                          className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all border ${
                            copiadoBarcode
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {copiadoBarcode ? 'Linha Digitável Copiada!' : 'Copiar Código de Barras'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botão de Cartão de Crédito Recorrente */}
            {cobranca && !showCardForm && (
              <button
                onClick={() => setShowCardForm(true)}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-5 py-3.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
              >
                <CardIcon size={18} className="text-gray-500" />
                Ativar Pagamento Recorrente via Cartão de Crédito
              </button>
            )}

            {/* Formulário de Cartão de Crédito */}
            {showCardForm && (
              <form onSubmit={handleSaveCard} className="border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-4 bg-gray-50/50 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-violet-600" />
                    <h3 className="font-bold text-sm text-gray-900">Dados do Cartão de Crédito</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCardForm(false)}
                    className="text-xs text-gray-500 hover:text-gray-900 font-semibold"
                  >
                    Cancelar
                  </button>
                </div>

                {/* Grid dos campos do Cartão */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Nome impresso no cartão</label>
                    <input
                      type="text"
                      required
                      placeholder="EX: JOAO S SILVA"
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value.toUpperCase())}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Número do cartão</label>
                    <input
                      type="text"
                      required
                      placeholder="0000 0000 0000 0000"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700">Mês Exp.</label>
                      <input
                        type="text"
                        required
                        maxLength={2}
                        placeholder="MM"
                        value={expiryMonth}
                        onChange={(e) => setExpiryMonth(e.target.value)}
                        className="w-full text-sm text-center rounded-lg border border-gray-200 bg-white px-2 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700">Ano Exp.</label>
                      <input
                        type="text"
                        required
                        maxLength={4}
                        placeholder="AAAA"
                        value={expiryYear}
                        onChange={(e) => setExpiryYear(e.target.value)}
                        className="w-full text-sm text-center rounded-lg border border-gray-200 bg-white px-2 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700">CVV</label>
                      <input
                        type="text"
                        required
                        maxLength={4}
                        placeholder="123"
                        value={ccv}
                        onChange={(e) => setCcv(e.target.value)}
                        className="w-full text-sm text-center rounded-lg border border-gray-200 bg-white px-2 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Dados do Titular do Cartão</h4>
                </div>

                {/* Grid dos campos do Titular */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">E-mail</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">CPF ou CNPJ</label>
                    <input
                      type="text"
                      required
                      placeholder="Apenas números"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Telefone com DDD</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 11999998888"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">CEP</label>
                    <input
                      type="text"
                      required
                      placeholder="Apenas números"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-700">Número do endereço</label>
                    <input
                      type="text"
                      required
                      value={addressNumber}
                      onChange={(e) => setAddressNumber(e.target.value)}
                      className="w-full text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                </div>

                {cartaoErro && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5 border border-red-100">
                    {cartaoErro}
                  </p>
                )}

                {cartaoSucesso && (
                  <p className="text-xs text-green-600 bg-green-50 rounded-lg p-2.5 border border-green-100 flex items-center gap-2">
                    <Check size={14} />
                    Cartão cadastrado com sucesso! Processando cobrança e liberando acesso...
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={salvandoCartao || cartaoSucesso}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-3 text-sm font-semibold transition-all shadow-sm"
                  >
                    {salvandoCartao ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Salvando Cartão...
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        Confirmar e Pagar Assinatura
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCardForm(false)}
                    className="border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            )}

            {/* Alerta de erro de verificação */}
            {checkErro && (
              <div className="bg-red-50 text-red-700 rounded-xl p-4 text-xs border border-red-100 leading-relaxed">
                {checkErro}
              </div>
            )}

            {/* Ações Inferiores */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={handleCheckStatus}
                disabled={verificando}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary hover:brightness-95 disabled:opacity-50 text-white px-5 py-3.5 text-sm font-bold shadow-sm transition-all"
              >
                {verificando ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Verificando compensação...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Já Paguei! Liberar Acesso
                  </>
                )}
              </button>

              <button
                onClick={logout}
                className="flex items-center justify-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-3.5 text-sm font-semibold transition-all"
              >
                <LogOut size={16} />
                Sair da Conta
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-[10px] text-gray-400 text-center leading-relaxed">
          Para suporte com seu faturamento contate financeiro@fiscohub.com.br. 
          Seus dados estão protegidos sob protocolos TLS e diretrizes da LGPD.
        </p>
      </div>
    </div>
  );
}
