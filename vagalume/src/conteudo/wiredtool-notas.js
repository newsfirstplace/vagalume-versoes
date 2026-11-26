// Organizador local do Wired Tool. As anotações são sincronizadas apenas entre Vagalumes no mesmo quarto.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.camada || !VL.conexao || !VL.codigos) return;
  const { camada, conexao, codigos } = VL;
  const { ENTRADA } = codigos;
  const el = camada.el;
  const PREFIXO = 'vl.wiredtool.notas.';
  const CSS = `
    .nitro-wired-creator-tool { min-width:400px!important; border:1px solid #637e23!important; border-radius:10px!important; box-shadow:0 16px 42px #0009!important; }
    .nitro-wired-creator-tool .wiredcreatortool-header { position:relative!important; padding-right:105px!important; background:#1b2526!important; color:#d6f24a!important; border-bottom:1px solid #d6f24a!important; }
    .nitro-wired-creator-tool .vl-wt-abrir { position:absolute; top:5px; right:7px; z-index:2; padding:3px 9px; border:1px solid #a8c63c; border-radius:6px; background:#253222; color:#d6f24a; font:700 11px system-ui,sans-serif; cursor:pointer; }
    .nitro-wired-creator-tool .vl-wt-abrir:hover { background:#364828; }
    .vl-wt-painel { position:fixed; top:75px; right:22px; z-index:400; width:min(388px,calc(100vw - 24px)); max-height:calc(100vh - 90px); display:flex; flex-direction:column; box-sizing:border-box; border:1px solid #607737; border-radius:11px; background:#192231; color:#e8eef4; box-shadow:0 18px 45px #000a; font:12px/1.4 system-ui,sans-serif; overflow:hidden; }
    .vl-wt-painel * { box-sizing:border-box; }
    .vl-wt-cabecalho { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 13px; background:linear-gradient(110deg,#1e2b25,#202d3b); border-bottom:2px solid #d6f24a; cursor:move; user-select:none; }
    .vl-wt-cabecalho strong { color:#d6f24a; font-size:13px; }
    .vl-wt-corpo { min-height:0; overflow:auto; padding:12px; scrollbar-width:thin; scrollbar-color:#6d8438 #151c29; }
    .vl-wt-descricao { margin:0 0 10px; color:#b3c0cf; }
    .vl-wt-selecao { padding:8px 10px; border:1px solid #40516a; border-radius:8px; background:#212e3f; margin-bottom:11px; }
    .vl-wt-selecao strong { color:#e8f7b2; }
    .vl-wt-linha { display:flex; gap:6px; margin:8px 0; }
    .vl-wt-linha>* { min-width:0; }
    .vl-wt-campo { display:block; margin:8px 0; font-weight:600; color:#cbd5e2; }
    .vl-wt-campo input,.vl-wt-campo textarea,.vl-wt-busca { width:100%; margin-top:4px; padding:8px; border:1px solid #43536d; border-radius:6px; background:#101722; color:#f0f4f8; font:12px system-ui,sans-serif; outline:none; }
    .vl-wt-campo textarea { min-height:68px; resize:vertical; }
    .vl-wt-campo input:focus,.vl-wt-campo textarea:focus,.vl-wt-busca:focus { border-color:#d6f24a; }
    .vl-wt-btn { border:1px solid #536477; border-radius:6px; padding:7px 9px; background:#273448; color:#e8eef4; cursor:pointer; font:600 11px system-ui,sans-serif; }
    .vl-wt-btn:hover { border-color:#d6f24a; }
    .vl-wt-btn.principal { background:#d6f24a; border-color:#d6f24a; color:#172016; }
    .vl-wt-btn.perigo { color:#ffb9b9; }
    .vl-wt-lista { display:grid; gap:7px; margin-top:10px; }
    .vl-wt-item { width:100%; padding:9px; text-align:left; border:1px solid #394a61; border-radius:8px; background:#202b3b; color:#e8eef4; cursor:pointer; }
    .vl-wt-item:hover { border-color:#d6f24a; }
    .vl-wt-item strong,.vl-wt-item span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .vl-wt-item span { color:#aebccc; font-size:11px; margin-top:2px; }
    .vl-wt-vazio { color:#9cabbc; padding:10px 3px; }
  `;

  const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  function normalizar(v) {
    if (!v || typeof v !== 'object') return null;
    const k = String(v.k || '');
    if (!/^(a:\d{1,12}|p:\d{1,3},\d{1,3})$/.test(k)) return null;
    const t = Number(v.t);
    if (!Number.isSafeInteger(t) || t < 0 || t > Date.now() + 60000) return null;
    const n = texto(v.n, 50), x = v.x === true;
    if (!x && !n) return null;
    return { k, n, d: texto(v.d, 240), t, x, a: texto(v.a, 30) };
  }
  function iniciar(ctx, obterSelecionado) {
    const mobis = new Map();
    let arquivo = null, quarto = '', notas = new Map(), painel = null, lista = null, estado = null;
    let campoNome = null, campoNota = null, chaveAtual = '', busca = null, timerGravar = null, timerEnvio = null;
    let mostrarEtiquetas = true;
    const etiquetas = el('div', { class: 'vl-wireds-fantasmas', 'aria-label': 'Nomes das antenas e pilhas' });
    const cssEtiquetas = el('style', { texto: '.vl-wt-etiqueta{position:absolute;max-width:150px;transform:translate(-50%,-155%);padding:3px 7px;border:1px solid #9bb63b;border-radius:6px;background:#17212ce8;color:#e9f9b4;box-shadow:0 2px 7px #0008;font:700 10px/1.2 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}' });
    etiquetas.appendChild(cssEtiquetas);
    camada.area().appendChild(etiquetas);
    const fila = [];
    const cancela = [
      conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { mobis.clear(); verificarQuarto(); }),
      // Mensagens em formato inesperado não podem derrubar o organizador.
      conexao.ouvir('entrada', ENTRADA.MOBIS_DO_QUARTO, function (l) { try { for (const m of codigos.lerMobisDoQuarto(l).mobis) mobis.set(m.id, m); } catch (e) { return; } atualizarSelecao(); }),
      conexao.ouvir('entrada', ENTRADA.MOBI_COLOCADO, function (l) { try { const m = codigos.lerMobi(l, true); mobis.set(m.id, m); } catch (e) { return; } atualizarSelecao(); }),
      conexao.ouvir('entrada', ENTRADA.MOBI_ATUALIZADO, function (l) { try { const m = codigos.lerMobi(l, true); mobis.set(m.id, m); } catch (e) { return; } atualizarSelecao(); }),
      conexao.ouvir('entrada', ENTRADA.MOBI_RETIRADO, function (l) { mobis.delete(Number(l.texto())); atualizarSelecao(); }),
    ];
    if (VL.dadosJogo) VL.dadosJogo.mobis().then(function (d) { arquivo = d; atualizarSelecao(); }, function () {});
    const atual = () => String(VL.pessoas && VL.pessoas.quartoAtual && VL.pessoas.quartoAtual() || '');
    function gravar() {
      clearTimeout(timerGravar);
      if (!quarto) return;
      const q = quarto;
      const dados = [...notas.values()].sort((a, b) => b.t - a.t).slice(0, 120);
      timerGravar = setTimeout(function () { chrome.storage.local.set({ [PREFIXO + q]: dados }).catch(function () {}); }, 250);
    }
    function mesclar(v) {
      const nota = normalizar(v);
      if (!nota || !quarto || (notas.get(nota.k) && notas.get(nota.k).t >= nota.t)) return;
      notas.set(nota.k, nota);
      gravar(); renderizarLista(); atualizarSelecao(); atualizarEtiquetas();
    }
    function enviarProximo() {
      clearTimeout(timerEnvio);
      timerEnvio = null;
      if (!fila.length || !quarto) return;
      const dado = fila.shift();
      if (VL.comunidade) VL.comunidade.acao(dado);
      timerEnvio = setTimeout(enviarProximo, 1700);
    }
    function anunciar(dado) { fila.push(dado); if (!timerEnvio) enviarProximo(); }
    async function verificarQuarto() {
      const q = atual();
      if (q === quarto) return;
      quarto = q; notas = new Map(); chaveAtual = ''; fila.length = 0;
      clearTimeout(timerEnvio); timerEnvio = null;
      renderizarLista(); atualizarSelecao(); atualizarEtiquetas();
      if (!q) return;
      try {
        const r = await chrome.storage.local.get(PREFIXO + q);
        if (quarto !== q) return;
        for (const v of Array.isArray(r[PREFIXO + q]) ? r[PREFIXO + q] : []) {
          const nota = normalizar(v); if (nota && (!notas.has(nota.k) || notas.get(nota.k).t < nota.t)) notas.set(nota.k, nota);
        }
        renderizarLista(); atualizarSelecao(); atualizarEtiquetas();
      } catch (erro) { /* anotações de outros Vagalumes ainda podem chegar */ }
      setTimeout(function () { if (quarto === q) anunciar({ t: 'wt:pedir', q }); }, 1800);
    }
    function aoMensagem(m) {
      if (!m || m.de !== 'sala' || !m.dado || typeof m.dado !== 'object') return;
      const d = m.dado;
      if (!quarto || String(d.q) !== quarto) return;
      if (d.t === 'wt:nota') mesclar(d.v);
      else if (d.t === 'wt:pedir' && m.nome && VL.comunidade) {
        const itens = [...notas.values()].sort((a, b) => b.t - a.t).slice(0, 120);
        for (let i = 0; i < itens.length; i += 30) VL.comunidade.direto(m.nome, { t: 'wt:lista', q: quarto, v: itens.slice(i, i + 30) });
      } else if (d.t === 'wt:lista' && m.tipo === 'presenca:direto' && Array.isArray(d.v)) {
        for (const v of d.v.slice(0, 30)) mesclar(v);
      }
    }
    let tentativasComunidade = 0;
    const ligar = setInterval(function () {
      if (++tentativasComunidade > 120) { clearInterval(ligar); return; } // sem a Comunidade, as anotações ficam só neste navegador
      if (VL.comunidade && VL.comunidade.aoAcao) {
        clearInterval(ligar); ctx.aoParar(VL.comunidade.aoAcao(aoMensagem));
        if (quarto) anunciar({ t: 'wt:pedir', q: quarto });
      }
    }, 1000);
    const relogio = setInterval(verificarQuarto, 2000);
    verificarQuarto();

    function contexto() {
      const id = Number(obterSelecionado());
      const m = mobis.get(id);
      const f = m && arquivo && arquivo.chao.get(m.tipo);
      return m ? { m, f, antena: !!(f && /antenna|antena/i.test(f.classe + ' ' + f.nome)) } : null;
    }
    function atualizarSelecao() {
      if (!estado) return;
      const c = contexto();
      estado.textContent = !quarto ? 'Entre em um quarto para organizar os wireds.' : !c ? 'Clique numa antena ou num wired da pilha no quarto.' :
        (c.antena ? 'Antena' : 'Pilha') + ' selecionada · ' + (c.f ? c.f.nome : 'mobi ' + c.m.tipo) + ' · posição ' + c.m.x + ', ' + c.m.y;
    }
    function atualizarEtiquetas() {
      const mapa = VL.mapaQuarto;
      if (!mostrarEtiquetas || !quarto || !mapa || !mapa.calibrado()) { etiquetas.replaceChildren(cssEtiquetas); return; }
      const novos = [cssEtiquetas];
      for (const v of notas.values()) {
        if (v.x || !v.n || novos.length > 100) continue;
        const m = v.k.startsWith('a:') ? mobis.get(Number(v.k.slice(2))) : null;
        const coords = m || (v.k.startsWith('p:') ? { x: Number(v.k.split(':')[1].split(',')[0]), y: Number(v.k.split(',')[1]), altura: 0 } : null);
        if (!coords || (m && !mobis.has(m.id))) continue;
        const p = mapa.telaDoPiso(coords.x, coords.y, coords.altura || 0);
        if (!p) continue;
        const no = el('span', { class: 'vl-wt-etiqueta', texto: v.n, title: v.d || v.n });
        no.style.left = p.x + 'px'; no.style.top = p.y + 'px';
        novos.push(no);
      }
      etiquetas.replaceChildren(...novos);
    }
    function selecionar(tipo) {
      const c = contexto();
      if (!quarto || !c) { camada.aviso('Clique numa antena ou num wired da pilha primeiro.', { tipo: 'erro' }); return; }
      if (tipo === 'a' && !c.antena) { camada.aviso('O mobi selecionado não é uma antena.', { tipo: 'erro' }); return; }
      if (tipo === 'p' && c.f && !/^wf_/i.test(c.f.classe)) { camada.aviso('Clique em um wired da pilha.', { tipo: 'erro' }); return; }
      chaveAtual = tipo === 'a' ? 'a:' + c.m.id : 'p:' + c.m.x + ',' + c.m.y;
      const nota = notas.get(chaveAtual);
      campoNome.value = nota && !nota.x ? nota.n : '';
      campoNota.value = nota && !nota.x ? nota.d : '';
      campoNome.focus();
    }
    function salvar(excluir) {
      if (!quarto || !chaveAtual) { camada.aviso('Selecione uma antena ou pilha.', { tipo: 'erro' }); return; }
      const n = excluir ? '' : texto(campoNome.value, 50);
      const d = excluir ? '' : texto(campoNota.value, 240);
      if (!excluir && !n) { campoNome.focus(); camada.aviso('Dê um nome à antena ou pilha.', { tipo: 'erro' }); return; }
      const v = { k: chaveAtual, n, d, t: Date.now(), x: !!excluir, a: texto(VL.pessoas && VL.pessoas.eu && VL.pessoas.eu(), 30) };
      notas.set(v.k, v); gravar(); renderizarLista(); atualizarEtiquetas();
      anunciar({ t: 'wt:nota', q: quarto, v });
      if (excluir) { campoNome.value = ''; campoNota.value = ''; }
      camada.aviso(excluir ? 'Anotação removida do quarto.' : VL.comunidade ? 'Anotação salva; Vagalumes deste quarto podem recebê-la.' : 'Anotação salva neste navegador. Ligue Comunidade para compartilhar.', { tipo: 'ok' });
    }
    function renderizarLista() {
      if (!lista) return;
      const termo = texto(busca && busca.value, 80).toLowerCase();
      const itens = [...notas.values()].filter((v) => !v.x && (!termo || (v.n + ' ' + v.d).toLowerCase().includes(termo))).sort((a, b) => a.n.localeCompare(b.n, 'pt-BR'));
      lista.replaceChildren(...itens.map((v) => el('button', { type: 'button', class: 'vl-wt-item', onclick() {
        chaveAtual = v.k; campoNome.value = v.n; campoNota.value = v.d; campoNome.focus();
      } }, [el('strong', { texto: (v.k.startsWith('a:') ? '⌁ Antena · ' : '▦ Pilha · ') + v.n }), el('span', { texto: (v.k.startsWith('p:') ? 'Piso ' + v.k.slice(2) : 'Mobi ' + v.k.slice(2)) + (v.d ? ' · ' + v.d : '') })])));
      if (!itens.length) lista.appendChild(el('p', { class: 'vl-wt-vazio', texto: quarto ? 'Nenhuma anotação neste quarto.' : 'Entre em um quarto para ver as anotações.' }));
    }
    function fechar() { if (painel) painel.remove(); painel = lista = estado = campoNome = campoNota = busca = null; }
    function abrir() {
      if (painel) { painel.style.display = ''; return; }
      painel = el('section', { class: 'vl-wt-painel', role: 'dialog', 'aria-label': 'Organizar Wired Tool' });
      const cabecalho = el('div', { class: 'vl-wt-cabecalho' }, [el('strong', { texto: '✦ Wired Tool · Vagalume' }), el('button', { type: 'button', class: 'vl-wt-btn', texto: '×', 'aria-label': 'Fechar', onclick: fechar })]);
      estado = el('div', { class: 'vl-wt-selecao' });
      campoNome = el('input', { type: 'text', maxlength: '50', placeholder: 'Ex.: Porta de entrada' });
      campoNota = el('textarea', { maxlength: '240', placeholder: 'Como funciona, condições, manutenção…' });
      busca = el('input', { type: 'search', class: 'vl-wt-busca', placeholder: 'Buscar nomes e anotações' });
      lista = el('div', { class: 'vl-wt-lista' });
      painel.append(cabecalho, el('div', { class: 'vl-wt-corpo' }, [
        el('p', { class: 'vl-wt-descricao', texto: 'Nomeie antenas e pilhas para organizar o quarto. Quem usa o Vagalume aqui verá as mesmas anotações.' }),
        estado,
        el('div', { class: 'vl-wt-linha' }, [el('button', { type: 'button', class: 'vl-wt-btn', texto: 'Usar antena clicada', onclick() { selecionar('a'); } }), el('button', { type: 'button', class: 'vl-wt-btn', texto: 'Usar pilha deste piso', onclick() { selecionar('p'); } })]),
        el('label', { class: 'vl-wt-campo' }, ['Nome', campoNome]),
        el('label', { class: 'vl-wt-campo' }, ['Anotação', campoNota]),
        el('div', { class: 'vl-wt-linha' }, [el('button', { type: 'button', class: 'vl-wt-btn principal', texto: 'Salvar e compartilhar', onclick() { salvar(false); } }), el('button', { type: 'button', class: 'vl-wt-btn perigo', texto: 'Remover', onclick() { salvar(true); } })]),
        el('label', { class: 'vl-wt-descricao' }, [el('input', { type: 'checkbox', checked: true, onchange(ev) { mostrarEtiquetas = ev.target.checked; atualizarEtiquetas(); } }), ' Mostrar nomes no quarto']),
        busca, lista,
      ]));
      painel.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
      busca.addEventListener('input', renderizarLista);
      document.body.appendChild(painel);
      let arrasto = null;
      cabecalho.addEventListener('pointerdown', function (ev) { if (ev.target.closest('button')) return; arrasto = { x: ev.clientX - painel.offsetLeft, y: ev.clientY - painel.offsetTop }; cabecalho.setPointerCapture(ev.pointerId); });
      cabecalho.addEventListener('pointermove', function (ev) { if (!arrasto) return; painel.style.left = Math.max(0, Math.min(innerWidth - painel.offsetWidth, ev.clientX - arrasto.x)) + 'px'; painel.style.top = Math.max(0, Math.min(innerHeight - 48, ev.clientY - arrasto.y)) + 'px'; painel.style.right = 'auto'; });
      cabecalho.addEventListener('pointerup', function () { arrasto = null; });
      atualizarSelecao(); renderizarLista();
    }
    const tirarCss = camada.estiloPagina('wiredtool-notas', CSS);
    let aguardando = false;
    function injetar() {
      const janela = document.querySelector('.nitro-wired-creator-tool');
      if (!janela || janela.querySelector('.vl-wt-abrir')) return;
      const alvo = janela.querySelector('.wiredcreatortool-header') || janela;
      alvo.appendChild(el('button', { type: 'button', class: 'vl-wt-abrir', texto: '✦ Organizar', onclick: abrir }));
    }
    const observador = new MutationObserver(function () { if (aguardando) return; aguardando = true; setTimeout(function () { aguardando = false; injetar(); }, 120); });
    if (document.body) observador.observe(document.body, { childList: true, subtree: true });
    injetar();
    const relogioEtiquetas = setInterval(atualizarEtiquetas, 500);
    ctx.aoParar(function () {
      cancela.forEach((fn) => fn()); clearInterval(ligar); clearInterval(relogio); clearInterval(relogioEtiquetas); clearTimeout(timerGravar); clearTimeout(timerEnvio);
      observador.disconnect(); tirarCss(); etiquetas.remove(); fechar();
    });
    return { abrir, atualizarSelecao };
  }
  VL.wiredToolNotas = { iniciar, normalizar };
})(typeof globalThis !== 'undefined' ? globalThis : this);
