# Workflow de Correção de Bugs - EUNAMAN Fleet ERP

Sempre que um erro ou bug for detectado ou relatado no sistema (por exemplo, erros de console do navegador, falhas de renderização, ou client-side exceptions), a Skill deve atuar seguindo estritamente este roteiro de depuração e validação.

---

## Processo de Correção em 8 Passos

### 1. Localizar Origem
* Identifique a tela ou rota onde o bug ocorre.
* Analise a stack trace ou mensagem de erro fornecida pelo usuário ou console.
* Faça buscas estáticas (`grep`) no código-fonte do projeto para localizar as linhas e arquivos que utilizam as funções, variáveis ou componentes envolvidos.

### 2. Explicar
* Descreva de forma concisa para o usuário o que está causando o erro (ex: referência nula, importação ausente, tipo incompatível, ou falta de verificação offline).

### 3. Corrigir
* Aplique a correção no código-fonte mantendo a compatibilidade e a estrutura do componente original.
* Dê preferência a soluções limpas, idiomáticas em TypeScript e reutilizáveis.

### 4. Verificar Impacto
* Avalie se a alteração afeta outros componentes, sub-telas ou módulos que importam o arquivo modificado.
* Garanta que a correção não quebra o funcionamento offline (enfileiramento local) ou o estado global do projeto.

### 5. Atualizar Tipos
* Se a correção mudou a assinatura de uma função, formato de objeto ou retorno de API, garanta que os tipos do TypeScript sejam atualizados em todos os locais correspondentes.

### 6. Validar Build
* Verifique se as dependências do projeto permanecem válidas e não há erros de compilação relacionados à alteração realizada.

### 7. Validar Lint
* Certifique-se de que a alteração respeita as regras de lint do projeto (imports duplicados, variáveis declaradas e não utilizadas, etc.).

### 8. Validar Supabase
* Se o bug envolver consultas de banco de dados ou políticas RLS, garanta que os filtros de consulta não quebram restrições de permissão por cargo.
