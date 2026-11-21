// Convites e registros locais dos grupos de voz. Sem DOM nem rede.
(function (raiz) {
  'use strict';
  const codigoValido = (v) => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
  const usuarioValido = (v) => /^[1-9][0-9]{0,11}$/.test(String(v || ''));
  const nome = (v) => String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
  const digitos = ['\u200b', '\u200c', '\u200d', '\u2060'];
  function convite(grupo, chave) {
    if (!codigoValido(grupo) || (chave && !codigoValido(chave))) return '';
    // Texto simples: não depende de caracteres invisíveis preservados pelo console.
    // A chave continua vinculada ao destinatário no servidor.
    return 'Convite Vagalume: vl-grupo-' + grupo + (chave ? '-' + chave : '') + ' — abra /grupos para aceitar.';
  }
  function lerConvite(texto) {
    const s = String(texto || '');
    const oculto = /\u2063\u2063([\u200b\u200c\u200d\u2060]{64}|[\u200b\u200c\u200d\u2060]{128})\u2063/.exec(s);
    if (oculto) {
      let dados = '';
      for (let i = 0; i < oculto[1].length; i += 2) dados += ((digitos.indexOf(oculto[1][i]) << 2) | digitos.indexOf(oculto[1][i + 1])).toString(16);
      return { grupo: dados.slice(0, 32), chave: dados.slice(32) || null };
    }
    const m = /(?:^|\s)vl-grupo-([a-f0-9]{32})(?:-([a-f0-9]{32}))?(?=\s|$)/.exec(s);
    return m ? { grupo: m[1], chave: m[2] || null } : null;
  }
  function limparLista(lista) {
    const vistos = new Set();
    return (Array.isArray(lista) ? lista : []).filter((g) => {
      if (!g || !codigoValido(g.grupo) || !codigoValido(g.chave) || vistos.has(g.grupo)) return false;
      vistos.add(g.grupo);
      return true;
    }).slice(0, 50).map((g) => ({ grupo: g.grupo, chave: g.chave, nome: nome(g.nome) || 'Grupo de voz' }));
  }
  function agruparMensagens(lista) {
    const blocos = [];
    for (const mensagem of Array.isArray(lista) ? lista : []) {
      const ultimo = blocos.at(-1);
      if (ultimo && ultimo[0].id === mensagem.id) ultimo.push(mensagem);
      else blocos.push([mensagem]);
    }
    return blocos;
  }
  function novidades(lista, marcaAnterior, meuId) {
    const mensagens = Array.isArray(lista) ? lista : [];
    const ultima = mensagens.at(-1);
    const marca = ultima ? ultima.id + ':' + ultima.codigo : '';
    if (!marca || marcaAnterior === undefined || marca === marcaAnterior) return { marca, novas: [] };
    const indice = mensagens.findIndex((m) => m.id + ':' + m.codigo === marcaAnterior);
    const novas = (indice >= 0 ? mensagens.slice(indice + 1) : marcaAnterior === '' ? mensagens : [ultima]).filter((m) => String(m.id) !== String(meuId));
    return { marca, novas };
  }
  const api = { codigoValido, usuarioValido, nome, convite, lerConvite, limparLista, agruparMensagens, novidades, LIMITE: 12 };
  (raiz.VL = raiz.VL || {}).grupos = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
