// Vagalume — módulo "chat": atalhos nos balões de fala. Um botão ao lado do balão copia o texto; os links da fala
// ficam azuis e abrem numa aba nova com um clique (pedido do usuário em 2026-11-14, no lugar do
// Ctrl+clique com confirmação; o Alt+Shift+clique que copiava o apelido saiu, também a pedido).
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo || !VL.texto) return;
  const { nucleo, camada, jogo, texto } = VL;
  const MARCA_LINK = 'data-vl-link-fala';
  const CSS_LINKS = '[' + MARCA_LINK + '] { color: #1f6feb !important; text-decoration: underline !important; cursor: pointer !important; pointer-events: auto !important; }'
    + '[' + MARCA_LINK + ']:hover { color: #0b4fc4 !important; }';

  nucleo.definirModulo({
    id: 'chat',
    iniciar(ctx) {
      ctx.aoConfig(function () {}); // as opções são lidas a cada fala e a cada clique

      // Links das falas: só http, https e "www." (que vira https); cada um vira um trecho azul.
      const tirarCss = camada.estiloPagina('chat-links', CSS_LINKS);
      ctx.aoParar(tirarCss);
      function marcarLinks(fala) {
        if (!ctx.secao().linksClicaveis || !fala || !fala.el) return;
        jogo.marcarTrechos(fala.el, texto.trechosDeLink, function (trecho, visivel) {
          const a = document.createElement('span');
          a.setAttribute(MARCA_LINK, trecho.url);
          a.title = trecho.url;
          a.textContent = visivel;
          return a;
        });
      }
      ctx.aoParar(jogo.observarFalas(marcarLinks));

      // Arrastar balões (2026-11-20, pedido do usuário): segurar e arrastar uma fala a leva para outro
      // lugar; ela continua subindo com as outras, só deslocada. Duplo clique devolve ao lugar.
      // O jogo posiciona cada balão por style.top/left (lido no cliente); o deslocamento vai no
      // transform, que o jogo não usa (o zoom usa a propriedade translate, que soma com ele).
      const SEL_BALAO = '.nitro-chat-widget .bubble-container';
      const tirarCssArraste = camada.estiloPagina('chat-arrastar', ''
        + 'html[data-vl-arrastar-baloes] ' + SEL_BALAO + ' { cursor: grab; }'
        + ' ' + SEL_BALAO + '.vl-arrastando { cursor: grabbing !important; z-index: 50; user-select: none; }'
        + ' html.vl-arrastando-balao, html.vl-arrastando-balao * { user-select: none !important; cursor: grabbing !important; }');
      ctx.aoParar(tirarCssArraste);
      const raizHtml = document.documentElement;
      function marcarArraste() {
        if (!raizHtml || typeof raizHtml.setAttribute !== 'function') return;
        if (ctx.secao().arrastarBaloes) raizHtml.setAttribute('data-vl-arrastar-baloes', '');
        else raizHtml.removeAttribute('data-vl-arrastar-baloes');
      }
      marcarArraste();
      ctx.aoConfig(function (secao) { if (secao === 'chat') marcarArraste(); });
      let arraste = null;
      let engolirClique = false;
      function deslocar(el, x, y) {
        el.dataset.vlArrX = String(Math.round(x));
        el.dataset.vlArrY = String(Math.round(y));
        el.style.transform = x || y ? 'translate(' + Math.round(x) + 'px, ' + Math.round(y) + 'px)' : '';
      }
      ctx.escutar(window, 'pointerdown', function (ev) {
        if (!ev.isTrusted || ev.button !== 0 || !ctx.secao().arrastarBaloes || camada.contem(ev)) return;
        const alvo = ev.target && ev.target.closest ? ev.target.closest(SEL_BALAO) : null;
        if (!alvo || ev.target.closest('.vl-acoes-fala, [' + MARCA_LINK + '], .vl-citacao, [data-vl-arroba]')) return;
        arraste = { el: alvo, x: ev.clientX, y: ev.clientY, dx: Number(alvo.dataset.vlArrX) || 0, dy: Number(alvo.dataset.vlArrY) || 0, movendo: false };
      }, true);
      ctx.escutar(window, 'pointermove', function (ev) {
        if (!arraste) return;
        const mx = ev.clientX - arraste.x;
        const my = ev.clientY - arraste.y;
        if (!arraste.movendo) {
          if (Math.hypot(mx, my) < 4) return; // clique comum: o jogo seleciona quem falou
          arraste.movendo = true;
          arraste.el.classList.add('vl-arrastando');
          if (raizHtml && raizHtml.classList) raizHtml.classList.add('vl-arrastando-balao');
          try { window.getSelection().removeAllRanges(); } catch (e) { /* sem seleção */ }
        }
        ev.preventDefault();
        if (!arraste.el.isConnected) { soltar(); return; } // o balão sumiu no meio do arraste
        deslocar(arraste.el, arraste.dx + mx, arraste.dy + my);
      }, true);
      function soltar() {
        if (!arraste) return;
        if (arraste.movendo) {
          arraste.el.classList.remove('vl-arrastando');
          if (raizHtml && raizHtml.classList) raizHtml.classList.remove('vl-arrastando-balao');
          engolirClique = true; // o clique que vem depois do arraste não seleciona a pessoa
          setTimeout(function () { engolirClique = false; }, 80);
        }
        arraste = null;
      }
      ctx.escutar(window, 'pointerup', soltar, true);
      ctx.escutar(window, 'pointercancel', soltar, true);
      ctx.escutar(window, 'click', function (ev) {
        if (!engolirClique) return;
        engolirClique = false;
        ev.preventDefault();
        ev.stopPropagation();
      }, true);
      ctx.escutar(window, 'dblclick', function (ev) {
        if (!ctx.secao().arrastarBaloes) return;
        const alvo = ev.target && ev.target.closest ? ev.target.closest(SEL_BALAO) : null;
        if (!alvo || !alvo.dataset.vlArrX) return;
        deslocar(alvo, 0, 0);
        delete alvo.dataset.vlArrX;
        delete alvo.dataset.vlArrY;
      }, true);
      ctx.aoParar(function () {
        soltar();
        if (raizHtml && raizHtml.removeAttribute) raizHtml.removeAttribute('data-vl-arrastar-baloes');
        document.querySelectorAll(SEL_BALAO + '[data-vl-arr-x]').forEach(function (el) { deslocar(el, 0, 0); delete el.dataset.vlArrX; delete el.dataset.vlArrY; });
      });

      ctx.escutar(window, 'click', function (ev) {
        if (!ev.isTrusted || ev.button !== 0 || camada.contem(ev)) return;
        const opcoes = ctx.secao();
        const link = ev.target && ev.target.closest ? ev.target.closest('[' + MARCA_LINK + ']') : null;
        if (link && opcoes.linksClicaveis && !ev.altKey) {
          const url = texto.linkSeguro(link.getAttribute(MARCA_LINK));
          ev.preventDefault();
          ev.stopPropagation();
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
          return;
        }
        // Botão de copiar ao lado do balão (no lugar do Alt+clique, pedido do usuário em 2026-11-15).
        const copiar = ev.target && ev.target.closest ? ev.target.closest('.vl-copiar-fala') : null;
        if (!copiar) return;
        const balao = jogo.balaoDe(copiar);
        const fala = balao && jogo.lerFala(balao);
        if (!fala) return;
        ev.preventDefault();
        ev.stopPropagation();
        camada.copiar(fala.texto).then(function (ok) {
          camada.aviso(ok ? 'Fala copiada.' : 'Não foi possível copiar a fala.', { tipo: ok ? 'ok' : 'erro' });
        });
      }, true);
      const NS = 'http://www.w3.org/2000/svg';
      // Os botões ficam numa fileira à direita do balão (copiar e responder).
      function fileiraDe(el) {
        let f = el.querySelector(':scope > .vl-acoes-fala');
        if (!f) { f = document.createElement('span'); f.className = 'vl-acoes-fala'; el.appendChild(f); }
        return f;
      }
      function botaoResponder(fala) {
        if (!ctx.secao().botaoResponder || !fala || !fala.el || !fala.autor || typeof document.createElement !== 'function' || !fala.el.querySelector || fala.el.querySelector('.vl-responder-fala')) return;
        const b = document.createElement('span');
        b.className = 'vl-responder-fala';
        b.title = 'Responder a ' + fala.autor;
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('width', '13');
        svg.setAttribute('height', '13');
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', 'M6.5 3.5 2.5 7.5l4 4M3 7.5h6.5c2.5 0 4 1.6 4 4v1');
        p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.7');
        p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(p);
        b.appendChild(svg);
        fileiraDe(fala.el).prepend(b);
      }
      ctx.aoParar(jogo.observarFalas(botaoResponder));
      function botaoCopiar(fala) {
        if (!ctx.secao().botaoCopiar || !fala || !fala.el || typeof document.createElement !== 'function' || !fala.el.querySelector || fala.el.querySelector('.vl-copiar-fala')) return;
        // Fala com áudio, imagem ou GIF do Vagalume: não há texto para copiar.
        if (VL.servidor && VL.servidor.ler(fala.texto)) return;
        const b = document.createElement('span');
        b.className = 'vl-copiar-fala';
        b.title = 'Copiar a fala';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('width', '13');
        svg.setAttribute('height', '13');
        for (const [x, y] of [[5, 5], [2, 2]]) {
          const r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', '9'); r.setAttribute('height', '9'); r.setAttribute('rx', '1.5');
          r.setAttribute('fill', x === 5 ? 'currentColor' : 'none'); r.setAttribute('fill-opacity', '.25'); r.setAttribute('stroke', 'currentColor'); r.setAttribute('stroke-width', '1.5');
          svg.appendChild(r);
        }
        b.appendChild(svg);
        fileiraDe(fala.el).appendChild(b);
      }
      ctx.aoParar(jogo.observarFalas(botaoCopiar));

      // Copiar mensagens do console (bate-papo com amigos e grupos; pedido do usuário em 2026-11-20).
      // Cada mensagem é uma linha .text-break dentro do .message-bubble; o botão aparece ao passar
      // o mouse na linha, dentro do balão (o lado de fora é cortado pela rolagem do console).
      const SELETOR_CONSOLE = '.nitro-friends-messenger .message-bubble .text-break';
      function iconeCopiar() {
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('width', '11');
        svg.setAttribute('height', '11');
        for (const [x, y] of [[5, 5], [2, 2]]) {
          const r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', '9'); r.setAttribute('height', '9'); r.setAttribute('rx', '1.5');
          r.setAttribute('fill', x === 5 ? 'currentColor' : 'none'); r.setAttribute('fill-opacity', '.25'); r.setAttribute('stroke', 'currentColor'); r.setAttribute('stroke-width', '1.5');
          svg.appendChild(r);
        }
        return svg;
      }
      function marcarConsole() {
        if (!ctx.secao().botaoCopiar) return;
        document.querySelectorAll(SELETOR_CONSOLE + ':not([data-vl-copiavel])').forEach(function (linha) {
          if (!linha.textContent.trim()) return;
          linha.setAttribute('data-vl-copiavel', '');
          const b = document.createElement('span');
          b.className = 'vl-copiar-console';
          b.title = 'Copiar a mensagem';
          b.appendChild(iconeCopiar());
          linha.appendChild(b);
        });
      }
      let pedidoConsole = 0;
      const observadorConsole = typeof MutationObserver === 'function' && typeof requestAnimationFrame === 'function' && document.querySelectorAll ? new MutationObserver(function () {
        if (pedidoConsole) return;
        pedidoConsole = requestAnimationFrame(function () { pedidoConsole = 0; marcarConsole(); });
      }) : null;
      if (observadorConsole && document.body) observadorConsole.observe(document.body, { childList: true, subtree: true });
      if (observadorConsole) marcarConsole();
      ctx.aoParar(function () {
        if (observadorConsole) observadorConsole.disconnect();
        if (pedidoConsole) cancelAnimationFrame(pedidoConsole);
        if (!document.querySelectorAll) return;
        document.querySelectorAll('.vl-copiar-console').forEach((e) => e.remove());
        document.querySelectorAll('[data-vl-copiavel]').forEach((e) => e.removeAttribute('data-vl-copiavel'));
      });
      ctx.escutar(window, 'click', function (ev) {
        if (!ev.isTrusted || ev.button !== 0) return;
        const b = ev.target && ev.target.closest ? ev.target.closest('.vl-copiar-console') : null;
        if (!b) return;
        const linha = b.parentElement;
        ev.preventDefault();
        ev.stopPropagation();
        // O texto da linha sem o próprio botão.
        let texto = '';
        for (const no of linha.childNodes) if (no !== b) texto += no.textContent;
        texto = texto.trim();
        if (!texto) return;
        camada.copiar(texto).then(function (ok) {
          camada.aviso(ok ? 'Mensagem copiada.' : 'Não foi possível copiar a mensagem.', { tipo: ok ? 'ok' : 'erro' });
        });
      }, true);
      ctx.aoParar(camada.estiloPagina('chat-copiar-console', ''
        + ' [data-vl-copiavel] { position: relative; padding-right: 20px; }'
        + ' .vl-copiar-console { position: absolute; top: 50%; right: 0; transform: translateY(-50%); width: 16px; height: 16px; display: grid; place-items: center;'
        + ' border-radius: 4px; background: #1b2230; border: 1px solid #36435c; color: #d6f24a; cursor: pointer; opacity: 0; transition: opacity .12s; }'
        + ' [data-vl-copiavel]:hover > .vl-copiar-console { opacity: 1; }'
        + ' .vl-copiar-console:hover { border-color: #d6f24a; background: #263042; }'));
      // Sem mexer na posição do .bubble-container: o jogo posiciona cada balão de forma absoluta e um
      // "position: relative" desmontava os balões (vídeo do usuário em 2026-11-15).
      ctx.aoParar(camada.estiloPagina('chat-copiar', ''
        + ' .vl-acoes-fala { position: absolute; top: 50%; left: 100%; margin-left: 4px; transform: translateY(-50%); display: flex; gap: 3px; pointer-events: auto; opacity: 0; transition: opacity .12s; }'
        + ' .bubble-container:hover .vl-acoes-fala { opacity: 1; }'
        + ' .vl-copiar-fala, .vl-responder-fala { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 5px;'
        + ' background: #1b2230; border: 1px solid #36435c; color: #d6f24a; cursor: pointer; }'
        + ' .vl-copiar-fala:hover, .vl-responder-fala:hover { border-color: #d6f24a; background: #263042; }'
        // Citação como uma aba que sai do alto do balão, à direita, como parte dele (desenho do
        // usuário em 2026-11-20). A aba copia o visual do próprio balão (cor, borda, cantos) na hora,
        // sem a borda de baixo, e cobre a borda de cima do balão: as duas formas viram uma só.
        // Dentro, uma pílula um pouco mais escura com a barra verde, a seta, o apelido e a frase.
        + ' .vl-citacao { position: absolute; z-index: 1; display: flex; justify-content: flex-end; align-items: flex-start; box-sizing: border-box;'
        + ' padding: 4px 3px 4px 6px; overflow: visible; pointer-events: none; }'
        + ' .vl-citacao::before, .vl-citacao::after { display: none !important; }'
        // A faixa escurece a cor do próprio balão (no balão branco fica cinza-claro, no cinza fica cinza).
        + ' .vl-citacao-pilula { display: flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%; box-sizing: border-box; padding: 1px 6px 1px 4px;'
        + ' border-radius: 3px; background: rgba(0, 0, 0, .13) !important; font-size: 11px; line-height: 14px; white-space: nowrap; }'
        + ' .vl-citacao-pilula::before { content: ""; flex: none; align-self: stretch; width: 2px; border-radius: 2px; background: #7fa312 !important; }'
        + ' .vl-citacao-pilula svg { flex: none; opacity: .7; }'
        + ' .vl-citacao-pilula b { flex: none; font-weight: 700 !important; opacity: .8; }'
        + ' .vl-citacao-texto { min-width: 0; overflow: hidden; text-overflow: ellipsis; opacity: .6; }'
        + ' .vl-resposta-oculto { display: none !important; }'
        + ' .vl-respondendo { position: fixed; z-index: 2147483000; display: flex; align-items: center; gap: 7px; box-sizing: border-box; padding: 5px 6px 5px 9px; border: 1px solid rgba(214, 242, 74, .45);'
        + ' border-left: 3px solid #d6f24a; border-radius: 7px; background: rgba(21, 26, 36, .96); color: #e6eaf1; font: 12px/1.3 system-ui, sans-serif; box-shadow: 0 6px 18px rgba(0, 0, 0, .45); }'
        + ' .vl-respondendo-texto { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }'
        + ' .vl-respondendo-texto b { color: #d6f24a; }'
        + ' .vl-respondendo button { flex: none; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #9aa4b5; font: 700 14px/1 system-ui, sans-serif; cursor: pointer; }'
        + ' .vl-respondendo button:hover { background: #263042; color: #fff; }'));
      ctx.aoParar(function () { document.querySelectorAll('.vl-acoes-fala, .vl-citacao').forEach((e) => e.remove()); });

      // ---------- Responder a uma fala (2026-11-19, pedido do usuário) ----------
      // O botão ↩ do balão marca a fala; uma barra acima do campo de chat mostra a quem você está
      // respondendo (Esc ou × cancela). Ao apertar Enter, sai no chat "@apelido mensagem" (é o que
      // quem não usa o Vagalume vê) e os Vagalumes do quarto recebem, pelo servidor de presença, qual
      // fala foi respondida; o balão delas ganha a citação em cima.
      const R = VL.respostas;
      let resposta = null; // { autor, texto }
      let barra = null;
      let posicionador = 0;
      function fecharBarra() {
        resposta = null;
        if (barra) barra.remove();
        barra = null;
        clearInterval(posicionador);
        posicionador = 0;
      }
      function posicionarBarra() {
        const campo = jogo.entradaChat();
        if (!barra || !campo) return;
        const caixa = (campo.closest('.chatinput-container') || campo).getBoundingClientRect();
        if (!caixa.width) return;
        barra.style.left = Math.round(caixa.left) + 'px';
        barra.style.width = Math.round(Math.max(caixa.width, 220)) + 'px';
        barra.style.top = Math.round(caixa.top - barra.offsetHeight - 6) + 'px';
      }
      function textoDaFala(fala) {
        const midia = VL.servidor && VL.servidor.ler(fala.texto);
        if (midia) return midia.tipo === 'a' ? '🎤 áudio' : midia.tipo === 'g' ? '🎬 GIF' : '📷 imagem';
        // Respondendo a uma resposta: o "@apelido" escondido do começo não entra na citação.
        const oculto = fala.el.querySelector && fala.el.querySelector('.vl-resposta-oculto');
        const texto = oculto ? String(fala.texto || '').replace(/^\s*@\S+\s*/, '') : fala.texto;
        return R.limpar(texto, R.MAX_CITADO);
      }
      function abrirResposta(fala) {
        const campo = jogo.entradaChat();
        if (!campo) { camada.aviso('Entre num quarto para responder.', { tipo: 'erro' }); return; }
        fecharBarra();
        resposta = { autor: fala.autor, texto: textoDaFala(fala) };
        barra = document.createElement('div');
        barra.className = 'vl-respondendo';
        const texto = document.createElement('span');
        texto.className = 'vl-respondendo-texto';
        const quem = document.createElement('b');
        quem.textContent = fala.autor;
        texto.append('↩ Respondendo a ', quem, ': ' + resposta.texto);
        texto.title = fala.autor + ': ' + resposta.texto;
        const fechar = document.createElement('button');
        fechar.type = 'button';
        fechar.textContent = '×';
        fechar.title = 'Cancelar a resposta (Esc)';
        fechar.addEventListener('click', function () { fecharBarra(); campo.focus(); });
        barra.append(texto, fechar);
        document.body.appendChild(barra);
        posicionarBarra();
        posicionador = setInterval(posicionarBarra, 300);
        campo.focus();
      }
      ctx.aoParar(fecharBarra);
      ctx.escutar(window, 'click', function (ev) {
        if (!ev.isTrusted || ev.button !== 0) return;
        const botao = ev.target && ev.target.closest ? ev.target.closest('.vl-responder-fala') : null;
        if (!botao) return;
        const balao = jogo.balaoDe(botao);
        const fala = balao && jogo.lerFala(balao);
        if (!fala || !fala.autor) return;
        ev.preventDefault();
        ev.stopPropagation();
        abrirResposta(fala);
      }, true);
      // Enter no campo com uma resposta marcada: manda "@apelido mensagem" e avisa os Vagalumes.
      ctx.escutar(window, 'keydown', function (ev) {
        if (!resposta || !ev.isTrusted || !jogo.ehEntradaChat(ev.target)) return;
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); fecharBarra(); return; }
        if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing) return;
        const campo = ev.target;
        const valor = String(campo.value || '').trim();
        if (!valor || /^[:/]/.test(valor)) return; // comandos seguem o caminho normal
        const final = R.textoDaResposta(resposta.autor, valor);
        if (!final) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const dado = R.dado(final, resposta.autor, resposta.texto);
        const eu = VL.pessoas && VL.pessoas.eu ? String(VL.pessoas.eu() || '') : '';
        if (dado && eu) esperar({ autor: eu, texto: final, citadoAutor: dado.citado.a, citado: dado.citado.x });
        if (dado && VL.comunidade && VL.comunidade.acao) VL.comunidade.acao(dado);
        fecharBarra();
        jogo.definirValor(campo, '');
        // Um instante para o aviso chegar às outros Vagalumes antes do balão.
        setTimeout(function () { if (!jogo.enviarFala(final)) camada.aviso('Não achei o campo de chat do jogo.', { tipo: 'erro' }); }, 120);
      }, true);

      // Citação no balão: casa o aviso (autor + texto) com o balão que aparece, nos dois sentidos.
      const esperando = [];
      const recentes = [];
      function citar(fala, r) {
        // Fica no .bubble-container (que o jogo já posiciona de forma absoluta), por cima do balão.
        const caixa = fala.el;
        const balaoEl = caixa && (caixa.querySelector('.chat-bubble') || caixa);
        if (!caixa || caixa.querySelector(':scope > .vl-citacao')) return;
        const c = document.createElement('div');
        c.className = 'vl-citacao';
        const pilula = document.createElement('span');
        pilula.className = 'vl-citacao-pilula';
        // Seta de resposta: sobe em curva e aponta para a direita.
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 12 12');
        svg.setAttribute('width', '10');
        svg.setAttribute('height', '10');
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', 'M2 11Q2 4.5 8.5 4.5M6 1.8 9 4.5 6 7.2');
        p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.8');
        p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(p);
        const quem = document.createElement('b');
        quem.textContent = r.citadoAutor;
        const frase = document.createElement('span');
        frase.className = 'vl-citacao-texto';
        frase.textContent = r.citado || '…';
        pilula.append(svg, quem, frase);
        c.title = 'Resposta a ' + r.citadoAutor + ': ' + (r.citado || '');
        c.appendChild(pilula);
        caixa.append(c);
        // Para quem usa o Vagalume, o "@apelido" do começo some (a citação já diz a quem é); quem
        // não usa continua vendo "@apelido mensagem".
        const msg = fala.el.querySelector('.message');
        if (msg) esconderMencao(msg, r.citadoAutor);
        // A aba fica à direita, do tamanho da citação; se não couber, vai até a borda esquerda do balão.
        function alinhar() {
          if (!c.isConnected) return;
          const base = caixa.getBoundingClientRect();
          const balao = balaoEl.getBoundingClientRect();
          // Não avança sobre o pedaço do avatar: começa no máximo onde começa o texto do balão.
          const conteudo = balaoEl.querySelector('.chat-content');
          const esquerda = Math.round((conteudo ? conteudo.getBoundingClientRect().left : balao.left) - base.left) - 4;
          const direita = Math.round(balao.right - base.left);
          // Do tamanho da citação (com uma folga à esquerda), sem passar da largura do balão.
          // Mede a citação inteira (sem o limite da aba) antes de ajustar.
          c.style.width = 'max-content';
          pilula.style.maxWidth = 'none';
          const natural = Math.ceil(pilula.getBoundingClientRect().width);
          pilula.style.maxWidth = '';
          const largura = Math.min(direita - esquerda, natural + 14);
          if (!(largura > 20)) return;
          c.style.left = (direita - largura) + 'px';
          c.style.width = largura + 'px';
          // Desce sobre a borda de cima do balão para esconder a emenda.
          const cobre = c.dataset.vlCobre ? Number(c.dataset.vlCobre) : 0;
          c.style.top = Math.round(balao.top - base.top - c.offsetHeight + cobre) + 'px';
        }
        copiarVisual(balaoEl, c, alinhar);
        alinhar();
        // O selo e a etiqueta da menção podem entrar logo depois e mudar a largura do apelido.
        setTimeout(alinhar, 60);
        setTimeout(alinhar, 400);
      }
      // Desenho da aba a partir do próprio balão. Os balões do Habblet são uma imagem fatiada
      // (border-image, ex.: "17 6 6 29 fill"); a fatia da esquerda (29 px) é o pedaço do avatar, que
      // não serve para a aba. Monta-se outra imagem com a borda direita espelhada (vira a esquerda),
      // um pedaço do miolo e a borda direita, só com as linhas de cima e uma linha do miolo para
      // preencher; a aba usa essa imagem sem a fatia de baixo, e assim emenda no balão.
      const desenhosDeAba = new Map();
      function desenhoDeAba(fonte, cima, direita, esquerda) {
        const chave = fonte + '|' + cima + '|' + direita + '|' + esquerda;
        if (!desenhosDeAba.has(chave)) {
          desenhosDeAba.set(chave, new Promise(function (resolver) {
            const img = new Image();
            img.onload = function () {
              try {
                const w = img.naturalWidth, h = img.naturalHeight;
                if (!(w > esquerda + direita + 2 && h > cima)) { resolver(null); return; }
                const tela = document.createElement('canvas');
                tela.width = direita * 2 + 2;
                tela.height = cima + 1;
                const g = tela.getContext('2d');
                g.imageSmoothingEnabled = false;
                g.save(); g.translate(direita, 0); g.scale(-1, 1);
                g.drawImage(img, w - direita, 0, direita, cima + 1, 0, 0, direita, cima + 1);
                g.restore();
                g.drawImage(img, esquerda + 2, 0, 2, cima + 1, direita, 0, 2, cima + 1);
                g.drawImage(img, w - direita, 0, direita, cima + 1, direita + 2, 0, direita, cima + 1);
                resolver(tela.toDataURL('image/png'));
              } catch (erro) { resolver(null); }
            };
            img.onerror = function () { resolver(null); };
            img.src = fonte;
          }));
        }
        return desenhosDeAba.get(chave);
      }
      function copiarVisual(de, para, depois) {
        const e = getComputedStyle(de);
        const st = para.style;
        // Letra e cor do texto da fala (o .chat-bubble em si não tem a cor do texto).
        const t = getComputedStyle(de.querySelector('.chat-content') || de);
        st.color = t.color;
        st.fontFamily = t.fontFamily;
        const fonte = /^url\(["']?(data:image\/[^"')]+)["']?\)$/.exec(String(e.borderImageSource || '').trim());
        const fatias = String(e.borderImageSlice || '').match(/[\d.]+/g) || [];
        if (fonte && fatias.length) {
          const cima = Math.round(Number(fatias[0]));
          const direita = Math.round(Number(fatias[1] !== undefined ? fatias[1] : fatias[0]));
          const esquerda = Math.round(Number(fatias[3] !== undefined ? fatias[3] : fatias[1] !== undefined ? fatias[1] : fatias[0]));
          const sobra = parseFloat(String(e.borderImageOutset || '0').trim().split(/\s+/)[0]) || 0;
          desenhoDeAba(fonte[1], cima, direita, esquerda).then(function (url) {
            if (!url || !para.isConnected) { if (!url) corSimples(); return; }
            st.borderStyle = 'solid';
            st.borderWidth = '0';
            st.borderImageSource = 'url("' + url + '")';
            st.borderImageSlice = cima + ' ' + direita + ' 0 ' + direita + ' fill';
            st.borderImageWidth = cima + 'px ' + direita + 'px 0 ' + direita + 'px';
            st.borderImageOutset = sobra + 'px 0 0 0';
            st.borderImageRepeat = 'stretch';
            st.minHeight = Math.max(0, cima - sobra) + 'px';
            // A aba desce sobre a borda de cima do balão (a imagem começa "sobra" px acima dele).
            para.dataset.vlCobre = String(Math.round(sobra + 2));
            if (depois) depois();
          });
          return;
        }
        corSimples();
        function corSimples() {
          // Balão sem imagem: copia fundo, borda e cantos de cima; sem a borda de baixo.
          st.backgroundColor = e.backgroundColor;
          st.backgroundImage = e.backgroundImage;
          st.borderStyle = e.borderTopStyle;
          st.borderColor = e.borderTopColor;
          st.borderTopWidth = e.borderTopWidth;
          st.borderLeftWidth = e.borderLeftWidth;
          st.borderRightWidth = e.borderRightWidth;
          st.borderBottomWidth = '0px';
          st.borderTopLeftRadius = e.borderTopLeftRadius;
          st.borderTopRightRadius = e.borderTopRightRadius;
          para.dataset.vlCobre = String(Math.max(2, Math.round(parseFloat(e.borderTopWidth) || 2)));
          if (depois) depois();
        }
      }
      function esconderMencao(msg, apelido) {
        const marca = '@' + String(apelido || '').toLowerCase();
        if (marca.length < 2 || !msg.textContent.trimStart().toLowerCase().startsWith(marca)) return;
        let no = msg.firstChild;
        while (no && no.nodeType === 3 && !no.textContent.trim()) no = no.nextSibling;
        if (!no) return;
        let depois;
        if (no.nodeType === 1 && no.textContent.trim().toLowerCase() === marca) {
          // A etiqueta de menção do Vagalume já embrulhou o "@apelido".
          no.classList.add('vl-resposta-oculto');
          depois = no.nextSibling;
        } else if (no.nodeType === 3) {
          const inicio = no.textContent.length - no.textContent.trimStart().length;
          const resto = no.splitText(inicio + marca.length);
          const oculto = document.createElement('span');
          oculto.className = 'vl-resposta-oculto';
          no.replaceWith(oculto);
          oculto.appendChild(no);
          depois = resto;
        } else return;
        if (depois && depois.nodeType === 3) depois.textContent = depois.textContent.replace(/^\s+/, '');
      }
      function limparVelhos() {
        const limite = Date.now() - 20000;
        while (esperando.length && esperando[0].quando < limite) esperando.shift();
        while (recentes.length && recentes[0].quando < limite) recentes.shift();
      }
      function casa(r, fala) {
        return String(fala.autor || '').toLowerCase() === String(r.autor).toLowerCase() && R.mesmaFala(fala.texto, r.texto);
      }
      function esperar(r) {
        limparVelhos();
        r.quando = Date.now();
        const i = recentes.findIndex((x) => x.fala.el.isConnected && casa(r, x.fala));
        if (i >= 0) { citar(recentes[i].fala, r); recentes.splice(i, 1); return; }
        esperando.push(r);
      }
      ctx.aoParar(jogo.observarFalas(function (fala) {
        if (!fala || !fala.el || !fala.autor) return;
        limparVelhos();
        const i = esperando.findIndex((r) => casa(r, fala));
        if (i >= 0) { citar(fala, esperando[i]); esperando.splice(i, 1); return; }
        recentes.push({ fala, quando: Date.now() });
        if (recentes.length > 40) recentes.shift();
      }));
      function aoAviso(m) {
        const d = m && m.dado && R.lerDado(m.dado);
        if (!d || !m.nome) return;
        esperar({ autor: String(m.nome), texto: d.texto, citadoAutor: d.autor, citado: d.citado });
      }
      function ligarAvisos() {
        if (VL.comunidade && VL.comunidade.aoAcao) { ctx.aoParar(VL.comunidade.aoAcao(aoAviso)); return true; }
        return false;
      }
      // O módulo Comunidade pode iniciar depois deste.
      if (!ligarAvisos()) {
        const espera = setInterval(function () { if (ligarAvisos()) clearInterval(espera); }, 1000);
        ctx.aoParar(function () { clearInterval(espera); });
      }
      // Ao desligar, os trechos voltam a ser texto comum.
      ctx.aoParar(function () {
        document.querySelectorAll('[' + MARCA_LINK + ']').forEach(function (no) { no.replaceWith(document.createTextNode(no.textContent)); });
      });

      // Botão direito num balão: escreve "@apelido " no campo de chat, para responder.
      ctx.escutar(window, 'contextmenu', function (ev) {
        if (!ev.isTrusted || !ctx.secao().responderComDireito || camada.contem(ev)) return;
        const balao = jogo.balaoDe(ev.target);
        const fala = balao && jogo.lerFala(balao);
        const campo = jogo.entradaChat();
        if (!fala || !fala.autor || !campo) return;
        ev.preventDefault();
        ev.stopPropagation();
        const atual = String(campo.value || '');
        const marca = '@' + fala.autor + ' ';
        jogo.definirValor(campo, atual.startsWith(marca) ? atual : marca + atual);
        campo.focus();
      }, true);

      // Estilo de balão forçado nas falas dos outros: troca a classe bubble-N do balão, só na sua tela.
      const ORIGINAL = 'data-vl-balao-original';
      function restaurarEstilo(b) {
        const antigo = b.getAttribute(ORIGINAL);
        if (!antigo) return;
        [...b.classList].filter((c) => /^bubble-\d+$/.test(c)).forEach((c) => b.classList.remove(c));
        b.classList.add(antigo);
        b.removeAttribute(ORIGINAL);
      }
      function forcarEstilo(fala) {
        const n = ctx.secao().estiloOutros;
        if (!fala || !fala.el) return;
        const eu = VL.pessoas && VL.pessoas.eu();
        if (eu && String(eu).toLowerCase() === String(fala.autor || '').toLowerCase()) return;
        const balao = fala.el.matches && fala.el.matches('.chat-bubble') ? fala.el : fala.el.querySelector && fala.el.querySelector('.chat-bubble');
        if (!balao) return;
        if (!Number.isInteger(n) || n < 0) { restaurarEstilo(balao); return; }
        const atual = [...balao.classList].find((c) => /^bubble-\d+$/.test(c));
        if (!atual || atual === 'bubble-' + n) return;
        if (!balao.hasAttribute(ORIGINAL)) balao.setAttribute(ORIGINAL, atual);
        balao.classList.remove(atual);
        balao.classList.add('bubble-' + n);
      }
      ctx.aoParar(jogo.observarFalas(forcarEstilo));
      ctx.aoConfig(function (secao) {
        if (secao !== 'chat') return;
        document.querySelectorAll('.nitro-chat-widget .bubble-container').forEach(function (b) {
          const fala = jogo.lerFala(b);
          if (fala) forcarEstilo(fala);
        });
      });
      ctx.aoParar(function () {
        document.querySelectorAll('[' + ORIGINAL + ']').forEach(restaurarEstilo);
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
