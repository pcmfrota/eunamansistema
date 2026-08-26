# Notas Reais de Funcionamento — EUNAMAN Fleet ERP

Este documento complementa os demais guias desta skill com fatos **confirmados na prática**, direto no código e no banco reais do projeto, em sessões de trabalho anteriores — não são aspiracionais como o restante da skill, foram checados um a um.

## Arquitetura de dados: Repository → Service → Server Action

A stack real de qualquer módulo maduro (Backlog, OS) segue esta camada:

* `src/models/<modulo>.ts` — interfaces TS (`XItem`, `XItemInsert`, `XItemUpdate`).
* `src/repositories/<Modulo>Repository.ts` — única camada que fala com o Supabase (`createClient` de `@/utils/supabase/server`), métodos crus (`list`/`upsert`/`insertMany`/`deleteMany`).
* `src/services/<Modulo>Service.ts` — validação/normalização (ex: normalizar `status`/`criticidade`, allowlist `VALID_COLUMNS`, zod em alguns casos como OS), chama o Repository.
* `app/<modulo>/actions.ts` — `'use server'`, uma função exportada por operação, sempre `try/catch` retornando `{ data }` / `{ success: true, ... }` / `{ error: string }` (nunca deixa a exceção subir crua pro client), sempre `revalidatePath('/<modulo>')` no final de escritas.

Não existe rota de API REST (`app/api/*`) para CRUD de módulo — tudo é Server Action. As poucas rotas em `app/api/` são utilitárias/legado (diagnóstico, categorias de OS).

## Banco de dados: dois padrões de "migration" coexistem

1. **Formal**: `supabase/migrations/*.sql` com timestamp — existe, mas nem toda mudança passa por ali.
2. **Ad-hoc (o mais usado na prática para pedidos pontuais)**: arquivo solto na raiz do projeto (`add-x.sql`, `fix-x.sql`), com um comentário do tipo `-- Aplicar manualmente no SQL Editor do Supabase`. O usuário roda manualmente e confirma com print do resultado. **Para pedidos pontuais de coluna/ajuste (o caso mais comum), prefira esse padrão** — é o que o usuário já sabe operar e espera, é mais rápido, e evita ficar esperando um deploy.

Consequência prática: **há desvio real entre o schema do banco de produção e as migrations versionadas no repo** (colunas existem no banco que não têm migration correspondente versionada). Nunca assuma que `supabase/migrations/` é a verdade absoluta do schema atual — na dúvida sobre se uma coluna existe, consulte o banco direto (ver seção de scripts de teste abaixo) em vez de só grepar `.sql`.

## Não existem tipos gerados do Supabase

Não rode nem procure `supabase gen types` — não é usado neste projeto. Os tipos são escritos à mão em `src/models/`. Tolerância a `any` é alta; não é prioridade eliminar isso por conta própria.

## O build tolera erros de TypeScript/ESLint de propósito

`next.config.mjs` tem `typescript.ignoreBuildErrors: true` e `eslint.ignoreDuringBuilds: true`. O projeto roda em produção com dezenas de erros pré-existentes de `tsc --noEmit` (não é sua responsabilidade zerar isso). Ao validar seu próprio código: rode `npx tsc --noEmit -p tsconfig.json` e confira que **nenhum erro novo** aparece nos arquivos que você tocou (`grep` pelo nome do arquivo) — ignore os erros pré-existentes em arquivos que você não editou.

## Testar mudanças de servidor/banco sem navegador

Não há automação de navegador (Playwright etc.) disponível neste ambiente. Para validar Server Actions ou mudanças de schema sem depender do usuário clicar na tela, o padrão que já funcionou bem: escrever um script Node solto (`.mjs`) na raiz do projeto que lê `.env.local`, usa `@supabase/supabase-js` com a `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS), replica exatamente a lógica da action que está sendo testada, roda com `node arquivo.mjs`, confere o resultado — e **apaga o script depois** (`rm`), nunca deixando esses scripts descartáveis entrarem em commit. É o mesmo padrão que scripts pré-existentes do projeto já usavam (`reset-user.mjs`, `tmp/update-calendar.mjs`, `tmp/fix-duplicatas-calendario.js`).

Quando o teste envolve criar dados reais (ex: uma OS, itens de backlog), usar dados de um registro real pequeno, confirmar o resultado, e **limpar/reverter os dados de teste em seguida** com outro script — nunca deixar lixo de teste na base de produção.

## Segurança — lições já aprendidas nesta base

* `.env.local` (com a `SUPABASE_SERVICE_ROLE_KEY` real) já esteve rastreado no git mesmo estando listado no `.gitignore`, porque foi commitado antes dessa regra existir. **Sempre rode `git status` (e, se precisar, `git check-ignore -v <arquivo>`) antes de dar `git add` num arquivo `.env*`**, mesmo que pareça óbvio que está ignorado — não confie só no `.gitignore` existir.
* Existia (removido no commit `fb8d144`) o hábito de gravar a senha do usuário em **texto puro** em `profiles.plain_password` e numa tabela legado `users.senha`, toda vez que uma senha era criada/resetada (`app/admin/usuarios/actions.ts`, `app/login/reset-password/ResetPasswordClient.tsx`, `reset-user.mjs`, `reset-all-users.mjs`). **Nunca reintroduza esse padrão** — o login sempre usa o Supabase Auth (hash) e nunca precisou dessa cópia legível.
* Existe um script `reset-all-users.mjs` que reseta a senha de **todos** os usuários do sistema pro mesmo valor fixo — é uma ferramenta de emergência; não rode nem sugira rodar sem confirmação explícita do usuário.

## Calendário Suzano ≠ mês civil

Praticamente todo cálculo de "período/mês atual" no sistema (Backlog, OS, Preventivas, dashboards) usa a tabela `calendario_suzano` (colunas `ano, mes, data_inicio, data_fim, total_dias`) — **não** `new Date().getMonth()`. O usuário se refere aos períodos como "RF'08", "RF'09" etc. (RF'XX = `mes = XX`, mesmo `ano`). Essas datas mudam periodicamente por aviso direto do usuário, geralmente numa lista "RF'XX - dd/mm até dd/mm - N dias" — mapeie pelo número do RF, confirme os dias batendo a conta, e faça `UPDATE` nas linhas já existentes (não `INSERT`) via script descartável com service role, seguindo o padrão da seção acima.

## Integração de IA no projeto

Existe uma extração de texto/imagem por IA no Backlog (`app/backlog/actions.ts` → `extrairPendenciasBacklogIA`), usando **Google Gemini** (`@google/genai`, env var `GEMINI_API_KEY`) — **não** Anthropic/Claude. Foi trocado de Claude pra Gemini nesta base especificamente porque o usuário não queria pagar créditos de API (Gemini tem camada gratuita via Google AI Studio). Se for mexer nessa função ou adicionar outra chamada de IA no projeto, siga esse mesmo provedor por padrão, a menos que instruído o contrário.

Modelo em uso: `gemini-3.6-flash`. A API do Gemini descontinua modelos de tempos em tempos — se der erro 404 "model ... is no longer available", a própria mensagem de erro da API costuma dizer qual é o modelo substituto recomendado; atualize a string do modelo nesse caso em vez de tentar adivinhar um nome.

Antes de escrever qualquer código novo contra a SDK de IA (Anthropic ou Google), **confira os tipos reais do pacote instalado em `node_modules` em vez de confiar cegamente em documentação buscada na web** — documentação de APIs de IA muda rápido e pode estar desatualizada ou (no caso do Gemini) mostrar uma superfície de API diferente da que está realmente instalada.