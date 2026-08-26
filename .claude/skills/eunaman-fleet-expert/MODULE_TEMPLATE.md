# Template de Módulos - EUNAMAN Fleet ERP

Este guia orienta o assistente no desenvolvimento automático de novos módulos solicitados pelo usuário (ex: **Abastecimento**). Sempre que for solicitado "Crie o módulo [Nome]", o assistente deve estruturar os seguintes arquivos e integrações.

---

## 1. Arquivos a Serem Criados

Ao implementar um novo módulo, a seguinte estrutura de arquivos deve ser gerada:

### Banco de Dados
* **`supabase/migrations/[TIMESTAMP]_create_[modulo]_table.sql`**: Migration SQL contendo criação da tabela, chave primária, chaves estrangeiras, índices de performance, ativação de RLS, e políticas de acesso (Select, Insert, Update, Delete) baseadas nos perfis de usuários.

### Frontend (Diretório do Módulo)
* **`app/[modulo]/page.tsx`**: Server component de rota. Busca os dados iniciais do Supabase e renderiza o Client Component.
* **`app/[modulo]/[Modulo]Client.tsx`**: Client Component principal. Gerencia abas de visualização, formulários de criação/edição, estado de modais e coordena a exibição.
* **`app/[modulo]/[Modulo]Table.tsx`**: Tabela principal de exibição dos registros com paginação, ações e ordenação.
* **`app/[modulo]/[Modulo]Modal.tsx`**: Modal de CRUD para adicionar e editar registros da tabela.
* **`app/[modulo]/[Modulo]Dashboard.tsx`**: Painel visual contendo cartões de estatísticas rápidas e gráficos de distribuição ou séries temporais usando `recharts`.
* **`app/[modulo]/actions.ts`**: Ações do lado do servidor (Server Actions) ou funções de serviço para chamar o Supabase (criar, ler, atualizar, deletar).
* **`app/[modulo]/types.ts`**: Arquivo de definição de tipos e interfaces do TypeScript para as entidades do módulo.
* **`app/[modulo]/[modulo]Utils.ts`**: Helpers de formatação e parsing específicos do módulo.

---

## 2. Integrações no Sistema

Não basta criar os arquivos do módulo; o assistente deve integrá-los ao sistema existente:

1. **Menu Lateral de Navegação (Sidebar / layout principal)**:
   * Localize o componente do menu lateral em `components/main-layout.tsx` or similar.
   * Adicione o novo link da rota (ex: `/abastecimento`), definindo um ícone do `lucide-react` coerente e o nome em caixa alta.
2. **Permissões de Acesso**:
   * Atualize as permissões de acesso por cargo na tabela `role_permissions` inserindo a nova rota nos cargos autorizados (ex: `admin`, `pcm`, `gestao` podem ver `/abastecimento`).
3. **Autenticação**:
   * Verifique se as rotas precisam de verification ou middlewares extras de proteção no client/server.
4. **Filtros e Relatórios**:
   * Adicione opções de filtros dinâmicos na toolbar da tela (ex: filtro por placa, período de data, operador).
   * Implemente a exportação dos dados da tabela para Excel utilizando a biblioteca `xlsx` (semelhante aos módulos de Backlog e Afiação).
