// Vagalume — decide quando uma fala repete outra recente (mesmo autor, mesmo texto), para o módulo
// "agrupar" juntar as duas num balão só. Puro: sem DOM, testado em Node.
(function (raiz) {
  'use strict';

  const MAX_GUARDADAS = 200;

  function chaveDe(autor, texto) {
    return String(autor || '').trim().toLowerCase() + '\u0000' + String(texto || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // janelaMs: se a última vez que a fala apareceu foi há mais que isso, ela começa um grupo novo.
  function criarAgrupador(janelaMs) {
    const grupos = new Map(); // chave -> { dono, vezes, ultimo }

    function limpar(agora) {
      for (const [chave, g] of grupos) if (agora - g.ultimo > janelaMs) grupos.delete(chave);
      while (grupos.size > MAX_GUARDADAS) grupos.delete(grupos.keys().next().value);
    }

    // `dono` é o que o chamador quer guardar da primeira fala (no módulo, o elemento do balão).
    // Devolve { repetida: false } para a primeira ou { repetida: true, dono, vezes } para as seguintes.
    function registrar(autor, texto, quando, dono) {
      const agora = Number.isFinite(quando) ? quando : Date.now();
      limpar(agora);
      const chave = chaveDe(autor, texto);
      const g = grupos.get(chave);
      if (g && agora - g.ultimo <= janelaMs) {
        g.vezes += 1;
        g.ultimo = agora;
        return { repetida: true, dono: g.dono, vezes: g.vezes };
      }
      grupos.set(chave, { dono, vezes: 1, ultimo: agora });
      return { repetida: false };
    }

    // Quando o balão da primeira fala some da tela, o grupo dele acaba.
    function esquecer(dono) {
      for (const [chave, g] of grupos) if (g.dono === dono) grupos.delete(chave);
    }

    return { registrar, esquecer, tamanho: () => grupos.size };
  }

  const api = { criarAgrupador, chaveDe };
  raiz.VL = raiz.VL || {};
  raiz.VL.agrupar = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
