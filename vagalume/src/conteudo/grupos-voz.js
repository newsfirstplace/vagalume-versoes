// Interface dos grupos salvos. A rede e as credenciais ficam na página da sala.
(function (raiz) {
  'use strict';
  // Ícone de grupo na lista de amigos (2026-11-19): duas pessoas desenhadas em SVG, no lugar de dois
  // ícones de perfil do jogo sobrepostos, que ficavam cortados.
  function simboloGrupo() {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 20 16');
    const partes = [
      ['circle', { cx: 13.5, cy: 4.5, r: 2.8, fill: '#8fa63a' }],
      ['path', { d: 'M8.6 15c0-3.4 2.2-5.6 4.9-5.6s4.9 2.2 4.9 5.6z', fill: '#8fa63a' }],
      ['circle', { cx: 7, cy: 5.2, r: 3.2, fill: '#d6f24a', stroke: '#12161f', 'stroke-width': 1 }],
      ['path', { d: 'M1.4 15.5c0-3.8 2.5-6.3 5.6-6.3s5.6 2.5 5.6 6.3z', fill: '#d6f24a', stroke: '#12161f', 'stroke-width': 1 }],
    ];
    for (const [tag, attrs] of partes) {
      const no = document.createElementNS(NS, tag);
      for (const k of Object.keys(attrs)) no.setAttribute(k, String(attrs[k]));
      svg.appendChild(no);
    }
    return svg;
  }
  const VL = raiz.VL;
  if (!VL || !VL.grupos || !VL.camada) return;
  const G = VL.grupos;
  const C = VL.camada;
  const el = C.el;
  const ICONE_AVISO = 'icones/aviso-mensagem.gif';
  const CSS = `
.vl-grupos-janela { position:fixed!important; z-index:2147483500; pointer-events:auto; }
.vl-console-grupos.nitro-card { width:285px; height:385px; min-width:285px; min-height:280px; max-width:calc(100vw - 16px); max-height:calc(100vh - 16px); resize:both; }
.vl-console-grupos .nitro-card-header { cursor:move; touch-action:none; user-select:none; flex-shrink:0; }
.vl-console-grupos .nitro-card-header-close { cursor:pointer; }
.vl-console-grupos.vl-recolhido { height:auto!important; min-height:0; resize:none; }
.vl-console-grupos.vl-recolhido > .content-area { display:none!important; }
.vl-console-grupos > .content-area { flex:1; min-height:0; overflow:auto!important; }
.vl-console-grupos > .content-area.vl-grupos-chat { overflow:hidden!important; }
.vl-console-grupos button { font:inherit; cursor:pointer; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-rostos { display:flex; gap:4px; overflow-x:auto; overflow-y:hidden; flex:none; min-height:40px; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .layout-grid-item-messenger { width:39px; height:39px; flex:none; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-avatar { position:relative; display:block; overflow:hidden; flex:none; width:50px; height:50px; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-avatar img { position:absolute; width:64px; height:110px; max-width:none; left:-7px; top:-28px; image-rendering:pixelated; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .layout-grid-item-messenger .vl-grupos-avatar { width:39px; height:39px; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .layout-grid-item-messenger img { width:32px; height:55px; left:3px; top:-6px; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-avatar .sem-visual { display:grid; place-items:center; height:100%; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-titulo { flex:none; min-height:8px; margin:5px 0 0; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .nitro-messenger-header-text { max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-acoes { display:flex; gap:4px; align-items:center; flex:none; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-acoes .vl-icone { width:26px; height:22px; padding:3px; display:grid; place-items:center; background:#d6f24a; color:#12161f; border:0; border-radius:5px; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-icone svg { width:15px; height:15px; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-acoes .clear { margin-left:auto; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-historico { flex:1; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:8px; padding-top:8px; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-fala { flex:none; align-items:flex-start; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-fala > .messages-group-left, .vl-console-grupos .vl-grupos-fala > .messages-group-right { flex:1; min-width:0; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .message-bubble .text-break { white-space:pre-wrap; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-compor { flex:none; display:flex; gap:4px; align-items:center; height:28px; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-grupos-compor input { position:static; flex:1; min-width:0; width:0; height:28px; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .chat-submit { position:static; height:20px; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-nota:empty { display:none; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-nota { margin:0; }
.nitro-friends-messenger .vl-grupo-atalho { width:39px; height:39px; padding:0; flex:none; display:grid; place-items:center; border:1px solid #36425a; border-radius:8px; color:inherit; background:#232c3c; cursor:pointer; font:700 16px system-ui; }
.nitro-friends-messenger .vl-grupo-atalho.active { background:#d6f24a; color:#12161f; }
.nitro-friends-messenger .vl-grupo-integrado > :first-child .layout-grid-item-messenger.active:not(.vl-grupo-atalho) { background:transparent!important; }
.nitro-friends-messenger .vl-grupos-contagem + .nitro-card-header-text { display:none; }
.nitro-friends-messenger .vl-grupo-integrado > :not(:first-child):not(.vl-grupo-conteudo) { display:none!important; }
.nitro-friends-messenger .vl-grupo-integrado > .vl-grupo-conteudo { padding:0; flex:1; min-height:0; }
.nitro-friends-messenger .vl-grupo-integrado > .vl-grupo-conteudo.vl-grupos-chat { overflow:hidden!important; }
.nitro-friends-messenger .vl-grupo-integrado > .vl-grupo-conteudo:not(.vl-grupos-chat) { overflow-x:hidden!important; overflow-y:auto!important; overscroll-behavior:contain; }
.vl-console-grupos .vl-grupos-atalhos { display:flex; gap:4px; flex:none; overflow-x:auto; }
.vl-console-grupos .vl-grupos-atalhos[hidden], .vl-console-grupos.vl-recolhido .vl-grupos-atalhos { display:none; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-botao { border:1px solid #36425a; border-radius:5px; background:#232c3c; color:inherit; padding:4px 7px; }
:is(.vl-console-grupos,.vl-grupo-conteudo) .vl-botao.primario { background:#d6f24a; color:#12161f; }
.nitro-friends-messenger .vl-grupo-membro { padding:0; border:0; cursor:pointer; }
.nitro-friends-messenger .vl-grupo-membro:focus-visible { outline:2px solid #d6f24a; outline-offset:1px; }
.vl-grupos-linha { display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:7px; border:1px solid #36425a; border-radius:6px; }
.vl-grupos-linha > span { flex:1; min-width:80px; overflow-wrap:anywhere; }
.vl-grupos small { display:block; }
.vl-grupos input { box-sizing:border-box; background:#10141c; color:#e8eef7; border:1px solid #36425a; border-radius:5px; padding:6px; min-width:0; width:100%; font:inherit; }
.vl-grupos-lista { display:grid; gap:6px; }
.vl-amigos-grupos { order:-100!important; flex:none; width:100%; }
.vl-amigos-grupos .second_tab { display:flex; align-items:center; gap:4px; cursor:pointer; text-align:left; }
.vl-amigos-grupos .vl-grupo-linha { cursor:pointer; }
.vl-amigos-grupos .vl-grupo-linha:hover { background:rgba(214,242,74,.1); }
.vl-amigos-grupos .vl-grupo-simbolo { display:grid; place-items:center; width:22px; height:18px; flex:none; }
.vl-amigos-grupos .vl-grupo-simbolo svg { display:block; width:20px; height:16px; }
.vl-amigos-grupos .vl-grupo-linha .text-truncate { flex:1; text-align:left; }
.vl-amigos-grupos button.icon-chat { background-color:transparent; border:0; padding:0; flex:none; cursor:pointer; }
.vl-amigos-grupos .vl-grupo-nao-lido { background:rgba(214,242,74,.14); }
.nitro-toolbar .vl-grupos-alerta { display:grid; place-items:center; width:32px; min-width:32px; height:36px; flex:none; padding:0; border:0!important; background:transparent!important; cursor:pointer; }
.nitro-toolbar .vl-grupos-alerta img { display:block; width:26px; height:32px; image-rendering:pixelated; }
.nitro-friends-messenger .vl-convite-codigo { font-size:0!important; }
.nitro-friends-messenger .vl-convite-console { display:grid; gap:6px; width:min(205px,100%); padding:8px; color:#e8eef7; background:#1b2230; border:1px solid #46536a; border-left:3px solid #d6f24a; border-radius:6px; overflow-wrap:anywhere; font:11px/1.35 system-ui,sans-serif; }
.nitro-friends-messenger .vl-convite-console .vl-convite-acoes { display:flex; gap:6px; }
.nitro-friends-messenger .vl-convite-console button { flex:1; min-width:0; padding:5px 6px; border:1px solid #46536a; border-radius:5px; background:#263349; color:#e8eef7; cursor:pointer; font:inherit; }
.nitro-friends-messenger .vl-convite-console button.primario { background:#d6f24a; border-color:#d6f24a; color:#12161f; }
`;
  const ERROS = {
    'grupo-ausente': 'Este grupo foi excluído.',
    'grupo-acesso': 'Você não tem mais acesso ou o convite expirou. Peça um novo convite ao criador.',
    'grupo-convite': 'Aceite o convite antes de entrar.',
    'grupo-cheio': 'O grupo já tem 12 membros, contando os convites pendentes.',
    'grupo-limite': 'Você já tem 50 grupos salvos na extensão.',
    'grupo-nao-salvo': 'Este grupo não está salvo na extensão. Peça um novo convite ao criador.',
    'grupo-dono': 'O criador pode excluir o grupo, mas não sair dele.',
    'grupo-armazenamento': 'Não consegui acessar os grupos salvos na extensão. Recarregue a extensão e tente novamente.',
    'grupo-backup': 'O arquivo de backup é inválido ou pertence a outra conta do Habblet.',
    devagar: 'Aguarde um minuto antes de tentar novamente.',
  };
  function criar(op) {
    const { ctx } = op;
    const convites = new Map();
    let caixa = null;
    let painelGrupo = null;
    let posicaoJanela = null;
    let fecharJanela = null;
    let parado = false;
    let geracao = 0;
    let pararConversa = null;
    let secaoAmigos = null;
    const abertos = new Map();
    let contaAbas = '';
    let grupoVisivel = null;
    let consoleIntegrado = null;
    let desencaixar = null;
    let conversaIndividual = '';
    let consoleAnterior = null;
    const avisos = new Map();
    const marcas = new Map();
    const naoLidos = new Map();
    let contaNovidades = '';
    let cursorNovidades = 0;
    let consultandoNovidades = false;
    let gruposConsultados = [];
    let proximaLista = 0;
    let audioAviso = null;
    const tentados = new Set();
    const resolvidos = new Map();
    const estilo = el('style', { texto: CSS });
    C.area().appendChild(estilo);
    ctx.aoParar(C.estiloPagina('grupos-console', CSS));
    ctx.aoParar(() => {
      parado = true;
      fecharJanela?.();
      estilo.remove(); secaoAmigos?.remove();
      document.querySelector('.vl-grupos-alerta')?.remove();
      audioAviso?.close?.().catch(() => {});
      document.querySelectorAll('.vl-grupo-atalho, .vl-grupos-contagem').forEach((n) => n.remove());
    });
    const id = () => String(VL.pessoas && VL.pessoas.meuId() || '');
    const apelido = () => VL.pessoas && VL.pessoas.eu() || '';
    const nota = (texto) => el('p', { class: 'vl-nota', texto });
    function figura(pessoa) {
      const amigo = VL.amigos?.lista?.().find((a) => String(a.id) === pessoa.id);
      const local = VL.pessoas?.visualDe?.(pessoa.nome);
      return amigo?.visual || (typeof local === 'string' ? local : local?.visual) || pessoa.visual || '';
    }
    function avatar(pessoa, miniatura = false) {
      const visual = figura(pessoa);
      const no = el('span', { class: 'vl-grupos-avatar', title: pessoa.nome, 'aria-label': pessoa.nome });
      const reserva = () => no.replaceChildren(el('span', { class: 'sem-visual', texto: pessoa.nome.slice(0, 2).toUpperCase() }));
      if (!visual) reserva();
      else no.appendChild(el('img', { alt: '', src: 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(visual) + '&size=m&direction=' + (pessoa.id === id() ? '2' : '4') + '&head_direction=' + (pessoa.id === id() ? '2' : '4'), onerror: reserva }));
      return miniatura ? el('button', {
        type: 'button', class: 'layout-grid-item-messenger vl-grupo-membro' + (pessoa.id === id() ? ' active' : ''),
        title: 'Abrir perfil de ' + pessoa.nome, 'aria-label': 'Abrir perfil de ' + pessoa.nome,
        onclick(ev) {
          ev.stopPropagation();
          const alvo = Number(pessoa.id);
          if (!Number.isSafeInteger(alvo) || alvo <= 0) return;
          if (VL.amigos?.perfil) VL.amigos.perfil(alvo);
          else if (VL.codigos?.SAIDA?.PERFIL) VL.conexao?.enviar?.(VL.codigos.SAIDA.PERFIL, [['i', alvo], ['b', true]]);
        },
      }, no) : no;
    }
    function erro(e) { C.aviso(ERROS[e.message] || 'Não foi possível concluir. Tente novamente. (' + e.message + ')', { tipo: 'erro' }); }
    async function pedir(tipo, dado) {
      if (parado) throw new Error('Mídia desativada');
      if (!G.usuarioValido(id())) throw new Error('Entre no hotel com a Conexão ligada');
      return op.sala('grupo:' + tipo, Object.assign({}, dado, { id: id() }));
    }
    function botao(texto, fn, destaque) {
      return el('button', { type: 'button', class: 'vl-botao' + (destaque ? ' primario' : ''), texto, async onclick(ev) {
        const b = ev.currentTarget;
        b.disabled = true;
        try { await fn(); } catch (e) { erro(e); } finally { b.disabled = false; }
      } });
    }
    function atualizarAvisoRodape() {
      let botaoAviso = document.querySelector('.vl-grupos-alerta');
      const pesquisa = document.querySelector('.nitro-toolbar .toolbar-navigation .icon-friendsearch');
      if (!naoLidos.size || !pesquisa?.parentElement) { botaoAviso?.remove(); return; }
      if (!botaoAviso) {
        botaoAviso = el('button', { type: 'button', class: 'vl-grupos-alerta', onclick() {
          const grupo = [...naoLidos.keys()].at(-1);
          if (grupo) abrirGrupo(grupo).catch(erro);
        } }, el('img', { src: chrome.runtime.getURL(ICONE_AVISO), alt: '' }));
      }
      if (botaoAviso.parentElement !== pesquisa.parentElement || botaoAviso.previousElementSibling !== pesquisa) pesquisa.after(botaoAviso);
      const total = [...naoLidos.values()].reduce((n, x) => n + x.quantidade, 0);
      const rotulo = total + ' mensagem(ns) nova(s) em ' + naoLidos.size + ' grupo(s). Abrir conversa.';
      botaoAviso.title = rotulo;
      botaoAviso.setAttribute('aria-label', rotulo);
      document.querySelectorAll('.vl-grupo-linha[data-grupo]').forEach((linha) => linha.classList.toggle('vl-grupo-nao-lido', naoLidos.has(linha.dataset.grupo)));
    }
    function tocarAviso() {
      const volume = Number(ctx.secao()?.volume ?? 100) / 100;
      if (!(volume > 0)) return;
      try {
        const Contexto = window.AudioContext || window.webkitAudioContext;
        if (!Contexto) return;
        if (!audioAviso) audioAviso = new Contexto();
        if (audioAviso.state === 'suspended') audioAviso.resume().catch(() => {});
        for (const [frequencia, atraso] of [[880, 0], [1175, 0.12]]) {
          const t = audioAviso.currentTime + atraso;
          const osc = audioAviso.createOscillator();
          const ganho = audioAviso.createGain();
          osc.type = 'sine'; osc.frequency.value = frequencia;
          ganho.gain.setValueAtTime(0.0001, t);
          ganho.gain.exponentialRampToValueAtTime(0.07 * volume, t + 0.015);
          ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
          osc.connect(ganho).connect(audioAviso.destination);
          osc.start(t); osc.stop(t + 0.18);
        }
      } catch (_) { /* O aviso visual continua se o navegador bloquear áudio. */ }
    }
    function registrarMensagens(grupo, nome, mensagens) {
      const { marca, novas } = G.novidades(mensagens, marcas.get(grupo), id());
      if (!marcas.has(grupo)) { marcas.set(grupo, marca); return; }
      if (!marca || marcas.get(grupo) === marca) return;
      marcas.set(grupo, marca);
      if (!novas.length) return;
      if (grupoVisivel !== grupo || !caixa?.isConnected || !pararConversa) {
        const atual = naoLidos.get(grupo);
        naoLidos.set(grupo, { nome, quantidade: Math.min(99, (atual?.quantidade || 0) + novas.length) });
        atualizarAvisoRodape();
      }
      tocarAviso();
    }
    function montar(...nos) {
      if (pararConversa) pararConversa();
      pararConversa = null;
      if (caixa && !parado) { caixa.classList.remove('vl-grupos-chat'); caixa.replaceChildren(...nos); }
    }
    function preencherAbas(faixa, integrado) {
      const botoes = new Map(Array.from(faixa.querySelectorAll('.vl-grupo-atalho')).map((b) => [b.dataset.grupo, b]));
      for (const [grupo, nome] of abertos) {
        let b = botoes.get(grupo);
        if (!b) {
          b = el('button', { type: 'button', class: 'layout-grid-item-messenger vl-grupo-atalho', dataset: { grupo }, onclick(ev) {
            ev.stopPropagation(); abrirGrupo(grupo).catch(erro);
          } });
          faixa.appendChild(b);
        }
        const inicial = Array.from(nome.trim())[0]?.toLocaleUpperCase('pt-BR') || '?';
        if (b.textContent !== inicial) b.textContent = inicial;
        if (b.title !== nome) { b.title = nome; b.setAttribute('aria-label', 'Grupo ' + nome); }
        const selecionado = grupo === grupoVisivel && (!!consoleIntegrado === integrado);
        b.classList.toggle('active', selecionado);
        b.setAttribute('aria-pressed', String(selecionado));
        botoes.delete(grupo);
      }
      for (const b of botoes.values()) b.remove();
    }
    function sincronizarAbas() {
      if (parado) return;
      if (contaAbas !== id()) { fecharJanela?.(); abertos.clear(); contaAbas = id(); }
      const nativo = document.querySelector('.nitro-friends-messenger:not(.vl-console-grupos)');
      const mudou = nativo !== consoleAnterior;
      consoleAnterior = nativo;
      if ((consoleIntegrado && (!consoleIntegrado.isConnected || !caixa?.isConnected || conversaIndividual !== tituloIndividual(nativo))) || (mudou && nativo && grupoVisivel && !consoleIntegrado)) fecharJanela?.();
      const faixa = nativo?.querySelector('.layout-grid-item-messenger:not(.vl-grupo-atalho)')?.parentElement;
      if (faixa) preencherAbas(faixa, true);
      const titulo = nativo?.querySelector('.nitro-card-header-text:not(.vl-grupos-contagem)');
      if (titulo) {
        let contagem = titulo.previousElementSibling;
        if (!contagem?.classList.contains('vl-grupos-contagem')) contagem = null;
        if (abertos.size && faixa) {
          if (!contagem) { contagem = el('span', { class: 'nitro-card-header-text vl-grupos-contagem' }); titulo.before(contagem); }
          const total = Number(/\((\d+)\)/.exec(titulo.textContent)?.[1] || 0) + abertos.size;
          const rotulo = 'Bate-papos ativos (' + total + ')';
          if (contagem.textContent !== rotulo) contagem.textContent = rotulo;
        } else contagem?.remove();
      }
      const faixaGrupo = painelGrupo?.querySelector('.vl-grupos-atalhos');
      if (faixaGrupo) { preencherAbas(faixaGrupo, false); faixaGrupo.hidden = !abertos.size; }
      const tituloGrupo = painelGrupo?.querySelector('.nitro-card-header-text');
      const rotuloGrupo = 'Bate-papos ativos (' + abertos.size + ')';
      if (tituloGrupo && tituloGrupo.textContent !== rotuloGrupo) tituloGrupo.textContent = rotuloGrupo;
    }
    function tituloIndividual(nativo) {
      return nativo?.querySelector('.nitro-messenger-header-text:not(.vl-grupo-conteudo *)')?.textContent || '';
    }
    function criarCaixa() {
      return el('div', { class: 'vl-grupos d-flex flex-column gap-2 container-fluid content-area' });
    }
    function fecharVisualizacao() {
      montar(); desencaixar?.();
      caixa = null; painelGrupo = null; fecharJanela = null; grupoVisivel = null; geracao++;
      sincronizarAbas();
    }
    function abrirJanela(consoleJogo) {
      caixa = criarCaixa();
      const titulo = el('span', { class: 'nitro-card-header-text', texto: 'Bate-papos ativos (1)' });
      const fechar = el('div', { class: 'position-absolute end-2 nitro-card-header-close', role: 'button', tabindex: '0', title: 'Fechar conversa do grupo', 'aria-label': 'Fechar conversa do grupo' });
      const cabecalho = el('div', { class: 'd-flex position-relative flex-column gap-2 container-fluid nitro-card-header' }, [el('div', { class: 'd-flex w-100' }, [titulo, fechar])]);
      painelGrupo = el('section', { class: 'd-flex overflow-hidden position-relative flex-column nitro-card theme-messenger nitro-friends-messenger vl-console-grupos', 'aria-label': 'Console do grupo' }, [cabecalho, el('div', { class: 'vl-grupos-atalhos px-2', hidden: true }), caixa]);
      const suporte = el('div', { class: 'draggable-window vl-grupos-janela' }, painelGrupo);
      function posicionar(x, y) {
        const r = suporte.getBoundingClientRect();
        posicaoJanela = { x: Math.max(0, Math.min(x, window.innerWidth - r.width)), y: Math.max(0, Math.min(y, window.innerHeight - 32)) };
        suporte.style.left = posicaoJanela.x + 'px';
        suporte.style.top = posicaoJanela.y + 'px';
      }
      let arrasto = null;
      cabecalho.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0 || ev.target.closest('[role="button"]')) return;
        ev.preventDefault();
        const r = suporte.getBoundingClientRect();
        arrasto = { x: ev.clientX - r.left, y: ev.clientY - r.top };
        cabecalho.setPointerCapture(ev.pointerId);
      });
      cabecalho.addEventListener('pointermove', (ev) => { if (arrasto) posicionar(ev.clientX - arrasto.x, ev.clientY - arrasto.y); });
      cabecalho.addEventListener('pointerup', () => { arrasto = null; });
      cabecalho.addEventListener('pointercancel', () => { arrasto = null; });
      cabecalho.addEventListener('lostpointercapture', () => { arrasto = null; });
      cabecalho.addEventListener('dblclick', (ev) => { if (!ev.target.closest('[role="button"]')) painelGrupo.classList.toggle('vl-recolhido'); });
      const ajustar = () => posicionar(posicaoJanela.x, posicaoJanela.y);
      fecharJanela = () => {
        window.removeEventListener('resize', ajustar);
        suporte.remove();
        fecharVisualizacao();
      };
      fechar.addEventListener('click', () => fecharJanela());
      fechar.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); fecharJanela(); } });
      for (const tipo of ['pointerdown', 'mousedown', 'click', 'dblclick', 'keydown', 'keyup', 'wheel']) suporte.addEventListener(tipo, (ev) => ev.stopPropagation());
      document.body.appendChild(suporte);
      if (!posicaoJanela) {
        const original = consoleJogo || document.querySelector('.nitro-friends-messenger:not(.vl-console-grupos)');
        const r = original?.getBoundingClientRect();
        posicionar(r ? r.right + 12 : (window.innerWidth - 285) / 2, r ? r.top : (window.innerHeight - 385) / 2);
      } else ajustar();
      window.addEventListener('resize', ajustar);
      sincronizarAbas();
    }
    async function abrir(consoleJogo) {
      if (parado) return;
      if (caixa) { painelGrupo?.classList.remove('vl-recolhido'); return; }
      abrirJanela(consoleJogo);
      await listar();
    }
    function encaixarNoConsole() {
      if (consoleIntegrado) return true;
      const nativo = document.querySelector('.nitro-friends-messenger:not(.vl-console-grupos)');
      const conteudo = nativo?.querySelector(':scope > .content-area');
      if (!conteudo?.firstElementChild?.querySelector('.layout-grid-item-messenger:not(.vl-grupo-atalho)') || !nativo.getClientRects().length || !conteudo.getClientRects().length) return false;
      if (!caixa) { caixa = criarCaixa(); fecharJanela = fecharVisualizacao; }
      const escolherAmigo = (ev) => {
        const aba = ev.target.closest('.layout-grid-item-messenger:not(.vl-grupo-atalho)');
        if (aba && conteudo.firstElementChild?.contains(aba)) fecharJanela?.();
      };
      consoleIntegrado = nativo;
      conversaIndividual = tituloIndividual(nativo);
      nativo.addEventListener('click', escolherAmigo, true);
      conteudo.classList.add('vl-grupo-integrado');
      caixa.classList.add('vl-grupo-conteudo');
      conteudo.appendChild(caixa);
      if (painelGrupo) painelGrupo.parentElement.hidden = true;
      desencaixar = () => {
        nativo.removeEventListener('click', escolherAmigo, true);
        conteudo.classList.remove('vl-grupo-integrado');
        caixa.remove();
        consoleIntegrado = null;
        desencaixar = null;
      };
      return true;
    }
    async function abrirGrupo(grupo) {
      if (parado) return;
      sincronizarAbas();
      if (!encaixarNoConsole() && !caixa) abrirJanela();
      painelGrupo?.classList.remove('vl-recolhido');
      if (caixa) await conversa(grupo);
    }
    async function sincronizarAmigos(atualizar = false) {
      const lista = document.querySelector('.nitro-friends .friends-container');
      if (!lista || !G.usuarioValido(id()) || parado) return;
      if (!lista.contains(secaoAmigos)) {
        secaoAmigos = el('section', { class: 'vl-amigos-grupos' });
        lista.prepend(secaoAmigos);
        atualizar = true;
      }
      // Uma leitura vazia feita durante o login não deve ocultar os grupos até a próxima sessão.
      if (!atualizar && secaoAmigos.dataset.conta === id() && Date.now() - Number(secaoAmigos.dataset.verificado || 0) < 15000) return;
      const secao = secaoAmigos;
      const conta = id();
      secao.dataset.conta = conta;
      secao.dataset.verificado = String(Date.now());
      try {
        const d = await pedir('listar');
        if (!secao.isConnected || secao !== secaoAmigos || conta !== id()) return;
        const linhas = el('div', {}, d.grupos.map((g) => el('div', { class: 'd-flex gap-1 align-items-center justify-content-between px-2 py-1 friend-row vl-grupo-linha' + (naoLidos.has(g.grupo) ? ' vl-grupo-nao-lido' : ''), dataset: { grupo: g.grupo }, ondblclick() { abrirGrupo(g.grupo).catch(erro); } }, [
          el('span', { class: 'vl-grupo-simbolo', 'aria-hidden': 'true' }, [simboloGrupo()]),
          el('span', { class: 'text-truncate', texto: g.nome }),
          el('button', { type: 'button', class: 'nitro-friends-spritesheet icon-chat', title: 'Abrir conversa de ' + g.nome, 'aria-label': 'Abrir conversa de ' + g.nome, onclick() { abrirGrupo(g.grupo).catch(erro); } }),
        ])));
        const seta = el('span', { 'aria-hidden': 'true', texto: '▾' });
        const cab = el('div', { class: 'second_tab friend-row', role: 'button', tabindex: '0', 'aria-expanded': 'true' }, [el('span', { texto: 'Grupos' }), seta]);
        const alternar = () => { linhas.hidden = !linhas.hidden; cab.setAttribute('aria-expanded', String(!linhas.hidden)); seta.textContent = linhas.hidden ? '▸' : '▾'; };
        cab.addEventListener('click', alternar);
        cab.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alternar(); } });
        secao.replaceChildren(cab, linhas);
        secao.hidden = !d.grupos.length;
      } catch (e) { secao.hidden = false; secao.replaceChildren(botao('Tentar carregar grupos', () => sincronizarAmigos(true))); }
    }
    async function listar() {
      const versao = ++geracao;
      montar(nota('Carregando seus grupos…'));
      try {
        const d = await pedir('listar');
        if (versao !== geracao || !caixa) return;
        for (const c of d.convites || []) if (!convites.has(c.grupo)) convites.set(c.grupo, c);
        const nome = el('input', { type: 'text', maxlength: 40, placeholder: 'Nome do novo grupo', 'aria-label': 'Nome do novo grupo' });
        const novos = el('div', { class: 'vl-grupos-linha' }, [nome, botao('Criar grupo', async () => {
          if (!G.nome(nome.value)) { nome.focus(); return; }
          const g = await pedir('criar', { nome: nome.value, apelido: apelido() });
          sincronizarAmigos(true);
          await conversa(g.grupo);
        }, true)]);
        const linhas = d.grupos.map((g) => el('div', { class: 'vl-grupos-linha' }, [el('span', { texto: g.nome }), botao('Abrir conversa', () => conversa(g.grupo))]));
        const pendentes = (d.convites || []).map((c) => el('div', { class: 'vl-grupos-linha' }, [
          el('span', { texto: c.autor + ' convidou você' }), botao('Ver convite', () => verConvite(c)),
          botao('Dispensar', async () => { await recusar(c); await listar(); }),
        ]));
        const arquivo = el('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': 'Selecionar backup dos grupos' });
        arquivo.addEventListener('change', async () => {
          const escolhido = arquivo.files?.[0];
          if (!escolhido) return;
          try {
            if (escolhido.size > 100000) throw new Error('grupo-backup');
            let backup;
            try { backup = JSON.parse(await escolhido.text()); } catch (_) { throw new Error('grupo-backup'); }
            const r = await pedir('restaurar', { backup });
            C.aviso(r.adicionados + ' grupo(s) restaurado(s).');
            sincronizarAmigos(true);
            await listar();
          } catch (e) { erro(e); }
          finally { arquivo.value = ''; }
        });
        montar(nota('Até 12 pessoas por grupo. Seus amigos precisam do Vagalume atualizado. Os grupos continuam salvos quando a chamada termina.'),
          ...pendentes, novos, el('div', { class: 'vl-grupos-lista' }, linhas.length ? linhas : [nota('Você ainda não tem grupos. Crie um e convide seus amigos do console.')]),
          botao('Usar código de convite', importarConvite),
          botao('Salvar backup dos grupos', async () => {
            const backup = await pedir('exportar');
            const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
            const link = el('a', { href: url, download: 'vagalume-grupos-' + id() + '.json' });
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
          }),
          el('div', {}, [botao('Restaurar backup', () => arquivo.click()), arquivo]),
          nota('Guarde o backup em local privado: ele contém as chaves de acesso aos seus grupos. Faça isso antes de remover a extensão ou instalá-la de outra pasta.'),
          botao('Atualizar lista', listar));
      } catch (e) { montar(nota('Não consegui carregar seus grupos.'), botao('Tentar novamente', listar)); erro(e); }
    }
    async function entrar(g, manterConversa = false) {
      if (op.grupoAtual() === g.grupo) { op.mostrarChamada(); if (fecharJanela && !manterConversa) fecharJanela(); return true; }
      if (op.emChamada() && !await C.confirmar('Entrar em ' + g.nome + ' e sair da chamada atual?', { sim: 'Trocar de chamada' })) return false;
      await op.entrar(g);
      if (fecharJanela && !manterConversa) fecharJanela();
      C.aviso('Você entrou na chamada de ' + g.nome + '.', { tipo: 'ok' });
      return true;
    }
    async function conversa(grupo) {
      const versao = ++geracao;
      montar(nota('Abrindo conversa…'));
      let g;
      try { g = await pedir('ver', { grupo }); }
      catch (e) { if (versao === geracao && caixa) await detalhes(grupo); return; }
      if (versao !== geracao || !caixa) return;
      abertos.set(grupo, g.nome);
      grupoVisivel = grupo;
      naoLidos.delete(grupo);
      atualizarAvisoRodape();
      encaixarNoConsole();
      sincronizarAbas();
      const historico = el('div', { class: 'vl-grupos-historico chat-messages', role: 'log', 'aria-label': 'Mensagens do grupo' });
      const rostos = el('div', { class: 'vl-grupos-rostos', 'aria-label': 'Avatares dos membros' });
      const status = nota('Carregando mensagens…');
      const campo = el('input', { class: 'chat-input-form form-control-sm', placeholder: 'Clique aqui para escrever para o grupo', maxlength: 400, 'aria-label': 'Mensagem para o grupo' });
      const voz = botao('', () => entrar(g, true));
      voz.className = 'vl-icone';
      if (op.icones) voz.appendChild(op.icones.fone());
      voz.title = 'Chamada de voz'; voz.setAttribute('aria-label', voz.title);
      const gerenciar = botao('', () => detalhes(grupo));
      gerenciar.className = 'vl-icone';
      if (op.icones) gerenciar.appendChild(op.icones.grupo());
      gerenciar.title = 'Membros e convites'; gerenciar.setAttribute('aria-label', gerenciar.title);
      let timer, codigo, textoAnterior, ultima, assinatura, ocupado = 0, envios = 0;
      const ativa = () => versao === geracao && pararConversa !== null;
      let membros = new Map();
      function exibirMembros(lista) {
        op.atualizarMembros?.(grupo, lista);
        const aceitos = lista.filter((p) => p.aceito).sort((a, b) => Number(b.id === id()) - Number(a.id === id()));
        membros = new Map(aceitos.map((p) => [p.id, p]));
        const nova = JSON.stringify(aceitos.map((p) => [p.id, p.nome, figura(p)]));
        if (nova !== assinatura) { rostos.replaceChildren(...aceitos.map((p) => avatar(p, true))); assinatura = nova; ultima = undefined; }
      }
      function exibir(d) {
        if (!ativa()) return;
        registrarMensagens(grupo, g.nome, d.mensagens);
        if (d.membros) exibirMembros(d.membros);
        status.textContent = d.naChamada ? d.naChamada + ' na chamada' : '';
        const marca = d.mensagens.at(-1);
        const chave = marca ? marca.id + ':' + marca.codigo : '';
        if (chave === ultima) return;
        const seguir = historico.scrollHeight - historico.scrollTop - historico.clientHeight < 36;
        const blocos = G.agruparMensagens(d.mensagens);
        historico.replaceChildren(...(blocos.length ? blocos.map((mensagens) => {
          const primeira = mensagens[0];
          const ultimaMensagem = mensagens.at(-1);
          const proprio = primeira.id === id();
          const foto = avatar(membros.get(primeira.id) || { id: primeira.id, nome: primeira.autor });
          const fala = el('div', { class: proprio ? 'messages-group-left' : 'messages-group-right' }, [
            el('div', { class: 'message-bubble mt-2 py-1 px-2 text-black' }, [
              el('div', { class: 'fw-bold username', texto: primeira.autor }),
              ...mensagens.map((m) => el('div', { class: 'ubuntu-custom-small text-break', texto: m.texto })),
            ]),
            el('span', { class: 'message-bubble-time', texto: new Date(ultimaMensagem.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }),
          ]);
          return el('div', { class: 'vl-grupos-fala d-flex w-100 gap-2 ' + (proprio ? 'justify-content-start' : 'justify-content-end') }, proprio ? [foto, fala] : [fala, foto]);
        }) : [nota('Ainda não há mensagens.')]));
        if (seguir || ultima === undefined) historico.scrollTop = historico.scrollHeight;
        ultima = chave;
      }
      // Limpa o campo na hora e põe o envio numa fila: quem digita rápido já escreve a próxima
      // enquanto a anterior ainda vai ao servidor. Se falhar, o texto volta ao campo (se estiver vazio).
      let fila = Promise.resolve();
      const enviar = botao('Fale', () => {
        const texto = campo.value.trim();
        if (!texto) return;
        if (texto !== textoAnterior) { codigo = crypto.randomUUID().replace(/-/g, ''); textoAnterior = texto; }
        const deste = codigo;
        campo.value = '';
        if (ativa()) campo.focus();
        ocupado++;
        envios++;
        fila = fila.then(async () => {
          try {
            exibir(await pedir('mensagem', { grupo, texto, codigo: deste }));
            if (textoAnterior === texto) textoAnterior = null;
          } catch (e) {
            if (!campo.value.trim()) campo.value = texto;
            erro(e);
          } finally { ocupado--; }
        });
      });
      enviar.className = 'messenger-button chat-submit fw-bold px-3';
      campo.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); enviar.click(); }
      });
      const voltar = botao('‹', listar);
      voltar.className = 'messenger-button';
      voltar.title = 'Seus grupos'; voltar.setAttribute('aria-label', 'Seus grupos');
      const encerrar = botao('', () => { abertos.delete(grupo); fecharJanela(); });
      encerrar.className = 'clear'; encerrar.title = 'Fechar conversa'; encerrar.setAttribute('aria-label', 'Fechar conversa');
      montar(rostos, el('div', { class: 'messenger-line vl-grupos-titulo' }, el('p', { class: 'nitro-messenger-header-text fw-bold', texto: g.nome, title: g.nome })),
        el('div', { class: 'vl-grupos-acoes' }, [voltar, voz, gerenciar, encerrar]), historico,
        status, el('div', { class: 'vl-grupos-compor' }, [campo].concat(op.botoesMidia ? [op.botoesMidia(function (marca) {
          // A mídia vai ao grupo como uma mensagem com a marca (o Vagalume mostra a imagem, o GIF ou o áudio no balão).
          campo.value = marca;
          enviar.click();
        })] : [], [enviar])));
      caixa.classList.add('vl-grupos-chat');
      exibirMembros(g.membros);
      const eu = membros.get(id());
      const visual = eu && figura(eu);
      if (visual && visual !== eu.visual) pedir('perfil', { grupo, visual }).catch(() => {});
      pararConversa = () => clearTimeout(timer);
      async function atualizar() {
        try {
          if (!document.hidden && !ocupado) {
            const antes = envios;
            const d = await pedir('mensagens', { grupo });
            if (antes === envios) exibir(d);
          }
        } catch (e) {
          if (!ativa()) return;
          if (['grupo-acesso', 'grupo-ausente'].includes(e.message)) { await detalhes(grupo); return; }
          status.textContent = 'Reconectando às mensagens…';
        } finally { if (ativa()) timer = setTimeout(atualizar, 6000); }
      }
      await atualizar();
    }
    async function mostrarCodigo(grupo, chave) {
      const codigo = 'vl-grupo-' + grupo + '-' + chave;
      const campo = el('input', { value: codigo, readonly: true, class: 'vl-entrada', 'aria-label': 'Código de convite' });
      const conteudo = el('div', { class: 'vl-grupos' }, [campo, botao('Copiar código', async () => {
        if (await C.copiar(codigo)) C.aviso('Código copiado. Compartilhe em privado com o amigo convidado.');
        else { campo.focus(); campo.select(); }
      }, true)]);
      await C.dialogo({ titulo: 'Convite do grupo', texto: 'Passe este código em privado ao amigo convidado. Ele pode colar em Usar código de convite, na lista de conversas.', conteudo });
    }
    async function enviarConvite(amigo, convite) {
      const texto = 'vl-grupo-' + convite.grupo + '-' + convite.chave;
      let resultado;
      try { resultado = await VL.conexao?.enviar(VL.codigos.SAIDA.MENSAGEM_PRIVADA, [['i', Number(amigo)], ['s', texto]]); }
      catch (e) { /* O código continua disponível se o console falhar. */ }
      if (resultado?.ok) C.aviso('Convite encaminhado ao console. Se o cartão não aparecer na conversa do amigo, compartilhe o código.');
      await mostrarCodigo(convite.grupo, convite.chave);
    }
    function importarConvite() {
      const campo = el('input', { placeholder: 'Cole o código de convite', maxlength: 240, 'aria-label': 'Código de convite' });
      montar(botao('Voltar', listar), campo, botao('Ver convite', async () => {
        const c = G.lerConvite(campo.value.trim());
        if (!c || !c.chave) { C.aviso('Cole um código de convite válido.', { tipo: 'erro' }); return; }
        await verConvite(c);
      }, true));
      campo.focus();
    }
    async function detalhes(grupo) {
      const versao = ++geracao;
      montar(nota('Carregando o grupo…'));
      try {
        const g = await pedir('ver', { grupo });
        if (versao !== geracao || !caixa) return;
        const dono = g.dono === id();
        const naChamada = new Set(g.pessoas.map((p) => p.id));
        const membros = g.membros.map((p) => el('div', { class: 'vl-grupos-linha' }, [
          el('span', {}, [el('b', { texto: p.nome + (p.id === id() ? ' (você)' : '') }), el('small', { texto: !p.aceito ? 'Convite pendente' : naChamada.has(p.id) ? 'Na chamada' : 'Membro' })]),
          dono && p.id !== id() ? botao('Remover', async () => {
            if (!await C.confirmar('Remover ' + p.nome + ' do grupo?', { sim: 'Remover' })) return;
            await pedir('remover', { grupo, amigo: p.id }); await detalhes(grupo);
          }) : null,
          dono && p.id !== id() ? botao('Novo convite', async () => {
            if (!await C.confirmar('Gerar outro convite para ' + p.nome + '? O acesso anterior será substituído e ele precisará aceitar novamente.', { sim: 'Enviar novo convite' })) return;
            const r = await pedir('convidar', { grupo, amigo: p.id, nome: p.nome, renovar: true });
            await enviarConvite(p.id, r);
            await detalhes(grupo);
          }) : null,
        ]));
        const gerenciar = dono ? [botao('Convidar amigos', () => escolherAmigos(g)), botao('Renomear', async () => {
          const campo = el('input', { value: g.nome, maxlength: 40, 'aria-label': 'Novo nome do grupo', class: 'vl-entrada' });
          const ok = await C.dialogo({ titulo: 'Renomear grupo', conteudo: campo, botoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Salvar', valor: true, destaque: true }] });
          if (ok && G.nome(campo.value)) {
            const nome = G.nome(campo.value);
            await pedir('renomear', { grupo, nome });
            if (abertos.has(grupo)) abertos.set(grupo, nome);
            sincronizarAbas(); sincronizarAmigos(true); await detalhes(grupo);
          }
        })] : [];
        montar(botao('← Conversa', () => conversa(grupo)), el('h3', { texto: g.nome }), nota(g.membros.length + '/12 membros · ' + g.pessoas.length + ' na chamada'),
          el('div', { class: 'vl-grupos-lista' }, membros), ...gerenciar,
          botao(dono ? 'Excluir grupo' : 'Sair do grupo', async () => {
            if (!await C.confirmar(dono ? 'Excluir ' + g.nome + ' para todos? A chamada será encerrada.' : 'Sair de ' + g.nome + '? Você precisará de outro convite para voltar.', { sim: dono ? 'Excluir grupo' : 'Sair do grupo' })) return;
            await pedir(dono ? 'excluir' : 'sair', { grupo }); abertos.delete(grupo); grupoVisivel = null; sincronizarAbas(); sincronizarAmigos(true); await listar();
          }));
      } catch (e) {
        const nos = [botao('← Seus grupos', listar), nota(ERROS[e.message] || 'Não consegui abrir o grupo.'), botao('Tentar novamente', () => detalhes(grupo))];
        if (['grupo-ausente', 'grupo-acesso'].includes(e.message)) nos.push(botao('Remover da minha lista', async () => {
          await pedir('esquecer', { grupo }); abertos.delete(grupo); grupoVisivel = null; sincronizarAbas(); await listar();
          sincronizarAmigos(true);
        }));
        montar(...nos); erro(e);
      }
    }
    function escolherAmigos(g) {
      const amigos = (VL.amigos && VL.amigos.lista ? VL.amigos.lista() : []).filter((a) => String(a.id) !== id() && !g.membros.some((p) => p.id === String(a.id) && p.aceito));
      const busca = el('input', { placeholder: 'Buscar amigo', 'aria-label': 'Buscar amigo' });
      const lista = el('div', { class: 'vl-grupos-lista' });
      const desenhar = () => lista.replaceChildren(...amigos.filter((a) => a.nome.toLowerCase().includes(busca.value.toLowerCase())).map((a) => el('div', { class: 'vl-grupos-linha' }, [
        el('span', { texto: a.nome }), botao('Enviar convite', async () => {
          const d = await pedir('convidar', { grupo: g.grupo, amigo: String(a.id), nome: a.nome });
          await enviarConvite(a.id, d);
          await detalhes(g.grupo);
        }),
      ])));
      busca.addEventListener('input', desenhar);
      desenhar();
      montar(botao('← ' + g.nome, () => detalhes(g.grupo)), busca, lista,
        nota(amigos.length ? 'O código vale por 7 dias. Gerar outro substitui o anterior.' : 'Nenhum amigo disponível para convidar.'));
    }
    async function verConvite(c) {
      const g = await pedir('ver', { grupo: c.grupo, convite: c.chave });
      const nomeDono = (g.membros.find((p) => p.id === g.dono) || {}).nome || c.autor;
      montar(botao('← Seus grupos', listar), el('h3', { texto: g.nome }), nota('Grupo de ' + nomeDono + ' · ' + g.membros.length + '/12 membros'),
        nota('Aceitar salva este grupo na extensão. Seu microfone só liga quando você entrar na chamada.'),
        botao('Aceitar convite', async () => {
          await pedir('aceitar', { grupo: c.grupo, convite: c.chave });
          convites.delete(c.grupo);
          fecharAviso(c.grupo, 'Convite aceito');
          sincronizarAmigos(true);
          await conversa(c.grupo);
        }, true), botao('Recusar', async () => { await recusar(c); await listar(); }));
    }
    function fecharAviso(grupo, resultado) {
      const aviso = avisos.get(grupo);
      if (aviso && resultado) {
        aviso.cartao.replaceChildren(el('span', { texto: resultado }));
        resolvidos.set(aviso.codigo, resultado);
        if (resolvidos.size > 50) resolvidos.delete(resolvidos.keys().next().value);
      }
      if (!resultado) aviso?.cartao.remove();
      avisos.delete(grupo);
    }
    async function recusar(c) {
      await pedir('dispensar', { grupo: c.grupo });
      convites.delete(c.grupo);
      fecharAviso(c.grupo, 'Convite recusado');
    }
    function mostrarAviso(c, g) {
      const aviso = avisos.get(c.grupo);
      if (!aviso) return;
      aviso.cartao.replaceChildren(
        el('b', { texto: 'Convite para ' + g.nome }), el('span', { texto: c.autor + ' convidou você.' }),
        el('div', { class: 'vl-convite-acoes' }, [
        botao('Aceitar', async () => {
          await pedir('aceitar', { grupo: c.grupo, convite: c.chave });
          fecharAviso(c.grupo, 'Convite aceito');
          convites.delete(c.grupo);
          sincronizarAmigos(true);
          await abrirGrupo(c.grupo);
        }, true), botao('Recusar', () => recusar(c)),
        ])
      );
      atualizarConvitesNoConsole();
    }
    function atualizarConvitesNoConsole() {
      const mensagens = document.querySelectorAll('.nitro-friends-messenger:not(.vl-console-grupos) .message-bubble .ubuntu-custom-small.text-break');
      for (const texto of mensagens) {
        const codigo = texto.dataset.vlConviteCodigo || texto.textContent.trim();
        const c = G.lerConvite(codigo);
        if (!c?.chave || codigo !== 'vl-grupo-' + c.grupo + '-' + c.chave) continue;
        const resultado = resolvidos.get(codigo);
        if (resultado) {
          texto.classList.add('vl-convite-codigo'); texto.dataset.vlConviteCodigo = codigo;
          if (!texto.querySelector('.vl-convite-console')) texto.appendChild(el('span', { class: 'vl-convite-console', texto: resultado }));
          continue;
        }
        const aviso = avisos.get(c.grupo);
        if (aviso?.codigo === codigo) {
          texto.classList.add('vl-convite-codigo'); texto.dataset.vlConviteCodigo = codigo;
          if (!texto.contains(aviso.cartao)) texto.appendChild(aviso.cartao);
          continue;
        }
        const nome = texto.closest('.message-bubble')?.querySelector('.username')?.textContent?.trim().toLowerCase();
        if (!nome || nome === apelido().toLowerCase()) continue;
        const amigo = VL.amigos?.lista?.().find((a) => a.nome.toLowerCase() === nome);
        if (amigo) validarConvite(c, amigo);
      }
    }
    function validarConvite(c, amigo) {
      const codigo = 'vl-grupo-' + c.grupo + '-' + c.chave;
      if (tentados.has(codigo) || resolvidos.has(codigo)) return;
      tentados.add(codigo);
      if (tentados.size > 50) tentados.delete(tentados.values().next().value);
      const anterior = avisos.get(c.grupo);
      if (anterior && anterior.codigo !== codigo) {
        anterior.cartao.replaceChildren(el('span', { texto: 'Convite substituído' }));
        resolvidos.set(anterior.codigo, 'Convite substituído');
      }
      if (convites.size >= 50) convites.delete(convites.keys().next().value);
      convites.set(c.grupo, { ...c, autor: amigo.nome });
      const registro = convites.get(c.grupo);
      const cartao = el('article', { class: 'vl-convite-console', role: 'group', 'aria-label': 'Convite de grupo' }, [el('b', { texto: 'Convite de grupo' }), el('span', { texto: 'Verificando convite…' })]);
      avisos.set(c.grupo, { codigo, cartao });
      atualizarConvitesNoConsole();
      pedir('ver', { grupo: c.grupo, convite: c.chave }).then(async (g) => {
        if (parado || convites.get(c.grupo) !== registro) return;
        if (g.dono !== String(amigo.id) || g.membros.find((p) => p.id === id())?.aceito) { cartao.replaceChildren(el('span', { texto: 'Convite indisponível' })); return; }
        await pedir('receber', { grupo: c.grupo, convite: c.chave, de: String(amigo.id), autor: amigo.nome });
        if (!parado && convites.get(c.grupo) === registro) mostrarAviso(registro, g);
      }).catch(() => { if (convites.get(c.grupo) === registro) { convites.delete(c.grupo); cartao.replaceChildren(el('span', { texto: 'Convite indisponível' })); } });
    }
    function receber(d) {
      const c = G.lerConvite(d && d.texto);
      if (!c || !c.chave || !G.usuarioValido(d.de)) return false;
      const amigo = VL.amigos?.lista?.().find((a) => String(a.id) === String(d.de));
      if (amigo) validarConvite(c, amigo);
      return true;
    }
    function ocultarBaloesDeConvite() {
      document.querySelectorAll('.nitro-notification-bubble, .Toastify__toast').forEach((no) => {
        const c = G.lerConvite(no.textContent);
        if (c?.chave) no.remove();
      });
    }
    async function consultarNovidades() {
      if (parado || consultandoNovidades || !G.usuarioValido(id())) return;
      consultandoNovidades = true;
      try {
        const conta = id();
        if (contaNovidades !== conta) { marcas.clear(); naoLidos.clear(); contaNovidades = conta; cursorNovidades = 0; gruposConsultados = []; proximaLista = 0; atualizarAvisoRodape(); }
        if (Date.now() >= proximaLista) {
          const d = await pedir('listar');
          gruposConsultados = d.grupos;
          proximaLista = Date.now() + 15000;
        }
        if (conta !== id()) return;
        const grupos = gruposConsultados;
        const ids = new Set(grupos.map((g) => g.grupo));
        for (const grupo of marcas.keys()) if (!ids.has(grupo)) marcas.delete(grupo);
        for (const grupo of naoLidos.keys()) if (!ids.has(grupo)) naoLidos.delete(grupo);
        atualizarAvisoRodape();
        if (!grupos.length) return;
        // Uma busca a cada 2,5 s: resposta rápida para um grupo e até 24 buscas/minuto.
        const g = grupos[cursorNovidades % grupos.length];
        cursorNovidades = (cursorNovidades + 1) % grupos.length;
        if (g.grupo === grupoVisivel && caixa?.isConnected && pararConversa) return;
        try {
          const d = await pedir('mensagens', { grupo: g.grupo });
          if (conta === id() && ids.has(g.grupo)) registrarMensagens(g.grupo, g.nome, d.mensagens);
        } catch (_) { /* A próxima rodada tenta de novo após reconectar. */ }
      } catch (_) { /* A próxima rodada tenta de novo após reconectar. */ }
      finally { consultandoNovidades = false; }
    }
    let convitePendente = false;
    const observarConvites = new MutationObserver(() => {
      if (convitePendente || parado) return;
      convitePendente = true;
      setTimeout(() => { convitePendente = false; if (!parado) { ocultarBaloesDeConvite(); atualizarConvitesNoConsole(); atualizarAvisoRodape(); } }, 80);
    });
    if (document.body) observarConvites.observe(document.body, { childList: true, subtree: true, characterData: true });
    ctx.aoParar(() => observarConvites.disconnect());
    const relogioAmigos = setInterval(() => { if (!parado) sincronizarAmigos(); }, 15000);
    ctx.aoParar(() => clearInterval(relogioAmigos));
    const relogioNovidades = setInterval(consultarNovidades, 2500);
    const primeiraConsulta = setTimeout(consultarNovidades, 800);
    ctx.aoParar(() => { clearInterval(relogioNovidades); clearTimeout(primeiraConsulta); });
    ctx.comando({ nome: 'grupos', uso: 'grupos', descricao: 'Abre seus grupos salvos de voz.', executar() { abrir().catch(erro); } });
    ctx.aba({ id: 'grupos-voz', titulo: 'Grupos de voz', ordem: 38, montar(alvo) {
      alvo.replaceChildren(nota('Crie grupos com seus amigos do console e entre na chamada quando quiser.'), botao('Abrir grupos de voz', abrir, true));
    } });
    return { abrir: (consoleJogo) => abrir(consoleJogo).catch(erro), receber, sincronizarAmigos, sincronizarAbas };
  }
  VL.gruposVoz = { criar };
})(typeof globalThis !== 'undefined' ? globalThis : this);
