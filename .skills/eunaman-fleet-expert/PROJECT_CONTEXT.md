# Project Context - EUNAMAN Fleet ERP

Este documento resume a arquitetura, pilha de tecnologias e a estrutura de pastas do sistema **EUNAMAN Fleet ERP**.

## Stack Tecnológica

O projeto é construído utilizando ferramentas modernas de desenvolvimento web de alto desempenho:

* **Framework Principal**: Next.js (App Router)
* **Biblioteca de UI**: React (com componentização forte)
* **Linguagem**: TypeScript (tipagem estrita em todo o projeto)
* **Estilização**: Tailwind CSS (design moderno, responsivo e baseado em classes utilitárias)
* **Banco de Dados & Autenticação**: Supabase (PostgreSQL, Realtime, Row Level Security)
* **Hospedagem & Deploy**: Vercel
* **Controle de Versão**: Git

## Estrutura do Repositório

A estrutura de diretórios do projeto é organizada de forma modular:

```text
/eunamansistema
├── app/                  # Rotas do Next.js (App Router)
│   ├── (auth)/           # Telas de login e recuperação
│   ├── admin/            # Telas administrativas (Usuários, Permissões, Configurações)
│   ├── afiacao/          # Módulo de Afiação de Corrente/Sabre/Rolltop e Estoque
│   ├── backlog/          # Módulo de Backlog Geral e Painel PCM
│   ├── layout.tsx        # Layout principal com Navbar e Sidebar
│   └── page.tsx          # Dashboard Inicial / Home
├── components/           # Componentes React Reutilizáveis (Cards, Loaders, UI genérica)
├── hooks/                # Hooks customizados (useOffline, useAuth, etc.)
├── lib/                  # Clientes e utilitários de terceiros (Supabase, localDb/IndexedDB)
├── utils/                # Funções utilitárias e ajudantes JavaScript/TypeScript
└── supabase/             # Banco de dados local/migrações
    ├── migrations/       # Scripts SQL versionados da estrutura do banco
    └── config.toml       # Configuração do CLI do Supabase
```

## Regras de Arquitetura de Software

1. **Reutilização de Componentes**: Nunca recrie elementos que já existem (como Loaders Premium, Modals customizados, inputs estilizados, seletores ou cabeçalhos). Verifique primeiro a pasta `/components`.
2. **Não Duplicação de Código (DRY)**: Se um trecho de lógica for usado mais de uma vez (como cálculo de datas, formatação de moeda ou conversão de dados do banco), extraia para uma função em `/utils` ou um hook personalizado em `/hooks`.
3. **Validação Estrita de TypeScript**: Todos os dados recebidos do banco ou passados entre componentes devem ter tipos bem definidos em arquivos de tipos. Evite o uso de `any` sempre que possível.
4. **Sincronização Offline**: O projeto possui suporte offline (IndexedDB local). Qualquer alteração nas views do cliente deve suportar o estado offline de leitura e enfileiramento de escritas.
