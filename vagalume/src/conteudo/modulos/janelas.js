// Vagalume — módulo "janelas": ajustes nas janelas do jogo.
// - Esc fecha a janela que está na frente.
// - Duplo clique na barra de título minimiza a janela (fica só a barra); outro duplo clique volta.
// - Animação curta ao abrir uma janela.
// - Lembra a largura e a altura da loja e do inventário (guardadas no storage.local, chave vl.tamanhos).
//   A loja tem `resize: both` (conferido ao vivo em 2026-11-13); o inventário não foi conferido.
// Estrutura conferida ao vivo em 2026-11-13: `.draggable-window > .nitro-card`, com
// `.nitro-card-header` (a barra que arrasta), `.menu` (abas) e `.content-area`.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo) return;
  const { nucleo, camada, jogo } = VL;
  const MINIMIZADA = 'data-vl-minimizada';
  const CSS_MINIMIZAR = '.nitro-card[' + MINIMIZADA + '] > :not(.nitro-card-header) { display: none !important; }\n' +
    '.nitro-card[' + MINIMIZADA + '] { height: auto !important; min-height: 0 !important; }';
  const CSS_ANIMAR = '@keyframes vl-abrir-janela { from { opacity: 0; transform: scale(.96); } to { opacity: 1; transform: none; } }\n' +
    '.draggable-window > .nitro-card { animation: vl-abrir-janela .14s ease-out; }\n' +
    '@media (prefers-reduced-motion: reduce) { .draggable-window > .nitro-card { animation: none; } }';

  const CHAVE = 'vl.tamanhos';
  const JANELAS = { loja: '.nitro-card.nitro-catalog', inventario: '.nitro-card.nitro-inventory' };
  const MIN = 200;
  const MAX = 3000;

  // Tamanho guardado só se for um par de inteiros dentro dos limites.
  function tamanhoValido(t) {
    return !!t && [t.w, t.h].every((n) => Number.isInteger(n) && n >= MIN && n <= MAX);
  }

  function lembrarTamanhos(ctx) {
    const armazem = raiz.chrome && chrome.storage && chrome.storage.local;
    if (!armazem || typeof ResizeObserver !== 'function' || typeof MutationObserver !== 'function') return;
    let guardados = {};
    let parado = false;
    let espera = null;
    const vistos = new WeakSet();
    armazem.get(CHAVE).then(function (r) {
      const t = r && r[CHAVE];
      if (t && typeof t === 'object') guardados = t;
      procurar();
    }).catch(function () {});

    const gravar = function () {
      clearTimeout(espera);
      espera = setTimeout(function () { if (!parado) armazem.set({ [CHAVE]: guardados }).catch(function () {}); }, 600);
    };
    const medidor = new ResizeObserver(function (entradas) {
      for (const e of entradas) {
        const no = e.target;
        const nome = no.getAttribute('data-vl-tamanho');
        if (!nome || no.hasAttribute(MINIMIZADA) || !no.isConnected) continue;
        const t = { w: Math.round(no.offsetWidth), h: Math.round(no.offsetHeight) };
        if (!tamanhoValido(t)) continue;
        const antes = guardados[nome];
        if (antes && antes.w === t.w && antes.h === t.h) continue;
        guardados[nome] = t;
        gravar();
      }
    });
    function procurar() {
      for (const nome of Object.keys(JANELAS)) {
        document.querySelectorAll(JANELAS[nome]).forEach(function (no) {
          if (vistos.has(no)) return;
          vistos.add(no);
          no.setAttribute('data-vl-tamanho', nome);
          const t = guardados[nome];
          if (tamanhoValido(t)) { no.style.width = t.w + 'px'; no.style.height = t.h + 'px'; }
          medidor.observe(no);
        });
      }
    }
    const vigia = new MutationObserver(procurar);
    vigia.observe(document.body || document.documentElement, { childList: true, subtree: true });
    ctx.aoParar(function () {
      parado = true;
      clearTimeout(espera);
      vigia.disconnect();
      medidor.disconnect();
      document.querySelectorAll('[data-vl-tamanho]').forEach((no) => no.removeAttribute('data-vl-tamanho'));
    });
  }

  // Outra extensão (a BANANA, visto ao vivo) pode fixar a altura da loja no próprio elemento, com
  // !important; por isso o minimizar também troca a altura no elemento e devolve a anterior depois.
  const ALTURA_ANTES = 'data-vl-altura-antes';
  // Categorias dos mobis do inventário: a busca textual continua sendo a do jogo.
  // Os filtros usam o arquivo de mobis do próprio Habblet para distinguir chão e parede.
  const FILTROS_INVENTARIO = [
    { id: 'wired', rotulo: 'Wired' }, { id: 'ltd', rotulo: 'LTD' },
    { id: 'parede', rotulo: 'Parede' }, { id: 'chao', rotulo: 'Chão' },
  ];
  const CSS_BUSCA = '.vl-busca-inv { display:flex; align-items:center; gap:4px; margin:4px 0 6px; width:100%; box-sizing:border-box; white-space:nowrap; } '
    + '.vl-busca-inv > button { flex:none; font-family:inherit; font-size:10px; font-weight:600; line-height:1.2; padding:3px 6px; border-radius:10px; border:1px solid rgba(127,127,127,.5); background:transparent; color:inherit; cursor:pointer; } '
    + '.vl-busca-inv > button:hover, .vl-busca-inv > button.ativo { border-color:#d6f24a; color:#d6f24a; } '
    + '.vl-busca-inv > .vl-limpar { margin-left:auto; } '
    + '.nitro-inventory .layout-grid-item.vl-inv-filtro-oculto { display:none!important; }';
  function campoDaBusca() {
    const inv = document.querySelector('.nitro-inventory');
    return inv ? inv.querySelector('input.form-control') : null;
  }
  function buscaDoInventario(ctx) {
    ctx.aoParar(camada.estiloPagina('janelas-busca', CSS_BUSCA));
    let filtroAtivo = '';
    let categorias = null;
    async function carregarCategorias() {
      if (categorias) return categorias;
      if (!VL.dadosJogo) throw new Error('Dados dos mobis indisponíveis');
      const dados = await VL.dadosJogo.mobis();
      const grupos = Object.fromEntries(FILTROS_INVENTARIO.map((f) => [f.id, new Set()]));
      function adicionar(ficha, onde) {
        const icone = VL.dadosJogo.iconeDe(ficha.classe);
        if (!icone) return;
        grupos[onde].add(icone);
        if (/^wf_/i.test(ficha.classe) || /wired/i.test(ficha.nome)) grupos.wired.add(icone);
        if (/(?:^|[_-])ltd(?:\d|[_-]|$)/i.test(ficha.classe) || /\bltd\b/i.test(ficha.nome)) grupos.ltd.add(icone);
      }
      for (const ficha of dados.chao.values()) adicionar(ficha, 'chao');
      for (const ficha of dados.parede.values()) adicionar(ficha, 'parede');
      categorias = grupos;
      return grupos;
    }
    function filtrarCartoes() {
      const inventario = document.querySelector('.nitro-inventory');
      if (!inventario) return;
      const abaMobis = [...inventario.querySelectorAll('div')].find((e) => !e.children.length && e.textContent.trim() === 'Mobis');
      const emMobis = !!abaMobis?.parentElement?.classList.contains('active');
      for (const cartao of inventario.querySelectorAll('.layout-grid-item')) {
        const url = /url\(["']?([^"')]+)/.exec(cartao.style.backgroundImage || '');
        cartao.classList.toggle('vl-inv-filtro-oculto', !!filtroAtivo && emMobis && (!url || !categorias?.[filtroAtivo]?.has(url[1])));
      }
    }
    function escrever(campo, termo) { jogo.definirValor(campo, termo); campo.focus(); marcar(); }
    function marcar() {
      const campo = campoDaBusca();
      const barra = document.querySelector('.vl-busca-inv');
      if (!campo || !barra) return;
      const v = String(campo.value || '').trim().toLowerCase();
      barra.querySelectorAll('button[data-filtro]').forEach((b) => {
        const ativo = b.dataset.filtro === filtroAtivo;
        b.classList.toggle('ativo', ativo);
        b.setAttribute('aria-pressed', String(ativo));
      });
      const limpar = barra.querySelector('.vl-limpar');
      if (limpar) limpar.hidden = !v && !filtroAtivo;
      filtrarCartoes();
    }
    function cuidar() {
      filtrarCartoes();
      const campo = campoDaBusca();
      if (!campo) return;
      const linha = campo.parentElement;
      if (!linha || !linha.parentElement) return;
      if (linha.parentElement.querySelector('.vl-busca-inv')) { marcar(); return; }
      const barra = document.createElement('div');
      barra.className = 'vl-busca-inv';
      for (const a of FILTROS_INVENTARIO) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = a.rotulo;
        b.dataset.filtro = a.id;
        b.setAttribute('aria-pressed', 'false');
        b.title = 'Mostrar ' + (a.id === 'chao' ? 'mobis de chão' : a.id === 'parede' ? 'mobis de parede' : a.rotulo) + ' no inventário — Vagalume';
        b.addEventListener('click', async function (ev) {
          ev.stopPropagation();
          if (filtroAtivo === a.id) { filtroAtivo = ''; marcar(); return; }
          try { await carregarCategorias(); filtroAtivo = a.id; marcar(); }
          catch (erro) { camada.aviso('Não consegui carregar os tipos de mobis para filtrar.', { tipo: 'erro' }); }
        });
        barra.appendChild(b);
      }
      const limpar = document.createElement('button');
      limpar.type = 'button';
      limpar.className = 'vl-limpar';
      limpar.textContent = 'Limpar';
      limpar.title = 'Limpar busca e filtro — Vagalume';
      limpar.addEventListener('click', function (ev) { ev.stopPropagation(); filtroAtivo = ''; const c = campoDaBusca(); if (c) escrever(c, ''); });
      barra.appendChild(limpar);
      linha.after(barra);
      campo.addEventListener('input', marcar);
      marcar();
    }
    let pendente = false;
    const observador = new MutationObserver(function () {
      if (pendente) return;
      pendente = true;
      setTimeout(function () { pendente = false; cuidar(); }, 200);
    });
    observador.observe(document.body, { childList: true, subtree: true });
    cuidar();
    ctx.aoParar(function () { observador.disconnect(); document.querySelectorAll('.vl-busca-inv').forEach((e) => e.remove()); document.querySelectorAll('.vl-inv-filtro-oculto').forEach((e) => e.classList.remove('vl-inv-filtro-oculto')); });
    // Ctrl+F com o inventário aberto vai para a busca dele (fora de um campo de texto).
    ctx.escutar(window, 'keydown', function (ev) {
      if (!ev.isTrusted || !ev.ctrlKey || ev.altKey || ev.shiftKey || ev.metaKey || String(ev.key).toLowerCase() !== 'f') return;
      const campo = campoDaBusca();
      if (!campo || jogo.campoOcupado(ev.target) || camada.contem(ev)) return;
      ev.preventDefault();
      ev.stopPropagation();
      campo.focus();
      campo.select();
    }, true);
  }

  // Ocultar quartos no navegador (como os de "Meus Quartos"): um "×" ao passar o mouse esconde o quarto
  // pelo nome; a linha "N ocultos · mostrar" acima da lista mostra de novo e permite desfazer. A lista
  // fica neste navegador (localStorage do Habblet). Estrutura conferida ao vivo em 2026-11-14:
  // `.nitro-navigator .navigator-grid > .navigator-item`, nome em `.text-truncate`.
  const CHAVE_OCULTOS = 'vl.quartosOcultos';
  const MAX_OCULTOS = 200;
  const CSS_QUARTOS = '.nitro-navigator .navigator-item { position: relative; } ' +
    '.vl-ocultar-quarto { position: absolute; top: 2px; right: 2px; z-index: 3; display: none; width: 16px; height: 16px; padding: 0; border: 0; border-radius: 50%; background: #12161f; color: #d6f24a; font: 700 11px/16px sans-serif; text-align: center; cursor: pointer; } ' +
    '.nitro-navigator .navigator-item:hover > .vl-ocultar-quarto { display: block; } ' +
    '.nitro-navigator:not([data-vl-mostrar-ocultos]) [data-vl-quarto-oculto] { display: none !important; } ' +
    '.nitro-navigator[data-vl-mostrar-ocultos] [data-vl-quarto-oculto] { opacity: .45; } ' +
    '.vl-ocultos-linha { display: flex; gap: 6px; align-items: center; font-size: 11px; padding: 2px 4px; opacity: .85; } .vl-ocultos-linha > button { border: 0; background: none; color: inherit; text-decoration: underline; cursor: pointer; font: inherit; padding: 0; }';
  function lerOcultos() {
    try { const v = JSON.parse(localStorage.getItem(CHAVE_OCULTOS) || '[]'); return Array.isArray(v) ? v.filter((n) => typeof n === 'string').slice(0, MAX_OCULTOS) : []; } catch (erro) { return []; }
  }
  function gravarOcultos(lista) { try { localStorage.setItem(CHAVE_OCULTOS, JSON.stringify(lista.slice(-MAX_OCULTOS))); } catch (erro) { /* sem armazenamento */ } }
  function ocultarQuartos(ctx) {
    ctx.aoParar(camada.estiloPagina('janelas-quartos', CSS_QUARTOS));
    let ocultos = new Set(lerOcultos());
    function nomeDo(item) { const n = item.querySelector('.text-truncate'); return n ? n.textContent.trim() : ''; }
    function alternar(nome) {
      if (ocultos.has(nome)) ocultos.delete(nome); else ocultos.add(nome);
      gravarOcultos([...ocultos]);
      cuidar();
    }
    function cuidar() {
      const nav = document.querySelector('.nitro-navigator');
      if (!nav) return;
      const mostrando = nav.hasAttribute('data-vl-mostrar-ocultos');
      nav.querySelectorAll('.navigator-grid').forEach(function (grade) {
        let quantos = 0;
        grade.querySelectorAll(':scope > .navigator-item').forEach(function (item) {
          const nome = nomeDo(item);
          if (!nome) return;
          const oculto = ocultos.has(nome);
          if (oculto) { quantos++; item.setAttribute('data-vl-quarto-oculto', ''); } else item.removeAttribute('data-vl-quarto-oculto');
          let b = item.querySelector(':scope > .vl-ocultar-quarto');
          if (!b) {
            b = document.createElement('button');
            b.type = 'button';
            b.className = 'vl-ocultar-quarto';
            b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); alternar(nomeDo(item)); });
            b.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
            item.appendChild(b);
          }
          const sinal = oculto ? '↺' : '×';
          if (b.textContent !== sinal) b.textContent = sinal; // sem mudar o DOM à toa (o observador olha a página)
          b.title = (oculto ? 'Voltar a mostrar este quarto' : 'Ocultar este quarto da lista') + ' — Vagalume';
        });
        let linha = grade.previousElementSibling && grade.previousElementSibling.classList.contains('vl-ocultos-linha') ? grade.previousElementSibling : null;
        if (!quantos) { if (linha) linha.remove(); return; }
        if (!linha) {
          linha = document.createElement('div');
          linha.className = 'vl-ocultos-linha';
          const texto = document.createElement('span');
          const botao = document.createElement('button');
          botao.type = 'button';
          botao.addEventListener('click', function (ev) {
            ev.stopPropagation();
            const n = document.querySelector('.nitro-navigator');
            if (!n) return;
            if (n.hasAttribute('data-vl-mostrar-ocultos')) n.removeAttribute('data-vl-mostrar-ocultos'); else n.setAttribute('data-vl-mostrar-ocultos', '');
            cuidar();
          });
          linha.append(texto, botao);
          grade.before(linha);
        }
        const t1 = quantos + (quantos === 1 ? ' quarto oculto' : ' quartos ocultos') + ' ·';
        const t2 = mostrando ? 'esconder de novo' : 'mostrar';
        if (linha.firstChild.textContent !== t1) linha.firstChild.textContent = t1;
        if (linha.lastChild.textContent !== t2) linha.lastChild.textContent = t2;
      });
    }
    let pendente = false;
    const observador = new MutationObserver(function () {
      if (pendente) return;
      pendente = true;
      setTimeout(function () { pendente = false; cuidar(); }, 200);
    });
    observador.observe(document.body, { childList: true, subtree: true });
    cuidar();
    ctx.aoParar(function () {
      observador.disconnect();
      document.querySelectorAll('.vl-ocultar-quarto, .vl-ocultos-linha').forEach((e) => e.remove());
      document.querySelectorAll('[data-vl-quarto-oculto]').forEach((e) => e.removeAttribute('data-vl-quarto-oculto'));
    });
  }

  // Nome do mobi no inventário: o jogo o corta com reticências. Passar o mouse mostra inteiro e o clique
  // copia. Elemento conferido ao vivo em 2026-11-14: o SELETOR_NOME_INV abaixo, na coluna da prévia.
  const SELETOR_NOME_INV = '.nitro-inventory .flex-column > .text-truncate.text-black';
  function nomeNoInventario(ctx) {
    ctx.aoParar(camada.estiloPagina('janelas-nome-inv', SELETOR_NOME_INV + ' { cursor: copy; } ' + SELETOR_NOME_INV + ':hover { white-space: normal; overflow: visible; }'));
    ctx.escutar(window, 'click', function (ev) {
      const alvo = ev.target && typeof ev.target.closest === 'function' ? ev.target.closest(SELETOR_NOME_INV) : null;
      if (!alvo) return;
      const nome = alvo.textContent.trim();
      if (!nome) return;
      camada.copiar(nome).then(function (ok) { camada.aviso(ok ? 'Nome copiado: ' + nome : 'Não deu para copiar.'); });
    }, true);
  }

  function minimizar(janela) {
    const s = janela.style;
    janela.setAttribute(ALTURA_ANTES, JSON.stringify([s.getPropertyValue('height'), s.getPropertyPriority('height'), s.getPropertyValue('min-height'), s.getPropertyPriority('min-height')]));
    s.setProperty('height', 'auto', 'important');
    s.setProperty('min-height', '0', 'important');
    janela.setAttribute(MINIMIZADA, '');
  }
  function restaurar(janela) {
    janela.removeAttribute(MINIMIZADA);
    let antes = null;
    try { antes = JSON.parse(janela.getAttribute(ALTURA_ANTES) || 'null'); } catch (erro) { antes = null; }
    janela.removeAttribute(ALTURA_ANTES);
    const s = janela.style;
    if (antes && antes[0]) s.setProperty('height', antes[0], antes[1]); else s.removeProperty('height');
    if (antes && antes[2]) s.setProperty('min-height', antes[2], antes[3]); else s.removeProperty('min-height');
  }

  nucleo.definirModulo({
    id: 'janelas',
    // Sem aoConfig: o núcleo reinicia o módulo quando as opções dele mudam.
    iniciar(ctx) {
      const opcoes = ctx.secao();

      ctx.escutar(window, 'keydown', function (ev) {
        if (ev.key !== 'Escape' || !ev.isTrusted || ev.isComposing || ev.repeat) return;
        if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.shiftKey) return;
        if (!opcoes.escFecha) return;
        if (camada.contem(ev) || camada.temDialogo()) return; // o Esc é do próprio Vagalume
        const alvo = ev.target;
        if (alvo && alvo.nodeType === 1 && (alvo.isContentEditable || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT')) return;
        if (jogo.fecharJanela(jogo.janelaDaFrente())) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      }, true);

      if (opcoes.minimizar) {
        const remover = camada.estiloPagina('janelas-minimizar', CSS_MINIMIZAR);
        ctx.escutar(window, 'dblclick', function (ev) {
          const alvo = ev.target;
          if (!alvo || typeof alvo.closest !== 'function') return;
          const barra = alvo.closest('.nitro-card-header');
          if (!barra || alvo.closest('.nitro-card-header-close')) return;
          const janela = barra.closest('.nitro-card');
          if (!janela) return;
          if (janela.hasAttribute(MINIMIZADA)) restaurar(janela);
          else minimizar(janela);
        }, true);
        ctx.aoParar(function () {
          remover();
          document.querySelectorAll('[' + MINIMIZADA + ']').forEach(restaurar);
        });
      }

      if (opcoes.animar) ctx.aoParar(camada.estiloPagina('janelas-animar', CSS_ANIMAR));
      if (opcoes.lembrarTamanho) lembrarTamanhos(ctx);
      if (opcoes.buscaInventario && document.body) buscaDoInventario(ctx);
      if (opcoes.ocultarQuartos && document.body) ocultarQuartos(ctx);
      if (opcoes.nomeInventario) nomeNoInventario(ctx);
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
