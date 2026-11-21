// Vagalume — histórico do chat em memória (não é gravado em disco nem enviado a lugar algum).
(function (raiz) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) require('./texto.js');
  const texto = raiz.VL.texto;

  function criarHistorico(limiteInicial) {
    let limite = Math.max(1, limiteInicial | 0 || 500);
    let itens = [];

    function aparar() {
      if (itens.length > limite) itens = itens.slice(itens.length - limite);
    }

    return {
      adicionar(fala) {
        if (!fala || typeof fala.texto !== 'string' || !fala.texto) return;
        itens.push({
          autor: typeof fala.autor === 'string' ? fala.autor : '',
          texto: fala.texto,
          quando: Number.isFinite(fala.quando) ? fala.quando : Date.now(),
        });
        aparar();
      },
      listar: () => itens.slice(),
      tamanho: () => itens.length,
      limite: () => limite,
      limpar() { itens = []; },
      redimensionar(n) { limite = Math.max(1, n | 0); aparar(); },
      // busca ignora acentos e maiúsculas; autor compara o apelido inteiro.
      filtrar(filtro) {
        const f = filtro || {};
        const busca = texto.semAcento(f.busca || '').trim();
        const autor = texto.semAcento(f.autor || '').trim();
        return itens.filter((i) => {
          if (autor && texto.semAcento(i.autor) !== autor) return false;
          if (!busca) return true;
          return texto.semAcento(i.texto).includes(busca) || texto.semAcento(i.autor).includes(busca);
        });
      },
    };
  }

  function paraTexto(itens) {
    return itens.map((i) => '[' + texto.hora(i.quando) + '] ' + (i.autor ? i.autor + ': ' : '') + i.texto).join('\n');
  }

  function paraJson(itens) {
    return JSON.stringify(itens.map((i) => ({ quando: new Date(i.quando).toISOString(), autor: i.autor, texto: i.texto })), null, 2);
  }

  const api = { criarHistorico, paraTexto, paraJson };
  raiz.VL.historico = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
