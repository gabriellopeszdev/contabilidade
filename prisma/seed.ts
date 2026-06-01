/**
 * prisma/seed.ts — População Inicial do Banco de Dados
 *
 * Idempotente: usa upsert em todos os registros.
 * Rodar múltiplas vezes não apaga nem duplica dados existentes.
 *
 * EXECUÇÃO:
 *   npx prisma db seed
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

import { SenhaHash }            from '../src/domain/value-objects/SenhaHash';
import { BcryptPasswordHasher } from '../src/infrastructure/auth/BcryptPasswordHasher';
import { SetorTipo }            from '@prisma/client';

// ---------------------------------------------------------------------------
// Bootstrap do Prisma Client com Driver Adapter (Prisma 7)
// ---------------------------------------------------------------------------

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });
const hasher  = new BcryptPasswordHasher();

// ---------------------------------------------------------------------------
// UUIDs fixos — garantem que o mesmo registro é sempre atualizado (não duplicado)
// ---------------------------------------------------------------------------

const SUPER_ADMIN_ID     = 'a1000000-0000-0000-0000-000000000001';
const CONTADOR_ID        = 'a2000000-0000-0000-0000-000000000002';
const CLIENTE_ID         = 'a3000000-0000-0000-0000-000000000003';
const FUNC_ESCRITORIO_ID = 'a4000000-0000-0000-0000-000000000004';
const FUNC_CLIENTE_ID    = 'a5000000-0000-0000-0000-000000000005';
const FUNC_GERENTE_ID    = 'a6000000-0000-0000-0000-000000000006';

// ---------------------------------------------------------------------------
// Dados de seed
// ---------------------------------------------------------------------------

const SUPER_ADMIN = {
  id:    SUPER_ADMIN_ID,
  name:  'Super Administrador',
  email: 'superadmin@contabilidade.com',
  senha: 'superadmin123',
  crc:   'CRC-SP/000001',
};

const CONTADOR = {
  id:             CONTADOR_ID,
  name:           'João Silva Contabilidade',
  email:          'contador@contabilidade.com',
  senha:          'contador123',
  crc:            'CRC-SP/001234',
  nomeEscritorio: 'Silva & Associados Contabilidade',
};

const CLIENTE = {
  id:    CLIENTE_ID,
  name:  'Empresa Demo Ltda',
  email: 'cliente@empresa.com',
  senha: 'cliente123',
  cnpj:  '11444777000161',
};

const FUNC_ESCRITORIO = { id: FUNC_ESCRITORIO_ID, name: 'Maria Fiscal',  email: 'maria@contabilidade.com', senha: 'maria12345' };
const FUNC_CLIENTE    = { id: FUNC_CLIENTE_ID,    name: 'Carlos DP',     email: 'carlos@empresa.com',       senha: 'carlos12345' };
const FUNC_GERENTE    = { id: FUNC_GERENTE_ID,    name: 'Ana Gerente',   email: 'ana@contabilidade.com',    senha: 'gerente12345' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertContador(data: {
  id: string; name: string; email: string; senha: string; crc: string; isAdmin: boolean;
}) {
  const existe = await prisma.usuarioContador.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existe) {
    return prisma.usuarioContador.update({
      where:  { email: data.email },
      data:   { name: data.name, crc: data.crc, isActive: true, isAdmin: data.isAdmin },
    });
  }
  const hash = await SenhaHash.criarDeTextoPlano(data.senha, hasher);
  return prisma.usuarioContador.create({
    data: { id: data.id, name: data.name, email: data.email, passwordHash: hash.hash, crc: data.crc, isActive: true, isAdmin: data.isAdmin },
  });
}

async function upsertCliente(data: {
  id: string; name: string; email: string; senha: string; cnpj: string;
}) {
  const existe = await prisma.usuarioCliente.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existe) {
    return prisma.usuarioCliente.update({
      where: { email: data.email },
      data:  { name: data.name, isActive: true },
    });
  }
  const hash = await SenhaHash.criarDeTextoPlano(data.senha, hasher);
  return prisma.usuarioCliente.create({
    data: { id: data.id, name: data.name, email: data.email, passwordHash: hash.hash, cnpj: data.cnpj, isActive: true },
  });
}

async function upsertFuncionario(data: {
  id: string; name: string; email: string; senha: string;
  vinculo: 'ESCRITORIO' | 'CLIENTE'; contadorId?: string; clienteId?: string; setores: SetorTipo[];
}) {
  const existe = await prisma.funcionario.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existe) {
    return prisma.funcionario.update({
      where: { email: data.email },
      data:  { name: data.name, vinculo: data.vinculo, contadorId: data.contadorId, clienteId: data.clienteId, setores: data.setores, isActive: true },
    });
  }
  const hash = await SenhaHash.criarDeTextoPlano(data.senha, hasher);
  return prisma.funcionario.create({
    data: { id: data.id, name: data.name, email: data.email, passwordHash: hash.hash, vinculo: data.vinculo, contadorId: data.contadorId, clienteId: data.clienteId, setores: data.setores, isActive: true },
  });
}

// ---------------------------------------------------------------------------
// Seed principal
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  // -------------------------------------------------------------------------
  // 1. Usuários
  // -------------------------------------------------------------------------
  const superAdmin = await upsertContador({ ...SUPER_ADMIN, isAdmin: true });
  console.log(`✅ Super Admin:       ${superAdmin.email} (id: ${superAdmin.id})`);

  const contador = await upsertContador({ ...CONTADOR, isAdmin: false });
  console.log(`✅ Contador:          ${contador.email} (id: ${contador.id})`);

  const cliente = await upsertCliente(CLIENTE);
  console.log(`✅ Cliente:           ${cliente.email} (id: ${cliente.id})`);

  // -------------------------------------------------------------------------
  // 2. ConfiguracaoEscritorio
  // -------------------------------------------------------------------------
  await prisma.configuracaoEscritorio.upsert({
    where:  { contadorId: contador.id },
    update: { nomeEscritorio: CONTADOR.nomeEscritorio },
    create: { contadorId: contador.id, nomeEscritorio: CONTADOR.nomeEscritorio },
  });

  // -------------------------------------------------------------------------
  // 3. Vínculo contador → cliente
  // -------------------------------------------------------------------------
  await prisma.contadorCliente.upsert({
    where:  { contadorId_clienteId: { contadorId: contador.id, clienteId: cliente.id } },
    update: {},
    create: { contadorId: contador.id, clienteId: cliente.id },
  });
  console.log(`✅ Carteira vinculada: ${contador.email} → ${cliente.email}`);

  // -------------------------------------------------------------------------
  // 4. Funcionários
  // -------------------------------------------------------------------------
  const funcEsc = await upsertFuncionario({ ...FUNC_ESCRITORIO, vinculo: 'ESCRITORIO', contadorId: contador.id, setores: [SetorTipo.FISCAL, SetorTipo.CONTABIL] });
  console.log(`✅ Func. escritório:  ${funcEsc.email} (setores: FISCAL, CONTABIL)`);

  const funcCli = await upsertFuncionario({ ...FUNC_CLIENTE, vinculo: 'CLIENTE', clienteId: cliente.id, setores: [SetorTipo.PESSOAL] });
  console.log(`✅ Func. cliente:     ${funcCli.email} (setores: PESSOAL)`);

  const funcGer = await upsertFuncionario({ ...FUNC_GERENTE, vinculo: 'ESCRITORIO', contadorId: contador.id, setores: [SetorTipo.TODOS] });
  console.log(`✅ Func. gerente:     ${funcGer.email} (setores: TODOS)\n`);

  // -------------------------------------------------------------------------
  // 5. Planos SaaS
  // -------------------------------------------------------------------------
  const [planoBasico, planoPro, planoEnterprise] = await Promise.all([
    prisma.planoSaaS.upsert({
      where:  { nome: 'Básico' },
      update: { preco: 89, limiteClientes: 20, limiteDocumentos: 1000, features: ['chat', 'calendario', 'financeiro'], isActive: true },
      create: { nome: 'Básico', descricao: 'Ideal para escritórios pequenos que estão começando.', preco: 89, limiteClientes: 20, limiteDocumentos: 1000, features: ['chat', 'calendario', 'financeiro'], isActive: true },
    }),
    prisma.planoSaaS.upsert({
      where:  { nome: 'Pro' },
      update: { preco: 189, limiteClientes: 100, limiteDocumentos: 5000, features: ['chat', 'calendario', 'financeiro', 'assinatura_eletronica', 'relatorios', 'equipe'], isActive: true },
      create: { nome: 'Pro', descricao: 'Para escritórios em crescimento que precisam de mais recursos.', preco: 189, limiteClientes: 100, limiteDocumentos: 5000, features: ['chat', 'calendario', 'financeiro', 'assinatura_eletronica', 'relatorios', 'equipe'], isActive: true },
    }),
    prisma.planoSaaS.upsert({
      where:  { nome: 'Enterprise' },
      update: { preco: 389, limiteClientes: -1, limiteDocumentos: -1, features: ['chat', 'calendario', 'financeiro', 'assinatura_eletronica', 'relatorios', 'equipe', 'integracao_cora'], isActive: true },
      create: { nome: 'Enterprise', descricao: 'Clientes e documentos ilimitados. Todos os recursos.', preco: 389, limiteClientes: -1, limiteDocumentos: -1, features: ['chat', 'calendario', 'financeiro', 'assinatura_eletronica', 'relatorios', 'equipe', 'integracao_cora'], isActive: true },
    }),
  ]);
  console.log(`✅ Planos:            Básico (R$89), Pro (R$189), Enterprise (R$389)`);

  // -------------------------------------------------------------------------
  // 6. Assinatura SaaS (plano Pro TRIAL para o contador de exemplo)
  // -------------------------------------------------------------------------
  const assinaturaExistente = await prisma.assinaturaSaaS.findFirst({
    where: { escritorioId: contador.id },
  });

  if (!assinaturaExistente) {
    await prisma.assinaturaSaaS.create({
      data: {
        escritorioId:  contador.id,
        planoId:       planoPro.id,
        status:        'TRIAL',
        dataRenovacao: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        valorMensal:   planoPro.preco,
      },
    });
    console.log(`✅ Plano Pro (TRIAL) atribuído ao contador de exemplo`);
  } else {
    console.log(`ℹ️  Assinatura do contador já existe — mantida sem alteração`);
  }

  void planoBasico;
  void planoEnterprise;

  // -------------------------------------------------------------------------
  // Resumo
  // -------------------------------------------------------------------------
  console.log('\n' + '─'.repeat(54));
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
  console.log('  Planos SaaS:');
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
