# Exemplo: Corrigir um Bug no Sistema

Este guia detalha um caso real de correção de bug na página de Afiação, onde ocorria um erro "Application error: a client-side exception has occurred" devido a importações ausentes e variáveis indefinidas no carregamento da tela.

---

## 1. Identificação do Bug
* **Sintoma**: Ao carregar a página `/afiacao`, a tela exibia uma falha branca com a mensagem de erro do Next.js.
* **Console do Navegador**: Exibia `ReferenceError: Search is not defined` e `ReferenceError: TIPO_FORMULARIO_OPCOES is not defined`.

---

## 2. Rastreamento e Solução

### Caso A: Componente `Search` ausente
No arquivo `app/afiacao/AfiacaoTransferencias.tsx`, o ícone `<Search>` era renderizado, mas a importação continha apenas `Calendar` (que não estava em uso):

```tsx
// ANTES (ERRADO)
import { Plus, Trash2, X, Calendar } from "lucide-react";

// DEPOIS (CORRIGIDO)
import { Plus, Trash2, X, Search } from "lucide-react";
```

### Caso B: Constante de Formas de Lançamento ausente
No arquivo `app/afiacao/BancoDadosAfiacao.tsx`, utilizava-se a constante `TIPO_FORMULARIO_OPCOES.map(...)` para renderizar o dropdown de filtros, mas ela não estava importada:

```tsx
// ANTES (ERRADO)
import {
  MAQUINAS_POR_MODULO,
  AFIADORES,
  MODULOS,
  renderCamposDetalhes,
} from "./AfiacaoForm";

// DEPOIS (CORRIGIDO)
import {
  MAQUINAS_POR_MODULO,
  AFIADORES,
  MODULOS,
  renderCamposDetalhes,
  TIPO_FORMULARIO_OPCOES,
} from "./AfiacaoForm";
```

---

## 3. Prevenção de Falhas Adicionais (Fallback de Estado Nulo)
Para garantir que problemas futuros com dados em branco no Supabase não causem novas exceções, envolvemos as chamadas de arrays em fallbacks seguros `(afiacoes || [])`:

```tsx
// Em app/afiacao/AfiacaoDashboard.tsx
const parsedData = useMemo(() => {
  return (afiacoes || []).flatMap((a) => {
    const rows = extrairLinhas(a, auxiliares);
    return rows.map((r) => { ... });
  });
}, [afiacoes, auxiliares]);
```
Isso evita que o método `.flatMap()` falhe caso `afiacoes` esteja nulo.
