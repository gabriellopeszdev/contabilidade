import { describe, it, expect } from 'vitest';
import { TarefaKanban, type EstadoTarefa } from '../../../src/domain/entities/TarefaKanban';
import { DomainException } from '../../../src/domain/exceptions/DomainException';
import { InvalidTransitionException } from '../../../src/domain/exceptions/InvalidTransitionException';

function criarTarefa(overrides: Partial<Parameters<typeof TarefaKanban.criar>[0]> = {}) {
  return TarefaKanban.criar({
    id: 'tarefa-001',
    clientId: 'cliente-001',
    title: 'Fechar balancete de maio',
    description: null,
    priority: 'MEDIUM',
    dueDate: null,
    position: 0,
    ...overrides,
  });
}

function reconstituir(estado: EstadoTarefa) {
  return TarefaKanban.reconstituir({
    id: 'x', clientId: 'c', assignedTo: null,
    title: 'T', description: null,
    currentState: estado, priority: 'LOW',
    dueDate: null, completedAt: null,
    position: 0, createdAt: new Date(), updatedAt: new Date(),
  });
}

describe('TarefaKanban', () => {
  describe('criar()', () => {
    it('inicia sempre no estado PENDING', () => {
      expect(criarTarefa().currentState).toBe('PENDING');
    });

    it('assignedTo é null por padrão', () => {
      expect(criarTarefa().assignedTo).toBeNull();
    });

    it('completedAt é null por padrão', () => {
      expect(criarTarefa().completedAt).toBeNull();
    });

    it('lança DomainException para título vazio', () => {
      expect(() => criarTarefa({ title: '' })).toThrow(DomainException);
    });

    it('lança DomainException para título com mais de 255 caracteres', () => {
      expect(() => criarTarefa({ title: 'x'.repeat(256) })).toThrow(DomainException);
    });

    it('aceita título com exatamente 255 caracteres', () => {
      expect(() => criarTarefa({ title: 'x'.repeat(255) })).not.toThrow();
    });

    it('lança DomainException para id vazio', () => {
      expect(() => criarTarefa({ id: '' })).toThrow(DomainException);
    });

    it('lança DomainException para clientId vazio', () => {
      expect(() => criarTarefa({ clientId: '' })).toThrow(DomainException);
    });

    it('lança DomainException para posição negativa', () => {
      expect(() => criarTarefa({ position: -1 })).toThrow(DomainException);
    });
  });

  describe('máquina de estados — transições válidas', () => {
    it('PENDING → PROCESSING', () => {
      const t = criarTarefa();
      t.transitar('PROCESSING');
      expect(t.currentState).toBe('PROCESSING');
    });

    it('PROCESSING → REVIEW', () => {
      const t = criarTarefa();
      t.transitar('PROCESSING');
      t.transitar('REVIEW');
      expect(t.currentState).toBe('REVIEW');
    });

    it('REVIEW → DONE (fluxo principal completo)', () => {
      const t = criarTarefa();
      t.transitar('PROCESSING');
      t.transitar('REVIEW');
      t.transitar('DONE');
      expect(t.currentState).toBe('DONE');
      expect(t.estaConcluida).toBe(true);
    });

    it('REVIEW → PROCESSING (retrabalho)', () => {
      const t = criarTarefa();
      t.transitar('PROCESSING');
      t.transitar('REVIEW');
      t.transitar('PROCESSING');
      expect(t.currentState).toBe('PROCESSING');
    });

    it('PROCESSING → PENDING (pausa)', () => {
      const t = criarTarefa();
      t.transitar('PROCESSING');
      t.transitar('PENDING');
      expect(t.currentState).toBe('PENDING');
    });
  });

  describe('máquina de estados — transições inválidas', () => {
    const invalidas: [EstadoTarefa, EstadoTarefa][] = [
      ['PENDING',    'REVIEW'],
      ['PENDING',    'DONE'],
      ['PROCESSING', 'DONE'],
      ['REVIEW',     'PENDING'],
      ['DONE',       'PENDING'],
      ['DONE',       'PROCESSING'],
      ['DONE',       'REVIEW'],
    ];

    it.each(invalidas)('lança InvalidTransitionException: %s → %s', (de, para) => {
      expect(() => reconstituir(de).transitar(para)).toThrow(InvalidTransitionException);
    });
  });

  describe('efeitos colaterais de transição', () => {
    it('registra completedAt ao atingir DONE', () => {
      const t = criarTarefa();
      t.transitar('PROCESSING');
      t.transitar('REVIEW');
      t.transitar('DONE');
      expect(t.completedAt).toBeInstanceOf(Date);
    });

    it('emite evento por transição', () => {
      const t = criarTarefa();
      t.transitar('PROCESSING');
      expect(t.peekDomainEvents()).toHaveLength(1);
      expect(t.peekDomainEvents()[0].eventName).toBe('TarefaTransitadaEvent');
    });

    it('acumula N eventos para N transições', () => {
      const t = criarTarefa();
      t.transitar('PROCESSING');
      t.transitar('REVIEW');
      t.transitar('DONE');
      expect(t.peekDomainEvents()).toHaveLength(3);
    });
  });

  describe('validarTransicao', () => {
    it('retorna true sem alterar estado', () => {
      const t = criarTarefa();
      expect(t.validarTransicao('PROCESSING')).toBe(true);
      expect(t.currentState).toBe('PENDING');
    });

    it('retorna false para transição proibida', () => {
      expect(criarTarefa().validarTransicao('DONE')).toBe(false);
    });
  });

  describe('transicoesDisponiveis', () => {
    it('PENDING só tem PROCESSING', () => {
      expect(criarTarefa().transicoesDisponiveis()).toEqual(['PROCESSING']);
    });

    it('DONE não tem transições', () => {
      const t = criarTarefa();
      t.transitar('PROCESSING');
      t.transitar('REVIEW');
      t.transitar('DONE');
      expect(t.transicoesDisponiveis()).toEqual([]);
    });

    it('PROCESSING tem REVIEW e PENDING', () => {
      const t = criarTarefa();
      t.transitar('PROCESSING');
      expect(t.transicoesDisponiveis()).toContain('REVIEW');
      expect(t.transicoesDisponiveis()).toContain('PENDING');
    });
  });

  describe('atribuição de responsável', () => {
    it('atribui contador responsável', () => {
      const t = criarTarefa();
      t.atribuirResponsavel('contador-001');
      expect(t.assignedTo).toBe('contador-001');
    });

    it('lança DomainException ao atribuir em tarefa DONE', () => {
      const t = criarTarefa();
      t.transitar('PROCESSING');
      t.transitar('REVIEW');
      t.transitar('DONE');
      expect(() => t.atribuirResponsavel('contador-001')).toThrow(DomainException);
    });

    it('lança DomainException para contadorId vazio', () => {
      expect(() => criarTarefa().atribuirResponsavel('')).toThrow(DomainException);
    });

    it('removerResponsavel() define assignedTo como null', () => {
      const t = criarTarefa();
      t.atribuirResponsavel('contador-001');
      t.removerResponsavel();
      expect(t.assignedTo).toBeNull();
    });
  });

  describe('posição', () => {
    it('atualiza posição válida', () => {
      const t = criarTarefa();
      t.atualizarPosicao(5);
      expect(t.position).toBe(5);
    });

    it('aceita posição zero', () => {
      const t = criarTarefa();
      t.atualizarPosicao(0);
      expect(t.position).toBe(0);
    });

    it('lança DomainException para posição negativa', () => {
      expect(() => criarTarefa().atualizarPosicao(-1)).toThrow(DomainException);
    });
  });

  describe('estaAtrasada', () => {
    it('retorna true quando dueDate no passado e não concluída', () => {
      const ontem = new Date(Date.now() - 86_400_000);
      expect(criarTarefa({ dueDate: ontem }).estaAtrasada).toBe(true);
    });

    it('retorna false quando concluída (mesmo com dueDate no passado)', () => {
      const ontem = new Date(Date.now() - 86_400_000);
      const t = criarTarefa({ dueDate: ontem });
      t.transitar('PROCESSING');
      t.transitar('REVIEW');
      t.transitar('DONE');
      expect(t.estaAtrasada).toBe(false);
    });

    it('retorna false sem dueDate', () => {
      expect(criarTarefa({ dueDate: null }).estaAtrasada).toBe(false);
    });

    it('retorna false com dueDate no futuro', () => {
      const amanha = new Date(Date.now() + 86_400_000);
      expect(criarTarefa({ dueDate: amanha }).estaAtrasada).toBe(false);
    });
  });
});
