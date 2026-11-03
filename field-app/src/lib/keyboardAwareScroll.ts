/**
 * Mantém QUALQUER campo de texto focado visível acima do teclado, em todo o field-app.
 *
 * Confirmado com log real de aparelho (ver commits 5b1297f/987e922/2da1c50 no histórico):
 * neste app o teclado não redimensiona window.innerHeight / document.documentElement.
 * clientHeight / window.visualViewport.height — ele é aplicado como padding nativo direto
 * na WebView (ver EunamanActivity.java), não como um resize que o Chromium reconheça.
 * Por isso nenhuma API de viewport do próprio navegador sabe que o teclado existe, e o
 * scroll-to-focused-input nativo do Chromium não funciona de forma confiável aqui — o
 * campo digitado pode ficar escondido atrás do teclado em QUALQUER formulário, não só em
 * componentes com lógica própria (ex: SearchableSelect, que tinha essa correção duplicada
 * até esta função existir).
 *
 * Esta função resolve isso uma vez, globalmente, pra qualquer <input>/<textarea>/
 * [contenteditable] da aplicação: ao ganhar foco, garante um respiro (padding-bottom)
 * real no container rolável mais próximo — usando a altura do teclado exposta por
 * EunamanActivity.java via window.__eunamanKeyboardHeight + evento
 * 'eunaman:keyboard-height-changed' — e rola até o campo ficar visível. Um
 * ResizeObserver + polling curto reaplicam a correção enquanto o campo estiver focado,
 * porque o conteúdo ao redor pode mudar de altura (ex: lista de resultados de uma busca).
 */
export function setupKeyboardAwareScroll() {
  let ancestralAtual: HTMLElement | null = null;
  let paddingOriginal = "";
  let resizeObserver: ResizeObserver | null = null;
  let intervalo: ReturnType<typeof setInterval> | null = null;
  let kbHandlerAtual: (() => void) | null = null;

  // Importante: NÃO exige scrollHeight > clientHeight aqui. Um formulário curto o
  // suficiente pra caber sem rolar ANTES do teclado abrir (ex: wizard do Backlog com só
  // Data/Criticidade/Tipo/Colaborador/Origem) tem overflow:auto mas ainda não excedeu o
  // container no instante exato do foco — exigir "já estar estourando" fazia a busca
  // falhar silenciosamente bem nesses casos (confirmado por relato real do usuário: TIPO
  // e TAG, ambos em formulários curtos, ficavam cobertos pelo teclado mesmo com esta
  // correção ativa). Basta achar o ancestral com overflow-y:auto/scroll — uma vez que o
  // padding-bottom extra for aplicado, ele passa a overflow de verdade; se não precisar,
  // "scrollTop +=" nele é inofensivo.
  function encontrarAncestralRolavel(el: HTMLElement): HTMLElement | null {
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const estilo = getComputedStyle(node);
      if (estilo.overflowY === "auto" || estilo.overflowY === "scroll") {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function limpar() {
    if (ancestralAtual) ancestralAtual.style.paddingBottom = paddingOriginal;
    if (kbHandlerAtual) window.removeEventListener("eunaman:keyboard-height-changed", kbHandlerAtual);
    resizeObserver?.disconnect();
    if (intervalo) clearInterval(intervalo);
    ancestralAtual = null;
    resizeObserver = null;
    intervalo = null;
    kbHandlerAtual = null;
  }

  function aoFocar(el: HTMLElement) {
    limpar();
    const ancestral = encontrarAncestralRolavel(el);
    if (!ancestral) return;
    ancestralAtual = ancestral;
    paddingOriginal = ancestral.style.paddingBottom;

    const rolarECorrigir = () => {
      const kb = (window as any).__eunamanKeyboardHeight || 0;
      ancestral.style.paddingBottom = kb > 0 ? `${kb + 24}px` : paddingOriginal;
      const rect = el.getBoundingClientRect();
      const limiteVisivel = window.innerHeight - kb;
      const quantoEsconde = rect.bottom - limiteVisivel;
      if (quantoEsconde > 0) ancestral.scrollTop += quantoEsconde + 16; // +16px de folga visual
    };

    rolarECorrigir();
    kbHandlerAtual = rolarECorrigir;
    window.addEventListener("eunaman:keyboard-height-changed", rolarECorrigir);

    resizeObserver = new ResizeObserver(rolarECorrigir);
    resizeObserver.observe(ancestral);

    // Poll curto de reforço: o WebView às vezes tenta reposicionar o foco sozinho (sem
    // saber do teclado) logo após o focus/teclado abrir, brigando com uma correção feita
    // só uma vez — confirmado em teste real no SearchableSelect antes desta generalização.
    let tentativas = 0;
    intervalo = setInterval(() => {
      rolarECorrigir();
      tentativas += 1;
      if (tentativas >= 15 && intervalo) {
        clearInterval(intervalo);
        intervalo = null;
      }
    }, 100);
  }

  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && !el.isContentEditable) return;
    aoFocar(el);
  });

  document.addEventListener("focusout", () => {
    // Só limpa se o foco não foi pra outro campo rastreável — evita um flash de
    // remover+reaplicar o padding ao trocar de campo (ex: Tab ou "Próximo" do teclado).
    setTimeout(() => {
      const ativo = document.activeElement as HTMLElement | null;
      const aindaEhCampo = !!ativo && (ativo.tagName === "INPUT" || ativo.tagName === "TEXTAREA" || ativo.isContentEditable);
      if (!aindaEhCampo) limpar();
    }, 50);
  });
}
