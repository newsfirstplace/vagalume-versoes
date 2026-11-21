// Arquivo local da extensão, acessado pelo fundo. Um registro por fala.
(function (raiz) {
  'use strict';
  let abertura;
  const nome = 'vagalume-historico';
  const falas = 'falas';

  function abrir() {
    if (!abertura) abertura = new Promise((resolver, rejeitar) => {
      const pedido = indexedDB.open(nome, 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore(falas, { autoIncrement: true });
      pedido.onerror = () => rejeitar(pedido.error);
      pedido.onsuccess = () => {
        const banco = pedido.result;
        banco.onversionchange = () => { banco.close(); abertura = null; };
        resolver(banco);
      };
    }).catch((e) => { abertura = null; throw e; });
    return abertura;
  }

  async function transacao(modo, executar) {
    const banco = await abrir();
    return new Promise((resolver, rejeitar) => {
      const tx = banco.transaction(falas, modo);
      let resposta;
      tx.oncomplete = () => resolver(resposta);
      tx.onabort = () => rejeitar(tx.error || new Error('histórico indisponível'));
      executar(tx.objectStore(falas), (valor) => { resposta = valor; });
    });
  }

  function adicionar(fala) {
    if (!fala || typeof fala.texto !== 'string' || !fala.texto || fala.texto.length > 16384) throw new Error('fala inválida');
    const item = {
      texto: fala.texto,
      autor: typeof fala.autor === 'string' ? fala.autor.slice(0, 100) : '',
      quando: Number.isFinite(fala.quando) && Math.abs(fala.quando) <= 8.64e15 ? fala.quando : Date.now(),
    };
    return transacao('readwrite', (arquivo) => { arquivo.add(item); });
  }

  function pagina({ busca, autor, antes, limite }) {
    const normalizar = (s) => raiz.VL.texto.semAcento(typeof s === 'string' ? s.trim().slice(0, 400) : '');
    const termo = normalizar(busca);
    const pessoa = normalizar(autor);
    const quantidade = Number.isSafeInteger(limite) ? Math.min(Math.max(limite, 1), 2000) : 200;
    const faixa = Number.isSafeInteger(antes) && antes > 0 ? IDBKeyRange.upperBound(antes, true) : null;
    return transacao('readonly', (arquivo, responder) => {
      const r = { itens: [], proxima: null, total: 0 };
      responder(r);
      const contar = arquivo.count();
      contar.onsuccess = () => { r.total = contar.result; };
      const pedido = arquivo.openCursor(faixa, 'prev');
      let ultima;
      pedido.onsuccess = () => {
        const cursor = pedido.result;
        if (!cursor) return;
        const item = cursor.value;
        if (!termo && !pessoa || combina(item)) {
          if (r.itens.length === quantidade) { r.proxima = ultima; return; }
          r.itens.push(item);
          ultima = cursor.primaryKey;
        }
        cursor.continue();
      };
      function combina(item) {
        const nome = normalizar(item.autor);
        return (!pessoa || nome === pessoa) && (!termo || nome.includes(termo) || raiz.VL.texto.semAcento(item.texto).includes(termo));
      }
    });
  }

  (raiz.VL = raiz.VL || {}).historicoLocal = {
    adicionar, pagina, limpar: () => transacao('readwrite', (arquivo) => { arquivo.clear(); }),
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
