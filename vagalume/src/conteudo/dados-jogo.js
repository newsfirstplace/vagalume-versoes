// Vagalume — catálogo visual local, textos públicos do jogo, mobis e roupas do avatar.
// Lê um único arquivo público do Habblet, o mesmo que o cliente do jogo baixa ao abrir o hotel
// (fica no cache do navegador): gamedata/habblet_texts.json. Sem cookies, sem enviar nada.
// Com o fundo (Last.fm), é o único lugar da extensão que faz pedido de rede; o teste de privacidade confere.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL) return;
  const ENDERECO_TEXTOS = 'https://images.habblet.city/habblet-asset-bundles/gamedata/habblet_texts.json';
  // Dados dos mobis (o mesmo arquivo que o jogo baixa; ~17 MB, costuma vir do cache). Lido só quando a
  // aba Inventário ou o repor precisam; fica guardado só o essencial: classe, nome e oferta da loja.
  const ENDERECO_MOBIS = 'https://images.habblet.city/habblet-asset-bundles/gamedata/habblet_furni.json';
  const ENDERECO_ICONES = 'https://images.habblet.city/library/hof_furni/icons/';
  // Catálogo de roupas do avatar (o mesmo FigureData.json que o jogo baixa, ~1,7 MB): para o gerador
  // de visual achar peças e cores novas no estilo da pessoa. Fica só o essencial de cada peça.
  const ENDERECO_FIGURAS = 'https://images.habblet.city/habblet-asset-bundles/gamedata/avatar/FigureData.json';
  let pedido = null;
  let pedidoMobis = null;
  let pedidoFiguras = null;

  function figuras() {
    if (!pedidoFiguras) {
      pedidoFiguras = fetch(ENDERECO_FIGURAS, { credentials: 'omit', cache: 'force-cache' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) {
          const paletas = {};
          for (const p of d.palettes || []) {
            paletas[p.id] = (p.colors || []).filter((c) => c && c.selectable && /^[0-9a-f]{6}$/i.test(c.hexCode))
              .map((c) => ({ id: Number(c.id), club: Number(c.club) || 0, hex: String(c.hexCode).toLowerCase() }));
          }
          const tipos = {};
          for (const s of d.setTypes || []) {
            const sets = [];
            for (const x of s.sets || []) {
              if (!x || !x.selectable || x.sellable || !Number.isInteger(x.id)) continue;
              const partes = x.parts || [];
              const cores = partes.reduce((m, p) => Math.max(m, Number(p.colorindex) || 0), 0);
              sets.push({ id: x.id, g: String(x.gender || 'U').toUpperCase(), club: Number(x.club) || 0, cores: x.colorable ? Math.max(1, cores) : 0, assinatura: [...new Set(partes.map((p) => p.type))].sort().join(',') });
            }
            sets.sort((a, b) => a.id - b.id);
            tipos[s.type] = { paleta: s.paletteId, sets };
          }
          return { tipos, paletas };
        })
        .catch(function (erro) { pedidoFiguras = null; throw erro; });
    }
    return pedidoFiguras;
  }

  function mobis() {
    if (!pedidoMobis) {
      pedidoMobis = fetch(ENDERECO_MOBIS, { credentials: 'omit', cache: 'force-cache' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) {
          const chao = new Map();
          const parede = new Map();
          const guardar = (lista, mapa) => { for (const f of lista || []) if (f && Number.isInteger(f.id)) mapa.set(f.id, { classe: String(f.classname || ''), nome: String(f.name || ''), oferta: Number(f.offerid) || 0, sentar: f.cansiton === true, deitar: f.canlayon === true }); };
          guardar(d.roomitemtypes && d.roomitemtypes.furnitype, chao);
          guardar(d.wallitemtypes && d.wallitemtypes.furnitype, parede);
          return { chao, parede };
        })
        .catch(function (erro) { pedidoMobis = null; throw erro; });
    }
    return pedidoMobis;
  }
  // "bonusrare26_3*5" -> .../bonusrare26_3_5_icon.png (cor depois do *), como o jogo monta.
  function iconeDe(classe) {
    const m = /^([^*]+)(?:\*(\d+))?$/.exec(String(classe || ''));
    if (!m || !/^[\w.-]+$/.test(m[1])) return '';
    return ENDERECO_ICONES + encodeURIComponent(m[1] + (m[2] ? '_' + m[2] : '')) + '_icon.png';
  }

  function textos() {
    if (!pedido) {
      pedido = fetch(ENDERECO_TEXTOS, { credentials: 'omit', cache: 'force-cache' })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .catch(function (erro) { pedido = null; throw erro; });
    }
    return pedido;
  }

  // Listas prontas: [{ id, nome }] em ordem de número. A cópia local cobre os IDs
  // publicados pela Radio Habblet; os textos atuais do jogo acrescentam IDs novos.
  function limparNome(nome, id) {
    const s = String(nome || '').replace(/\s*\(\d+\)\s*$/, '').trim();
    return !s || /_name$|_desc$|^fx_/i.test(s) ? '' : s;
  }
  function listaVisual(tipo, padrao, nomePadrao) {
    const pares = (VL.catalogoVisual && VL.catalogoVisual[tipo]) || [];
    const saida = new Map([[0, { id: 0, nome: 'Remover' }]]);
    for (const [id, nome, acao] of pares) {
      if (!Number.isInteger(id) || id <= 0) continue;
      const item = { id, nome: String(nome || '').trim() || nomePadrao + ' ' + id };
      if (tipo === 'itens' && acao === 'drk') item.acao = acao;
      saida.set(id, item);
    }
    return textos().catch(() => ({})).then(function (t) {
      for (const k of Object.keys(t)) {
        const m = padrao.exec(k);
        if (!m) continue;
        const id = Number(m[1]);
        if (!Number.isSafeInteger(id) || id < 0 || saida.has(id)) continue;
        saida.set(id, { id, nome: limparNome(t[k], id) || nomePadrao + ' ' + id });
      }
      return [...saida.values()].sort((a, b) => a.id - b.id);
    });
  }
  function efeitos() { return listaVisual('efeitos', /^fx_(\d+)$/, 'Efeito'); }
  function itensDeMao() { return listaVisual('itens', /^handitem(\d+)$/, 'Item'); }

  VL.dadosJogo = { efeitos, itensDeMao, mobis, figuras, iconeDe, ENDERECO_TEXTOS, ENDERECO_MOBIS, ENDERECO_FIGURAS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
