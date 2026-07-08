# Regras do Banco de Dados - EUNAMAN Fleet ERP

Este documento detalha as políticas, restrições e fluxos de modificação para a base de dados hospedada no **Supabase (PostgreSQL)**.

## Diretrizes de Tabelas e Integridade

Quando for necessário criar ou alterar tabelas do banco de dados, a Skill deve seguir este checklist obrigatório:

1. **Migrations SQL**: Toda e qualquer alteração de estrutura (DDL) ou carga de dados estruturados deve ser feita via script SQL versionado dentro da pasta `/supabase/migrations`. Nunca altere o banco diretamente pelo console do Supabase sem salvar a migration correspondente.
2. **Índices (`INDEX`)**: Crie índices em campos muito utilizados em filtros (`WHERE`), junções (`JOIN`) e ordenação (`ORDER BY`), como placas, datas, status e chaves estrangeiras.
3. **Foreign Keys (Chaves Estrangeiras)**: Sempre defina chaves estrangeiras apropriadas com comportamento de exclusão seguro (ex: `ON DELETE CASCADE` ou `ON DELETE SET NULL`).
4. **Row Level Security (RLS)**: Toda tabela deve ter a RLS ativada (`ALTER TABLE public.minha_tabela ENABLE ROW LEVEL SECURITY;`).
5. **Policies (Políticas de Acesso)**: Defina políticas granulares de leitura, escrita, atualização e exclusão baseadas nos papéis dos usuários autenticados (`auth.uid()`, roles, etc.).
6. **Atualização de Tipos**: Após criar ou alterar tabelas, gere ou atualize os tipos de TypeScript auto-gerados do Supabase no projeto para manter o compilador tipado e seguro.

---

## Gestão de Cargos e Permissões (Roles)

O sistema possui cargos pré-definidos para os usuários. A lista de cargos existentes é:
* `admin` (Administrador geral)
* `pcm` (Planejamento e Controle de Manutenção)
* `gestao` (Visualização estratégica e relatórios)
* `visitante` (Acesso somente leitura)
* `mecanico` (Operação de manutenção)
* `motorista` (Operadores de veículos)
* `gestor` (Aprovadores e gerentes de área)
* `afiador` (Especialista em afiação)

### Fluxo de Trabalho ao Criar um Novo Cargo:
Se for solicitado a criação de um novo cargo/função no sistema, a Skill deve seguir rigidamente esta sequência de passos:

1. **Criar Migration**: Criar uma migration SQL em `/supabase/migrations`.
2. **Atualizar `role_permissions`**: Inserir as permissões padrão para o novo cargo na tabela `role_permissions` associando o cargo com as rotas/telas permitidas (`allowed_tabs`).
3. **Atualizar CHECK constraints**: Atualizar as restrições de tipo de papel (`CHECK`) nas tabelas `profiles` e `role_permissions` para aceitar o novo termo do cargo (ex: `CHECK (role IN ('admin', ..., 'novo_cargo'))`).
4. **Atualizar Telas**: Adaptar as telas para bloquear/permitir campos com base no novo perfil de usuário.
5. **Atualizar Menu**: Ajustar o menu lateral (`sidebar`/`navbar`) para que renderize as abas corretas para o novo cargo.
6. **Atualizar Autenticação**: Garantir que o provedor de autenticação (`auth-context`) e middleware (se houver) leiam e apliquem a regra do novo cargo corretamente no estado do cliente.
