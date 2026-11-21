// Vagalume — ponto de partida do script de conteúdo. É o último arquivo da lista do manifesto:
// quando ele roda, todos os módulos já se apresentaram ao núcleo.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.config || raiz.__vagalumeIniciado) return;
  // Chave de emergência: abrir o hotel com ?vagalume=off deixa a extensão de fora.
  if (String(location.search).includes('vagalume=off')) return;
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id || !chrome.storage) return;
  raiz.__vagalumeIniciado = true;
  VL.nucleo.iniciar(VL.config.criarArmazem(chrome.storage)).catch(function (erro) {
    console.warn('[Vagalume] Não foi possível iniciar:', erro);
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
