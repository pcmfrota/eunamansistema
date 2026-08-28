---
name: mao-de-obra-modulo
description: Especificação completa e portátil do módulo de Apontamento de Mão de Obra (jornada diária de colaboradores) do EUNAMAN Fleet ERP — schema de banco, regras de negócio, contratos de server actions e fluxo de UI, pronta para reimplementar em outro sistema.
risk: safe
source: user
---

# Módulo: Apontamento Diário de Mão de Obra

Especificação portátil do módulo "Ficha Mão de Obra" do EUNAMAN Fleet ERP. Escrita para ser levada a **outro sistema/codebase** — descreve o modelo de dados, as regras de negócio e os contratos de UI/API de forma independente da stack (a implementação de origem é Next.js 14 App Router + Supabase/Postgres + React, mas as regras abaixo não dependem disso).

## 1. Propósito e conceito central

Cada colaborador (mecânico, motorista etc.) registra sua **jornada de um dia** com uma lista granular de atividades apontadas ao longo do turno — incluindo tempo produtivo e tempo ocioso/parado. Não é "1 ficha = 1 serviço em 1 placa"; é **1 ficha = 1 colaborador = 1 dia**, com N atividades soltas dentro dela.

Essa é uma decisão deliberada de modelagem, adotada depois de uma versão anterior mais rígida (ficha por placa/serviço). Ao portar o módulo, mantenha esse conceito — é o que faz o dashboard de produtividade (tempo produtivo x ocioso x não apontado) fazer sentido.

## 2. Modelo de dados

### `fichas_mao_obra` (a jornada/cabeçalho do dia)

```sql
CREATE TABLE fichas_mao_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_ficha TEXT UNIQUE NOT NULL,       -- gerado no cliente: "MO-{ano}-{4 dígitos aleatórios}"
  mecanico_nome TEXT NOT NULL,             -- nome do colaborador (texto livre, não FK — ver regra 3.6)
  mecanico_matricula TEXT,
  equipe TEXT,                             -- turno (catálogo: '1° TURNO' etc.)
  supervisor TEXT,                         -- catálogo administrável
  modulo TEXT,                             -- área/módulo operacional (catálogo)
  frente_trabalho TEXT,                    -- catálogo (ex: 'HV', 'FW', 'CARREGAMENTO')
  data_jornada DATE DEFAULT CURRENT_DATE,
  hora_inicio_jornada TEXT,                -- "HH:MM"
  hora_fim_jornada TEXT,                   -- "HH:MM"
  tempo_total_horas NUMERIC DEFAULT 0,     -- soma dos apontamentos (recalculado, nunca editado à mão)
  tempo_produtivo_horas NUMERIC DEFAULT 0,
  tempo_ocioso_horas NUMERIC DEFAULT 0,
  observacoes TEXT,
  status TEXT DEFAULT 'Em andamento',      -- 'Em andamento' | 'Finalizado'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
```

> Na base de origem existem colunas legadas de uma versão anterior por-serviço (`placa`, `equipamento`, `tipo_manutencao`, `descricao_servico`, `pecas`, `fotos_antes/depois`, `assinatura_*`, `km`, `horimetro`) que ficaram sem uso pela UI atual. **Não recrie essas colunas ao portar** — eram específicas da modelagem antiga.

### `apontamentos_mao_obra` (cada atividade da jornada — 1 linha por atividade)

