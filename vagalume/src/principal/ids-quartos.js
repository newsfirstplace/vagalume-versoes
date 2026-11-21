// Vagalume — mundo MAIN da página do hotel: escreve o id de cada quarto da lista do navegador num
// atributo (data-vl-quarto), para o resto da extensão saber qual quarto é cada linha.
// O id vem das propriedades que o próprio cliente dá ao componente da linha (roomData.roomId),
// conferido ao vivo em 2026-11-14. Só lê; não muda nada no jogo.
(function () {
  'use strict';
  if (window.__vlIdsQuartos) return;
  Object.defineProperty(window, '__vlIdsQuartos', { value: true });

  function idDe(el) {
    const k = Object.keys(el).find((n) => n.startsWith('__reactFiber'));
    let f = k ? el[k] : null;
    for (let i = 0; f && i < 10; i += 1, f = f.return) {
      const p = f.memoizedProps;
      if (p && p.roomData && typeof p.roomData === 'object' && Number.isInteger(p.roomData.roomId)) return p.roomData.roomId;
    }
    return null;
  }

  function marcar() {
    document.querySelectorAll('.nitro-navigator .navigator-item').forEach(function (el) {
      const id = idDe(el);
      const atual = el.getAttribute('data-vl-quarto');
      if (id == null) { if (atual != null) el.removeAttribute('data-vl-quarto'); return; }
      if (atual !== String(id)) el.setAttribute('data-vl-quarto', String(id));
    });
  }

  let pendente = false;
  function agendar() {
    if (pendente) return;
    pendente = true;
    setTimeout(function () { pendente = false; marcar(); }, 120);
  }
  function comecar() {
    new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true, characterData: true });
    marcar();
  }
  if (document.body) comecar();
  else document.addEventListener('DOMContentLoaded', comecar, { once: true });
})();
