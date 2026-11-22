// Vagalume — ferramenta de construção (pedido do usuário em 2026-11-15): selecionar uma área do chão
// arrastando, como no Paint, ver a área desenhada no chão (borda limão e o meio translúcido) e agir em
// tudo de dentro (mover, girar, espelhar, subir, descer, nivelar, escada, estado, recolher), além de
// selecionar itens iguais ou a pilha e ver as alturas. A janela completa é a ferramenta do próprio jogo, com o tema.
//
// Onde fica cada piso na tela: o quarto é isométrico e o Vagalume calibra com cliques no chão (o jogo
// manda o piso no pedido de andar, o Vagalume sabe onde foi o clique). Acompanha o arraste da câmera do
// jogo e a troca do zoom do jogo; a câmera do Vagalume é desfeita pelo retângulo do canvas.
// Carregado antes de modulos/construcao.js, que chama VL.ferramentaConstrucao(ctx, api).
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.camada || !VL.codigos || !VL.jogo) return;
  const { camada, codigos, jogo } = VL;
  const { SAIDA, ENTRADA } = codigos;
  const NS = 'http://www.w3.org/2000/svg';

  VL.ferramentaConstrucao = function (ctx, api) {
    const el = camada.el;
    const conexao = VL.conexao;
    let mapaMotor = null;
    let geracaoQuarto = 0;
    let selecionandoMotor = false;
    let areaMotor = null;
    let pedidoMotor = 0;
    let respostaMotor = null;
    function pedirMotor(acao, dados) {
      const id = ++pedidoMotor;
      respostaMotor = null;
      document.dispatchEvent(new CustomEvent('vl:construcao:extensao', { detail: JSON.stringify(Object.assign({ acao, id }, dados)) }));
      return !!(respostaMotor && respostaMotor.id === id && respostaMotor.ok);
    }
    ctx.escutar(document, 'vl:construcao:pagina', function (ev) {
      let d;
      try { d = JSON.parse(ev.detail); } catch (e) { return; }
      if (!d) return;
      if (d.tipo === 'resposta') { respostaMotor = d; return; }
      if (d.tipo === 'mapa') { mapaMotor = d; desenhar(); return; }
      if (d.tipo === 'quarto') { mapaMotor = null; limparSelecao(); return; }
      if (!selecionandoMotor) return;
      if (d.tipo === 'area') { areaMotor = d.area; desenhar(); avisarArea(d.area); }
      if (d.tipo === 'selecionada') {
        const tipo = selecionandoIguais;
        selecionandoMotor = false; areaMotor = null;
        ignorarCliqueAte = Date.now() + 500;
        if (entregarArea(d.area)) return;
        definirArea(d.area, tipo); pararSelecao();
        if (!idsDaSelecao().length) camada.aviso('Nenhum mobi nesta área. Selecione outra região.');
      }
    });

    // ---------- canvas e escala ----------
    function canvas() {
      for (const s of jogo.SELETORES.quarto) { const c = document.querySelector(s); if (c && c.offsetWidth > 100) return c; }
      return null;
    }
    function escalaDoJogo() { const p = VL.zoomQuarto && VL.zoomQuarto.estaPerto ? VL.zoomQuarto.estaPerto() : true; return p === false ? 0.5 : 1; }
    function paraLocal(c, sx, sy) { const r = c.getBoundingClientRect(); const k = c.offsetWidth / r.width; return { x: (sx - r.left) * k, y: (sy - r.top) * k }; }
    function paraTela(c, p) { const r = c.getBoundingClientRect(); const k = c.offsetWidth / r.width; return { x: r.left + p.x / k, y: r.top + p.y / k }; }

    // ---------- calibração ----------
    let amostras = [];          // origens (em px do canvas, na escala atual)
    let escalaAmostras = 1;
    let ultimoClique = null;    // { local, quando }
    let arraste = null;         // { inicio local, ultimo local, andou }
    function origem() {
      const s = escalaDoJogo();
      const c = canvas();
      if (c && s !== escalaAmostras && amostras.length) {
        // o zoom do jogo troca a partir do centro da tela
        const k = s / escalaAmostras;
        const cx = c.offsetWidth / 2;
        const cy = c.offsetHeight / 2;
        amostras = amostras.map((o) => ({ x: cx + (o.x - cx) * k, y: cy + (o.y - cy) * k }));
      }
      escalaAmostras = s;
      return codigos.origemMediana(amostras);
    }
    function calibrado() { return !!mapaMotor || amostras.length > 0; }
    function pisoLocal(x, y, z) {
      if (!mapaMotor) return codigos.pisoNaTela(origem(), escalaDoJogo(), x, y, z || 0);
      const m = mapaMotor;
      return { x: m.origem.x + x * m.x.x + y * m.y.x + (z || 0) * m.z.x, y: m.origem.y + x * m.x.y + y * m.y.y + (z || 0) * m.z.y };
    }
    function pisoDoLocal(p) {
      if (!mapaMotor) return codigos.telaNoPiso(origem(), escalaDoJogo(), p.x, p.y);
      const m = mapaMotor; const dx = p.x - m.origem.x; const dy = p.y - m.origem.y;
      const det = m.x.x * m.y.y - m.y.x * m.x.y;
      return { x: Math.round((dx * m.y.y - dy * m.y.x) / det), y: Math.round((dy * m.x.x - dx * m.x.y) / det) };
    }
    function cantos(a) {
      return [[a.x1 - .5, a.y1 - .5], [a.x2 + .5, a.y1 - .5], [a.x2 + .5, a.y2 + .5], [a.x1 - .5, a.y2 + .5]].map(([x, y]) => pisoLocal(x, y));
    }
    ctx.aoParar(conexao.ouvir('saida', SAIDA.ANDAR, function (l) {
      const x = l.inteiro();
      const y = l.inteiro();
      if (!ultimoClique || Date.now() - ultimoClique.quando > 1600) return;
      origem(); // ajusta à escala atual
      amostras.push(codigos.origemDaAmostra(ultimoClique.local, { x, y }, escalaDoJogo()));
      if (amostras.length > 9) amostras.shift();
      ultimoClique = null;
      atualizarJanela();
      desenhar();
    }));
    ctx.aoParar(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { geracaoQuarto++; amostras = []; limparSelecao(); }));

    // Para outros módulos (o /achar): onde fica um piso na tela e avisar que a câmera do jogo andou.
    const mapa = {
      calibrado,
      telaDoPiso(x, y, z) { const c = canvas(); return c && calibrado() ? paraTela(c, pisoLocal(x, y, z)) : null; },
      deslocar(dx, dy) { const c = canvas(); if (!c || !amostras.length) return; const r = c.getBoundingClientRect(); const k = c.offsetWidth / r.width; origem(); amostras = amostras.map((o) => ({ x: o.x + dx * k, y: o.y + dy * k })); desenhar(); },
    };
    VL.mapaQuarto = mapa;
    ctx.aoParar(function () { if (VL.mapaQuarto === mapa) VL.mapaQuarto = null; });

    // ---------- seleção ----------
    let selecionando = false;
    let selecionandoIguais = null;
    let arrastandoSelecao = null; // { inicio: piso, fim: piso }
    let selecao = null;           // { area } ou { ids: [...], nome }
    let modoDestino = null;
    let destinoPreview = null;
    let escolhendo = false;
    let executando = false;
    let atualizarPainel = function () {};
    function idsDaSelecao() {
      if (!selecao) return [];
      if (selecao.ids) return selecao.ids.filter((id) => api.mobis.has(id));
      if (selecao.area) {
        const lista = [...api.mobis.values()];
        return (selecao.tipo == null ? codigos.mobisNaArea(lista, selecao.area)
          : codigos.mobisIguaisNaArea(lista, selecao.area, selecao.tipo)).map((m) => m.id);
      }
      return [];
    }
    function listaDaSelecao() { return idsDaSelecao().map((id) => api.mobis.get(id)).filter(Boolean); }
    function areaDaLista(lista) {
      if (!lista.length) return null;
      return { x1: Math.min(...lista.map((m) => m.x)), y1: Math.min(...lista.map((m) => m.y)), x2: Math.max(...lista.map((m) => m.x)), y2: Math.max(...lista.map((m) => m.y)) };
    }
    function areaDaSelecao() { return selecao && selecao.area ? selecao.area : areaDaLista(listaDaSelecao()); }
    ctx.ouvir('construcao:historico', function () {
      if (!selecao || !selecao.ids) return;
      selecao.area = areaDaLista(listaDaSelecao());
      api.definirArea(null);
      atualizarJanela(); desenhar();
    });
    function definirArea(a, tipo) {
      const area = { x1: Math.min(a.x1, a.x2), y1: Math.min(a.y1, a.y2), x2: Math.max(a.x1, a.x2), y2: Math.max(a.y1, a.y2) };
      selecao = { area, tipo: tipo == null ? null : tipo };
      selecao.ids = idsDaSelecao(); // o conjunto não muda quando outro mobi entra na região
      api.definirArea(tipo == null ? area : null); // comandos antigos não incluem outros tipos por engano
      atualizarJanela();
      desenhar();
    }
    // Seleção pedida por outra função (ex.: "Colocar Vários" do inventário): a área vai para ela e
    // não vira seleção de mobis.
    let aoArea = null;
    let aoMudarArea = null; // recebe a área enquanto a pessoa arrasta (prévia dos mobis)
    const normalizar = (a) => ({ x1: Math.min(a.x1, a.x2), y1: Math.min(a.y1, a.y2), x2: Math.max(a.x1, a.x2), y2: Math.max(a.y1, a.y2) });
    function avisarArea(a) { if (aoMudarArea) aoMudarArea(normalizar(a)); }
    function entregarArea(a) {
      if (!aoArea) return false;
      const f = aoArea;
      aoArea = null; aoMudarArea = null; // a prévia fica até quem pediu terminar
      limparSelecao();
      f(normalizar(a));
      return true;
    }
    // Mobis só de prévia (desenhados pelo motor, sem ir ao servidor). Lista vazia tira todos.
    function previaColocacao(tipo, direcao, pontos) { return pedirMotor('colocacao', { tipo, direcao: direcao || 0, pontos: pontos || [] }); }
    // { topos, chaos } por piso, lidos do motor do jogo (null sem o motor).
    function alturasPisos(pontos) { return pedirMotor('alturas', { pontos }) ? respostaMotor : null; }
    function largarPreviaArea() { if (aoMudarArea) { aoMudarArea = null; previaColocacao(0, 0, []); } }
    function limparSelecao() {
      largarPreviaArea();
      aoArea = null;
      pedirMotor('cancelar'); selecionandoMotor = false; areaMotor = null;
      selecao = null; arrastandoSelecao = null; modoDestino = null; destinoPreview = null; escolhendo = false;
      selecionando = false; selecionandoIguais = null;
      document.documentElement.removeAttribute('data-vl-selecionando');
      api.definirArea(null); atualizarJanela(); desenhar();
    }
    function comecarSelecao(iguais, aoTerminar, aoMudar) {
      if (executando) return;
      if (!conexao.disponivel()) { camada.aviso('Ligue o módulo "Conexão do jogo" e recarregue o hotel.', { tipo: 'erro' }); return; }
      aoArea = typeof aoTerminar === 'function' ? aoTerminar : null;
      aoMudarArea = aoArea && typeof aoMudar === 'function' ? aoMudar : null;
      const mobi = iguais ? api.mobis.get(api.selecionado()) : null;
      if (iguais && !mobi) { camada.aviso('Clique primeiro no mobi que servirá de modelo.', { tipo: 'erro' }); return; }
      selecionando = true;
      selecionandoIguais = mobi ? mobi.tipo : null;
      modoDestino = null; destinoPreview = null; escolhendo = false;
      document.documentElement.setAttribute('data-vl-selecionando', '');
      selecionandoMotor = true;
      if (pedirMotor('selecionar')) {
        ctx.emitir('painel:fechar');
        camada.aviso('Arraste no chão para marcar a área. Esc cancela.');
        atualizarJanela(); return;
      }
      selecionandoMotor = false;
      camada.aviso(calibrado()
        ? 'Arraste no chão para marcar a área (Esc cancela).'
        : 'Clique no centro de um piso livre para calibrar e depois arraste a área. Descongele o personagem para calibrar.', { duracaoMs: 7000 });
      atualizarJanela();
    }
    function pararSelecao() { largarPreviaArea(); aoArea = null; if (selecionandoMotor) pedirMotor('cancelar'); selecionandoMotor = false; areaMotor = null; selecionando = false; selecionandoIguais = null; arrastandoSelecao = null; document.documentElement.removeAttribute('data-vl-selecionando'); atualizarJanela(); desenhar(); }
    function selecionarIguais() {
      const m = api.mobis.get(api.selecionado());
      if (!m) { camada.aviso('Clique antes num mobi do chão.', { tipo: 'erro' }); return; }
      const ids = [...api.mobis.values()].filter((x) => x.tipo === m.tipo).map((x) => x.id);
      selecao = { ids, nome: 'iguais' };
      api.definirArea(null);
      atualizarJanela(); desenhar();
      camada.aviso(ids.length + ' mobis iguais selecionados.');
    }
    function selecionarPilha() {
      const m = api.mobis.get(api.selecionado());
      if (!m) { camada.aviso('Clique antes num mobi do chão.', { tipo: 'erro' }); return; }
      const ids = [...api.mobis.values()].filter((x) => x.x === m.x && x.y === m.y).map((x) => x.id);
      selecao = { ids, nome: 'pilha' };
      api.definirArea(null);
      atualizarJanela(); desenhar();
      camada.aviso('Pilha com ' + ids.length + ' mobis selecionada.');
    }

    function comecarDestino(modo) {
      if (executando) return;
      if (!exigirSelecao()) return;
      if (!calibrado()) { camada.aviso('Calibre o piso antes: clique num piso livre e selecione a área.', { tipo: 'erro' }); return; }
      modoDestino = modo;
      destinoPreview = null;
      escolhendo = false;
      document.documentElement.setAttribute('data-vl-selecionando', '');
      pedirMotor('previa', { ids: idsDaSelecao(), modo });
      ctx.emitir('painel:fechar');
      camada.aviso('Clique no piso onde ficará o primeiro quadrado da ' + (modo === 'copiar' ? 'cópia' : 'seleção') + '. Esc cancela.');
      atualizarJanela(); desenhar();
    }
    function escolher() {
      if (!selecao) selecao = { ids: [], nome: 'escolhidos' };
      else if (selecao.area) { selecao = { ids: idsDaSelecao(), nome: 'escolhidos' }; api.definirArea(null); }
      escolhendo = !escolhendo;
      modoDestino = null; destinoPreview = null;
      camada.aviso(escolhendo ? 'Clique nos mobis para incluir ou tirar da seleção. Clique em Escolher novamente para terminar.' : 'Escolha concluída.');
      atualizarJanela(); desenhar();
    }
    ctx.aoParar(conexao.ouvir('saida', SAIDA.CLICAR_MOBI, function (l) {
      if (!escolhendo) return;
      const id = l.inteiro();
      if (!api.mobis.has(id)) return;
      const ids = new Set(selecao && selecao.ids ? selecao.ids : []);
      if (ids.has(id)) ids.delete(id); else ids.add(id);
      selecao = { ids: [...ids], nome: 'escolhidos' };
      atualizarJanela(); desenhar();
    }));

    // Eventos de mouse: calibração (cliques), arraste da câmera do jogo e a seleção (que segura os eventos).
    function sobreOCanvas(ev) { const c = canvas(); return c && ev.target === c ? c : null; }
    ctx.escutar(window, 'pointerdown', function (ev) {
      if (!ev.isTrusted || ev.button !== 0 || camada.contem(ev)) return;
      const c = sobreOCanvas(ev);
      if (!c) return;
      if (selecionandoMotor) return; // o motor trata o arraste e informa os pisos exatos
      const local = paraLocal(c, ev.clientX, ev.clientY);
      if (modoDestino && calibrado()) {
        ev.stopImmediatePropagation(); ev.preventDefault();
        const p = pisoDoLocal(local);
        const a = areaDaSelecao();
        const modo = modoDestino;
        modoDestino = null; destinoPreview = null;
        pedirMotor('cancelar');
        document.documentElement.removeAttribute('data-vl-selecionando');
        ignorarCliqueAte = Date.now() + 500;
        if (a) { if (modo === 'copiar') copiar(p.x - a.x1, p.y - a.y1); else mover(p.x - a.x1, p.y - a.y1); }
        atualizarJanela(); desenhar();
        return;
      }
      if (selecionando && calibrado()) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        const p = pisoDoLocal(local);
        arrastandoSelecao = { inicio: p, fim: p };
        desenhar();
        return;
      }
      ultimoClique = { local, quando: Date.now() };
      arraste = { inicio: local, ultimo: local };
    }, true);
    ctx.escutar(window, 'mousedown', function (ev) { if (!selecionandoMotor && sobreOCanvas(ev) && ((selecionando && arrastandoSelecao) || modoDestino || Date.now() < ignorarCliqueAte)) { ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
    ctx.escutar(window, 'pointermove', function (ev) {
      const c = canvas();
      if (!c) return;
      if (selecionandoMotor) return;
      if (arrastandoSelecao) {
        ev.stopImmediatePropagation();
        const local = paraLocal(c, ev.clientX, ev.clientY);
        const p = pisoDoLocal(local);
        if (p.x !== arrastandoSelecao.fim.x || p.y !== arrastandoSelecao.fim.y) { arrastandoSelecao.fim = p; desenhar(); avisarArea({ x1: arrastandoSelecao.inicio.x, y1: arrastandoSelecao.inicio.y, x2: p.x, y2: p.y }); }
        return;
      }
      if (modoDestino && calibrado()) {
        if (!sobreOCanvas(ev)) return;
        const p = pisoDoLocal(paraLocal(c, ev.clientX, ev.clientY));
        const a = areaDaSelecao();
        if (a && (!destinoPreview || destinoPreview.x1 !== p.x || destinoPreview.y1 !== p.y)) {
          destinoPreview = { x1: p.x, y1: p.y, x2: p.x + a.x2 - a.x1, y2: p.y + a.y2 - a.y1 };
          // A prévia já mostra cada coluna apoiada no topo da pilha do piso de destino (como fica com "Empilhar por cima").
          const lista = listaDaSelecao();
          const encaixe = codigos.encaixeSobreMobis(lista, p.x - a.x1, p.y - a.y1, [...api.mobis.values()], modoDestino === 'mover' ? new Set(lista.map((m) => m.id)) : null);
          pedirMotor('destino', { dx: p.x - a.x1, dy: p.y - a.y1, dz: Object.fromEntries(encaixe.deslocamentos) });
          desenhar();
        }
        return;
      }
      if (arraste && (ev.buttons & 1)) arraste.ultimo = paraLocal(c, ev.clientX, ev.clientY);
    }, true);
    ctx.escutar(window, 'mousemove', function (ev) { if (arrastandoSelecao) ev.stopImmediatePropagation(); }, true);
    function soltar(ev) {
      if (arrastandoSelecao) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        const a = arrastandoSelecao;
        arrastandoSelecao = null;
        // fecha com o primeiro que chegar (pointerup ou mouseup) e segura o clique que vem depois,
        // senão o jogo faria o avatar andar até o piso
        ignorarCliqueAte = Date.now() + 500;
        if (entregarArea({ x1: a.inicio.x, y1: a.inicio.y, x2: a.fim.x, y2: a.fim.y })) return;
        definirArea({ x1: a.inicio.x, y1: a.inicio.y, x2: a.fim.x, y2: a.fim.y }, selecionandoIguais);
        pararSelecao();
        const n = idsDaSelecao().length;
        camada.aviso('Área marcada: ' + n + ' mobi(s). Use o menu ao lado da área.');
        return;
      }
      if (arraste && ev.type === 'pointerup') {
        const dx = arraste.ultimo.x - arraste.inicio.x;
        const dy = arraste.ultimo.y - arraste.inicio.y;
        // arrastou a câmera do jogo: o quarto andou junto
        if (Math.hypot(dx, dy) > 4 && amostras.length) { origem(); amostras = amostras.map((o) => ({ x: o.x + dx, y: o.y + dy })); desenhar(); }
        arraste = null;
      }
    }
    ctx.escutar(window, 'pointerup', soltar, true);
    ctx.escutar(window, 'mouseup', soltar, true);
    let ignorarCliqueAte = 0;
    ctx.escutar(window, 'click', function (ev) { if (!selecionandoMotor && ((selecionando && calibrado()) || modoDestino || Date.now() < ignorarCliqueAte) && sobreOCanvas(ev)) { ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
    ctx.escutar(document, 'keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (selecionando) { ev.stopImmediatePropagation(); pararSelecao(); return; }
      if (modoDestino) { ev.stopImmediatePropagation(); pedirMotor('cancelar'); modoDestino = null; destinoPreview = null; document.documentElement.removeAttribute('data-vl-selecionando'); atualizarJanela(); desenhar(); return; }
      if (escolhendo) { ev.stopImmediatePropagation(); escolhendo = false; atualizarJanela(); return; }
      if (selecao && !jogo.campoOcupado()) { limparSelecao(); }
    }, true);

    // ---------- desenho no chão (SVG por cima do quarto, sem pegar o mouse) ----------
    let verAlturas = false;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'vl-chao');
    document.documentElement.appendChild(svg);
    ctx.aoParar(function () { svg.remove(); document.documentElement.removeAttribute('data-vl-selecionando'); });
    let quadro = 0;
    function desenhar() { if (!quadro) quadro = requestAnimationFrame(pintar); }
    function poligono(pontos, classe) {
      const p = document.createElementNS(NS, 'polygon');
      p.setAttribute('points', pontos.map((q) => q.x.toFixed(1) + ',' + q.y.toFixed(1)).join(' '));
      p.setAttribute('class', classe);
      return p;
    }
    function pintar() {
      quadro = 0;
      const c = canvas();
      const pecas = [];
      if (c && calibrado()) {
        const tela = (p) => paraTela(c, p);
        const areaViva = areaMotor || (arrastandoSelecao ? { x1: Math.min(arrastandoSelecao.inicio.x, arrastandoSelecao.fim.x), y1: Math.min(arrastandoSelecao.inicio.y, arrastandoSelecao.fim.y), x2: Math.max(arrastandoSelecao.inicio.x, arrastandoSelecao.fim.x), y2: Math.max(arrastandoSelecao.inicio.y, arrastandoSelecao.fim.y) } : null);
        if (areaViva || (selecao && selecao.area)) {
          pecas.push(poligono(cantos(areaViva || selecao.area).map(tela), 'vl-chao-area'));
        } else if (selecao && selecao.ids) {
          const vistos = new Set();
          for (const m of listaDaSelecao()) {
            const k = m.x + ',' + m.y;
            if (vistos.has(k)) continue;
            vistos.add(k);
            pecas.push(poligono(cantos({ x1: m.x, y1: m.y, x2: m.x, y2: m.y }).map(tela), 'vl-chao-area'));
          }
        }
        if (destinoPreview) pecas.push(poligono(cantos(destinoPreview).map(tela), 'vl-chao-destino'));
        if (verAlturas) {
          let n = 0;
          for (const m of api.mobis.values()) {
            if (++n > 200) break;
            const p = tela(pisoLocal(m.x, m.y, m.altura || 0));
            const t = document.createElementNS(NS, 'text');
            t.setAttribute('x', p.x.toFixed(1));
            t.setAttribute('y', (p.y - 6).toFixed(1));
            t.setAttribute('class', 'vl-chao-altura');
            t.textContent = String(Math.round((m.altura || 0) * 100) / 100);
            pecas.push(t);
          }
        }
      }
      svg.replaceChildren(...pecas);
      posicionarMenu();
      // enquanto há algo desenhado, acompanha a câmera a cada quadro
      if (pecas.length || arrastandoSelecao) quadro = requestAnimationFrame(pintar);
    }
    ctx.aoParar(function () { if (quadro) cancelAnimationFrame(quadro); quadro = 0; });

    // ---------- ações na seleção ----------
    function exigirSelecao() {
      if (executando) { camada.aviso('Espere a ação terminar.'); return null; }
      const lista = listaDaSelecao();
      if (!lista.length) { camada.aviso(selecao ? 'Nenhum mobi do chão na seleção.' : 'Selecione antes: arraste no chão (Selecionar área), ou escolha itens iguais ou a pilha.', { tipo: 'erro' }); return null; }
      return lista;
    }
    async function executarGrupo(fn, historico) {
      if (executando) return;
      executando = true; atualizarJanela(); desenhar();
      try { await (historico ? api.emLoteGrupo : api.emLote)(fn); }
      catch (e) { camada.aviso('A ação não terminou. Confira os mobis antes de tentar novamente.', { tipo: 'erro' }); }
      finally { executando = false; atualizarJanela(); desenhar(); }
    }
    async function alturaNoDestino(lista, dx, dy, copiar, salaOriginal) {
      const ignorados = copiar ? null : new Set(lista.map((m) => m.id));
      const medir = () => codigos.encaixeSobreMobis(lista, dx, dy, api.mobis.values(), ignorados);
      const inicial = medir();
      if (!inicial.ocupados) return new Map();
      const escolha = await camada.dialogo({
        titulo: 'Há mobis no destino',
        texto: inicial.ocupados + (inicial.ocupados === 1 ? ' mobi já ocupa' : ' mobis já ocupam') + ' os pisos dessa área. Como você quer ' + (copiar ? 'copiar' : 'mover') + ' a seleção? Empilhar apoia cada quadrado no topo dos mobis abaixo dele.',
        largo: true,
        botoes: [
          { rotulo: 'Cancelar', valor: null, foco: true },
          { rotulo: 'Manter altura atual', valor: 'manter' },
          { rotulo: 'Empilhar por cima', valor: 'empilhar', destaque: true },
        ],
      });
      if (escolha == null) return null;
      if (geracaoQuarto !== salaOriginal) { camada.aviso('Você mudou de quarto; a ação foi cancelada.', { tipo: 'erro' }); return null; }
      if (escolha === 'manter') return new Map();
      const encaixe = medir();
      if (encaixe.semTopo) { camada.aviso('Não consegui ler a altura de todos os mobis no destino. A ação foi cancelada.', { tipo: 'erro' }); return null; }
      if (lista.some((m) => codigos.alturaValida((m.altura || 0) + (encaixe.deslocamentos.get((m.x + dx) + ',' + (m.y + dy)) || 0)) == null)) {
        camada.aviso('A pilha ultrapassaria a altura máxima permitida pelo hotel.', { tipo: 'erro' });
        return null;
      }
      return encaixe.deslocamentos;
    }
    async function mover(dx, dy) {
      const lista = exigirSelecao(); if (!lista) return;
      if (!dx && !dy) { camada.aviso('Escolha outro piso para mover a seleção.'); return; }
      const salaOriginal = geracaoQuarto;
      const deslocamentos = await alturaNoDestino(lista, dx, dy, false, salaOriginal);
      if (deslocamentos == null || geracaoQuarto !== salaOriginal) return;
      return executarGrupo(async function () {
        const plano = codigos.planoMoverArea(lista, dx, dy);
        const alturas = new Map(lista.map((m) => [m.id, codigos.alturaValida((m.altura || 0) + (deslocamentos.get((m.x + dx) + ',' + (m.y + dy)) || 0))]));
        for (const p of plano) p.altura = alturas.get(p.id);
        const feitos = await api.moverLista(plano, true);
        if (selecao && selecao.area) {
          const a = selecao.area;
          selecao = { ids: lista.map((m) => m.id), area: { x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy }, nome: 'grupo' };
          api.definirArea(null); atualizarJanela();
        }
        camada.aviso(feitos + ' pedidos de movimento enviados com a altura de cada mobi.', { tipo: 'ok' });
        desenhar();
      }, true);
    }
    async function sugerirCompra(faltam, pendentes, feitos, salaOriginal) {
      const lista = [...faltam].map(([tipo, quantidade]) => ({ tipo, quantidade }));
      const total = lista.reduce((s, item) => s + item.quantidade, 0);
      let dados = null;
      try { if (VL.dadosJogo) dados = await VL.dadosJogo.mobis(); } catch (erro) { /* exibe o tipo quando os nomes não carregam */ }
      const itens = lista.map(({ tipo, quantidade }) => {
        const mobi = dados && (dados.chao.get(tipo) || dados.parede.get(tipo));
        return { nome: mobi && mobi.nome ? mobi.nome : 'Tipo ' + tipo, icone: mobi && VL.dadosJogo.iconeDe(mobi.classe), quantidade };
      });
      const escolha = await camada.dialogoMobis({
        titulo: 'Completar a cópia',
        texto: (feitos ? feitos + ' já copiados. ' : '') + total + ' faltaram no inventário. Confira os preços antes de comprar; depois o Vagalume colocará somente os que faltaram.',
        itens,
        botoes: [
          { rotulo: 'Agora não', valor: false, foco: true },
          { rotulo: 'Ver preços e comprar', valor: true, destaque: true },
        ],
      });
      if (!escolha) return;
      if (geracaoQuarto !== salaOriginal) { camada.aviso('Você mudou de quarto; a compra desta cópia foi cancelada.', { tipo: 'erro' }); return; }
      if (!VL.loja || !VL.loja.comprarTipos) {
        camada.aviso('Ligue o módulo "Loja e inventário" para comprar.', { tipo: 'erro' });
        return;
      }
      const compra = await VL.loja.comprarTipos(lista);
      if (!compra || !compra.feitas) return;
      if (geracaoQuarto !== salaOriginal) { camada.aviso('A compra terminou, mas você mudou de quarto. Os mobis ficaram no inventário.', { tipo: 'erro' }); return; }
      camada.aviso('Compra concluída. Atualizando o inventário para terminar a cópia…');
      await executarGrupo(async function () {
        let plano = null;
        for (let tentativa = 0; tentativa < 3; tentativa++) {
          if (geracaoQuarto !== salaOriginal) { camada.aviso('Você mudou de quarto; os mobis comprados ficaram no inventário.', { tipo: 'erro' }); return; }
          const inventario = await api.pedirInventario();
          if (inventario) plano = codigos.planoDeColagem(pendentes, inventario);
          if (plano && plano.colocar.length >= compra.feitas) break;
          if (tentativa < 2) await new Promise((resolver) => setTimeout(resolver, 400));
        }
        if (!plano) { camada.aviso('Compra feita, mas o inventário não respondeu. Confira os itens antes de continuar.', { tipo: 'erro' }); return; }
        if (!plano.colocar.length) { camada.aviso('Compra feita, mas os mobis ainda não apareceram no inventário.', { tipo: 'erro' }); return; }
        if (geracaoQuarto !== salaOriginal) { camada.aviso('Você mudou de quarto; os mobis comprados ficaram no inventário.', { tipo: 'erro' }); return; }
        const colocados = await api.colocarLista(plano.colocar);
        const semEstoque = [...plano.faltam.values()].reduce((s, n) => s + n, 0);
        camada.aviso(colocados + ' mobis restantes colocados nas alturas escolhidas.' + (semEstoque ? ' Ainda faltam ' + semEstoque + ' no inventário.' : ''), { tipo: colocados === pendentes.length ? 'ok' : 'erro' });
      });
    }
    async function copiar(dx, dy) {
      const lista = exigirSelecao(); if (!lista) return;
      const salaOriginal = geracaoQuarto;
      const deslocamentos = await alturaNoDestino(lista, dx, dy, true, salaOriginal);
      if (deslocamentos == null || geracaoQuarto !== salaOriginal) return;
      let sugestao = null;
      return executarGrupo(async function () {
        const itens = await api.pedirInventario();
        if (!itens) { camada.aviso('O inventário não respondeu.', { tipo: 'erro' }); return; }
        const origem = lista.map((m) => Object.assign({}, m, { altura: codigos.alturaValida((m.altura || 0) + (deslocamentos.get((m.x + dx) + ',' + (m.y + dy)) || 0)) }));
        const plano = codigos.planoDuplicar(origem, dx, dy, itens);
        const faltam = [...plano.faltam.values()].reduce((s, n) => s + n, 0);
        const feitos = plano.colocar.length ? await api.colocarLista(plano.colocar) : 0;
        if (feitos) camada.aviso(feitos + ' mobis copiados nas alturas escolhidas.', { tipo: 'ok' });
        if (faltam) sugestao = { faltam: plano.faltam, pendentes: plano.pendentes, feitos };
      }).then(function () {
        if (sugestao) return sugerirCompra(sugestao.faltam, sugestao.pendentes, sugestao.feitos, salaOriginal);
      });
    }
    function girar() {
      const lista = exigirSelecao(); if (!lista) return;
      const area = areaDaSelecao();
      return executarGrupo(async function () {
        await api.moverLista(codigos.planoGirarArea(lista, area), true);
        if (selecao && selecao.area) {
          const w = area.x2 - area.x1 + 1; const h = area.y2 - area.y1 + 1;
          selecao = { ids: lista.map((m) => m.id), area: { x1: area.x1, y1: area.y1, x2: area.x1 + h - 1, y2: area.y1 + w - 1 }, nome: 'grupo' };
          api.definirArea(null); atualizarJanela();
        }
        desenhar();
      }, true);
    }
    function espelhar(eixo) {
      const lista = exigirSelecao(); if (!lista) return;
      return executarGrupo(async function () { await api.moverLista(codigos.planoEspelharArea(lista, areaDaSelecao(), eixo), true); desenhar(); }, true);
    }
    function mudarAltura(delta) {
      const lista = exigirSelecao(); if (!lista) return;
      if (lista.length > 40) { camada.aviso('São ' + lista.length + ' mobis: selecione até 40 para mudar a altura, para não levar mute do jogo.', { tipo: 'erro' }); return; }
      api.alturas(lista.map((m) => ({ id: m.id, altura: codigos.alturaValida(Math.max(0, (api.alturaPendente(m)) + delta)) })).filter((p) => p.altura != null));
    }
    function nivelar(z) {
      const lista = exigirSelecao(); if (!lista) return;
      if (lista.length > 40) { camada.aviso('Selecione até 40 mobis para nivelar.', { tipo: 'erro' }); return; }
      api.alturas(codigos.planoEscada(lista, 'x', z, 0));
    }
    function escada(passo, eixo) {
      const lista = exigirSelecao(); if (!lista) return;
      if (lista.length > 40) { camada.aviso('Selecione até 40 mobis para a escada.', { tipo: 'erro' }); return; }
      const base = Math.min(...lista.map((m) => m.altura || 0));
      api.alturas(codigos.planoEscada(lista, eixo, base, passo));
    }
    function alterarEstado() {
      const lista = exigirSelecao(); if (!lista) return;
      executarGrupo(async function () {
        for (const m of lista) { await api.mandar(SAIDA.USAR_MOBI, [['i', m.id], ['i', 0]]); await api.esperar(250); }
        camada.aviso(lista.length + ' mobis mudaram de estado.');
      });
    }
    function recolherSelecao() {
      const lista = exigirSelecao(); if (!lista) return;
      executarGrupo(async function () { const n = await api.recolherIds(lista.map((m) => m.id)); camada.aviso(n + ' mobis recolhidos.', { tipo: 'ok' }); limparSelecao(); });
    }

    // ---------- menu ao lado da seleção ----------
    const menu = el('div', { class: 'vl-sel-menu', hidden: true });
    function botao(rotulo, dica, fn, classe) { return el('button', { type: 'button', class: 'vl-botao' + (classe ? ' ' + classe : ''), texto: rotulo, title: dica, onclick: fn }); }
    function passo() { return Number(ctx.secao().passoAltura) || 0.5; }
    const tituloMenu = el('div', { class: 'vl-sel-menu-titulo' });
    menu.append(
      tituloMenu,
      botao('Mover', 'Mover o conjunto até o piso escolhido', () => comecarDestino('mover')),
      botao('Rotacionar', 'Girar o conjunto 90°, mantendo as alturas', girar),
      botao('Alterar estado', 'Alterar o estado de todos', alterarEstado),
      botao('Copiar', 'Usar cópias do inventário no piso escolhido', () => comecarDestino('copiar')),
      botao('Escolher', 'Recolher os mobis selecionados para o inventário', recolherSelecao),
      botao('Cancelar', 'Tirar a seleção (Esc)', limparSelecao),
    );
    camada.area().appendChild(menu);
    ctx.aoParar(function () { menu.remove(); });
    function posicionarMenu() {
      const c = canvas();
      const a = c && calibrado() && !selecionando && !arrastandoSelecao && !modoDestino && !executando ? areaDaSelecao() : null;
      if (!a || !selecao || !idsDaSelecao().length) { menu.hidden = true; return; }
      const pontos = cantos(a).map((p) => paraTela(c, p));
      const topo = pontos.reduce((m, p) => (p.y < m.y ? p : m));
      const dir = pontos.reduce((m, p) => (p.x > m.x ? p : m));
      menu.hidden = false;
      tituloMenu.textContent = 'Grupo (' + idsDaSelecao().length + ' mobis)';
      const l = Math.min(window.innerWidth - menu.offsetWidth - 8, dir.x + 12);
      const t = Math.max(8, Math.min(window.innerHeight - menu.offsetHeight - 8, topo.y - 10));
      menu.style.left = Math.max(8, l) + 'px';
      menu.style.top = t + 'px';
    }

    // ---------- ferramenta de construção do próprio jogo (pedido do usuário em 2026-11-15) ----------
    // A janela própria do Vagalume saiu: "/ferramenta" abre a do jogo (ícone na coluna de ferramentas do
    // quarto), que recebe o tema do Vagalume (CSS no módulo Interface). O botão "Selecionar" dela usa a
    // seleção do Vagalume (arrastar no chão, área em limão e o menu ao lado), porque a do jogo é desenhada
    // dentro do quarto e não dá para mudar a cor.
    function montarPainel(alvo) {
      const secao = (titulo, filhos) => el('section', { class: 'vl-cons-secao' }, [el('h3', { class: 'vl-acoes-titulo', texto: titulo })].concat(filhos));
      const botao = (rotulo, acao, destaque) => el('button', { type: 'button', class: 'vl-botao' + (destaque ? ' primario' : ''), texto: rotulo, onclick: acao });
      const linha = (filhos) => el('div', { class: 'vl-linha' }, filhos);
      const nativa = () => document.querySelector('.nitro-room-construction-tool');
      let ultimaTentativaNativa = 0;
      function garantirNativa() {
        let janela = nativa();
        if (!janela && conexao.disponivel() && Date.now() - ultimaTentativaNativa > 3000) {
          ultimaTentativaNativa = Date.now(); abrirNativa(true); janela = nativa();
        }
        return janela;
      }
      function campoNativo(rotulo, tipo) {
        const janela = nativa();
        const nome = janela && [...janela.querySelectorAll('.option-name')].find((n) => n.textContent.trim() === rotulo);
        const grupo = nome && nome.closest('.justify-content-between');
        return grupo && grupo.querySelector('input[type="' + tipo + '"]');
      }
      const referencias = [];
      function opcaoNativa(rotulo, numerico) {
        const caixa = el('input', { type: 'checkbox', class: 'vl-interruptor', 'aria-label': rotulo });
        caixa.addEventListener('change', function () {
          const entrada = campoNativo(rotulo, 'checkbox');
          if (entrada) entrada.click();
          else camada.aviso('Ferramenta do jogo indisponível neste quarto.', { tipo: 'erro' });
          sincronizarNativa();
        });
        const filhos = [caixa, el('span', { texto: rotulo })];
        let numero = null;
        if (numerico) {
          numero = el('input', { type: 'number', class: 'vl-campo vl-numero', min: numerico.min, max: numerico.max, step: numerico.step, 'aria-label': rotulo + ': valor' });
          numero.addEventListener('change', function () {
            const entrada = campoNativo(rotulo, 'number');
            if (!entrada) { camada.aviso('Ferramenta do jogo indisponível neste quarto.', { tipo: 'erro' }); return; }
            jogo.definirValor(entrada, numero.value);
            entrada.dispatchEvent(new Event('change', { bubbles: true }));
            sincronizarNativa();
          });
          filhos.push(numero);
        }
        referencias.push({ rotulo, caixa, numero });
        return el('label', { class: 'vl-ajuste chave' }, filhos);
      }
      const status = el('p', { class: 'vl-nota' });
      const selecionar = botao('Selecionar área', () => { if (selecionando) pararSelecao(); else comecarSelecao(false); }, true);
      const iguaisArea = botao('Selecionar mobis iguais na área', () => { if (selecionando) pararSelecao(); else comecarSelecao(true); });
      const moverBotao = botao('Mover', () => comecarDestino('mover'));
      const copiarBotao = botao('Copiar', () => comecarDestino('copiar'));
      const girarBotao = botao('Rotacionar', girar);
      const estadoBotao = botao('Alterar estado', alterarEstado);
      const escolherBotao = botao('Escolher', recolherSelecao);
      escolherBotao.title = 'Recolher os mobis selecionados para o inventário';
      const cancelarBotao = botao('Cancelar', limparSelecao);
      const bloco = el('div', { class: 'vl-cons-integrada' }, [
        secao('Seleção no quarto', [status, linha([selecionar, iguaisArea]), linha([
          botao('Iguais no quarto', selecionarIguais), botao('Pilha', selecionarPilha), botao('Selecionar um a um', escolher),
        ])]),
        secao('Ações com a seleção', [linha([moverBotao, copiarBotao, girarBotao, estadoBotao]),
          linha([escolherBotao, cancelarBotao]),
          linha([botao('Espelhar ↔', () => espelhar('x')), botao('Espelhar ↕', () => espelhar('y'))]),
          el('p', { class: 'vl-nota', texto: 'Mover e Copiar: clique no piso de destino. Se houver mobis lá, escolha entre empilhar e manter as alturas.' })]),
        secao('Ações com personagem', [opcaoNativa('Congelar personagem')]),
        secao('Ações com mobis', [
          opcaoNativa('Altura', { min: 0, max: 63, step: 0.1 }),
          opcaoNativa('Aumentar gradualmente a altura', { min: 0, max: 63, step: 0.1 }),
          opcaoNativa('Estado', { min: 0, max: 999, step: 1 }),
          opcaoNativa('Direção', { min: 0, max: 7, step: 2 }),
          opcaoNativa('Alterar altura dos mobis iguais'),
          opcaoNativa('Alterar estado dos mobis iguais'),
          opcaoNativa('Rotacionar os mobis iguais'),
          opcaoNativa('Escolher os mobis iguais'),
        ]),
        secao('Histórico e piso', [linha([botao('Desfazer', function () { if (api.desfazer()) limparSelecao(); }), botao('Refazer', function () { if (api.refazer()) limparSelecao(); }),
          botao('Editor de Chão', function () {
            const janela = garantirNativa();
            const acao = janela && [...janela.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Editor de Chão');
            if (acao) acao.click(); else camada.aviso('Editor de Chão indisponível neste quarto.', { tipo: 'erro' });
          })])]),
      ]);
      alvo.appendChild(bloco);
      function sincronizarNativa() {
        garantirNativa();
        for (const ref of referencias) {
          const entrada = campoNativo(ref.rotulo, 'checkbox');
          ref.caixa.disabled = !entrada;
          if (entrada) ref.caixa.checked = entrada.checked;
          if (ref.numero) {
            const valor = campoNativo(ref.rotulo, 'number');
            ref.numero.disabled = !valor;
            if (valor && document.activeElement !== ref.numero) ref.numero.value = valor.value;
          }
        }
      }
      atualizarPainel = function () {
        const n = idsDaSelecao().length;
        status.textContent = executando ? 'Aplicando a ação aos mobis…' : selecionando ? (calibrado() ? 'Arraste no chão para selecionar.' : 'Clique no centro de um piso livre para calibrar; depois arraste.') : modoDestino ? 'Clique no piso de destino.'
          : escolhendo ? 'Clique em mobis para incluir ou retirar.' : n ? n + ' mobi(s) selecionado(s).' : 'Nenhuma área selecionada.';
        for (const b of [moverBotao, copiarBotao, girarBotao, estadoBotao, escolherBotao]) b.disabled = !n || executando;
        cancelarBotao.disabled = !n && !selecionando && !modoDestino && !escolhendo;
        selecionar.textContent = selecionando && selecionandoIguais == null ? 'Cancelar seleção' : 'Selecionar área';
      };
      atualizarPainel();
      sincronizarNativa();
      const relogio = setInterval(sincronizarNativa, 800);
      return function () { clearInterval(relogio); atualizarPainel = function () {}; };
    }

    function abrirNativa(silencioso) {
      const icone = document.querySelector('.nitro-room-tools .icon-room-construction-tool');
      const alvo = icone && (icone.closest('[class*="cursor-pointer"], button, .d-flex') || icone);
      if (!alvo) { if (!silencioso) camada.aviso('Entre num quarto para usar a ferramenta de construção.', { tipo: 'erro' }); return; }
      alvo.click();
    }
    function abrirJanela() { ctx.emitir('painel:abrir', { aba: 'construcao' }); }
    ctx.escutar(window, 'click', function (ev) {
      if (ev.isTrusted && ev.target && ev.target.closest && ev.target.closest('.nitro-room-tools .icon-room-construction-tool')) {
        ev.stopImmediatePropagation(); ev.preventDefault(); abrirJanela(); return;
      }
      const b = ev.target && ev.target.closest ? ev.target.closest('.nitro-room-construction-tool button') : null;
      if (!b) return;
      const rotulo = b.textContent.trim();
      if (!/^selecionar(?: mobis iguais na área)?$/i.test(rotulo)) return;
      ev.stopImmediatePropagation();
      ev.preventDefault();
      if (selecionando) pararSelecao(); else comecarSelecao(/iguais/i.test(rotulo));
    }, true);
    function atualizarJanela() { atualizarPainel(); }

    ctx.aoParar(camada.estiloPagina('construcao-ferramenta', 'svg.vl-chao { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 2147483000; overflow: visible; }'
      + ' .vl-chao-area { fill: rgba(214, 242, 74, .22); stroke: #d6f24a; stroke-width: 3; stroke-linejoin: round; filter: drop-shadow(0 0 4px rgba(214, 242, 74, .55)); }'
      + ' .vl-chao-destino { fill: rgba(214, 242, 74, .13); stroke: #d6f24a; stroke-width: 2; stroke-dasharray: 7 5; }'
      + ' .vl-chao-altura { fill: #d6f24a; font: 700 11px system-ui, sans-serif; text-anchor: middle; paint-order: stroke; stroke: #12161f; stroke-width: 3px; }'
      + ' html[data-vl-selecionando] canvas { cursor: crosshair !important; }'
      + ' html[data-vl-ferramenta-integrada] .nitro-room-construction-tool { display: none !important; }'
      + ' .vl-cons-integrada { display:flex; flex-direction:column; gap:12px; }'
      + ' .vl-cons-integrada .vl-cons-secao { border:1px solid var(--borda); border-radius:9px; padding:10px; }'
      + ' .vl-cons-integrada .vl-linha { flex-wrap:wrap; }'
      + ' .vl-cons-integrada .vl-ajuste { padding:6px 2px; }'));

    document.documentElement.setAttribute('data-vl-ferramenta-integrada', '');
    pedirMotor('ativar');
    ctx.aoParar(function () { pedirMotor('desativar'); });
    ctx.aoParar(function () { document.documentElement.removeAttribute('data-vl-ferramenta-integrada'); });

    return { abrirJanela, comecarSelecao, selecionarIguais, selecionarPilha, limparSelecao, montarPainel, previaColocacao, alturasPisos };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
