// Vagalume — detector de menções: apelido e termos, com fronteira de palavra que entende acentos.
(function (raiz) {
  'use strict';

  function escapar(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // soComArroba: o apelido só conta quando vem logo depois de "@" (como "@fulano"); os outros termos
  // continuam valendo sozinhos.
  function criarDetector(opcoes) {
    const o = opcoes || {};
    const apelido = typeof o.apelido === 'string' ? o.apelido.trim() : '';
    const arroba = !!o.soComArroba && !!apelido;
    const padraoArroba = arroba ? new RegExp('@(' + escapar(apelido) + ')(?![\\p{L}\\p{N}_])', 'iu') : null;
    const termos = [];
    for (const t of [arroba ? '' : o.apelido].concat(Array.isArray(o.termos) ? o.termos : [])) {
      if (typeof t !== 'string') continue;
      const limpo = t.trim();
      if (limpo && !termos.some((x) => x.toLowerCase() === limpo.toLowerCase())) termos.push(limpo);
    }
    const padrao = termos.length
      ? new RegExp('(?<![\\p{L}\\p{N}_])(' + termos.map(escapar).join('|') + ')(?![\\p{L}\\p{N}_])', 'iu')
      : null;
    const proprio = typeof o.apelido === 'string' ? o.apelido.trim().toLowerCase() : '';

    return {
      vazio: !padrao && !padraoArroba,
      // Devolve o termo encontrado ou null. Falas do próprio usuário não contam.
      testar(fala) {
        if ((!padrao && !padraoArroba) || !fala || typeof fala.texto !== 'string') return null;
        if (proprio && typeof fala.autor === 'string' && fala.autor.trim().toLowerCase() === proprio) return null;
        const a = padraoArroba ? padraoArroba.exec(fala.texto) : null;
        if (a) return '@' + a[1];
        if (!padrao) return null;
        const m = padrao.exec(fala.texto);
        return m ? m[1] : null;
      },
    };
  }

  const api = { criarDetector };
  raiz.VL = raiz.VL || {};
  raiz.VL.mencoes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
