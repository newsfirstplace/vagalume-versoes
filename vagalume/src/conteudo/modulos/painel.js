// Vagalume — módulo "painel": a janela do Vagalume sobre o hotel. Cada módulo ligado pode registrar
// uma aba; este arquivo desenha a janela, o botão flutuante que a abre e a aba "Início".
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo || !VL.padroes || !VL.atalhos) return;
  const { nucleo, camada, jogo, padroes, atalhos } = VL;
  const el = camada.el;
  const caminhosAbas = {
    casa: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6',
    inicio: 'M4 5h16 M8 2v6 M4 12h16 M15 9v6 M4 19h16 M10 16v6',
    'efeitos-itens': 'M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z',
    conexoes: 'M10 14l4-4 M8 17H7a4 4 0 0 1 0-8h3 M14 7h3a4 4 0 0 1 0 8h-3',
    quarto: 'M3 4h18v16H3z M12 4v16 M3 12h18',
    historico: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18 M12 7v5l3 2',
    mencoes: 'M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3 7 M16 12a4 4 0 1 1-8 0a4 4 0 1 1 8 0',
    comandos: 'M3 5h18v14H3z M7 9l3 3-3 3 M12 15h5',
    macros: 'M5 19L19 5 M4 5l2 2 M18 17l2 2 M15 2l1 2 M2 14l2 1',
    'grupos-voz': 'M9 11a3 3 0 1 0 0-6a3 3 0 1 0 0 6 M17 10a2 2 0 1 0 0-4a2 2 0 1 0 0 4 M3 19v-2a6 6 0 0 1 12 0v2z M16 14a4 4 0 0 1 5 4v1h-4',
    captura: 'M3 7h4l2-2h6l2 2h4v12H3z M12 10a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
    construcao: 'M4 20l10-10 M10 4l4-2l8 8l-4 4z M3 17l4 4',
    inventario: 'M3 7l9-4l9 4v11l-9 4l-9-4z M3 7l9 4l9-4 M12 11v11',
    wired: 'M4 5h6v6H4z M14 13h6v6h-6z M10 8h4a3 3 0 0 1 3 3v2 M7 11v5h7',
  };
  const caminhosAssuntos = {
    conversa: 'M4 5h16v12H9l-5 4v-4H4z M7 9h10 M7 12h7',
    pessoas: 'M8 10a3 3 0 1 0 0-6a3 3 0 1 0 0 6 M2 20v-2a6 6 0 0 1 9-5 M17 8c1-2 4-1 4 1c0 3-4 5-4 5s-4-2-4-5c0-2 3-3 4-1',
    quarto: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M4 21v-2a8 8 0 0 1 16 0v2z',
    construcao: 'M3 12l6-3 6 3-6 3z M3 12v6l6 3 6-3v-6 M9 15v6 M13 6l4-2 4 2-4 2z M17 8v4',
    loja: 'M5 8h14l1 13H4z M9 9V6a3 3 0 0 1 6 0v3 M9 13h6',
    aparencia: 'M4 18l9-9 3 3-9 9H4z M14 8l3-3a2 2 0 0 1 3 3l-3 3z M4 18v3h3',
    desempenho: 'M4 18a8 8 0 1 1 16 0 M12 18l4-7 M7 18h10 M5 14l2 1 M19 14l-2 1',
    sistema: 'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5 M12 8l1 3 3 1-3 1-1 3-1-3-3-1 3-1z',
  };
  function desenharIcone(caminho, classe) {
    const selo = el('span', { class: classe, 'aria-hidden': 'true' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const forma = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    forma.setAttribute('d', caminho || 'M4 4h16v16H4z');
    svg.appendChild(forma);
    selo.appendChild(svg);
    return selo;
  }
  // Com as ilustrações do jogo (imagens do Habbo) quando houver; senão, o ícone desenhado.
  function ilustrado(chave, classe, tamanho, reserva) {
    return VL.ilustracoes ? VL.ilustracoes.elemento(chave, classe, tamanho, reserva) : reserva;
  }
  function iconeAba(id) { return ilustrado('aba:' + id, 'vl-aba-ilus', 26, desenharIcone(caminhosAbas[id] || caminhosAbas.inicio, 'vl-aba-icone')); }
  function iconeAssunto(id) { return ilustrado('assunto:' + id, 'vl-assunto-ilus', 30, desenharIcone(caminhosAssuntos[id], 'vl-assunto-icone')); }

  nucleo.definirModulo({
    id: 'painel',
    iniciar(ctx) {
      if (VL.youtubeTV && VL.youtubeTV.iniciar) VL.youtubeTV.iniciar(ctx);
      let janela = null;
      let corpo = null;
      let barraAbas = null;
      let botao = null;
      let abaAtual = 'casa';
      let visualAjustes = 'lista';
      let desmontar = null;
      let defAbaMontada = null;
      let posicao = null; // onde a pessoa deixou a janela; vale enquanto a página estiver aberta
      let focoAnterior = null;

      const abasFixas = [['efeitos-itens', 'Efeitos e itens', 2], ['construcao', 'Construção', 45], ['wired', 'Wired', 47]].map(([id, titulo, ordem]) => ({
        id, titulo, ordem,
        montar(alvo) {
          alvo.appendChild(el('p', { class: 'vl-nota', texto: id === 'efeitos-itens' ? 'Ligue Visual e avatar em Ajustes para usar os efeitos e itens de mão.' : 'Ligue ' + titulo + ' acima para usar as ferramentas desta página.' }));
        },
      }));
      function abasParaPainel() {
        const abas = nucleo.listarAbas();
        for (const fixa of abasFixas) {
          if (!abas.some((aba) => aba.id === fixa.id)) abas.push(fixa);
        }
        return abas.sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || String(a.titulo).localeCompare(String(b.titulo)));
      }

      // Uso das abas, para a página de Início (storage.local "vl.usoPainel"; nada sai do navegador).
      const CHAVE_USO = 'vl.usoPainel';
      let uso = {};
      try { chrome.storage.local.get(CHAVE_USO).then(function (r) { if (r && r[CHAVE_USO] && typeof r[CHAVE_USO] === 'object') uso = r[CHAVE_USO]; }, function () {}); } catch (erro) { /* sem uso guardado */ }
      let gravarUso = 0;
      function contarUso(id) {
        if (!id || id === 'casa') return;
        uso[id] = Math.min(9999, (Number(uso[id]) || 0) + 1);
        clearTimeout(gravarUso);
        gravarUso = setTimeout(function () { try { chrome.storage.local.set({ [CHAVE_USO]: uso }).catch(function () {}); } catch (erro) { /* tudo bem */ } }, 1500);
      }

      function limitar(x, y) {
        const largura = janela ? janela.offsetWidth : 380;
        const maxX = Math.max(8, window.innerWidth - largura - 8);
        const maxY = Math.max(8, window.innerHeight - 48);
        return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
      }

      function posicionar() {
        if (!janela) return;
        const p = limitar(posicao ? posicao.x : 72, posicao ? posicao.y : 72);
        janela.style.left = p.x + 'px';
        janela.style.top = p.y + 'px';
      }

      function encerrarAba() {
        if (!desmontar) return;
        try { desmontar(); } catch (erro) { /* a aba anterior já não importa */ }
        desmontar = null;
      }

      function montarAba() {
        if (!janela) return;
        encerrarAba();
        corpo.replaceChildren();
        corpo.scrollTop = 0;
        const def = abasParaPainel().find((a) => a.id === abaAtual);
        defAbaMontada = def || null;
        if (!def) {
          corpo.appendChild(el('p', { class: 'vl-vazio', texto: 'Nenhuma seção disponível.' }));
          return;
        }
        try {
          const alvoFerramentas = (abaAtual === 'construcao' || abaAtual === 'wired')
            ? el('div', { class: 'vl-ferramentas-pagina' }) : corpo;
          if (alvoFerramentas !== corpo) corpo.appendChild(alvoFerramentas);
          const retorno = def.montar(alvoFerramentas);
          const pararAjustes = (abaAtual === 'construcao' || abaAtual === 'wired') ? montarConfiguracoesPagina(corpo, abaAtual) : null;
          desmontar = function () {
            if (typeof retorno === 'function') retorno();
            if (pararAjustes) pararAjustes();
          };
        } catch (erro) {
          console.warn('[Vagalume] Falha ao montar a aba "' + def.id + '":', erro);
          corpo.replaceChildren(el('p', { class: 'vl-vazio', texto: 'Não foi possível abrir esta aba.' }));
        }
      }

      function desenharAbas(focar) {
        if (!janela) return;
        const abas = abasParaPainel();
        barraAbas.replaceChildren(...abas.map((a) => el('button', {
          type: 'button',
          class: 'vl-aba',
          role: 'tab',
          id: 'vl-aba-' + a.id,
          'aria-selected': a.id === abaAtual ? 'true' : 'false',
          'aria-controls': 'vl-corpo',
          tabindex: a.id === abaAtual ? '0' : '-1',
          onclick() { selecionar(a.id); },
        }, [iconeAba(a.id), el('span', { class: 'vl-aba-texto', texto: a.titulo })])));
        corpo.setAttribute('aria-labelledby', 'vl-aba-' + abaAtual);
        if (focar) {
          const marcada = barraAbas.querySelector('[aria-selected="true"]');
          if (marcada) marcada.focus();
        }
      }

      function selecionar(id) {
        if (id !== abaAtual) {
          contarUso(id);
          abaAtual = id;
          montarAba();
        }
        desenharAbas(true);
      }

      // Setas, Home e End andam entre as abas, como em qualquer lista de abas.
      function aoTeclarAbas(ev) {
        const abas = abasParaPainel();
        if (!abas.length) return;
        const i = Math.max(0, abas.findIndex((a) => a.id === abaAtual));
        let j = -1;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') j = (i + 1) % abas.length;
        else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') j = (i - 1 + abas.length) % abas.length;
        else if (ev.key === 'Home') j = 0;
        else if (ev.key === 'End') j = abas.length - 1;
        if (j < 0) return;
        ev.preventDefault();
        selecionar(abas[j].id);
      }

      function prepararArraste(cabecalho) {
        let arraste = null;
        cabecalho.addEventListener('pointerdown', function (ev) {
          if (ev.button !== 0 || (ev.target && ev.target.closest && ev.target.closest('button'))) return;
          const caixa = janela.getBoundingClientRect();
          arraste = { id: ev.pointerId, dx: ev.clientX - caixa.left, dy: ev.clientY - caixa.top };
          try { cabecalho.setPointerCapture(ev.pointerId); } catch (erro) { /* segue sem captura */ }
          ev.preventDefault();
        });
        cabecalho.addEventListener('pointermove', function (ev) {
          if (!arraste || ev.pointerId !== arraste.id) return;
          posicao = limitar(ev.clientX - arraste.dx, ev.clientY - arraste.dy);
          posicionar();
        });
        function soltar(ev) {
          if (!arraste || ev.pointerId !== arraste.id) return;
          arraste = null;
          try { cabecalho.releasePointerCapture(ev.pointerId); } catch (erro) { /* já estava solto */ }
        }
        cabecalho.addEventListener('pointerup', soltar);
        cabecalho.addEventListener('pointercancel', soltar);
      }

      // Ícone na barra do hotel, depois da câmera (pedido do usuário em 2026-11-15: "que pareça um ícone
      // nativo do jogo"): o pote de vagalumes em pixel art, com as mesmas classes dos itens da barra
      // (`.nitro-toolbar .navigation-item`), para ter o mesmo jeito ao passar o mouse. Com ele na
      // barra, a bolinha do canto esquerdo some; sem barra (tela de carregamento), ela volta.
      let iconeBarra = null;
      let tirarEstiloBarra = null;
      function cuidarDaBarra() {
        const quer = ctx.secao().mostrarBotao === true;
        // Ao lado da câmera; na vista do hotel (sem câmera), ao lado do avatar da barra (pedido de 2026-11-16:
        // o ponto voltava para o canto quando a câmera sumia).
        const camera = quer ? (document.querySelector('.nitro-toolbar .navigation-item.icon-camera') || document.querySelector('.nitro-toolbar .navigation-item.item-avatar')) : null;
        if (!camera) {
          if (iconeBarra) iconeBarra.remove();
        } else {
          if (!iconeBarra) {
            iconeBarra = document.createElement('div');
            iconeBarra.className = 'navigation-item vl-icone-barra';
            iconeBarra.setAttribute('role', 'button');
            iconeBarra.addEventListener('click', function (ev) { ev.stopPropagation(); alternar(); });
          }
          iconeBarra.title = 'Vagalume' + (ctx.secao().atalho ? ' (' + ctx.secao().atalho + ')' : '');
          if (camera.nextElementSibling !== iconeBarra) camera.after(iconeBarra);
        }
        const naBarra = !!(iconeBarra && iconeBarra.isConnected);
        if (botao) botao.hidden = naBarra;
        return naBarra;
      }
      tirarEstiloBarra = camada.estiloPagina('painel-barra', (VL.marca && VL.marca.icone
        ? '.nitro-toolbar .vl-icone-barra { width: 32px; height: 32px; flex: none; align-self: center; cursor: pointer; '
          + 'background: url("' + VL.marca.dataUrl(VL.marca.icone()) + '") center / 32px 32px no-repeat; image-rendering: pixelated; }'
        : ''));
      let barraPendente = false;
      const observarBarra = new MutationObserver(function () {
        if (barraPendente) return;
        barraPendente = true;
        setTimeout(function () { barraPendente = false; cuidarDaBarra(); }, 300);
      });
      if (document.body) observarBarra.observe(document.body, { childList: true, subtree: true });
      ctx.aoParar(function () {
        observarBarra.disconnect();
        if (iconeBarra) iconeBarra.remove();
        if (typeof tirarEstiloBarra === 'function') tirarEstiloBarra();
      });

      function atualizarBotao() {
        const opcoes = ctx.secao();
        if (opcoes.mostrarBotao !== true) {
          if (botao) botao.remove();
          botao = null;
          cuidarDaBarra();
          return;
        }
        if (!botao) {
          botao = el('button', { type: 'button', class: 'vl-flutuante', onclick() { alternar(); } });
          camada.area().appendChild(botao);
        }
        cuidarDaBarra();
        botao.setAttribute('aria-label', janela ? 'Fechar o painel do Vagalume' : 'Abrir o painel do Vagalume');
        botao.setAttribute('aria-expanded', janela ? 'true' : 'false');
        botao.title = 'Vagalume' + (opcoes.atalho ? ' (' + opcoes.atalho + ')' : '');
      }

      function abrir(idAba) {
        const abas = abasParaPainel();
        const pedida = idAba && abas.some((a) => a.id === idAba) ? idAba : null;
        if (janela) {
          if (pedida && pedida !== abaAtual) {
            abaAtual = pedida;
            montarAba();
          }
          desenharAbas(true);
          return;
        }
        if (pedida) abaAtual = pedida;
        if (!abas.some((a) => a.id === abaAtual)) abaAtual = abas.length ? abas[0].id : 'inicio';
        focoAnterior = camada.foco() || document.activeElement;

        barraAbas = el('div', { class: 'vl-abas', role: 'tablist', 'aria-label': 'Seções do Vagalume', 'aria-orientation': 'vertical', onkeydown: aoTeclarAbas });
        corpo = el('div', { class: 'vl-corpo', id: 'vl-corpo', role: 'tabpanel', tabindex: '0' });
        const cabecalho = el('div', { class: 'vl-cabecalho' }, [
          el('span', { class: 'vl-marca', 'aria-hidden': 'true' }),
          el('h2', { class: 'vl-titulo', texto: 'Vagalume' }),
          el('span', { class: 'vl-versao', texto: 'v' + (padroes.VERSAO || '') }),
          el('button', { type: 'button', class: 'vl-fechar', 'aria-label': 'Fechar o painel', title: 'Fechar (Esc)', texto: '×', onclick() { fechar(); } }),
        ]);
        janela = el('div', { class: 'vl-janela', role: 'dialog', 'aria-label': 'Vagalume' }, [cabecalho, el('div', { class: 'vl-miolo' }, [barraAbas, corpo])]);
        janela.addEventListener('keydown', function (ev) {
          if (ev.key !== 'Escape' || ev.defaultPrevented || camada.temDialogo()) return;
          ev.preventDefault();
          fechar();
        });
        prepararArraste(cabecalho);
        camada.area().appendChild(janela);
        posicionar();
        desenharAbas(true);
        montarAba();
        atualizarBotao();
      }

      function fechar(semFoco) {
        if (!janela) return;
        const focado = camada.foco();
        const tinhaFoco = !!(focado && janela.contains(focado));
        encerrarAba();
        janela.remove();
        janela = null;
        corpo = null;
        barraAbas = null;
        if (semFoco) return;
        atualizarBotao();
        if (!tinhaFoco) return;
        const volta = focoAnterior && focoAnterior.isConnected && focoAnterior !== document.body ? focoAnterior : botao;
        try { if (volta && typeof volta.focus === 'function') volta.focus(); } catch (erro) { /* sem foco para devolver */ }
      }

      function alternar() {
        if (janela) fechar();
        else abrir();
      }

      // ---------- aba "Ajustes": os mesmos campos da página de opções (core/campos.js) ----------
      const CAMPOS = VL.campos ? VL.campos.AJUSTES : {};
      let serieCampo = 0;
      const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

      function marcar(marca, texto, erro) {
        if (!marca) return;
        marca.textContent = texto;
        marca.classList.toggle('erro', !!erro);
        clearTimeout(marca.relogio);
        marca.relogio = setTimeout(function () { marca.textContent = ''; }, erro ? 4000 : 1600);
      }
      function gravarCampo(secao, chave, valor, marca) {
        return ctx.alterar(secao, { [chave]: valor }).then(function () { marcar(marca, 'gravado'); }, function () { marcar(marca, 'não gravou', true); });
      }
      // O valor como ficará depois da validação (limites, listas, CSS limpo), para mostrar na hora.
      function valorAceito(secao, chave, valor) {
        const s = VL.config.mesclarSecao(secao, Object.assign({}, ctx.config()[secao] || {}, { [chave]: valor }));
        return s ? s[chave] : valor;
      }

      function campoDoPainel(secao, def) {
        const id = 'vl-c-' + (++serieCampo);
        const atual = () => (ctx.config()[secao] || {})[def.chave];
        const marca = el('span', { class: 'vl-gravado', 'aria-live': 'polite' });
        const nota = def.nota ? el('span', { class: 'vl-nota vl-nota-campo', hidden: true, texto: def.nota }) : null;
        const info = def.nota ? el('button', { type: 'button', class: 'vl-info', title: def.nota, 'aria-label': 'Mais sobre: ' + def.rotulo, 'aria-expanded': 'false', texto: 'i' }) : null;
        if (info) {
          info.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            nota.hidden = !nota.hidden;
            info.setAttribute('aria-expanded', nota.hidden ? 'false' : 'true');
          });
        }
        let controle = null;
        let extras = [];
        let empilhado = !!def.empilhado;
        let atualizar = function () {};
        function dependencia() {
          if (!def.depende || !controle) return;
          controle.disabled = (ctx.config()[secao] || {})[def.depende] !== true;
        }
        function comBotao(lerValor, validar) {
          const botaoGravar = el('button', { type: 'button', class: 'vl-botao', texto: 'Gravar' });
          botaoGravar.addEventListener('click', function () {
            const v = lerValor();
            const r = validar ? validar(v) : { ok: true, valor: v };
            if (!r.ok) { marcar(marca, r.motivo || 'valor inválido', true); return; }
            gravarCampo(secao, def.chave, valorAceito(secao, def.chave, r.valor), marca);
          });
          extras.push(botaoGravar);
        }
        switch (def.tipo) {
          case 'chave': {
            controle = el('input', { type: 'checkbox', class: 'vl-interruptor', id });
            controle.checked = atual() === true;
            controle.addEventListener('change', function () { gravarCampo(secao, def.chave, controle.checked, marca); });
            atualizar = function () { controle.checked = atual() === true; dependencia(); };
            dependencia();
            const no = el('label', { class: 'vl-ajuste chave', for: id }, [
              controle,
              el('span', { class: 'vl-ajuste-texto' }, [el('span', { class: 'vl-rotulo-linha' }, [el('span', { texto: def.rotulo }), info]), nota, marca]),
            ]);
            return { no, atualizar, def };
          }
          case 'numero':
          case 'faixa': {
            const faixa = VL.config.FAIXAS[secao + '.' + def.chave] || [];
            const deslizante = def.tipo === 'faixa';
            controle = el('input', { type: deslizante ? 'range' : 'number', class: deslizante ? 'vl-faixa' : 'vl-campo vl-numero', id, min: faixa[0], max: faixa[1], step: def.passo || 1 });
            controle.value = String(atual());
            const mostrador = deslizante ? el('span', { class: 'vl-nota vl-mostrador', texto: atual() + (def.unidade || '') }) : null;
            let relogio = 0;
            const salvar = function () {
              const v = Number(String(controle.value).replace(',', '.'));
              if (!Number.isFinite(v)) { controle.value = String(atual()); return; }
              const aceito = valorAceito(secao, def.chave, v);
              if (!deslizante) controle.value = String(aceito);
              gravarCampo(secao, def.chave, aceito, marca);
            };
            controle.addEventListener(deslizante ? 'input' : 'change', function () {
              if (mostrador) mostrador.textContent = controle.value + (def.unidade || '');
              clearTimeout(relogio);
              relogio = setTimeout(salvar, 350);
            });
            atualizar = function () {
              if (camada.foco() !== controle) controle.value = String(atual());
              if (mostrador) mostrador.textContent = controle.value + (def.unidade || '');
              dependencia();
            };
            dependencia();
            if (mostrador) extras.push(mostrador);
            else if (def.unidade) extras.push(el('span', { class: 'vl-nota', texto: def.unidade }));
            break;
          }
          case 'escolha': {
            controle = el('select', { class: 'vl-campo', id }, (def.opcoes || []).map(function (o) { return el('option', { value: o.valor, texto: o.rotulo }); }));
            controle.value = String(atual());
            controle.addEventListener('change', function () { gravarCampo(secao, def.chave, controle.value, marca); });
            atualizar = function () { controle.value = String(atual()); };
            break;
          }
          case 'escolha-imagem': {
            // Escolha por imagens (2026-11-20, pedido do usuário: balão de digitando com a imagem de
            // cada opção). Cada opção traz `imagem` (endereço data:) e o rótulo vai no title.
            empilhado = true;
            const botoes = [];
            controle = el('div', { class: 'vl-escolha-imagem', id, role: 'radiogroup', 'aria-label': def.rotulo });
            for (const o of def.opcoes || []) {
              const imagem = typeof o.imagem === 'function' ? o.imagem() : o.imagem;
              const b = el('button', { type: 'button', class: 'vl-escolha-opcao', role: 'radio', title: o.rotulo, 'data-valor': o.valor }, [
                imagem ? el('img', { alt: '', src: imagem }) : null,
                el('span', { texto: o.curto || o.rotulo }),
              ]);
              b.addEventListener('click', function () { gravarCampo(secao, def.chave, o.valor, marca); marcarOpcao(o.valor); });
              botoes.push(b);
              controle.appendChild(b);
            }
            function marcarOpcao(v) {
              for (const b of botoes) {
                const sim = b.getAttribute('data-valor') === String(v);
                b.classList.toggle('ativa', sim);
                b.setAttribute('aria-checked', sim ? 'true' : 'false');
              }
            }
            marcarOpcao(atual());
            atualizar = function () { marcarOpcao(atual()); };
            break;
          }
          case 'lastfm': {
            // Guia curto (pedido do usuário em 2026-11-15) e confirmação de que o Last.fm é seu.
            const abrirSite = function (url) { window.open(url, '_blank', 'noopener,noreferrer'); };
            const passo = function (n, titulo, filhos) {
              return el('li', { class: 'vl-passo' }, [el('span', { class: 'vl-passo-num', texto: String(n) }), el('div', { class: 'vl-passo-corpo' }, [el('strong', { texto: titulo })].concat(filhos))]);
            };
            controle = el('input', { type: 'text', class: 'vl-campo', id, placeholder: 'apelido no Last.fm', maxlength: 15, autocomplete: 'off', spellcheck: 'false' });
            controle.value = String(atual() || '');
            const gravarApelido = el('button', { type: 'button', class: 'vl-botao', texto: 'Gravar' });
            gravarApelido.addEventListener('click', function () {
              const v = controle.value.trim();
              if (v && !(VL.lastfm && VL.lastfm.usuarioValido(v))) { marcar(marca, 'apelido inválido', true); return; }
              gravarCampo(secao, def.chave, v, marca);
            });
            controle.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); gravarApelido.click(); } });
            const estado = el('p', { class: 'vl-confirmacao' });
            const codigo = el('code', { class: 'vl-codigo-grande' });
            const caixaCodigo = el('div', { class: 'vl-linha', hidden: true }, [
              codigo,
              el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Copiar', onclick() { camada.copiar(codigo.textContent).then(function (ok) { marcar(marca, ok ? 'código copiado' : 'não copiou', !ok); }); } }),
              el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Abrir o perfil no Last.fm', onclick() { abrirSite('https://www.last.fm/settings'); } }),
            ]);
            const gerar = el('button', { type: 'button', class: 'vl-botao destaque', texto: 'Confirmar que é meu' });
            const verificar = el('button', { type: 'button', class: 'vl-botao destaque', texto: 'Já pus o código: verificar', hidden: true });
            function desenharEstado() {
              const mus = VL.musica;
              if (!mus) { estado.textContent = 'Ligue o módulo Música (o interruptor acima) para confirmar.'; estado.className = 'vl-confirmacao'; gerar.disabled = true; return; }
              const e = mus.estado();
              gerar.disabled = !e.valido;
              if (e.confirmado) {
                estado.textContent = '✓ Confirmado: ' + e.usuario + ' é seu. Quem usa o Vagalume já vê a sua música. Pode tirar o código do perfil do Last.fm.';
                estado.className = 'vl-confirmacao ok';
                caixaCodigo.hidden = true; verificar.hidden = true; gerar.hidden = true;
                return;
              }
              estado.className = 'vl-confirmacao';
              gerar.hidden = !!e.codigo;
              if (!e.valido) estado.textContent = 'Primeiro escreva e grave o seu apelido (passo 2).';
              else if (!e.codigo) estado.textContent = 'Ainda não confirmado: por enquanto ninguém vê a sua música.';
              else estado.textContent = 'No Last.fm, ponha este código no campo "Nome de exibição" (Display name), salve, e volte aqui:';
              codigo.textContent = e.codigo || '';
              caixaCodigo.hidden = !e.codigo;
              verificar.hidden = !e.codigo;
            }
            gerar.addEventListener('click', function () { if (VL.musica) { VL.musica.comecarConfirmacao(); desenharEstado(); } });
            verificar.addEventListener('click', function () {
              if (!VL.musica) return;
              verificar.disabled = true;
              estado.textContent = 'Conferindo no Last.fm…';
              VL.musica.verificar().then(function (r) {
                verificar.disabled = false;
                desenharEstado();
                if (r && r.ok && !r.confere) { estado.textContent = 'O código ainda não aparece no seu Nome de exibição. Confira se salvou o perfil no Last.fm e tente de novo.'; estado.className = 'vl-confirmacao erro'; }
                else if (!r || !r.ok) { estado.textContent = r && r.erro === 'nao-existe' ? 'Esse apelido não existe no Last.fm.' : 'Não deu para falar com o Last.fm agora. Tente de novo.'; estado.className = 'vl-confirmacao erro'; }
              });
            });
            ctx.ouvir('musica:estado', function () { if (estado.isConnected) desenharEstado(); });
            atualizar = function () { if (camada.foco() !== controle) controle.value = String(atual() || ''); desenharEstado(); };
            desenharEstado();
            const no = el('div', { class: 'vl-ajuste empilhado vl-guia' }, [
              el('ol', { class: 'vl-passos' }, [
                passo(1, 'Ligue o Spotify ao Last.fm', [
                  el('span', { class: 'vl-nota', texto: 'Crie uma conta grátis no Last.fm. Em Configurações › Aplicativos, clique em "Conectar" no Spotify.' }),
                  el('div', { class: 'vl-linha' }, [el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Abrir o Last.fm', onclick() { abrirSite('https://www.last.fm/settings/applications'); } })]),
                ]),
                passo(2, 'Escreva o seu apelido do Last.fm', [el('div', { class: 'vl-linha' }, [controle, gravarApelido]), marca]),
                passo(3, 'Confirme que a conta é sua', [
                  estado, caixaCodigo, el('div', { class: 'vl-linha' }, [gerar, verificar]),
                  el('span', { class: 'vl-nota', texto: 'Isso impede que alguém mostre o Last.fm de outra pessoa. Só precisa fazer uma vez.' }),
                ]),
              ]),
            ]);
            return { no, atualizar, def };
          }
          case 'texto': {
            controle = el('input', { type: 'text', class: 'vl-campo', id, maxlength: (VL.config.LIMITES || {}).texto || 200 });
            controle.value = String(atual() || '');
            controle.addEventListener('change', function () { gravarCampo(secao, def.chave, valorAceito(secao, def.chave, controle.value.trim()), marca); });
            atualizar = function () { if (camada.foco() !== controle) controle.value = String(atual() || ''); };
            break;
          }
          case 'prefixo': {
            controle = el('input', { type: 'text', class: 'vl-campo', id, maxlength: 12 });
            controle.value = String(atual() || '');
            comBotao(function () { return controle.value; }, function (v) {
              const p = VL.config.limparPrefixo(v);
              return p ? { ok: true, valor: p } : { ok: false, motivo: 'use / ou uma palavra começando por letra' };
            });
            atualizar = function () { if (camada.foco() !== controle) controle.value = String(atual() || ''); };
            break;
          }
          case 'atalho': {
            controle = el('input', { type: 'text', class: 'vl-campo', id, placeholder: 'Ex.: Alt+V' });
            controle.value = String(atual() || '');
            comBotao(function () { return controle.value; }, function (v) {
              const r = VL.atalhos.validar(v);
              return r.ok ? { ok: true, valor: r.combo } : { ok: false, motivo: r.motivo || 'atalho inválido' };
            });
            atualizar = function () { if (camada.foco() !== controle) controle.value = String(atual() || ''); };
            break;
          }
          case 'termos':
          case 'css': {
            empilhado = true;
            controle = el('textarea', { class: 'vl-campo vl-texto-longo', id, rows: def.tipo === 'css' ? 6 : 4, spellcheck: 'false' });
            const lerTexto = function () { const v = atual(); return Array.isArray(v) ? v.join('\n') : String(v || ''); };
            controle.value = lerTexto();
            comBotao(function () {
              return def.tipo === 'termos' ? controle.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean) : controle.value;
            });
            atualizar = function () { if (camada.foco() !== controle) controle.value = lerTexto(); };
            break;
          }
          case 'macros':
          case 'captura': {
            const aba = def.tipo;
            const no = el('div', { class: 'vl-ajuste' }, [
              el('span', { class: 'vl-nota', texto: aba === 'macros' ? 'As macros se criam e editam na aba Macros.' : 'A captura e o editor ficam na aba Captura.' }),
              el('button', { type: 'button', class: 'vl-botao', texto: 'Ir para ' + (aba === 'macros' ? 'Macros' : 'Captura'), onclick() { selecionar(aba); } }),
            ]);
            return { no, atualizar: function () {}, def };
          }
          default:
            return null;
        }
        const no = el('div', { class: 'vl-ajuste' + (empilhado ? ' empilhado' : '') }, [
          el('div', { class: 'vl-ajuste-rotulo' }, [el('label', { for: id, texto: def.rotulo }), info]),
          el('div', { class: 'vl-ajuste-controle' }, [controle].concat(extras)),
          nota,
          marca,
        ]);
        return { no, atualizar, def };
      }

      function montarConfiguracoesPagina(alvo, id) {
        const titulo = id === 'wired' ? 'Wired' : 'Construção';
        const chave = el('input', { type: 'checkbox', class: 'vl-interruptor', 'aria-label': 'Ligar ' + titulo });
        const marca = el('span', { class: 'vl-gravado', 'aria-live': 'polite' });
        const campos = (CAMPOS[id] || []).map((def) => campoDoPainel(id, def)).filter(Boolean);
        const controles = el('div', { class: 'vl-ajustes' }, campos.map((campo) => campo.no));
        const secao = el('section', { class: 'vl-modulo vl-config-pagina' }, [
          el('h3', { class: 'vl-acoes-titulo', texto: 'Configurações de ' + titulo }),
          el('div', { class: 'vl-modulo-topo' }, [chave, el('div', { class: 'vl-modulo-texto' }, [
            el('strong', { texto: titulo }),
            el('span', { class: 'vl-modulo-resumo', texto: 'Configurações desta página' }),
          ]), marca]),
          controles,
        ]);
        alvo.prepend(secao);
        function sincronizar() {
          chave.checked = ctx.config().modulos[id] === true;
          for (const campo of campos) campo.atualizar();
        }
        chave.addEventListener('change', function () {
          ctx.alterar('modulos', { [id]: chave.checked }).then(function () {
            marcar(marca, 'gravado');
          }, function () {
            sincronizar();
            marcar(marca, 'não gravou', true);
          });
        });
        sincronizar();
        const parar = nucleo.ouvir('config', sincronizar);
        return parar;
      }

      function montarConexoes(alvo) {
        const chave = el('input', { type: 'checkbox', class: 'vl-interruptor', 'aria-label': 'Ligar Música (Last.fm)' });
        const marca = el('span', { class: 'vl-gravado', 'aria-live': 'polite' });
        const campos = (CAMPOS.musica || []).map((def) => campoDoPainel('musica', def)).filter(Boolean);
        const jogo = VL.conexao;
        const chaveJogo = el('input', { type: 'checkbox', class: 'vl-interruptor', 'aria-label': 'Ligar Conexão do jogo' });
        const estadoJogo = el('strong', { class: 'vl-conexoes-estado', role: 'status' });
        const detalheJogo = el('span', { class: 'vl-nota' });
        const atividade = el('div', { class: 'vl-conexoes-atividade', role: 'log', 'aria-label': 'Atividade da conexão do jogo' });
        const botaoAtividade = el('button', { type: 'button', class: 'vl-botao', texto: 'Mostrar atividade ao vivo' });
        let pararRegistro = null;
        let eventos = 0;
        function pararAtividade() {
          if (pararRegistro) { pararRegistro(); pararRegistro = null; }
          botaoAtividade.textContent = 'Mostrar atividade ao vivo';
        }
        function desenharJogo() {
          const ligado = ctx.config().modulos.conexao === true;
          const pronto = !!(jogo && jogo.disponivel());
          const conectado = pronto && jogo.conectado();
          chaveJogo.checked = ligado;
          estadoJogo.textContent = conectado ? 'Jogo conectado' : pronto ? 'Ponte ativa · aguardando o jogo' : ligado ? 'Recarregue o hotel para conectar' : 'Conexão desligada';
          estadoJogo.classList.toggle('ativa', conectado);
          detalheJogo.textContent = conectado ? 'O Vagalume acompanha os eventos do Habblet nesta sessão.' : pronto ? 'A ponte está pronta; entre em um quarto ou aguarde a reconexão.' : ligado ? 'O módulo foi ligado, mas a ponte ainda não foi instalada nesta página.' : 'Ligue a conexão para usar recursos de construção, wired e avatar.';
          botaoAtividade.disabled = !pronto;
          if (!pronto) pararAtividade();
        }
        botaoAtividade.addEventListener('click', function () {
          if (pararRegistro) { pararAtividade(); return; }
          if (!jogo || !jogo.disponivel()) return;
          atividade.replaceChildren();
          eventos = 0;
          pararRegistro = jogo.registro(function (r) {
            if (!r || r.tipo !== 'resumo') return;
            eventos++;
            const linha = el('div', { class: 'vl-conexoes-evento', texto: (r.direcao === 'entrada' ? '↓ Recebido' : '↑ Enviado') + ' · código ' + r.cabecalho + ' · ' + r.tamanho + ' bytes' });
            atividade.prepend(linha);
            while (atividade.children.length > 12) atividade.lastChild.remove();
          });
          botaoAtividade.textContent = 'Parar atividade ao vivo';
        });
        chaveJogo.addEventListener('change', function () {
          ctx.alterar('modulos', { conexao: chaveJogo.checked }).then(function () {
            desenharJogo();
            camada.aviso('Recarregue o hotel para aplicar a mudança na Conexão do jogo.');
          }, function () { desenharJogo(); camada.aviso('Não deu para salvar a Conexão do jogo.', { tipo: 'erro' }); });
        });
        const secaoJogo = el('section', { class: 'vl-modulo vl-conexoes-cartao' }, [
          el('div', { class: 'vl-modulo-topo' }, [chaveJogo, el('div', { class: 'vl-modulo-texto' }, [el('strong', { texto: 'Habblet' }), estadoJogo])]),
          el('div', { class: 'vl-conexoes-corpo' }, [detalheJogo, botaoAtividade, atividade, el('span', { class: 'vl-nota', texto: 'A demonstração mostra apenas códigos e tamanhos das mensagens, sem o conteúdo delas.' })]),
        ]);
        const secaoMusica = el('section', { class: 'vl-modulo vl-config-pagina' }, [
          el('div', { class: 'vl-modulo-topo' }, [
            chave,
            el('div', { class: 'vl-modulo-texto' }, [
              el('strong', { texto: 'Música (Last.fm)' }),
              el('span', { class: 'vl-modulo-resumo', texto: 'Mostre no miniperfil o que você está ouvindo ou ouviu por último.' }),
            ]),
            marca,
          ]),
          el('div', { class: 'vl-ajustes' }, campos.map((campo) => campo.no)),
        ]);
        const perfilCampos = {};
        const rotulosPerfil = { discord: 'Discord', steam: 'Steam', valorant: 'Valorant', lol: 'League of Legends', letterboxd: 'Letterboxd' };
        const descricoesPerfil = {
          discord: 'Mostre seu usuário ou convite.', steam: 'Compartilhe seu perfil de jogador.',
          valorant: 'Mostre seu Riot ID.', lol: 'Mostre seu Riot ID.', letterboxd: 'Compartilhe seu diário de filmes.',
        };
        const exemplosPerfil = { discord: 'usuário ou convite', steam: 'nome ou link Steam', valorant: 'Nome#BR1', lol: 'Nome#BR1', letterboxd: 'usuário ou link' };
        const perfilLista = el('div', { class: 'vl-conexoes-campos' });
        const perfilEstado = el('p', { class: 'vl-nota', role: 'status' });
        let perfilAviso = '';
        async function salvarServico(id, valor, editor, botao) {
          const api = VL.comunidade && VL.comunidade.perfil;
          const estado = api && api.estado();
          if (!estado || !estado.carregado) { perfilEstado.textContent = 'Entre no hotel para salvar suas conexões.'; return; }
          botao.disabled = true;
          try {
            const novos = { ...estado.dados, [id]: valor, confirmados: { ...estado.dados.confirmados } };
            // Trocou o perfil: a confirmação antiga não vale mais.
            if (valor !== estado.dados[id]) delete novos.confirmados[id];
            await api.salvar(novos);
            editor.hidden = true;
            perfilAviso = rotulosPerfil[id] + (valor ? ' adicionado ao miniperfil.' : ' removido do miniperfil.');
          } catch (erro) { perfilAviso = erro.message || 'Não deu para salvar a conexão.'; }
          botao.disabled = false;
          desenharPerfil();
        }
        // Last.fm sem aba própria (pedido do usuário, 2026-11-19): os ajustes abrem dentro da linha.
        const editorLastfm = el('div', { class: 'vl-conexoes-servico-editor vl-conexoes-lastfm', hidden: true }, [secaoMusica]);
        const botaoLastfm = el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Configurar', 'aria-expanded': 'false', onclick() {
          editorLastfm.hidden = !editorLastfm.hidden;
          botaoLastfm.textContent = editorLastfm.hidden ? 'Configurar' : 'Fechar';
          botaoLastfm.setAttribute('aria-expanded', editorLastfm.hidden ? 'false' : 'true');
        } });
        perfilLista.appendChild(el('div', { class: 'vl-conexoes-servico', 'data-servico': 'lastfm' }, [el('div', { class: 'vl-conexoes-servico-linha' }, [
          el('span', { class: 'vl-conexoes-servico-icone', 'data-servico': 'lastfm' }, [VL.conexoesPerfil.icone ? VL.conexoesPerfil.icone('lastfm') : null]),
          el('span', { class: 'vl-conexoes-servico-info' }, [el('strong', { texto: 'Last.fm' }), el('small', { texto: 'Mostre sua música no miniperfil.' })]),
          botaoLastfm,
        ]), editorLastfm]));
        const ordemPerfil = ['letterboxd', 'discord', 'valorant', 'lol', 'steam'];
        for (const id of ordemPerfil) {
          const s = VL.conexoesPerfil.SERVICOS.find((servico) => servico.id === id);
          const campo = el('input', { type: 'text', class: 'vl-campo', maxlength: 56, autocomplete: 'off', placeholder: exemplosPerfil[s.id], 'aria-label': rotulosPerfil[s.id] });
          const estado = el('small', { class: 'vl-conexoes-servico-estado' });
          const editor = el('div', { class: 'vl-conexoes-servico-editor', hidden: true });
          const confirmavel = VL.conexoesPerfil.CONFIRMAVEIS.includes(s.id);
          const ehDiscord = s.id === 'discord';
          const confirmador = ehDiscord ? montarDiscord() : confirmavel ? montarConfirmacaoSteam(s.id, campo) : null;
          const alternar = el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Adicionar', onclick() {
            if (ehDiscord) { confirmador.no.hidden = !confirmador.no.hidden; if (!confirmador.no.hidden) confirmador.recomecar(); return; }
            campo.value = (VL.comunidade && VL.comunidade.perfil && VL.comunidade.perfil.estado().dados[s.id]) || '';
            editor.hidden = !editor.hidden;
            if (confirmador) { confirmador.no.hidden = editor.hidden; if (!editor.hidden) confirmador.recomecar(); }
            if (!editor.hidden) campo.focus();
          } });
          const gravar = el('button', { type: 'button', class: 'vl-botao primario pequeno', texto: 'Salvar', onclick() { const valor = campo.value.trim(); if (valor) salvarServico(s.id, valor, editor, gravar); else perfilEstado.textContent = 'Informe um usuário, ID ou link para adicionar.'; } });
          const remover = el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Remover', onclick() { salvarServico(s.id, '', editor, remover); } });
          if (ehDiscord) confirmador.acoes.append(remover);
          else editor.append(campo, confirmavel ? '' : gravar, remover);
          perfilCampos[s.id] = { campo, estado, editor, alternar, remover, confirmador };
          perfilLista.appendChild(el('div', { class: 'vl-conexoes-servico', 'data-servico': s.id }, [
            el('div', { class: 'vl-conexoes-servico-linha' }, [
              el('span', { class: 'vl-conexoes-servico-icone', 'data-servico': s.id }, [VL.conexoesPerfil.icone ? VL.conexoesPerfil.icone(s.id) : null]),
              el('span', { class: 'vl-conexoes-servico-info' }, [el('strong', { texto: rotulosPerfil[s.id] }), el('small', { texto: descricoesPerfil[s.id] }), estado]),
              alternar,
            ]), editor, confirmador ? confirmador.no : null,
          ]));
        }
        // Discord (2026-11-19): só entra confirmado, pelo login do próprio Discord (o fundo abre a
        // janela de login com chrome.identity e lê só o nome e o id da conta).
        function montarDiscord() {
          const status = el('p', { class: 'vl-nota', role: 'status' });
          const retornoTexto = el('code', { class: 'vl-conexoes-codigo' });
          const ajuda = el('p', { class: 'vl-nota', hidden: true }, ['Se o Discord disser que o endereço de retorno é inválido, cadastre este endereço em Redirects, no OAuth2 do app: ', retornoTexto]);
          const entrar = el('button', { type: 'button', class: 'vl-botao primario pequeno', texto: 'Entrar com Discord', onclick: entrarAgora });
          const acoes = el('div', { class: 'vl-conexoes-confirmar-acoes' }, [entrar]);
          const no = el('div', { class: 'vl-conexoes-confirmar', hidden: true }, [
            el('p', { class: 'vl-nota' }, ['Abre o login do próprio Discord. O Vagalume recebe só o seu nome de usuário: nada de e-mail, servidores ou mensagens, e o acesso é descartado logo depois.']),
            acoes, status, ajuda,
          ]);
          function recomecar() { status.textContent = ''; }
          async function entrarAgora() {
            const api = VL.comunidade && VL.comunidade.perfil;
            const e = api && api.estado();
            if (!e || !e.carregado) { status.textContent = 'Entre no hotel e aguarde seu perfil carregar.'; return; }
            entrar.disabled = true;
            status.textContent = 'Esperando o login na janela do Discord…';
            let r = null;
            try { r = await chrome.runtime.sendMessage({ tipo: 'discord:entrar' }); } catch (erro) { r = null; }
            entrar.disabled = false;
            if (!r || !r.ok) {
              const erro = r && r.erro;
              status.textContent = erro === 'recusado' ? 'Você não autorizou no Discord; nada foi salvo.'
                : erro === 'cancelado' ? 'A janela do Discord foi fechada antes do fim; nada foi salvo.'
                : erro === 'sem-identity' ? 'Recarregue o Vagalume (/recarregarextensao) para liberar o login do Discord.'
                : 'Não deu para confirmar com o Discord agora. Tente de novo.';
              if (r && r.retorno && erro !== 'recusado') { retornoTexto.textContent = r.retorno; ajuda.hidden = false; }
              return;
            }
            ajuda.hidden = true;
            const atual = api.estado().dados;
            try {
              await api.salvar({ ...atual, discord: r.usuario, confirmados: { ...atual.confirmados, discord: r.id } });
              no.hidden = true;
              perfilAviso = 'Discord confirmado e adicionado ao miniperfil (' + (r.nome ? r.nome + ', ' : '') + '@' + r.usuario + ').';
            } catch (erro) { status.textContent = erro.message || 'Não deu para salvar a confirmação.'; }
            desenharPerfil();
          }
          return { no, recomecar, acoes };
        }
        // Steam (2026-11-19): só entra no miniperfil confirmado, por um código no resumo do perfil
        // público, conferido pelo fundo. Adicionar = confirmar.
        function codigoNovo() {
          const n = new Uint32Array(1); crypto.getRandomValues(n);
          return 'vagalume-' + String(n[0] % 1000000).padStart(6, '0');
        }
        function montarConfirmacaoSteam(id, campo) {
          let codigo = codigoNovo();
          const codigoTexto = el('code', { class: 'vl-conexoes-codigo', texto: codigo });
          const status = el('p', { class: 'vl-nota', role: 'status' });
          const link = el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Abrir meu perfil Steam', onclick() {
            const url = VL.conexoesPerfil.destino(id, campo.value.trim());
            if (url) window.open(url, '_blank', 'noopener,noreferrer');
            else status.textContent = 'Escreva acima o nome do seu perfil Steam ou cole o link dele.';
          } });
          const copiar = el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Copiar código', onclick() {
            camada.copiar(codigo).then(function (ok) { status.textContent = ok ? 'Código copiado.' : 'Copie o código: ' + codigo; });
          } });
          const conferir = el('button', { type: 'button', class: 'vl-botao primario pequeno', texto: 'Conferir e adicionar', onclick: conferirAgora });
          const no = el('div', { class: 'vl-conexoes-confirmar', hidden: true }, [
            el('ol', { class: 'vl-conexoes-passos' }, [
              el('li', {}, ['Escreva acima o nome do seu perfil Steam ou cole o link dele.']),
              el('li', {}, ['No Steam, abra o seu perfil e clique em ', el('strong', { texto: 'Editar perfil' }), '. O perfil precisa estar público.']),
              el('li', {}, ['Cole este código no ', el('strong', { texto: 'Resumo' }), ' e salve: ', codigoTexto]),
              el('li', {}, ['Volte aqui e clique em ', el('strong', { texto: 'Conferir e adicionar' }), '. Só depois disso o Steam aparece no seu miniperfil; aí pode apagar o código do resumo.']),
            ]),
            el('div', { class: 'vl-conexoes-confirmar-acoes' }, [link, copiar, conferir]),
            status,
          ]);
          function recomecar() { codigo = codigoNovo(); codigoTexto.textContent = codigo; status.textContent = ''; }
          async function conferirAgora() {
            const api = VL.comunidade && VL.comunidade.perfil;
            const e = api && api.estado();
            const valor = campo.value.trim();
            if (!e || !e.carregado) { status.textContent = 'Entre no hotel e aguarde seu perfil carregar.'; return; }
            if (!valor) { status.textContent = 'Escreva o nome do seu perfil Steam ou cole o link dele.'; return; }
            conferir.disabled = true;
            status.textContent = 'Conferindo o perfil…';
            let r = null;
            try { r = await chrome.runtime.sendMessage({ tipo: 'steam:verificar', valor, codigo }); } catch (erro) { r = null; }
            conferir.disabled = false;
            if (!r || !r.ok) {
              const erro = r && r.erro;
              if (erro === 'sem-permissao') {
                chrome.runtime.sendMessage({ tipo: 'steam:permitir' }).catch(function () {});
                status.textContent = 'Permita a leitura do steamcommunity.com na janelinha que abriu e clique em Conferir de novo.';
              } else status.textContent = erro === 'nao-existe' ? 'Não achei esse perfil no Steam. Confira o nome ou cole o link do perfil.'
                : erro === 'dados' ? 'Esse valor não é um perfil Steam. Use o nome do link (steamcommunity.com/id/nome) ou cole o link.'
                : 'Não deu para ler o perfil agora. Tente de novo em instantes.';
              return;
            }
            if (!r.publico) { status.textContent = 'O perfil está privado. Deixe-o público no Steam e confira de novo.'; return; }
            if (!r.confere) { status.textContent = 'Ainda não achei o código no resumo. Salve o resumo no Steam e confira de novo (o Steam pode levar alguns segundos).'; return; }
            // Confirmado: grava o link exato do perfil (SteamID64) e a confirmação.
            const atual = api.estado().dados;
            const novos = { ...atual, [id]: VL.conexoesPerfil.linkSteam(r.id64), confirmados: { ...atual.confirmados, [id]: r.id64 } };
            try {
              await api.salvar(novos);
              no.hidden = true;
              if (campo.parentNode) campo.parentNode.hidden = true;
              perfilAviso = rotulosPerfil[id] + ' confirmado e adicionado ao miniperfil' + (r.nome ? ' (' + r.nome + ')' : '') + '. Já pode apagar o código do resumo.';
            } catch (erro) { status.textContent = erro.message || 'Não deu para salvar a confirmação.'; }
            desenharPerfil();
          }
          return { no, recomecar };
        }
        function desenharPerfil() {
          const api = VL.comunidade && VL.comunidade.perfil;
          const e = api && api.estado();
          perfilEstado.textContent = perfilAviso || (!e ? 'Ligue a Comunidade Vagalume para usar o miniperfil.' : !e.carregado ? 'Entre no hotel e aguarde seu perfil carregar.' : 'Adicione os serviços que quer mostrar no próprio miniperfil e para outros Vagalumes do quarto.');
          if (!e || !e.carregado) return;
          for (const s of VL.conexoesPerfil.SERVICOS) {
            const ui = perfilCampos[s.id], valor = e.dados[s.id] || '';
            ui.alternar.textContent = s.id === 'discord' ? (valor ? 'Trocar' : 'Conectar') : valor ? 'Editar' : 'Adicionar';
            const confirmado = !!(e.dados.confirmados && e.dados.confirmados[s.id]);
            ui.estado.textContent = !valor ? 'Não adicionado'
              : ui.confirmador && !confirmado ? 'Não confirmado · não aparece no miniperfil'
              : e.dados.publicado ? (confirmado ? '✓ Confirmado · ' : 'No miniperfil · ') + valor
              : 'Valor antigo · salvar uma conexão publica os valores antigos';
            ui.estado.classList.toggle('confirmado', confirmado);
            if (ui.confirmador && ui.editor.hidden && s.id !== 'discord') ui.confirmador.no.hidden = true;
            ui.remover.hidden = !valor;
            if (ui.editor.hidden && camada.foco() !== ui.campo) ui.campo.value = valor;
          }
        }
        const secaoPerfil = el('section', { class: 'vl-modulo vl-conexoes-cartao vl-conexoes-perfil-cartao' }, [
          el('div', { class: 'vl-modulo-topo' }, [el('div', { class: 'vl-modulo-texto' }, [el('strong', { texto: 'Seu miniperfil' }), el('span', { class: 'vl-modulo-resumo', texto: 'Adicione os serviços que quer mostrar para outros Vagalumes.' })])]),
          el('div', { class: 'vl-conexoes-corpo vl-conexoes-perfil-corpo' }, [
            perfilEstado,
            el('p', { class: 'vl-nota', texto: 'Last.fm, Steam e Discord são confirmados (✓) e só aparecem no miniperfil depois disso. Os outros ficam como informados por você.' }),
            perfilLista,
          ]),
        ]);
        // Sem abas (2026-11-19): a aba Habblet ficou oculta e o Last.fm abre dentro da linha dele.
        alvo.append(
          el('h2', { class: 'vl-acoes-titulo', texto: 'Conexões' }),
          el('p', { class: 'vl-nota', texto: 'Escolha o que aparece no seu miniperfil para outros Vagalumes.' }),
          secaoPerfil,
        );
        alvo.classList.add('vl-conexoes-pagina', 'perfil-ativa');
        function sincronizar() {
          chave.checked = ctx.config().modulos.musica === true;
          for (const campo of campos) campo.atualizar();
          desenharJogo();
        }
        chave.addEventListener('change', function () {
          ctx.alterar('modulos', { musica: chave.checked }).then(function () { marcar(marca, 'gravado'); }, function () {
            sincronizar(); marcar(marca, 'não gravou', true);
          });
        });
        sincronizar();
        desenharPerfil();
        const pararConfig = nucleo.ouvir('config', sincronizar);
        const pararEstado = jogo && jogo.aoEstado ? jogo.aoEstado(desenharJogo) : function () {};
        const pararPerfil = ctx.ouvir('perfil:estado', desenharPerfil);
        return function () { pararConfig(); pararEstado(); pararPerfil(); pararAtividade(); };
      }

      // ---------- Ajustes (repaginado em 2026-11-15, pedido do usuário: "muito confuso, difícil de
      // encontrar as coisas, as buscas não são muito assertivas") ----------
      // Início: assuntos em blocos (cada um diz quantos módulos estão ligados). Um assunto: os módulos
      // dele, com o resumo à vista e o aviso quando dependem da Conexão. Busca: resultados por
      // pontuação (nome do módulo, rótulo do ajuste, sinônimos, comandos), com o próprio controle do
      // ajuste ali mesmo.
      const ASSUNTOS = [
        { id: 'conversa', nome: 'Chat e conversa', desc: 'Menções, links nas falas, silenciar, histórico, comandos, macros e avisos.', modulos: ['chat', 'digitando', 'mencoes', 'silenciar', 'agrupar', 'historico', 'apelidos', 'comandos', 'macros', 'notificacoes'] },
        { id: 'pessoas', nome: 'Pessoas e amigos', desc: 'Amigos, imagens, áudios, chamada de voz e a comunidade Vagalume.', modulos: ['amigos', 'midia', 'comunidade'] },
        { id: 'quarto', nome: 'Quarto e avatar', desc: 'Conexão do jogo, andar com setas, voltar ao quarto, visual, efeitos e zoom.', modulos: ['conexao', 'visual', 'zoom'] },
        { id: 'construcao', nome: 'Construção e wired', desc: 'Mover e girar mobis, áreas, copiar quarto e wired.', modulos: ['construcao', 'wired'] },
        { id: 'loja', nome: 'Loja e inventário', desc: 'Comprar, repor, carrinho, Feira Livre e excluir em massa.', modulos: ['loja'] },
        { id: 'aparencia', nome: 'Aparência', desc: 'Tema Vagalume, janelas, barra de baixo e CSS próprio.', modulos: ['interface', 'janelas', 'estilo'] },
        { id: 'desempenho', nome: 'Desempenho', desc: 'Jogo fluido, FPS e ping no canto, limitar quadros e bloquear anúncios.', modulos: ['fluido', 'contador', 'fps', 'anuncios', 'medicao'] },
        { id: 'sistema', nome: 'Painel e captura', desc: 'Este painel, atalho de teclado e captura de tela.', modulos: ['painel', 'captura'] },
      ];
      const PRECISA_CONEXAO = new Set(['construcao', 'amigos', 'loja', 'visual', 'wired', 'comunidade', 'musica', 'midia']);
      // Palavras que as pessoas usam para procurar -> palavras que estão nos módulos.
      const SINONIMOS = {
        spotify: 'musica lastfm', lastfm: 'musica', 'last.fm': 'musica', som: 'musica volume', cancao: 'musica',
        fps: 'contador quadros', ping: 'contador latencia', lag: 'contador fps', travando: 'fps desempenho',
        escuro: 'tema', cor: 'tema estilo', cores: 'tema estilo', visual: 'tema visual', roupa: 'visual vestir', look: 'visual',
        mencao: 'mencoes', marcar: 'mencoes', arroba: 'mencoes', '@': 'mencoes',
        mute: 'silenciar', bloquear: 'silenciar', ignorar: 'silenciar', esconder: 'silenciar ocultar',
        link: 'links chat', links: 'chat', amigo: 'amigos', seguir: 'amigos acompanhar', grupo: 'comunidade', selo: 'comunidade',
        mobi: 'construcao mobis', mobis: 'construcao', mover: 'construcao', girar: 'construcao', altura: 'construcao',
        comprar: 'loja', compra: 'loja', inventario: 'loja janelas', feira: 'loja',
        print: 'captura', foto: 'captura', tela: 'captura', efeito: 'visual efeitos', handitem: 'visual',
        atalho: 'teclado atalho', setas: 'setinhas andar', andar: 'setinhas', anuncio: 'anuncios', propaganda: 'anuncios',
      };

      function montarAjustes(alvo) {
        const campos = [];
        const caixas = new Map();
        const busca = el('input', { type: 'search', id: 'vl-busca-ajustes', class: 'vl-campo vl-busca', placeholder: 'Ex.: amigos, voz, tema, FPS…', 'aria-label': 'Buscar funções e ajustes' });
        const trocarVisual = el('button', { type: 'button', class: 'vl-visual-ajustes', texto: visualAjustes === 'lista' ? 'Ver cartões' : 'Ver lista' });
        const areaBusca = el('div', { class: 'vl-busca-area' }, [
          el('div', { class: 'vl-busca-cab' }, [el('label', { class: 'vl-busca-rotulo', for: 'vl-busca-ajustes', texto: 'Buscar funções e ajustes' }), trocarVisual]), busca,
        ]);
        const vista = el('div', { class: 'vl-vista' });
        const rodape = el('div', { class: 'vl-rodape-ajustes' });
        alvo.append(areaBusca, vista, rodape);
        let assunto = null;
        let assuntoAberto = null;
        const catalogo = padroes.CATALOGO;
        const porId = new Map(catalogo.map((m) => [m.id, m]));
        const listados = new Set(ASSUNTOS.flatMap((a) => a.modulos).concat('musica'));
        const assuntos = ASSUNTOS.map((a) => Object.assign({}, a, { modulos: a.modulos.filter((id) => porId.has(id)) }));
        const sobra = catalogo.filter((m) => !listados.has(m.id)).map((m) => m.id);
        if (sobra.length) assuntos[assuntos.length - 1].modulos.push(...sobra);

        function ligado(id) { return id === 'painel' || ctx.config().modulos[id] === true; }

        // Um cartão de módulo: interruptor, nome, resumo, dependência e os ajustes (abertos ou não).
        function cartaoDoModulo(m, abertoDeInicio, soCampos) {
          const defs = (CAMPOS[m.id] || []).filter(Boolean).filter((d) => !soCampos || soCampos.includes(d));
          const ajustes = el('div', { class: 'vl-ajustes', hidden: true });
          let montados = false;
          function montarCampos() {
            if (montados) return;
            montados = true;
            for (const def of defs) {
              const c = campoDoPainel(m.id, def);
              if (!c) continue;
              campos.push(c);
              ajustes.appendChild(c.no);
            }
            if (!defs.length) ajustes.appendChild(el('p', { class: 'vl-nota', texto: m.id === 'visual' ? 'Efeitos, handitems e suas opções ficam na aba Efeitos e itens.' : 'Só liga e desliga; não tem outros ajustes.' }));
          }
          let interruptor = null;
          if (m.id !== 'painel') {
            interruptor = el('input', { type: 'checkbox', class: 'vl-interruptor', 'aria-label': 'Ligar ' + m.nome });
            interruptor.checked = ligado(m.id);
            interruptor.addEventListener('change', function () {
              ctx.alterar('modulos', { [m.id]: interruptor.checked }).then(function () {
                if (m.recarregar) camada.aviso(m.nome + ': vale depois de recarregar o hotel.');
              }, function () {
                interruptor.checked = ligado(m.id);
                camada.aviso('Não foi possível salvar a mudança.', { tipo: 'erro' });
              });
            });
            if (!caixas.has(m.id)) caixas.set(m.id, []);
            caixas.get(m.id).push(interruptor);
          }
          const dependencia = el('div', { class: 'vl-dependencia', hidden: true }, [
            el('span', { texto: 'Precisa da Conexão do jogo, que está desligada.' }),
            el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Ligar a Conexão', onclick() {
              ctx.alterar('modulos', { conexao: true }).then(function () { camada.aviso('Conexão ligada. Recarregue o hotel para valer.'); });
            } }),
          ]);
          const expandir = el('button', { type: 'button', class: 'vl-expandir', 'aria-expanded': 'false' });
          const cartao = el('div', { class: 'vl-modulo' + (m.id === 'painel' ? ' fixo' : '') }, [
            el('div', { class: 'vl-modulo-topo' }, [
              interruptor || el('span', { class: 'vl-sempre', title: 'O painel fica sempre ligado', texto: 'sempre' }),
              ilustrado('modulo:' + m.id, 'vl-modulo-ilus', 28, null),
              el('div', { class: 'vl-modulo-texto' }, [
                el('div', { class: 'vl-modulo-nome' }, [
                  el('strong', { texto: m.nome }),
                  m.recarregar ? el('span', { class: 'vl-selo', title: 'Ligar ou desligar vale depois de recarregar o hotel', texto: 'recarrega' }) : null,
                ]),
                el('span', { class: 'vl-modulo-resumo', texto: m.resumo }),
              ]),
              expandir,
            ]),
            dependencia,
            ajustes,
          ]);
          function abrirFechar(abrir) {
            if (abrir) montarCampos();
            ajustes.hidden = !abrir;
            cartao.classList.toggle('aberto', abrir);
            expandir.setAttribute('aria-expanded', abrir ? 'true' : 'false');
            expandir.textContent = abrir ? 'Fechar' : (defs.length ? (visualAjustes === 'lista' ? 'Configurar' : 'Ajustes') : 'Detalhes');
          }
          expandir.addEventListener('click', function () { abrirFechar(ajustes.hidden); });
          function dep() { dependencia.hidden = !(PRECISA_CONEXAO.has(m.id) && ligado(m.id) && !ligado('conexao')); }
          dep();
          cartao.atualizarDependencia = dep;
          abrirFechar(!!abertoDeInicio);
          return cartao;
        }

        // ---------- início: os assuntos ----------
        function contarAssunto(a) {
          const ligados = a.modulos.filter(ligado).length;
          return ligados + ' de ' + a.modulos.length + ' ligado' + (ligados === 1 ? '' : 's');
        }
        function alternarAssunto(id) {
          assuntoAberto = assuntoAberto === id ? null : id;
          for (const secao of vista.querySelectorAll('.vl-assunto-secao')) {
            const aberto = secao.dataset.assunto === assuntoAberto;
            secao.classList.toggle('aberto', aberto);
            secao.querySelector('.vl-assunto-funcoes').hidden = !aberto;
            secao.querySelector('.vl-assunto-abertura').setAttribute('aria-expanded', String(aberto));
            secao.querySelector('.vl-assunto-seta').textContent = aberto ? '⌄' : '›';
          }
        }
        function desenharInicio() {
          assunto = null;
          if (visualAjustes === 'lista') {
            const blocos = assuntos.map(function (a) {
              const aberto = assuntoAberto === a.id;
              const cabecalho = el('button', { type: 'button', class: 'vl-assunto-abertura', 'aria-expanded': String(aberto), 'aria-controls': 'vl-assunto-' + a.id, onclick() { alternarAssunto(a.id); } }, [
                iconeAssunto(a.id),
                el('span', { class: 'vl-assunto-info' }, [el('strong', { texto: a.nome }), el('small', { texto: a.desc })]),
                el('span', { class: 'vl-assunto-lado' }, [el('span', { class: 'vl-assunto-conta', texto: contarAssunto(a) }), el('span', { class: 'vl-assunto-seta', 'aria-hidden': 'true', texto: aberto ? '⌄' : '›' })]),
              ]);
              const funcoes = el('div', { class: 'vl-assunto-funcoes', id: 'vl-assunto-' + a.id, hidden: !aberto }, [
                el('p', { class: 'vl-nota', texto: 'Use o interruptor para ligar. Abra Configurar para mudar as opções.' }),
                el('div', { class: 'vl-modulos' }, a.modulos.map((mid) => cartaoDoModulo(porId.get(mid), a.modulos.length === 1))),
              ]);
              return el('section', { class: 'vl-assunto-secao' + (aberto ? ' aberto' : ''), 'data-assunto': a.id }, [cabecalho, funcoes]);
            });
            vista.replaceChildren(
              el('div', { class: 'vl-inicio-titulo' }, [el('strong', { texto: 'Explore as funções' }), el('span', { texto: 'Abra um assunto e ajuste tudo aqui mesmo.' })]),
              el('div', { class: 'vl-assuntos-lista' }, blocos),
            );
            rodape.hidden = false;
            return;
          }
          const blocos = assuntos.map(function (a) {
            return el('button', { type: 'button', class: 'vl-assunto', onclick() { abrirAssunto(a.id); } }, [
              el('strong', { texto: a.nome }),
              el('span', { class: 'vl-assunto-desc', texto: a.desc }),
              el('span', { class: 'vl-assunto-conta', texto: contarAssunto(a) }),
            ]);
          });
          vista.replaceChildren(
            el('p', { class: 'vl-nota vl-dica-inicio', texto: 'Escolha um assunto ou use a busca. Ligue cada função no interruptor; abra Ajustes para configurar os detalhes.' }),
            el('div', { class: 'vl-assuntos' }, blocos),
          );
          rodape.hidden = false;
        }
        trocarVisual.addEventListener('click', function () {
          visualAjustes = visualAjustes === 'lista' ? 'cartoes' : 'lista';
          trocarVisual.textContent = visualAjustes === 'lista' ? 'Ver cartões' : 'Ver lista';
          assunto = null;
          assuntoAberto = null;
          if (busca.value.trim()) desenharBusca(); else desenharInicio();
        });

        function abrirAssunto(id) {
          const a = assuntos.find((x) => x.id === id);
          if (!a) { desenharInicio(); return; }
          assunto = id;
          const voltar = el('button', { type: 'button', class: 'vl-voltar', texto: '← Voltar aos assuntos', title: 'Volta para a lista de assuntos', onclick: desenharInicio });
          const cartoes = a.modulos.map((mid) => cartaoDoModulo(porId.get(mid), a.modulos.length === 1));
          vista.replaceChildren(voltar, el('h3', { class: 'vl-titulo-assunto', texto: a.nome }), el('p', { class: 'vl-nota', texto: a.desc }), el('div', { class: 'vl-modulos' }, cartoes));
          rodape.hidden = true;
          vista.scrollIntoView && voltar.focus();
        }

        // ---------- busca ----------
        function palavras(texto) {
          const base = normalizar(texto).split(/[^a-z0-9@.]+/).filter((p) => p.length >= 2 || p === '@');
          const extra = [];
          for (const p of base) if (SINONIMOS[p]) extra.push(...SINONIMOS[p].split(' '));
          return { base, todas: Array.from(new Set(base.concat(extra))) };
        }
        function pontos(texto, termos, peso) {
          const t = normalizar(texto);
          if (!t) return 0;
          const ditas = t.split(/[^a-z0-9@.]+/);
          let soma = 0;
          for (const p of termos) {
            if (ditas.includes(p)) soma += peso;
            else if (ditas.some((d) => d.startsWith(p))) soma += peso * 0.7;
            else if (p.length >= 4 && t.includes(p)) soma += peso * 0.4;
          }
          return soma;
        }
        function procurar(texto) {
          const { base, todas } = palavras(texto);
          if (!todas.length) return [];
          const achados = [];
          for (const m of catalogo) {
            const pm = pontos(m.nome, todas, 30) + pontos(m.id, todas, 20) + pontos(m.resumo, todas, 6);
            if (pm > 0) achados.push({ tipo: 'modulo', m, pontos: pm + (base.every((p) => normalizar(m.nome).includes(p)) ? 40 : 0) });
            for (const def of (CAMPOS[m.id] || []).filter(Boolean)) {
              const pc = pontos(def.rotulo || '', todas, 18) + pontos(def.nota || '', todas, 4) + pm * 0.3;
              if (pc >= 10) achados.push({ tipo: 'campo', m, def, pontos: pc });
            }
          }
          for (const c of nucleo.comandos.listar()) {
            const pc = pontos(c.nome, todas, 22) + pontos((c.apelidos || []).join(' '), todas, 12) + pontos(c.descricao || '', todas, 5);
            if (pc >= 10) achados.push({ tipo: 'comando', c, pontos: pc * 0.8 });
          }
          return achados.sort((a, b) => b.pontos - a.pontos).slice(0, 14);
        }
        function desenharBusca() {
          const texto = busca.value.trim();
          if (!texto) { if (assunto) abrirAssunto(assunto); else desenharInicio(); return; }
          rodape.hidden = true;
          const achados = procurar(texto);
          if (!achados.length) {
            vista.replaceChildren(el('p', { class: 'vl-vazio', texto: 'Nada encontrado para "' + texto + '". Tente outra palavra, como tema, música, amigos, loja ou FPS.' }));
            return;
          }
          // Ajustes do mesmo módulo ficam juntos num cartão aberto só com eles.
          const nos = [];
          const vistos = new Set();
          for (const a of achados) {
            if (a.tipo === 'comando') {
              const p = VL.comandos ? VL.comandos.inicioDigitado(ctx.config().comandos.prefixo) : '/';
              nos.push(el('div', { class: 'vl-resultado-comando' }, [
                el('code', { class: 'vl-codigo', texto: p + (a.c.uso || a.c.nome) }),
                el('span', { class: 'vl-nota', texto: a.c.descricao || '' }),
                el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Escrever no chat', onclick() {
                  const campo = jogo.entradaChat();
                  if (!campo) { camada.aviso('Entre num quarto para usar o chat.', { tipo: 'erro' }); return; }
                  jogo.definirValor(campo, p + a.c.nome + ' ');
                  campo.focus();
                } }),
              ]));
              continue;
            }
            if (vistos.has(a.m.id)) continue;
            vistos.add(a.m.id);
            if (a.m.id === 'musica') {
              nos.push(el('div', { class: 'vl-resultado' }, [
                el('span', { class: 'vl-resultado-onde', texto: 'Conexões' }),
                el('button', { type: 'button', class: 'vl-botao', texto: 'Abrir Música (Last.fm)', onclick() { selecionar('conexoes'); } }),
              ]));
              continue;
            }
            const doModulo = achados.filter((x) => x.tipo === 'campo' && x.m.id === a.m.id).map((x) => x.def);
            const so = a.tipo === 'campo' || (doModulo.length && doModulo.length < (CAMPOS[a.m.id] || []).length) ? doModulo : null;
            // O primeiro módulo achado já vem aberto (com todos os ajustes, ou só os que combinaram).
            const cartao = cartaoDoModulo(a.m, !!so || vistos.size === 1, so);
            nos.push(el('div', { class: 'vl-resultado' }, [el('span', { class: 'vl-resultado-onde', texto: (assuntos.find((x) => x.modulos.includes(a.m.id)) || {}).nome || '' }), cartao]));
          }
          vista.replaceChildren(el('p', { class: 'vl-nota', texto: nos.length + ' resultado' + (nos.length === 1 ? '' : 's') + ' para "' + texto + '"' }), ...nos);
        }
        let relogioBusca = 0;
        busca.addEventListener('input', function () { clearTimeout(relogioBusca); relogioBusca = setTimeout(desenharBusca, 120); });
        busca.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && busca.value) { ev.stopPropagation(); busca.value = ''; desenharBusca(); } });
        desenharInicio();

        // Cópia de segurança e redefinição, como na página de opções.
        const arquivo = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
        arquivo.addEventListener('change', async function () {
          const f = arquivo.files && arquivo.files[0];
          arquivo.value = '';
          if (!f) return;
          let novo;
          try { novo = VL.config.importar(await f.text()); } catch (erro) { camada.aviso(erro.message, { tipo: 'erro' }); return; }
          if (!(await camada.confirmar('Trocar todas as configurações do Vagalume pelas do arquivo?', { titulo: 'Importar configurações', sim: 'Importar' }))) return;
          try {
            for (const secao of Object.keys(novo)) await ctx.gravar(secao, novo[secao]);
            camada.aviso('Configurações importadas. Alguns módulos só mudam depois de recarregar o hotel.', { tipo: 'ok' });
          } catch (erro) { camada.aviso('Não foi possível importar tudo.', { tipo: 'erro' }); }
        });
        rodape.appendChild(el('section', { class: 'vl-secao vl-quadro' }, [
          el('h3', { texto: 'Cópia de segurança' }),
          el('p', { class: 'vl-nota', texto: 'Guarde as suas configurações num arquivo, traga de volta de um arquivo ou volte tudo ao padrão.' }),
          el('div', { class: 'vl-linha' }, [
            el('button', { type: 'button', class: 'vl-botao', texto: 'Exportar', onclick() {
              camada.baixar('vagalume-configuracoes-' + camada.carimbo() + '.json', VL.config.exportar(ctx.config()), 'application/json;charset=utf-8');
            } }),
            el('button', { type: 'button', class: 'vl-botao', texto: 'Importar…', onclick() { arquivo.click(); } }),
            el('button', { type: 'button', class: 'vl-botao perigo', texto: 'Redefinir tudo', async onclick() {
              if (!(await camada.confirmar('Voltar todas as configurações do Vagalume ao padrão? Isso não pode ser desfeito.', { titulo: 'Redefinir', sim: 'Redefinir' }))) return;
              try {
                for (const secao of Object.keys(padroes.PADROES)) await ctx.gravar(secao, padroes.PADROES[secao]);
                camada.aviso('Configurações de volta ao padrão.', { tipo: 'ok' });
              } catch (erro) { camada.aviso('Não foi possível redefinir tudo.', { tipo: 'erro' }); }
            } }),
            arquivo,
          ]),
        ]));

        // Mantém tudo em dia sem redesenhar (o foco do teclado não se perde).
        function sincronizar() {
          const modulos = ctx.config().modulos;
          caixas.forEach(function (lista, id) { lista.forEach(function (caixa) { caixa.checked = modulos[id] === true; }); });
          for (let i = campos.length - 1; i >= 0; i--) {
            if (!campos[i].no.isConnected) { campos.splice(i, 1); continue; }
            try { campos[i].atualizar(); } catch (erro) { /* campo removido */ }
          }
          vista.querySelectorAll('.vl-modulo').forEach(function (c) { if (c.atualizarDependencia) c.atualizarDependencia(); });
          if (visualAjustes === 'lista') {
            vista.querySelectorAll('.vl-assunto-secao').forEach(function (secao) {
              const a = assuntos.find((x) => x.id === secao.dataset.assunto);
              if (a) secao.querySelector('.vl-assunto-conta').textContent = contarAssunto(a);
            });
          } else if (!assunto && !busca.value.trim() && camada.foco() !== busca) desenharInicio();
        }
        const parar1 = nucleo.ouvir('config', sincronizar);
        const parar2 = nucleo.ouvir('modulo', sincronizar);
        return function () { parar1(); parar2(); };
      }

      // ---------- ligações ----------

      ctx.escutar(window, 'keydown', function (ev) {
        if (!ev.isTrusted || ev.repeat || ev.isComposing) return;
        const atalho = ctx.secao().atalho;
        if (!atalho || atalhos.deEvento(ev) !== atalho) return;
        ev.preventDefault();
        ev.stopImmediatePropagation(); // o atalho do painel vem antes de qualquer macro com a mesma combinação
        alternar();
      }, true);

      ctx.escutar(window, 'resize', function () { posicionar(); });

      ctx.aoConfig(function (secao) {
        if (secao === 'painel') atualizarBotao();
      });

      ctx.ouvir('painel:alternar', function () { alternar(); });
      ctx.ouvir('painel:abrir', function (dado) { abrir(dado && dado.aba); });
      ctx.ouvir('painel:fechar', function () { fechar(true); });
      ctx.ouvir('abas', function () {
        if (!janela) return;
        const focado = camada.foco();
        const naBarra = !!(focado && barraAbas.contains(focado));
        const abas = abasParaPainel();
        if (!abas.some((a) => a.id === abaAtual)) {
          abaAtual = abas.length ? abas[0].id : 'inicio';
          montarAba();
        } else if (abas.find((a) => a.id === abaAtual) !== defAbaMontada) {
          montarAba();
        }
        desenharAbas(naBarra);
      });

      // Boas-vindas (pedido do usuário em 2026-11-15): apresentação curta que aparece uma vez, na
      // primeira vez que a pessoa entra no hotel com o Vagalume. Fica marcada em vl.boasVindasVista.
      const CHAVE_BOAS_VINDAS = 'vl.boasVindasVista';
      const RECURSOS = [
        ['Chat e conversa', 'Menções com @, histórico das falas, links clicáveis e silenciar quem você quiser.'],
        ['Pessoas e amigos', 'Veja onde seus amigos estão e mostre só amigos no quarto.'],
        ['Conexões', 'Conecte o Last.fm para mostrar no miniperfil o que você está ouvindo.'],
        ['Construção', 'Mova, gire e mude a altura dos mobis com um clique; copie e cole quartos inteiros.'],
        ['Loja e inventário', 'Compre sem confirmação extra, reponha mobis sozinho e veja o inventário com imagens.'],
        ['Zoom e câmera', 'Aproxime e afaste o quarto com a roda do mouse, suave e rumo ao cursor.'],
        ['Aparência', 'Tema Vagalume nas janelas do jogo, contador de FPS e ping, macros e capturas de tela.'],
      ];
      let boasVindas = null;
      function mostrarBoasVindas() {
        if (boasVindas) return;
        const atalho = ctx.secao().atalho;
        const prefixo = VL.comandos ? VL.comandos.inicioDigitado(ctx.config().comandos.prefixo) : '/';
        let fecharBV = null;
        const explorar = el('button', { type: 'button', class: 'vl-botao primario', texto: 'Explorar o painel', onclick() { fecharBV(); abrir('inicio'); } });
        const comecar = el('button', { type: 'button', class: 'vl-botao', texto: 'Começar a jogar', onclick() { fecharBV(); } });
        const caixa = el('div', { class: 'vl-bv', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'vl-bv-titulo' }, [
          el('div', { class: 'vl-bv-topo' }, [
            el('span', { class: 'vl-bv-ponto', 'aria-hidden': 'true' }),
            el('div', {}, [
              el('h2', { id: 'vl-bv-titulo', texto: 'Bem-vindo ao Vagalume' }),
              el('p', { class: 'vl-bv-lema', texto: 'Uma luz a mais no seu Habblet.' }),
            ]),
          ]),
          el('p', { class: 'vl-bv-texto', texto: 'O Vagalume é uma extensão que deixa o Habblet mais prático, bonito e divertido. Ela junta num lugar só ferramentas de chat, amigos, construção, loja e aparência — e cada uma pode ser ligada ou desligada quando você quiser.' }),
          el('div', { class: 'vl-bv-grade' }, RECURSOS.map(([titulo, texto]) => el('div', { class: 'vl-bv-cartao' }, [
            el('strong', { texto: titulo }), el('span', { texto: texto }),
          ]))),
          el('h3', { class: 'vl-bv-sub', texto: 'Para começar' }),
          el('ul', { class: 'vl-bv-dicas' }, [
            el('li', {}, [el('kbd', { texto: atalho || 'botão redondo' }), el('span', { texto: atalho ? ' ou o botão redondo no canto abre o painel com todas as opções.' : ' no canto abre o painel com todas as opções.' })]),
            el('li', {}, [el('kbd', { texto: prefixo }), el('span', { texto: ' no chat mostra a lista de comandos do Vagalume.' })]),
            el('li', {}, [el('span', { texto: 'Na busca do painel, escreva o que procura: música, zoom, tema, amigos…' })]),
          ]),
          el('p', { class: 'vl-bv-fim', texto: 'Explore as opções disponíveis e divirta-se!' }),
          el('div', { class: 'vl-bv-acoes' }, [comecar, explorar]),
          el('p', { class: 'vl-bv-nota', texto: 'Extensão feita por fãs, sem ligação oficial com o Habblet. Para ver esta apresentação de novo: ' + prefixo + 'boasvindas' }),
        ]);
        const veu = el('div', { class: 'vl-veu vl-bv-veu' }, [caixa]);
        function aoTeclar(ev) {
          if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); fecharBV(); }
          else if (ev.key === 'Tab') {
            ev.preventDefault(); ev.stopImmediatePropagation();
            (explorar.getRootNode().activeElement === explorar ? comecar : explorar).focus();
          }
        }
        function tirar() { window.removeEventListener('keydown', aoTeclar, true); veu.remove(); boasVindas = null; }
        fecharBV = function () {
          if (!boasVindas) return;
          tirar();
          try { chrome.storage.local.set({ [CHAVE_BOAS_VINDAS]: padroes.VERSAO }); } catch (erro) { /* contexto da extensão encerrado */ }
        };
        boasVindas = tirar; // ao desligar a extensão, sai sem marcar como vista
        window.addEventListener('keydown', aoTeclar, true);
        camada.area().appendChild(veu);
        explorar.focus();
      }
      // Espera o hotel terminar de carregar (barra de baixo e tela do quarto) antes de apresentar.
      let relogioBV = 0;
      try {
        chrome.storage.local.get(CHAVE_BOAS_VINDAS).then(function (r) {
          if (r && r[CHAVE_BOAS_VINDAS]) return;
          const inicio = Date.now();
          (function esperar() {
            const pronto = document.querySelector('.nitro-toolbar') && document.querySelector('canvas');
            if (pronto) { relogioBV = setTimeout(mostrarBoasVindas, 1500); return; }
            if (Date.now() - inicio < 180000) relogioBV = setTimeout(esperar, 1000);
          })();
        }).catch(function () { /* sem storage: não apresenta */ });
      } catch (erro) { /* contexto da extensão encerrado */ }

      ctx.comando({
        nome: 'boasvindas',
        uso: 'boasvindas',
        descricao: 'Mostra de novo a apresentação do Vagalume.',
        executar() { mostrarBoasVindas(); },
      });

      ctx.comando({
        nome: 'painel',
        uso: 'painel',
        descricao: 'Abre ou fecha o painel do Vagalume.',
        executar() { alternar(); },
      });

      // ---------- Início (2026-11-20, pedido do usuário: painel mais ilustrativo) ----------
      // Seu avatar e o quarto em que você está; as seções que você mais abre, em cartões com imagens
      // do Habbo; e todas as outras seções logo abaixo.
      const DESCRICAO_ABAS = {
        inicio: 'Ligue e ajuste cada função', 'efeitos-itens': 'Efeitos e itens de mão', conexoes: 'Miniperfil e contas confirmadas',
        quarto: 'Ações rápidas no quarto', historico: 'Tudo o que foi falado', mencoes: 'Quem chamou você',
        comandos: 'Todos os comandos', macros: 'Falas automáticas', 'grupos-voz': 'Chamadas com amigos',
        captura: 'Prints do quarto', construcao: 'Mover, girar e empilhar', inventario: 'Seus mobis', wired: 'Copiar e colar wired',
      };
      const PADRAO_MAIS_USADOS = ['construcao', 'efeitos-itens', 'grupos-voz', 'conexoes', 'captura', 'quarto'];
      function montarCasa(alvo) {
        const abas = abasParaPainel().filter((a) => a.id !== 'casa');
        const porId = new Map(abas.map((a) => [a.id, a]));
        const P = VL.pessoas;
        const nome = (P && P.eu && P.eu()) || '';
        const pessoa = nome && P && P.visualDe ? P.visualDe(nome) : null;
        const visual = pessoa && typeof pessoa === 'object' ? pessoa.visual : '';
        const quarto = P && P.quartoNome ? P.quartoNome() : '';
        const ligados = Object.entries(ctx.config().modulos || {}).filter(([, v]) => v === true).length;
        const foto = el('div', { class: 'vl-casa-foto', 'aria-hidden': 'true' });
        if (visual && /^[a-z]{2}-\d+(-\d+)*(\.[a-z]{2}-\d+(-\d+)*)*$/.test(visual)) {
          foto.appendChild(el('img', { alt: '', src: 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(visual) + '&direction=2&head_direction=3&gesture=sml&size=m' }));
        } else {
          foto.classList.add('sem-foto');
        }
        const topo = el('section', { class: 'vl-casa-topo' }, [
          foto,
          el('div', { class: 'vl-casa-ola' }, [
            el('strong', { texto: nome ? 'Olá, ' + nome + '!' : 'Olá!' }),
            el('span', { texto: quarto ? 'Você está em ' + quarto : 'Entre num quarto para usar tudo' }),
            el('span', { class: 'vl-casa-selo', texto: ligados + ' funções ligadas' }),
          ]),
        ]);
        const contados = Object.entries(uso).filter(([id, n]) => porId.has(id) && n > 0).sort((a, b) => b[1] - a[1]).map(([id]) => id);
        const mais = [...new Set(contados.concat(PADRAO_MAIS_USADOS).filter((id) => porId.has(id)))].slice(0, 6);
        const cartao = (id) => {
          const a = porId.get(id);
          return el('button', { type: 'button', class: 'vl-casa-cartao', onclick() { selecionar(id); } }, [
            ilustrado('aba:' + id, 'vl-casa-ilus', 40, desenharIcone(caminhosAbas[id] || caminhosAbas.inicio, 'vl-casa-icone')),
            el('strong', { texto: a.titulo }),
            el('span', { texto: DESCRICAO_ABAS[id] || '' }),
          ]);
        };
        const outras = abas.filter((a) => !mais.includes(a.id));
        const filhos = [
          topo,
          el('h3', { class: 'vl-casa-titulo', texto: contados.length ? 'Você mais usa' : 'Para começar' }),
          el('div', { class: 'vl-casa-grade' }, mais.map(cartao)),
        ];
        // Atalho para o YouTube (janela do Vagalume), quando estiver disponível.
        if (VL.youtubeTV && typeof VL.youtubeTV.abrir === 'function') {
          filhos.push(el('button', { type: 'button', class: 'vl-casa-faixa', onclick() { VL.youtubeTV.abrir(); } }, [
            ilustrado('atalho:youtube', 'vl-casa-ilus pequena', 30, null),
            el('span', { class: 'vl-casa-faixa-texto' }, [el('strong', { texto: 'YouTube no Vagalume' }), el('span', { texto: 'Assista sozinho ou junto com o quarto' })]),
            el('span', { class: 'vl-casa-seta', 'aria-hidden': 'true', texto: '›' }),
          ]));
        }
        if (outras.length) {
          filhos.push(el('h3', { class: 'vl-casa-titulo', texto: 'Todas as seções' }));
          filhos.push(el('div', { class: 'vl-casa-lista' }, outras.map((a) => el('button', { type: 'button', class: 'vl-casa-item', onclick() { selecionar(a.id); } }, [
            ilustrado('aba:' + a.id, 'vl-casa-ilus pequena', 24, desenharIcone(caminhosAbas[a.id] || caminhosAbas.inicio, 'vl-casa-icone pequena')),
            el('span', { texto: a.titulo }),
          ]))));
        }
        filhos.push(el('p', { class: 'vl-nota vl-casa-dica', texto: 'Procurando uma função? Abra Ajustes e escreva na busca o que você quer fazer.' }));
        alvo.append(...filhos);
      }
      ctx.aba({ id: 'casa', titulo: 'Início', ordem: -10, montar: montarCasa });
      ctx.aba({ id: 'inicio', titulo: 'Ajustes', ordem: 0, montar: montarAjustes });
      ctx.aba({ id: 'conexoes', titulo: 'Conexões', ordem: 3, montar: montarConexoes });

      atualizarBotao();
      ctx.aoParar(function () {
        clearTimeout(relogioBV);
        if (boasVindas) boasVindas();
        fechar(true);
        if (botao) botao.remove();
        botao = null;
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
