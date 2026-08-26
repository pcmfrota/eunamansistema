# Padrões de Código - EUNAMAN Fleet ERP

Este documento estabelece as diretrizes de engenharia de software e estruturação de código para manter a manutenibilidade e escalabilidade do ecossistema EUNAMAN.

## Diretrizes de Desenvolvimento

* **Componentes Pequenos e Focados**: Evite arquivos monolíticos de milhares de linhas. Componentes React devem ter responsabilidade única. Se um formulário ou grid de dados estiver muito grande, separe em subcomponentes internos (ex: `FormFields.tsx`, `TableRows.tsx`).
* **Hooks Separados**: Toda lógica complexa de estado, efeitos paralelos ou chamadas de API do cliente deve ser extraída para hooks React customizados (`/hooks`). O componente deve focar prioritariamente na renderização visual.
* **Funções Utilitárias**: Funções de formatação de valores, manipulação de strings, operações com datas e cálculos estatísticos de indicadores (ex: MTBF, DO) devem ser colocadas em arquivos utilitários específicos na pasta `/utils` ou `/lib`.
* **Tipos Centralizados**: Defina as interfaces de TypeScript em arquivos de tipo dedicados (ex: `.ts` ou `/types`). Evite declarações redundantes de tipos no corpo dos arquivos de componentes.
* **SQL Declarativo em Migrations**: Qualquer tabela, função do banco, triggers, policies ou RLS deve ser criada apenas via migração versionada. Nunca insira lógica complexa de SQL diretamente no código TypeScript do cliente se ela puder ser resolvida no banco.
* **Código DRY (Don't Repeat Yourself)**: Lógica repetida é sinal de refatoração pendente. Reutilize código, componentes e helpers em vez de copiar e colar.

## Checklist de Validação Obrigatório
Ao concluir qualquer alteração de código, valide os seguintes pontos:
1. **Tipos no TypeScript**: O código compila sem erros de tipagem estrita? Os dados retornados de consultas ou mutações estão tipados adequadamente?
2. **Reutilização**: Eu reutilizei os componentes globais e helpers existentes do projeto em vez de criar novos do zero?
3. **Erros de Referência (ReferenceErrors)**: Verifiquei se todas as variáveis, funções e componentes utilizados no JSX/TSX estão importados corretamente?
4. **Resiliência contra Nulos**: Tratamentos de arrays e objetos complexos (ex: `.map`, `.filter`, `.flatMap`, `.reduce`) possuem guards/fallbacks apropriados para o caso de os dados virem indefinidos ou nulos da API?
