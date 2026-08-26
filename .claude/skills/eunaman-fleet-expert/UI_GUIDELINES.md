# Diretrizes de Interface (UI) - EUNAMAN Fleet ERP

Este documento estabelece as regras de design e experiência do usuário (UX/UI) do ecossistema EUNAMAN. Toda nova tela ou componente deve seguir estritamente estas diretrizes para manter a coesão visual.

## Identidade Visual e Estilo

Sempre siga e replique a identidade visual atual do sistema. Ao criar telas:

* **Cards**: Use a mesma estrutura de bordas arredondadas (`rounded-2xl` ou `rounded-3xl`), sombras discretas (`shadow-xl` ou `shadow-md`), bordas finas (`border border-zinc-200 dark:border-zinc-800`) e efeitos hover suaves.
* **Cores**: Use paletas harmoniosas e premium baseadas em escala de cinzas escuros/claros (zinc/slate) com acentos de cores funcionais bem definidos (ex: Indigo para destaque, Emerald para sucesso, Orange para avisos, Red para perigos). Nunca use cores puras de navegador (red, green, blue).
* **Tipografia**: Use a mesma hierarquia de fontes, pesos (font-black, font-bold) e estilos de texto em caixa alta (uppercase) para cabeçalhos e rótulos importantes.
* **Espaçamentos**: Siga o padrão de grid (`p-3 md:p-5 flex flex-col gap-4`) e distanciamentos consistentes.
* **Layout Principal**: A barra de navegação lateral (menu lateral) e o layout responsivo integrado devem ser mantidos sem alterações. O aplicativo deve ser 100% responsivo, funcionando perfeitamente em telas móveis e desktop.

## Padrões de Gráficos e Dashboard

O sistema possui indicadores operacionais específicos de manutenção. A Skill reconhece a existência de termos e telas do sistema como:

* **DM**: Disponibilidade Mecânica
* **DO**: Disponibilidade Operacional
* **MTBF**: Mean Time Between Failures (Tempo Médio Entre Falhas)
* **MTTR**: Mean Time To Repair (Tempo Médio de Reparo)
* **Backlog**: Lista de serviços pendentes/aguardando recursos
* **Horas Mecânicas**: Acompanhamento de horas aplicadas por mecânico
* **Frota**: Cadastro e status operacional de equipamentos/placas
* **OS**: Ordem de Serviço
* **Preventiva**: Cronograma e execução de preventivas
* **Checklist**: Checklists operacionais de equipamentos
* **Horímetros**: Leitura e controle de horas acumuladas de frota

### Regras para Criação de Novos Gráficos:
Ao receber solicitações para a criação de um novo gráfico:
1. Use as mesmas bibliotecas gráficas presentes no projeto (como `recharts`).
2. Siga exatamente a estilização, paleta de cores (gradientes de azul/indigo para séries de dados, laranja para alertas) e comportamento interativo dos tooltips presentes nos dashboards existentes.
3. Use os mesmos containers de carregamento (`PremiumLoader` ou esqueletos de carregamento visual) enquanto os dados do gráfico estão sendo processados.
