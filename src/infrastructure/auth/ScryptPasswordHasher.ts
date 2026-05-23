import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import type { IPasswordHasher } from '../../domain/ports/IPasswordHasher';

// =============================================================================
// ScryptPasswordHasher — Implementação com crypto nativo do Node.js
//
// Usa o algoritmo scrypt (RFC 7914), recomendado pelo NIST e seguro contra
// ataques de GPU/ASIC graças ao uso intensivo de memória.
//
// FORMATO DO HASH ARMAZENADO:
//   <salt_hex>:<hash_hex>
//   Exemplo: "a1b2c3...(32 bytes hex):<64 bytes hex>"
//
// PARÂMETROS scrypt (N, r, p):
//   N = 16384 (2^14) — custo de CPU/memória (aumentar em hardware mais potente)
//   r = 8            — tamanho do bloco (recomendado pelo RFC 7914)
//   p = 1            — paralelismo
//   keyLen = 64      — 64 bytes de saída (512 bits)
//
// PRODUÇÃO:
//   Se preferir bcrypt (mais amplamente auditado para senhas), substitua
//   esta implementação por BcryptPasswordHasher usando a lib `bcryptjs`
//   (pure JS, sem dependências nativas) sem alterar nenhum use case.
// =============================================================================

const scryptAsync = promisify(scrypt);

const SALT_BYTES = 32;  // 256 bits de salt aleatório
const KEY_LEN    = 64;  // 512 bits de chave derivada

export class ScryptPasswordHasher implements IPasswordHasher {
  /**
   * Gera o hash de uma senha em texto plano.
   * Cria um salt criptograficamente seguro para cada senha.
   *
   * @returns String no formato "<salt_hex>:<hash_hex>".
   */
  async hash(senhaPlana: string): Promise<string> {
    const salt      = randomBytes(SALT_BYTES);
    const hashBuf   = (await scryptAsync(senhaPlana, salt, KEY_LEN)) as Buffer;

    return `${salt.toString('hex')}:${hashBuf.toString('hex')}`;
  }

  /**
   * Compara uma senha em texto plano com um hash previamente gerado por `hash()`.
   * Usa `timingSafeEqual` para proteger contra timing attacks.
   *
   * @param senhaPlana Senha digitada pelo usuário no login.
   * @param hashArmazenado String "<salt_hex>:<hash_hex>" salva no banco.
   * @returns `true` se a senha corresponde ao hash.
   */
  async comparar(senhaPlana: string, hashArmazenado: string): Promise<boolean> {
    const [saltHex, hashHex] = hashArmazenado.split(':');

    if (!saltHex || !hashHex) {
      return false; // Hash malformado — não corresponde
    }

    const salt       = Buffer.from(saltHex, 'hex');
    const hashSalvo  = Buffer.from(hashHex, 'hex');
    const hashNovo   = (await scryptAsync(senhaPlana, salt, KEY_LEN)) as Buffer;

    // Proteção contra timing attacks: comparação em tempo constante
    return timingSafeEqual(hashSalvo, hashNovo);
  }
}