```sql
CREATE TABLE apontamentos_mao_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id UUID NOT NULL REFERENCES fichas_mao_obra(id) ON DELETE CASCADE,
  tipo_atividade TEXT NOT NULL,            -- categoria da atividade (texto livre ou catálogo, a critério da implementação)
  tipo_manutencao TEXT,                    -- catálogo (opcional)
  apontamento_codigo TEXT,                 -- código do catálogo de apontamentos (ver tabela mao_obra_apontamentos_catalogo abaixo)
  produtivo BOOLEAN NOT NULL DEFAULT false,-- copiado do catálogo no momento do apontamento
  placa TEXT,                              -- equipamento afetado, se aplicável
  descricao TEXT,
  hora_inicio TEXT,                        -- "HH:MM"
  hora_fim TEXT,                           -- "HH:MM"
  tempo_gasto_minutos INTEGER DEFAULT 0,   -- fonte de verdade (ver 3.3)
  registrado_por UUID REFERENCES auth.users(id),
  registrado_por_nome TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Por que uma tabela separada em vez de um JSONB dentro da ficha:** vários colaboradores (ou o mesmo colaborador em aparelhos diferentes) apontam na mesma jornada ao longo do dia. Um JSONB reescrito por inteiro a cada "salvar" tem risco real de sobrescrita — a última gravação vence e apaga o que outra sessão tinha acabado de apontar. Cada atividade sendo sua própria linha, inserida no momento em que é confirmada, elimina essa corrida.

### `mao_obra_catalogos` (listas suspensas administráveis)

```sql
CREATE TABLE mao_obra_catalogos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL,   -- 'tipo_manutencao' | 'equipe_turno' | 'supervisor' | 'modulo' | 'frente_trabalho'
  valor TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (categoria, valor)
);
```

Uma tabela genérica categoria+valor cobre todas as listas suspensas do formulário — evita criar uma tabela por lista. **Exclusão é lógica** (`ativo = false`), nunca `DELETE`: preserva a legibilidade de fichas antigas (o valor está gravado como texto solto na ficha, não como referência). Criar um item reaproveita `UNIQUE(categoria, valor)` com `ON CONFLICT ... DO UPDATE`/upsert, então readicionar o mesmo valor reativa a linha em vez de duplicar.

### `mao_obra_apontamentos_catalogo` (o "o que você está fazendo", com código)

```sql
CREATE TABLE mao_obra_apontamentos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  produtivo BOOLEAN NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Catálogo separado do anterior porque tem uma dimensão a mais (código numérico, ex: "215" = "TROCAR") e é a fonte de verdade de `produtivo` — quando um apontamento é criado, `produtivo` é copiado deste catálogo para a linha do apontamento (não é recalculado depois; se o catálogo mudar, apontamentos já lançados não retroagem).

## 3. Regras de negócio

### 3.1 — Jornada é única por colaborador + dia, retomável de qualquer aparelho

Ao abrir o formulário, o sistema procura uma ficha com `status = 'Em andamento'` cujo `mecanico_nome` e `data_jornada` batam com o colaborador/dia atual. Se existir, **retoma essa jornada** (mesmo `id`) em vez de criar uma nova — permite que o colaborador troque de celular ou reabra o app no mesmo dia sem duplicar a ficha. A busca é só carregada em segundo plano; quem decide de fato entrar no formulário é o usuário (a tela inicial é sempre um menu de cards, nunca pula direto pro formulário).

### 3.2 — Duas atividades não podem se sobrepor no tempo

Antes de salvar um apontamento, valida que o intervalo `[hora_inicio, hora_fim]` não sobrepõe nenhum outro apontamento já lançado na mesma jornada. Trata virada de dia (ex: início 23:00, fim 01:00) somando 24h ao horário final quando `fim <= início`. Um colaborador só pode estar fazendo uma coisa por vez.

### 3.3 — `tempo_gasto_minutos` é a fonte de verdade

O tempo de cada atividade é sempre gravado como inteiro em minutos (`tempo_gasto_minutos`). Uma string "HH:MM" só existe como conveniência de exibição/edição no lado do cliente antes de salvar — nunca é o que vai pro banco. Ao formatar de volta pra exibição: `HH = floor(min/60)`, `MM = min % 60`, ambos com 2 dígitos.

### 3.4 — Totais da jornada são sempre recalculados, nunca editados diretamente

