import { z } from 'zod';
import { validarCnpj } from '../../../utils/validators';

// =============================================================================
// Schema Zod para criação/validação de um cliente
//
// Exportado aqui para ser reutilizado tanto no endpoint POST /clientes
// quanto no endpoint POST /clientes/importar (importação em massa via CSV).
// =============================================================================

export const criarClienteSchema = z.object({
  nome:             z.string().min(2, 'Nome deve ter ao menos 2 caracteres.').max(255),
  email:            z.string().email('E-mail inválido.').max(255),
  cnpj:             z.string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 14, 'CNPJ deve conter 14 dígitos.')
    .refine(validarCnpj, 'CNPJ com dígitos verificadores inválidos.'),
  phone:            z.string().max(20).optional(),
  cnae:             z.string().max(10).optional(),
  regimeTributario: z.string().max(50).optional(),
});

export type CriarClienteInput = z.infer<typeof criarClienteSchema>;
