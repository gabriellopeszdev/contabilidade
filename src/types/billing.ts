export interface CobrancaPendente {
  id: string;
  valor: number;
  vencimento: string;
  status: string;
  asaasBoletoUrl: string | null;
  asaasInvoiceUrl: string | null;
  asaasPixPayload: string | null;
  asaasBarcode: string | null;
}