`tempo_total_horas`, `tempo_produtivo_horas` e `tempo_ocioso_horas` na ficha são derivados somando `tempo_gasto_minutos` de todos os apontamentos daquela `jornada_id` (produtivo vs. improdutivo conforme a flag `produtivo` de cada linha). Todo `INSERT`/`UPDATE`/`DELETE` de apontamento dispara esse recálculo e regrava a ficha — o usuário nunca digita esses totais.

"Tempo não apontado" (para o dashboard) = duração da jornada (`hora_fim_jornada - hora_inicio_jornada`) menos a soma de todos os apontamentos — o intervalo do turno em que nada foi registrado.

### 3.5 — Fechamento e reabertura

- Uma jornada só pode ser marcada `Finalizado` se tiver pelo menos uma atividade apontada.
- Uma jornada `Finalizado` só pode voltar a ser editada por um administrador, explicitamente clicando em "Reabrir Jornada" (não existe edição silenciosa de ficha fechada). Reabrir exige conexão online (grava a mudança direto no servidor antes de liberar a edição local).

### 3.6 — Visibilidade do histórico por cargo

No histórico de fichas: **administrador vê os lançamentos de todos os colaboradores**; qualquer outro cargo (mecânico, motorista etc.) **só vê as próprias fichas**. A comparação de "dono" prioriza o id do usuário autenticado (`created_by`) por ser confiável; cai para comparar `mecanico_nome` (normalizado, case-insensitive) só em fichas antigas sem `created_by` preenchido. Contadores de UI (ex: "Histórico (N)") devem refletir essa mesma visibilidade, não o total global.

> Isso é uma restrição de **exibição** (aplicação), não necessariamente de banco — replique também como policy de RLS/equivalente no sistema de destino se precisar impedir leitura via API direta, não só esconder na tela.

### 3.7 — Esta aba é sempre visível, independente da matriz de permissões

Diferente das outras abas do sistema (que são liberadas por uma lista de permissões por cargo), o Apontamento de Mão de Obra é **sempre exibido pra todo mundo**, porque todo colaborador operacional precisa registrar o próprio dia. Ao portar: não gate essa tela atrás de uma permissão configurável — ela é incondicional.

### 3.8 — Offline-first

O formulário e a listagem funcionam sem conexão: gravação otimista num cache local (IndexedDB ou equivalente), fila de sincronização que reenvia ao voltar a conexão, e leitura que sempre prioriza o cache local (atualizado em segundo plano quando online). Toda mutação (criar jornada, apontar atividade, excluir, fechar, reabrir) segue esse padrão: grava local primeiro, enfileira, tenta gravar no servidor imediatamente se online.

## 4. Contratos de Server Actions (equivalente a endpoints/mutations)

| Ação | Parâmetros | Retorno | Observação |
|---|---|---|---|
| `getFichasMaoObra(limit)` | limite opcional (padrão 2000) | `{ data }` \| `{ error }` | Lê todas as fichas — filtragem por cargo é responsabilidade do cliente (ver 3.6) |
| `salvarFichaMaoObra(ficha)` | ficha completa (upsert) | `{ success, data }` \| `{ error }` | `created_by` = usuário autenticado; sanitiza campos numéricos vazios antes de gravar |
| `excluirFichaMaoObra(id)` | id | `{ success }` \| `{ error }` | Tira um snapshot da ficha antes de excluir e registra em log de auditoria |
| `reabrirJornada(id)` | id | `{ success }` \| `{ error }` | Só muda `status` para `'Em andamento'` — a checagem de "é admin?" é do cliente |
| `duplicarFichaMaoObra(id)` | id | `{ success, data }` \| `{ error }` | Copia a ficha com novo `numero_ficha`, `status = 'Em andamento'`, `data_jornada = hoje` |
| `getApontamentos(limit)` | limite opcional (padrão 10000) | `{ data }` \| `{ error }` | Todos os apontamentos de todas as jornadas |
| `salvarApontamento(apontamento)` | apontamento completo (upsert) | `{ success, data }` \| `{ error }` | Busca `full_name` do perfil do usuário pra `registrado_por_nome`; recalcula totais da jornada no final |
| `excluirApontamento(id)` | id | `{ success }` \| `{ error }` | Recalcula totais da jornada afetada depois de excluir |
| `criarCatalogoItem(categoria, valor)` | categoria, valor | `{ success, data }` \| `{ error }` | Valor normalizado (trim + uppercase); upsert por `(categoria, valor)` |
| `editarCatalogoItem(id, novoValor)` | id, novo valor | `{ success, data }` \| `{ error }` | Erro amigável em violação de unicidade |
| `excluirCatalogoItem(id)` | id | `{ success }` \| `{ error }` | Exclusão lógica (`ativo = false`) |
| `criarApontamentoCatalogo(codigo, descricao, produtivo)` | — | `{ success, data }` \| `{ error }` | Upsert por `codigo` |
| `editarApontamentoCatalogo(id, codigo, descricao, produtivo)` | — | `{ success, data }` \| `{ error }` | — |
| `excluirApontamentoCatalogo(id)` | id | `{ success }` \| `{ error }` | Exclusão lógica |

