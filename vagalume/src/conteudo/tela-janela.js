// Janela da tela compartilhada, por cima do hotel (pedido do usuário em 2026-11-19: "uma janela do
// vagalume por cima do hotel, igual os links, com opção de diminuir, aumentar, minimizar, colocar em
// tela cheia e picture-in-picture"). O vídeo fica numa página da extensão (src/tela) dentro dela; o
// picture-in-picture é pedido lá dentro, porque o navegador só o abre com o clique no próprio quadro.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.camada) return;
  const C = VL.camada;
  const el = C.el;
  const LARGURAS = [320, 420, 560, 720, 880, 1040, 1200];
  const ALTO_FIXO = 84; // cabeçalho + barra de baixo da página da tela
  const CSS = `
.vl-tela { position: absolute; z-index: 30; pointer-events: auto; display: flex; flex-direction: column;
  background: #12161f; border: 1px solid rgba(214, 242, 74, .45); border-radius: 12px; overflow: hidden;
  box-shadow: 0 18px 48px rgba(0, 0, 0, .6), 0 0 24px rgba(214, 242, 74, .12); resize: both;
  min-width: 260px; min-height: 180px; max-width: calc(100vw - 8px); max-height: calc(100vh - 8px); }
.vl-tela-topo { display: flex; align-items: center; gap: 6px; padding: 6px 6px 6px 12px; flex: none;
  background: linear-gradient(90deg, #1d2431, #1f2a1c); border-bottom: 2px solid #d6f24a;
  cursor: move; touch-action: none; user-select: none; -webkit-user-select: none; }
.vl-tela-ponto { flex: none; width: 9px; height: 9px; border-radius: 50%; background: #d6f24a; box-shadow: 0 0 8px 2px rgba(214, 242, 74, .55); }
.vl-tela.ao-vivo .vl-tela-ponto { background: #ff5b5b; box-shadow: 0 0 8px 2px rgba(255, 91, 91, .6); }
.vl-tela-titulo { flex: 1 1 auto; min-width: 0; margin: 0; font: 700 13px/1.2 system-ui, sans-serif; color: #d6f24a;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vl-tela-botao { flex: none; width: 28px; height: 26px; display: grid; place-items: center; padding: 0; border-radius: 7px;
  border: 1px solid #2c3445; background: #171c26; color: #e6ebf3; font: 700 14px/1 system-ui, sans-serif; cursor: pointer; }
.vl-tela-botao:hover:not(:disabled) { border-color: #d6f24a; color: #d6f24a; }
.vl-tela-botao:disabled { opacity: .4; cursor: default; }
.vl-tela-botao:focus-visible { outline: 2px solid #d6f24a; outline-offset: 1px; }
.vl-tela-botao.fechar:hover { border-color: #ff6b6b; color: #ff6b6b; }
.vl-tela-botao svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.vl-tela-corpo { flex: 1 1 auto; min-height: 0; display: flex; }
.vl-tela-corpo iframe { flex: 1 1 auto; width: 100%; height: 100%; border: 0; background: #0d1017; }
.vl-tela.arrastando .vl-tela-corpo iframe { pointer-events: none; }
.vl-tela.minimizada { resize: none; min-height: 0; height: auto !important; width: 280px !important; }
.vl-tela.minimizada .vl-tela-corpo { display: none; }
.vl-tela.minimizada .vl-tela-tamanho { display: none; }
.vl-tela:fullscreen { border-radius: 0; border: 0; max-width: none; max-height: none; resize: none; }
.vl-tela:fullscreen .vl-tela-tamanho { display: none; }
.vl-tela-convite { position: absolute; z-index: 31; top: 70px; left: 50%; transform: translateX(-50%); pointer-events: auto;
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; max-width: calc(100vw - 32px);
  background: #171c26; color: #e6ebf3; border: 1px solid rgba(214, 242, 74, .5); border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, .55); font: 13px/1.3 system-ui, sans-serif; }
.vl-tela-convite b { color: #d6f24a; }
.vl-tela-convite button { padding: 7px 11px; border-radius: 7px; border: 1px solid #2c3445; background: #1d2431; color: inherit; font: 600 12px/1 system-ui, sans-serif; cursor: pointer; }
.vl-tela-convite button.assistir { background: #d6f24a; border-color: #d6f24a; color: #12161f; }
`;
  const ICONES = {
    menos: [['path', { d: 'M5 12h14' }]],
    mais: [['path', { d: 'M12 5v14M5 12h14' }]],
    minimizar: [['path', { d: 'M5 18h14' }]],
    restaurar: [['rect', { x: 5, y: 5, width: 14, height: 14, rx: 2 }]],
    cheia: [['path', { d: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5' }]],
    sairCheia: [['path', { d: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5' }]],
    fechar: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
  };
  function icone(nome) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    for (const [tag, attrs] of ICONES[nome]) {
      const n = document.createElementNS(ns, tag);
      for (const k of Object.keys(attrs)) n.setAttribute(k, String(attrs[k]));
      svg.appendChild(n);
    }
    return svg;
  }
  function botao(nome, titulo, acao, extra) {
    const b = el('button', { type: 'button', class: 'vl-tela-botao' + (extra ? ' ' + extra : ''), title: titulo, 'aria-label': titulo });
    b.appendChild(icone(nome));
    b.addEventListener('click', function (ev) { ev.stopPropagation(); acao(); });
    b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    return b;
  }
  function trocarIcone(b, nome, titulo) {
    b.replaceChildren(icone(nome));
    b.title = titulo;
    b.setAttribute('aria-label', titulo);
  }

  const janelas = new Map(); // chave -> { fechar }
  const convites = new Map(); // id -> função que tira
  const chave = (modo, de) => modo + ':' + (de || '');
  // O painel da chamada redesenha os botões (AO VIVO / VENDO, Tela / Sua tela) quando uma janela abre ou fecha.
  const ouvintes = new Set();
  function avisarMudanca() { for (const fn of ouvintes) { try { fn(); } catch (e) { /* segue */ } } }
  function aoMudar(fn) { ouvintes.add(fn); return function () { ouvintes.delete(fn); }; }

  function abrir(opcoes) {
    const o = opcoes || {};
    const modo = o.modo === 'enviar' ? 'enviar' : 'ver';
    const de = String(o.de || '').replace(/\D/g, '');
    const k = chave(modo, de);
    if (janelas.has(k)) { janelas.get(k).trazer(); return; }
    if (modo === 'ver') tirarConvite(de);
    const sala = typeof o.sala === 'function' ? o.sala : function () { return Promise.resolve(); };
    const area = C.area();
    const titulo = el('p', { class: 'vl-tela-titulo', texto: modo === 'enviar' ? 'Compartilhar a sua tela' : 'Tela de ' + (o.nome || 'quem está compartilhando') });
    let indice = modo === 'enviar' ? 2 : 3;
    let minimizada = false;
    const bMenos = botao('menos', 'Diminuir', function () { mudarTamanho(-1); }, 'vl-tela-tamanho');
    const bMais = botao('mais', 'Aumentar', function () { mudarTamanho(1); }, 'vl-tela-tamanho');
    const bMin = botao('minimizar', 'Minimizar', function () { alternarMinimizar(); });
    const bCheia = botao('cheia', 'Tela cheia', function () { alternarCheia(); });
    const bFechar = botao('fechar', modo === 'enviar' ? 'Parar e fechar' : 'Fechar', function () { fechar(true); }, 'fechar');
    const topo = el('div', { class: 'vl-tela-topo' }, [el('span', { class: 'vl-tela-ponto', 'aria-hidden': 'true' }), titulo, bMenos, bMais, bMin, bCheia, bFechar]);
    const endereco = chrome.runtime.getURL('src/tela/tela.html') + '?modo=' + modo + (modo === 'ver' ? '&de=' + encodeURIComponent(de) + '&nome=' + encodeURIComponent(o.nome || '') : '');
    const quadro = el('iframe', { title: modo === 'enviar' ? 'Compartilhar a tela' : 'Tela compartilhada', allow: 'display-capture; fullscreen; picture-in-picture; autoplay', src: endereco });
    const janela = el('div', { class: 'vl-tela', role: 'dialog', 'aria-label': titulo.textContent }, [
      el('style', { texto: CSS }), topo, el('div', { class: 'vl-tela-corpo' }, [quadro]),
    ]);

    function limitar() {
      const r = janela.getBoundingClientRect();
      const x = Math.min(Math.max(4, r.left), Math.max(4, innerWidth - Math.min(r.width, 120)));
      const y = Math.min(Math.max(4, r.top), Math.max(4, innerHeight - 40));
      janela.style.left = x + 'px';
      janela.style.top = y + 'px';
    }
    function aplicarTamanho() {
      const largura = Math.min(LARGURAS[indice], innerWidth - 16);
      const altura = Math.min(Math.round(largura * 9 / 16) + ALTO_FIXO, innerHeight - 16);
      janela.style.width = largura + 'px';
      janela.style.height = altura + 'px';
      bMenos.disabled = indice === 0;
      bMais.disabled = indice === LARGURAS.length - 1 || LARGURAS[indice] >= innerWidth - 16;
    }
    function mudarTamanho(passo) {
      if (minimizada) alternarMinimizar();
      // Se a pessoa redimensionou pelo canto, parte do tamanho mais perto do atual.
      const atual = janela.getBoundingClientRect().width;
      let perto = 0;
      LARGURAS.forEach((l, i) => { if (Math.abs(l - atual) < Math.abs(LARGURAS[perto] - atual)) perto = i; });
      indice = Math.max(0, Math.min(LARGURAS.length - 1, perto + passo));
      aplicarTamanho();
      limitar();
    }
    function alternarMinimizar() {
      minimizada = !minimizada;
      janela.classList.toggle('minimizada', minimizada);
      trocarIcone(bMin, minimizada ? 'restaurar' : 'minimizar', minimizada ? 'Restaurar' : 'Minimizar');
      if (!minimizada) aplicarTamanho();
      limitar();
    }
    function emTelaCheia() { return !!document.fullscreenElement && janela.matches(':fullscreen'); }
    function alternarCheia() {
      if (emTelaCheia()) { document.exitFullscreen().catch(function () {}); return; }
      if (minimizada) alternarMinimizar();
      janela.requestFullscreen().catch(function () { C.aviso('O navegador não deixou abrir em tela cheia.', { tipo: 'erro' }); });
    }
    function aoMudarCheia() {
      const cheia = emTelaCheia();
      trocarIcone(bCheia, cheia ? 'sairCheia' : 'cheia', cheia ? 'Sair da tela cheia' : 'Tela cheia');
    }
    document.addEventListener('fullscreenchange', aoMudarCheia);

    // Arrastar pelo cabeçalho.
    let arraste = null;
    topo.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || emTelaCheia()) return;
      const r = janela.getBoundingClientRect();
      arraste = { id: ev.pointerId, dx: ev.clientX - r.left, dy: ev.clientY - r.top };
      topo.setPointerCapture(ev.pointerId);
      janela.classList.add('arrastando');
      ev.preventDefault();
    });
    topo.addEventListener('pointermove', function (ev) {
      if (!arraste || ev.pointerId !== arraste.id) return;
      janela.style.left = (ev.clientX - arraste.dx) + 'px';
      janela.style.top = (ev.clientY - arraste.dy) + 'px';
    });
    function soltar(ev) {
      if (!arraste || ev.pointerId !== arraste.id) return;
      arraste = null;
      janela.classList.remove('arrastando');
      limitar();
    }
    topo.addEventListener('pointerup', soltar);
    topo.addEventListener('pointercancel', soltar);
    topo.addEventListener('dblclick', function (ev) { if (!ev.target.closest('button')) alternarMinimizar(); });

    // Avisos da página da tela.
    let relogioFim = 0;
    function aoMensagem(ev) {
      if (ev.source !== quadro.contentWindow || !ev.data || ev.data.vagalume !== 'tela') return;
      const t = ev.data.t;
      if (t === 'ao-vivo') janela.classList.add('ao-vivo');
      else if (t === 'fim') {
        janela.classList.remove('ao-vivo');
        clearTimeout(relogioFim);
        relogioFim = setTimeout(function () { fechar(false); }, 3500);
      } else if (t === 'pip') {
        // Com o picture-in-picture aberto, a janela fica só com o cabeçalho; ao voltar, reabre.
        if (ev.data.ligado && !minimizada) alternarMinimizar();
        else if (!ev.data.ligado && minimizada) alternarMinimizar();
      }
    }
    window.addEventListener('message', aoMensagem);
    function aoRedimensionarPagina() { if (!minimizada && !emTelaCheia()) limitar(); }
    window.addEventListener('resize', aoRedimensionarPagina);

    let fechada = false;
    function fechar(avisarOutros) {
      if (fechada) return;
      fechada = true;
      clearTimeout(relogioFim);
      if (emTelaCheia()) document.exitFullscreen().catch(function () {});
      try { quadro.contentWindow.postMessage({ vagalume: 'tela-janela', t: 'parar' }, new URL(chrome.runtime.getURL('')).origin); } catch (e) { /* já saiu */ }
      if (avisarOutros) {
        if (modo === 'enviar') sala('tela:todos', { dado: { papel: 'enviar', t: 'fim' } }).catch(function () {});
        else sala('tela:sinal', { para: de, dado: { papel: 'ver', t: 'sair' } }).catch(function () {});
      }
      document.removeEventListener('fullscreenchange', aoMudarCheia);
      window.removeEventListener('message', aoMensagem);
      window.removeEventListener('resize', aoRedimensionarPagina);
      // O quadro sai da página depois do aviso de parar, para a câmera da tela fechar na hora.
      setTimeout(function () { try { quadro.src = 'about:blank'; } catch (e) { /* nada */ } janela.remove(); }, 60);
      janelas.delete(k);
      avisarMudanca();
    }
    function trazer() {
      area.appendChild(janela); // vai para cima das outras
      if (minimizada) alternarMinimizar();
    }

    area.appendChild(janela);
    aplicarTamanho();
    const r = janela.getBoundingClientRect();
    const deslocamento = janelas.size * 28;
    janela.style.left = Math.max(8, (modo === 'enviar' ? 24 : innerWidth - r.width - 24) - deslocamento) + 'px';
    janela.style.top = Math.max(8, Math.round((innerHeight - r.height) / 2) + deslocamento) + 'px';
    janelas.set(k, { fechar, trazer });
    avisarMudanca();
  }

  // Cartão "X está compartilhando a tela", com Assistir.
  function convite(opcoes) {
    const o = opcoes || {};
    const de = String(o.de || '').replace(/\D/g, '');
    if (!de || janelas.has(chave('ver', de)) || convites.has(de)) return;
    const nome = o.nome || 'Alguém';
    const cartao = el('div', { class: 'vl-tela-convite', role: 'status' }, [
      el('style', { texto: CSS }),
      el('span', {}, [el('b', { texto: nome }), document.createTextNode(' está compartilhando a tela.')]),
      el('button', { type: 'button', class: 'assistir', texto: 'Assistir', onclick() { tirarConvite(de); abrir({ modo: 'ver', de, nome, sala: o.sala }); } }),
      el('button', { type: 'button', texto: 'Agora não', onclick() { tirarConvite(de); } }),
    ]);
    const relogio = setTimeout(function () { tirarConvite(de); }, 45000);
    C.area().appendChild(cartao);
    convites.set(de, function () { clearTimeout(relogio); cartao.remove(); });
  }
  function tirarConvite(de) {
    const tirar = convites.get(String(de));
    if (tirar) { convites.delete(String(de)); tirar(); }
  }
  function fecharTodas() {
    for (const j of [...janelas.values()]) j.fechar(false);
    for (const de of [...convites.keys()]) tirarConvite(de);
  }
  function aberta(modo, de) { return janelas.has(chave(modo === 'enviar' ? 'enviar' : 'ver', String(de || '').replace(/\D/g, ''))); }

  VL.telaJanela = { abrir, convite, tirarConvite, fecharTodas, aberta, aoMudar };
})(typeof globalThis !== 'undefined' ? globalThis : this);
