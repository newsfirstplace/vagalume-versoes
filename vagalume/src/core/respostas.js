// Vagalume — responder a uma fala (2026-11-19). Contas puras, sem DOM.
// Quem não usa o Vagalume vê a resposta como "@apelido mensagem"; os Vagalumes do quarto recebem,
// pelo servidor de presença, qual fala foi respondida e mostram a citação em cima do balão.
(function (raiz) {
  'use strict';
  const MAX_CITADO = 120;
  const MAX_TEXTO = 260;
  const SEM_INVISIVEIS = /[​-‏⁠-⁤﻿]/g;

  function limpar(s, max) {
    return String(s == null ? '' : s).replace(SEM_INVISIVEIS, '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  // Texto que vai para o chat: "@apelido mensagem" (sem repetir a menção se já estiver escrita).
  function textoDaResposta(autor, mensagem) {
    const a = limpar(autor, 40);
    const m = limpar(mensagem, MAX_TEXTO);
    if (!a || !m) return '';
    const marca = '@' + a;
    return m.toLowerCase().startsWith(marca.toLowerCase()) ? m : marca + ' ' + m;
  }
  // O que vai para as outros Vagalumes (o servidor aceita até 600 caracteres por ação).
  function dado(texto, citadoAutor, citadoTexto) {
    const t = limpar(texto, MAX_TEXTO);
    const a = limpar(citadoAutor, 40);
    const x = limpar(citadoTexto, MAX_CITADO);
    if (!t || !a) return null;
    return { t: 'resposta', texto: t, citado: { a, x } };
  }
  function lerDado(d) {
    if (!d || d.t !== 'resposta' || typeof d.texto !== 'string' || !d.citado || typeof d.citado !== 'object') return null;
    const texto = limpar(d.texto, MAX_TEXTO);
    const a = limpar(d.citado.a, 40);
    if (!texto || !a) return null;
    return { texto, autor: a, citado: limpar(d.citado.x, MAX_CITADO) };
  }
  // O balão pode chegar com espaços diferentes ou cortado pelo jogo: compara sem maiúsculas e
  // espaços, e aceita quando um começa com o outro (no mínimo 12 letras).
  function normal(s) { return limpar(s, 400).toLowerCase().replace(/\s+/g, ''); }
  function mesmaFala(a, b) {
    const x = normal(a), y = normal(b);
    if (!x || !y) return false;
    if (x === y) return true;
    const menor = x.length < y.length ? x : y;
    return menor.length >= 12 && (x.startsWith(y) || y.startsWith(x));
  }
  const api = { MAX_CITADO, textoDaResposta, dado, lerDado, mesmaFala, limpar };
  raiz.VL = raiz.VL || {};
  raiz.VL.respostas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
