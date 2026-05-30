-- Permite atribuir tarefas Kanban a um funcionário específico (sem FK — Funcionario é modelo separado)
ALTER TABLE "tarefa_kanban" ADD COLUMN "assigned_to_funcionario_id" UUID;
CREATE INDEX "tarefa_kanban_assigned_to_funcionario_id_idx" ON "tarefa_kanban"("assigned_to_funcionario_id");

-- Permite atribuir obrigações fiscais a um funcionário responsável
ALTER TABLE "obrigacao_fiscal" ADD COLUMN "assigned_to_funcionario_id" UUID;
CREATE INDEX "obrigacao_fiscal_assigned_to_funcionario_id_idx" ON "obrigacao_fiscal"("assigned_to_funcionario_id");