Todas retornam `{ error: string }` em vez de deixar a exceção subir crua — nunca lançam para o chamador.

## 5. Fluxo de UI

Estrutura de abas dentro do módulo:

1. **Menu** (tela inicial) — cards grandes: "Apontamento do Dia" (form), "Histórico (N)" (lista, N já filtrado por cargo — ver 3.6), "Dashboard", e "Catálogos" (só admin).
2. **Apontamento do Dia (form)** — cabeçalho da jornada (colaborador, equipe, supervisor, módulo, frente, horário de início/fim do turno) + lista de atividades já apontadas + botão para apontar uma nova atividade (modal/inline: tipo, código do catálogo, placa, horário início/fim, descrição — produtivo é derivado do código escolhido). Botões "Salvar Rascunho" / "Finalizar Jornada" / (se `Finalizado` e admin) "Reabrir Jornada".
3. **Histórico** — tabela: Data, Número, Colaborador, quantidade de Atividades, Total, Produtivo, Ocioso, Status, Ações (ver/imprimir PDF, editar, duplicar, reabrir se aplicável, excluir se admin). Filtros: nome do colaborador, placa, categoria de atividade, supervisor, intervalo de datas.
4. **Dashboard** — KPIs (total de horas, produtivo, ocioso, colaboradores ativos no período) + gráficos: por dia, por mês, por tipo de atividade (pizza), produtivo x improdutivo x não apontado (pizza), por tipo de manutenção (barra horizontal), por colaborador (barra), ranking. Filtrável por período (mês/ano) e por colaborador.
5. **Catálogos** (admin) — CRUD simples (criar/editar/excluir lógico) para cada categoria de `mao_obra_catalogos` e para `mao_obra_apontamentos_catalogo`.

## 6. Ao portar para outro sistema — pontos de atenção

- **Dependência de calendário operacional**: o dashboard usa um conceito de "período/mês atual" vindo de uma tabela de calendário operacional específica desta empresa (`calendario_suzano` — período não bate com o mês civil). Se o sistema de destino não tem esse conceito, substitua por mês civil comum (`new Date().getMonth()`), simplificando os filtros de período.
- **Autenticação**: as regras acima assumem um usuário autenticado com um perfil (`role`, `full_name`) disponível tanto no cliente quanto no servidor. Adapte `created_by`/`registrado_por` para o equivalente do novo sistema de auth.
- **Camada offline-first**: é opcional — o núcleo do módulo (schema + regras 3.1 a 3.7) funciona perfeitamente num sistema só-online. Só recrie a fila de sincronização (3.8) se o novo sistema também precisa funcionar sem internet em campo.
- **Design system**: os nomes de cor/estilo não foram incluídos de propósito — são específicos da identidade visual do EUNAMAN. Aplique o design system do sistema de destino sobre esta estrutura de dados e regras.
