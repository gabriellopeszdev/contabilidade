/**
 * prisma/seed.ts — População Inicial do Banco de Dados
 *
 * Cria os registros mínimos para desenvolvimento e demonstração:
 *   - 1 Super Admin     (superadmin@contabilidade.com) — isAdmin: true
 *   - 1 UsuarioContador (contador@contabilidade.com)
 *   - 1 UsuarioCliente  (cliente@empresa.com)
 *   - Associação ContadorCliente
 *   - ConfiguracaoEscritorio para o contador
 *
 * EXECUÇÃO:
 *   npx prisma db seed
 *   (ou via "prisma": { "seed": "tsx prisma/seed.ts" } no package.json)
 *
 * IDEMPOTÊNCIA:
 *   Apaga todos os dados existentes e recria do zero a cada execução.
 *
 * SENHAS PADRÃO (NUNCA usar em produção):
 *   Super Admin: superadmin123
 *   Contador:    contador123
 *   Cliente:     cliente123
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg }    from '@prisma/adapter-pg';
import { Pool }        from 'pg';

import { SenhaHash }           from '../src/domain/value-objects/SenhaHash';
import { BcryptPasswordHasher } from '../src/infrastructure/auth/BcryptPasswordHasher';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Bootstrap do Prisma Client com Driver Adapter (Prisma 7)
// ---------------------------------------------------------------------------

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

const hasher = new BcryptPasswordHasher();

// ---------------------------------------------------------------------------
// UUIDs fixos (determinísticos) para facilitar testes e referências manuais
// ---------------------------------------------------------------------------

const SUPER_ADMIN_ID = randomUUID();
const CONTADOR_ID    = randomUUID();
const CLIENTE_ID     = randomUUID();
const FUNC_ESCRITORIO_ID = randomUUID();
const FUNC_CLIENTE_ID    = randomUUID();
const FUNC_GERENTE_ID    = randomUUID();

// ---------------------------------------------------------------------------
// Dados de seed
// ---------------------------------------------------------------------------

const SUPER_ADMIN = {
  id:    SUPER_ADMIN_ID,
  name:  'Super Administrador',
  email: 'superadmin@contabilidade.com',
  senha: 'superadmin123',
  // CRC fictício exclusivo para o super admin
  crc:   'CRC-SP/000001',
};

const CONTADOR = {
  id:    CONTADOR_ID,
  name:  'João Silva Contabilidade',
  email: 'contador@contabilidade.com',
  senha: 'contador123',
  crc:   'CRC-SP/001234',
  nomeEscritorio: 'Silva & Associados Contabilidade',
};

const CLIENTE = {
  id:    CLIENTE_ID,
  name:  'Empresa Demo Ltda',
  email: 'cliente@empresa.com',
  senha: 'cliente123',
  // CNPJ válido (dígitos verificadores conferidos pelo algoritmo oficial):
  // 11.444.777/0001-61
  cnpj:  '11444777000161',
};

const FUNC_ESCRITORIO = {
  id:    FUNC_ESCRITORIO_ID,
  name:  'Maria Fiscal',
  email: 'maria@contabilidade.com',
  senha: 'maria12345',
};

const FUNC_CLIENTE = {
  id:    FUNC_CLIENTE_ID,
  name:  'Carlos DP',
  email: 'carlos@empresa.com',
  senha: 'carlos12345',
};

const FUNC_GERENTE = {
  id:    FUNC_GERENTE_ID,
  name:  'Ana Gerente',
  email: 'ana@contabilidade.com',
  senha: 'gerente12345',
};

// ---------------------------------------------------------------------------
// Seed principal
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // -------------------------------------------------------------------------
  // 0. Limpar dados anteriores (trunca tabelas exceto _prisma_migrations)
  // -------------------------------------------------------------------------
  console.log('🗑️  Limpando dados anteriores...');
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  console.log('✅ Banco limpo.\n');

  // -------------------------------------------------------------------------
  // 1. Super Admin (isAdmin: true — acesso ao painel /contadores)
  // -------------------------------------------------------------------------
  const superAdminHash = await SenhaHash.criarDeTextoPlano(SUPER_ADMIN.senha, hasher);

  const superAdmin = await prisma.usuarioContador.create({
    data: {
      id:           SUPER_ADMIN.id,
      name:         SUPER_ADMIN.name,
      email:        SUPER_ADMIN.email,
      passwordHash: superAdminHash.hash,
      crc:          SUPER_ADMIN.crc,
      isActive:     true,
      isAdmin:      true,
    },
  });

  console.log(`✅ Super Admin criado: ${superAdmin.email} (id: ${superAdmin.id})`);

  // -------------------------------------------------------------------------
  // 2. UsuarioContador comum + ConfiguracaoEscritorio
  // -------------------------------------------------------------------------
  const contadorHash = await SenhaHash.criarDeTextoPlano(CONTADOR.senha, hasher);

  const contador = await prisma.$transaction(async (tx) => {
    const c = await tx.usuarioContador.create({
      data: {
        id:           CONTADOR.id,
        name:         CONTADOR.name,
        email:        CONTADOR.email,
        passwordHash: contadorHash.hash,
        crc:          CONTADOR.crc,
        isActive:     true,
        isAdmin:      false,
      },
    });

    await tx.configuracaoEscritorio.create({
      data: {
        contadorId:     c.id,
        nomeEscritorio: CONTADOR.nomeEscritorio,
      },
    });

    return c;
  });

  console.log(`✅ Contador criado:    ${contador.email} (id: ${contador.id})`);

  // -------------------------------------------------------------------------
  // 3. UsuarioCliente
  // -------------------------------------------------------------------------
  const clienteHash = await SenhaHash.criarDeTextoPlano(CLIENTE.senha, hasher);

  const cliente = await prisma.usuarioCliente.create({
    data: {
      id:           CLIENTE.id,
      name:         CLIENTE.name,
      email:        CLIENTE.email,
      passwordHash: clienteHash.hash,
      cnpj:         CLIENTE.cnpj,
      isActive:     true,
    },
  });

  console.log(`✅ Cliente criado:     ${cliente.email} (id: ${cliente.id})`);

  // -------------------------------------------------------------------------
  // 4. Associação ContadorCliente (carteira)
  // -------------------------------------------------------------------------
  await prisma.contadorCliente.create({
    data: {
      contadorId: contador.id,
      clienteId:  cliente.id,
    },
  });

  console.log(`✅ Carteira vinculada: ${contador.email} → ${cliente.email}\n`);

  // -------------------------------------------------------------------------
  // 5. Funcionários de exemplo
  // -------------------------------------------------------------------------
  const funcEscHash  = await SenhaHash.criarDeTextoPlano(FUNC_ESCRITORIO.senha, hasher);
  const funcCliHash  = await SenhaHash.criarDeTextoPlano(FUNC_CLIENTE.senha, hasher);

  const funcEsc = await prisma.funcionario.create({
    data: {
      id:           FUNC_ESCRITORIO.id,
      name:         FUNC_ESCRITORIO.name,
      email:        FUNC_ESCRITORIO.email,
      passwordHash: funcEscHash.hash,
      vinculo:      'ESCRITORIO',
      contadorId:   contador.id,
      setores:      ['FISCAL', 'CONTABIL'],
      isActive:     true,
    },
  });
  console.log(`✅ Func. escritório:  ${funcEsc.email} (setores: FISCAL, CONTABIL)`);

  const funcCli = await prisma.funcionario.create({
    data: {
      id:           FUNC_CLIENTE.id,
      name:         FUNC_CLIENTE.name,
      email:        FUNC_CLIENTE.email,
      passwordHash: funcCliHash.hash,
      vinculo:      'CLIENTE',
      clienteId:    cliente.id,
      setores:      ['PESSOAL'],
      isActive:     true,
    },
  });
  console.log(`✅ Func. cliente:     ${funcCli.email} (setores: PESSOAL)`);

  const funcGerHash = await SenhaHash.criarDeTextoPlano(FUNC_GERENTE.senha, hasher);

  const funcGer = await prisma.funcionario.create({
    data: {
      id:           FUNC_GERENTE.id,
      name:         FUNC_GERENTE.name,
      email:        FUNC_GERENTE.email,
      passwordHash: funcGerHash.hash,
      vinculo:      'ESCRITORIO',
      contadorId:   contador.id,
      setores:      ['TODOS'],
      isActive:     true,
    },
  });
  console.log(`✅ Func. gerente:     ${funcGer.email} (setores: TODOS)\n`);

  // -------------------------------------------------------------------------
  // 6. Planos SaaS
  // -------------------------------------------------------------------------
  const [planoBasico, planoPro, planoEnterprise] = await Promise.all([
    prisma.planoSaaS.create({
      data: {
        nome:             'Básico',
        descricao:        'Ideal para escritórios pequenos que estão começando.',
        preco:            89,
        limiteClientes:   20,
        limiteDocumentos: 1000,
        features:         ['chat', 'calendario', 'financeiro'],
        isActive:         true,
      },
    }),
    prisma.planoSaaS.create({
      data: {
        nome:             'Pro',
        descricao:        'Para escritórios em crescimento que precisam de mais recursos.',
        preco:            189,
        limiteClientes:   100,
        limiteDocumentos: 5000,
        features:         ['chat', 'calendario', 'financeiro', 'assinatura_eletronica', 'relatorios', 'equipe'],
        isActive:         true,
      },
    }),
    prisma.planoSaaS.create({
      data: {
        nome:             'Enterprise',
        descricao:        'Clientes e documentos ilimitados. Todos os recursos.',
        preco:            389,
        limiteClientes:   -1,
        limiteDocumentos: -1,
        features:         ['chat', 'calendario', 'financeiro', 'assinatura_eletronica', 'relatorios', 'equipe', 'integracao_cora'],
        isActive:         true,
      },
    }),
  ]);
  console.log(`✅ Planos criados: Básico (R$89), Pro (R$189), Enterprise (R$389)`);

  // Assign Pro plan to the seed contador as TRIAL
  await prisma.assinaturaSaaS.create({
    data: {
      escritorioId:  contador.id,
      planoId:       planoPro.id,
      status:        'TRIAL',
      dataRenovacao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      valorMensal:   planoPro.preco,
    },
  });
  console.log(`✅ Plano Pro (TRIAL) atribuído ao contador de exemplo\n`);

  // suppress unused variable warnings
  void planoBasico;
  void planoEnterprise;

  // -------------------------------------------------------------------------
  // Resumo
  // -------------------------------------------------------------------------
  console.log('─'.repeat(54));
  console.log('Seed concluído! Credenciais de acesso:\n');
  console.log('  Super Admin (ADMIN) → /contadores');
  console.log(`    E-mail: ${SUPER_ADMIN.email}`);
  console.log(`    Senha:  ${SUPER_ADMIN.senha}\n`);
  console.log('  Contador (ACCOUNTANT) → /dashboard');
  console.log(`    E-mail: ${CONTADOR.email}`);
  console.log(`    Senha:  ${CONTADOR.senha}\n`);
  console.log('  Cliente (CLIENT) → /documentos');
  console.log(`    E-mail: ${CLIENTE.email}`);
  console.log(`    Senha:  ${CLIENTE.senha}\n`);
  console.log('  Func. Escritório (EMPLOYEE) → /dashboard');
  console.log(`    E-mail: ${FUNC_ESCRITORIO.email}`);
  console.log(`    Senha:  ${FUNC_ESCRITORIO.senha}`);
  console.log(`    Setores: FISCAL, CONTABIL\n`);
  console.log('  Func. Cliente (EMPLOYEE) → /documentos');
  console.log(`    E-mail: ${FUNC_CLIENTE.email}`);
  console.log(`    Senha:  ${FUNC_CLIENTE.senha}`);
  console.log(`    Setores: PESSOAL\n`);
  console.log('  Func. Gerente (EMPLOYEE) → /dashboard');
  console.log(`    E-mail: ${FUNC_GERENTE.email}`);
  console.log(`    Senha:  ${FUNC_GERENTE.senha}`);
  console.log(`    Setores: TODOS (acesso total)\n`);
  console.log('  Planos SaaS criados:');
  console.log('    Básico      → R$89/mês  · 20 clientes  · 1.000 docs');
  console.log('    Pro (TRIAL) → R$189/mês · 100 clientes · 5.000 docs (atribuído ao contador)');
  console.log('    Enterprise  → R$389/mês · ilimitado');
  console.log('─'.repeat(54));
  console.log('\n⚠️  ATENÇÃO: credenciais apenas para desenvolvimento.\n');
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (err) => {
    console.error('\n❌ Erro ao executar seed:', err);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
