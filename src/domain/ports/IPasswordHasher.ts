/**
 * Port (interface) para hashing e comparação de senhas.
 * Define o CONTRATO que a camada de domínio exige.
 * A implementação concreta (bcrypt) vive na infraestrutura.
 * Segue o Princípio de Inversão de Dependência (DIP - SOLID).
 */
export interface IPasswordHasher {
  hash(senhaPlana: string): Promise<string>;
  comparar(senhaPlana: string, hash: string): Promise<boolean>;
}
