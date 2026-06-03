/**
 * prisma/seed.production.ts — Seed de Produção
 *
 * Cria apenas o superadmin e os planos SaaS.
 * Idempotente: seguro para rodar múltiplas vezes.
 *
 * EXECUÇÃO no VPS:
 *   cd ~/contabilidade
 *   docker compose exec app npx tsx prisma/seed.production.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg }    from '@prisma/adapter-pg';
import { Pool }        from 'pg';

import { SenhaHash }            from '../src/domain/value-objects/SenhaHash';
import { BcryptPasswordHasher } from '../src/infrastructure/auth/BcryptPasswordHasher';

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });
const hasher  = new BcryptPasswordHasher();

const SUPER_ADMIN_ID = 'a1000000-0000-0000-0000-000000000001';

const SUPER_ADMIN = {
  id:    SUPER_ADMIN_ID,
  name:  'Super Administrador',
  email: 'kaircompany@azura.dev.br',
  senha: 'apl197512',
  crc:   'CRC-SP/000001',
};

async function main() {
  console.log('Iniciando seed de produção...\n');

  // Super Admin
  const existe = await prisma.usuarioContador.findUnique({
    where:  { email: SUPER_ADMIN.email },
    select: { id: true },
  });

  if (existe) {
    await prisma.usuarioContador.update({
      where: { email: SUPER_ADMIN.email },
      data:  { name: SUPER_ADMIN.name, crc: SUPER_ADMIN.crc, isActive: true, isAdmin: true },
    });
    console.log(`Superadmin atualizado: ${SUPER_ADMIN.email}`);
  } else {
    const hash = await SenhaHash.criarDeTextoPlano(SUPER_ADMIN.senha, hasher);
    await prisma.usuarioContador.create({
      data: {
        id:           SUPER_ADMIN.id,
        name:         SUPER_ADMIN.name,
        email:        SUPER_ADMIN.email,
        passwordHash: hash.hash,
        crc:          SUPER_ADMIN.crc,
        isActive:     true,
        isAdmin:      true,
      },
    });
    console.log(`Superadmin criado: ${SUPER_ADMIN.email}`);
  }

  const FEATURES_BASICO     = ['chat', 'calendario', 'financeiro', 'integracao_cora'];
  const FEATURES_PRO        = ['chat', 'calendario', 'financeiro', 'integracao_cora', 'assinatura_eletronica', 'relatorios', 'equipe'];
  const FEATURES_ENTERPRISE = ['chat', 'calendario', 'financeiro', 'integracao_cora', 'assinatura_eletronica', 'relatorios', 'equipe', 'ia'];

  // Planos SaaS
  await Promise.all([
    prisma.planoSaaS.upsert({
      where:  { nome: 'Básico' },
      update: { preco: 89, limiteClientes: 20, limiteDocumentos: 1000, features: FEATURES_BASICO, isActive: true },
      create: { nome: 'Básico', descricao: 'Para escritórios pequenos que estão começando.', preco: 89, limiteClientes: 20, limiteDocumentos: 1000, features: FEATURES_BASICO, isActive: true },
    }),
    prisma.planoSaaS.upsert({
      where:  { nome: 'Pro' },
      update: { preco: 189, limiteClientes: 100, limiteDocumentos: 5000, features: FEATURES_PRO, isActive: true },
      create: { nome: 'Pro', descricao: 'Para escritórios em crescimento com mais recursos.', preco: 189, limiteClientes: 100, limiteDocumentos: 5000, features: FEATURES_PRO, isActive: true },
    }),
    prisma.planoSaaS.upsert({
      where:  { nome: 'Enterprise' },
      update: { preco: 389, limiteClientes: -1, limiteDocumentos: -1, features: FEATURES_ENTERPRISE, isActive: true },
      create: { nome: 'Enterprise', descricao: 'Clientes e documentos ilimitados. Todos os recursos, incluindo IA.', preco: 389, limiteClientes: -1, limiteDocumentos: -1, features: FEATURES_ENTERPRISE, isActive: true },
    }),
  ]);
  console.log('Planos SaaS criados: Básico (R$89), Pro (R$189), Enterprise (R$389)');

  console.log('\nSeed de produção concluído.');
  console.log(`  Login: ${SUPER_ADMIN.email}`);
  console.log(`  Senha: ${SUPER_ADMIN.senha}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (err) => {
    console.error('Erro no seed:', err);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
