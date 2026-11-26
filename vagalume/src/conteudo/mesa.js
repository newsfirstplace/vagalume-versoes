// Vagalume — mesa de jogos para mais de duas pessoas (pedido do usuário em 2026-11-26).
// Quem abre a mesa é o anfitrião: guarda o estado do jogo, roda os bots e manda a cada jogador o que ele pode
// ver. Os outros só mandam as jogadas. Tudo vai pelo canal direto entre Vagalumes do mesmo quarto
// (VL.comunidade.direto). Cada jogo é um "plugin" registrado com VL.mesa.registrar(id, def):
//   def = { nome, glifo, texto, min, max, bots: [[id, rótulo]], nova(jogadores, opcoes), aplicar(estado, nome, acao),
//           tick?(estado) -> mudou, visao(estado, nome), fim(estado) -> null | { ordem, texto },
//           montar(api) -> { el, atualizar(visao) } }
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.camada) return;
  const camada = VL.camada;
  const el = camada.el;
  const JOGOS = {};
  const CSS = `
  .vl-ms { pointer-events: auto; position: fixed; z-index: 31; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(760px, calc(100vw - 24px)); max-height: calc(100vh - 40px); display: flex; flex-direction: column;
    background: #141a24; color: #e8eef7; border: 1px solid rgba(214,242,74,.35); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.6); font: 13px/1.4 system-ui, sans-serif; overflow: hidden; }
  .vl-ms-cab { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: linear-gradient(180deg, rgba(214,242,74,.12), transparent); border-bottom: 1px solid rgba(214,242,74,.25); cursor: move; user-select: none; }
  .vl-ms-cab b { font-size: 15px; } .vl-ms-cab .esp { flex: 1; }
  .vl-ms-cab button { all: unset; cursor: pointer; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; color: #c9d3e2; font-size: 18px; }
  .vl-ms-cab button:hover { background: rgba(255,255,255,.08); color: #fff; }
  .vl-ms-corpo { padding: 14px; overflow: auto; }
  .vl-ms-botao { border: 1px solid #3b4a60; background: #212c3c; color: #e8eef7; border-radius: 10px; padding: 8px 14px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
  .vl-ms-botao:hover:not(:disabled) { border-color: #d6f24a; }
  .vl-ms-botao.forte { background: #d6f24a; border-color: #d6f24a; color: #141a10; }
  .vl-ms-botao:disabled { opacity: .45; cursor: default; }
  .vl-ms-sala { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .vl-ms-cartao { background: #1a2230; border: 1px solid #2c3a4f; border-radius: 12px; padding: 12px; }
  .vl-ms-cartao h3 { margin: 0 0 8px; font-size: 13px; color: #d6f24a; text-transform: uppercase; letter-spacing: .5px; }
  .vl-ms-pessoa { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,.03); margin-bottom: 4px; }
  .vl-ms-pessoa .nome { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vl-ms-pessoa small { color: #8f9bb0; }
  .vl-ms-acoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; align-items: center; }
  .vl-ms-nota { color: #9aa6ba; font-size: 12px; margin: 6px 0 0; }
  .vl-ms-convite { pointer-events: auto; position: fixed; z-index: 40; left: 50%; top: 40%; transform: translate(-50%, -50%); width: min(340px, calc(100vw - 24px)); background: #141a24; border: 1px solid #d6f24a; border-radius: 16px; padding: 16px; color: #e8eef7; text-align: center; box-shadow: 0 0 30px rgba(214,242,74,.25), 0 20px 50px rgba(0,0,0,.6); font: 13px system-ui, sans-serif; }
  .vl-ms-convite .glifo { font-size: 40px; display: block; margin-bottom: 6px; }
  .vl-ms-convite .vl-ms-acoes { justify-content: center; }
  .vl-ms-res { margin-top: 12px; padding: 12px; border-radius: 12px; background: rgba(214,242,74,.08); border: 1px solid rgba(214,242,74,.35); }
  .vl-ms-res h3 { margin: 0 0 6px; color: #d6f24a; }
  .vl-ms-res ol { margin: 0; padding-left: 22px; }
  @media (max-width: 640px) { .vl-ms-sala { grid-template-columns: 1fr; } }
  `;
  const sessaoNova = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  const NOMES_BOT = ['Bot Faísca', 'Bot Lume', 'Bot Brilho', 'Bot Estrela', 'Bot Cometa', 'Bot Neon', 'Bot Pirilampo'];

  function registrar(id, def) { JOGOS[id] = def; }

  function iniciar(ctx) {
    const estilo = el('style', { texto: CSS });
    camada.area().appendChild(estilo);
    let janela = null, corpo = null, titulo = null;
    let mesa = null;   // { jogo, sessao, anfitriao, souAnfitriao, jogadores: [{ nome, bot }], opcoes, fase, estado, versao, visao, tela }
    let convite = null; // convite recebido: { de, s, j, no, relogio }
    let relogio = null;
    const eu = () => (VL.pessoas && VL.pessoas.eu && VL.pessoas.eu()) || 'Você';
    const mesmo = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
    const vagalumesNoQuarto = () => ((VL.pessoas && VL.pessoas.lista && VL.pessoas.lista()) || [])
      .filter((n) => !mesmo(n, eu()) && VL.comunidade && VL.comunidade.usaVagalume && VL.comunidade.usaVagalume(n));

    function mandar(nome, dado) {
      if (!VL.comunidade || !VL.comunidade.direto) return Promise.resolve(null);
      return VL.comunidade.direto(nome, Object.assign({ s: mesa ? mesa.sessao : dado.s }, dado));
    }
    const pessoas = () => mesa.jogadores.filter((p) => !p.bot && !mesmo(p.nome, eu()));

    // ---------- janela ----------
    function montarJanela() {
      titulo = el('b', { texto: 'Jogos' });
      const cab = el('div', { class: 'vl-ms-cab' }, [titulo, el('span', { class: 'esp' }),
        el('button', { type: 'button', title: 'Fechar', 'aria-label': 'Fechar', texto: '×', onclick: sair })]);
      corpo = el('div', { class: 'vl-ms-corpo' });
      janela = el('div', { class: 'vl-ms', role: 'dialog', 'aria-label': 'Mesa de jogos', tabindex: '0' }, [cab, corpo]);
      janela.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Escape' && !(mesa && mesa.fase === 'jogo')) sair(); });
      cab.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0 || ev.target.closest('button')) return;
        const r = janela.getBoundingClientRect(), x0 = ev.clientX, y0 = ev.clientY;
        cab.setPointerCapture(ev.pointerId);
        const mover = (e) => { janela.style.transform = 'none'; janela.style.left = Math.max(0, Math.min(innerWidth - janela.offsetWidth, r.left + e.clientX - x0)) + 'px'; janela.style.top = Math.max(0, Math.min(innerHeight - 44, r.top + e.clientY - y0)) + 'px'; };
        const fim = () => { cab.removeEventListener('pointermove', mover); cab.removeEventListener('pointerup', fim); };
        cab.addEventListener('pointermove', mover); cab.addEventListener('pointerup', fim);
      });
      camada.area().appendChild(janela);
    }
    function mostrar() { if (!janela) montarJanela(); janela.style.display = ''; desenhar(); }

    function desenhar() {
      if (!janela || !mesa) return;
      const def = JOGOS[mesa.jogo];
      titulo.textContent = def.glifo + ' ' + def.nome;
      if (mesa.fase === 'sala') { camada.trocar(corpo, telaSala(def)); return; }
      if (!mesa.tela) { mesa.tela = def.montar(apiTela()); corpo.replaceChildren(mesa.tela.el); }
      if (mesa.visao) mesa.tela.atualizar(mesa.visao);
      const fim = mesa.fase === 'fim' && mesa.resultado;
      const resAntigo = corpo.querySelector('.vl-ms-res');
      if (resAntigo) resAntigo.remove();
      if (fim) corpo.appendChild(telaResultado(fim));
    }
    function apiTela() {
      return { eu: eu(), agir, anfitriao: () => mesa && mesa.souAnfitriao };
    }
    function telaSala(def) {
      const anf = mesa.souAnfitriao;
      const lista = mesa.jogadores.map((p) => el('div', { class: 'vl-ms-pessoa' }, [
        el('span', { 'aria-hidden': 'true', texto: p.bot ? '🤖' : mesmo(p.nome, mesa.anfitriao) ? '👑' : '🙂' }),
        el('span', { class: 'nome', texto: p.nome + (mesmo(p.nome, eu()) ? ' (você)' : '') }),
        p.bot ? el('small', { texto: (def.bots.find(([id]) => id === p.bot) || [, ''])[1] }) : null,
        anf && !mesmo(p.nome, eu()) ? el('button', { type: 'button', class: 'vl-ms-botao', texto: 'Tirar', onclick() { tirar(p.nome); } }) : null,
      ]));
      const cheio = mesa.jogadores.length >= def.max;
      const blocos = [el('div', { class: 'vl-ms-cartao' }, [el('h3', { texto: 'Jogadores (' + mesa.jogadores.length + '/' + def.max + ')' })].concat(lista))];
      if (anf) {
        const convidados = vagalumesNoQuarto();
        const linhas = convidados.length ? convidados.map((n) => {
          const dentro = mesa.jogadores.some((p) => mesmo(p.nome, n));
          const chamado = mesa.chamados && mesa.chamados.has(n.toLowerCase());
          return el('div', { class: 'vl-ms-pessoa' }, [el('span', { class: 'nome', texto: n }),
            el('button', { type: 'button', class: 'vl-ms-botao', texto: dentro ? 'Na mesa' : chamado ? 'Chamado' : 'Convidar', disabled: dentro || chamado || cheio, onclick() { convidar(n); } })]);
        }) : [el('p', { class: 'vl-ms-nota', texto: 'Ninguém com o Vagalume no quarto agora. Dá para jogar com bots.' })];
        const nivel = el('select', { class: 'vl-ms-botao', 'aria-label': 'Nível do bot' }, def.bots.map(([id, r]) => el('option', { value: id, texto: r })));
        blocos.push(el('div', { class: 'vl-ms-cartao' }, [el('h3', { texto: 'Chamar quem está no quarto' })].concat(linhas, !def.bots.length ? [] : [
          el('div', { class: 'vl-ms-acoes' }, [nivel, el('button', { type: 'button', class: 'vl-ms-botao', texto: '+ Bot', disabled: cheio, onclick() { botNovo(nivel.value); } })]),
        ])));
      }
      const humanos = mesa.jogadores.filter((p) => !p.bot).length;
      const pode = mesa.jogadores.length >= def.min && humanos >= (def.minPessoas || 0);
      return [
        el('p', { class: 'vl-ms-nota', texto: def.texto }),
        el('div', { class: 'vl-ms-sala' }, blocos),
        el('div', { class: 'vl-ms-acoes' }, anf ? [
          el('button', { type: 'button', class: 'vl-ms-botao forte', texto: 'Começar', disabled: !pode, onclick: comecar }),
          el('span', { class: 'vl-ms-nota', texto: pode ? 'Pronto para começar.' : (def.minPessoas ? 'Precisa de pelo menos ' + def.minPessoas + ' pessoas com o Vagalume (este jogo não tem bots).' : 'Precisa de pelo menos ' + def.min + ' jogadores (bots contam).') }),
        ] : [el('span', { class: 'vl-ms-nota', texto: 'Esperando ' + mesa.anfitriao + ' começar…' }), el('button', { type: 'button', class: 'vl-ms-botao', texto: 'Sair da mesa', onclick: sair })]),
      ];
    }
    function telaResultado(r) {
      return el('div', { class: 'vl-ms-res', role: 'status' }, [
        el('h3', { texto: r.texto || 'Fim de jogo' }),
        r.ordem ? el('ol', null, r.ordem.map((n) => el('li', { texto: n + (mesmo(n, eu()) ? ' (você)' : '') }))) : null,
        el('div', { class: 'vl-ms-acoes' }, [
          mesa.souAnfitriao ? el('button', { type: 'button', class: 'vl-ms-botao forte', texto: 'Jogar de novo', onclick: deNovo }) : el('span', { class: 'vl-ms-nota', texto: 'Esperando ' + mesa.anfitriao + '…' }),
          el('button', { type: 'button', class: 'vl-ms-botao', texto: 'Sair', onclick: sair }),
        ]),
      ]);
    }

    // ---------- anfitrião ----------
    function abrir(jogo) {
      const def = JOGOS[jogo];
      if (!def) return;
      if (mesa && mesa.fase !== 'fim' && mesa.jogo !== jogo) { camada.aviso('Termine ou saia da mesa de ' + JOGOS[mesa.jogo].nome + ' primeiro.', { tipo: 'erro' }); mostrar(); return; }
      if (!mesa || mesa.jogo !== jogo || mesa.fase === 'fim') mesa = { jogo, sessao: sessaoNova(), anfitriao: eu(), souAnfitriao: true, jogadores: [{ nome: eu(), bot: null }], fase: 'sala', chamados: new Set() };
      mostrar();
    }
    function convidar(nome) {
      mesa.chamados.add(nome.toLowerCase());
      mandar(nome, { t: 'ms:convite', j: mesa.jogo });
      camada.aviso('Convite enviado a ' + nome + '.');
      desenhar();
      setTimeout(function () { if (mesa && mesa.chamados) { mesa.chamados.delete(nome.toLowerCase()); desenhar(); } }, 45000);
    }
    function botNovo(nivel) {
      const usados = new Set(mesa.jogadores.map((p) => p.nome));
      const nome = NOMES_BOT.find((n) => !usados.has(n)) || ('Bot ' + mesa.jogadores.length);
      mesa.jogadores.push({ nome, bot: nivel });
      avisarSala();
    }
    function tirar(nome) {
      mesa.jogadores = mesa.jogadores.filter((p) => !mesmo(p.nome, nome));
      mandar(nome, { t: 'ms:fim', m: 'Você saiu da mesa.' });
      avisarSala();
    }
    function avisarSala() {
      for (const p of pessoas()) mandar(p.nome, { t: 'ms:sala', j: mesa.jogo, a: mesa.anfitriao, js: mesa.jogadores });
      desenhar();
    }
    function comecar() {
      const def = JOGOS[mesa.jogo];
      if (mesa.jogadores.length < def.min || mesa.jogadores.filter((p) => !p.bot).length < (def.minPessoas || 0)) return;
      mesa.estado = def.nova(mesa.jogadores, mesa.opcoes || {});
      mesa.fase = 'jogo'; mesa.versao = 0; mesa.tela = null; mesa.resultado = null;
      publicar();
      clearInterval(relogio);
      relogio = setInterval(function () {
        if (!mesa || !mesa.souAnfitriao || mesa.fase !== 'jogo') return;
        if (def.tick && def.tick(mesa.estado)) publicar();
        else if (Date.now() - (mesa.publicadoEm || 0) > 3000) publicar(); // de novo, para quem perdeu uma mensagem
      }, 150);
    }
    function deNovo() { mesa.fase = 'sala'; mesa.tela = null; mesa.estado = null; avisarSala(); }
    // Manda a cada pessoa o que ela pode ver e desenha a minha.
    function publicar() {
      const def = JOGOS[mesa.jogo];
      mesa.versao++;
      mesa.publicadoEm = Date.now();
      const fim = def.fim(mesa.estado);
      if (fim && mesa.fase === 'jogo') { mesa.fase = 'fim'; mesa.resultado = fim; clearInterval(relogio); }
      for (const p of pessoas()) mandar(p.nome, { t: 'ms:estado', j: mesa.jogo, v: mesa.versao, vi: def.visao(mesa.estado, p.nome), f: mesa.fase === 'fim' ? fim : null, js: mesa.jogadores, a: mesa.anfitriao });
      mesa.visao = def.visao(mesa.estado, eu());
      desenhar();
    }
    function agir(acao) {
      if (!mesa || mesa.fase !== 'jogo') return;
      if (mesa.souAnfitriao) { if (JOGOS[mesa.jogo].aplicar(mesa.estado, eu(), acao)) publicar(); return; }
      mandar(mesa.anfitriao, { t: 'ms:acao', a: acao });
    }
    function sair() {
      if (mesa) {
        if (mesa.souAnfitriao) for (const p of pessoas()) mandar(p.nome, { t: 'ms:fim', m: mesa.anfitriao + ' fechou a mesa.' });
        else mandar(mesa.anfitriao, { t: 'ms:sair' });
      }
      clearInterval(relogio);
      mesa = null;
      if (janela) janela.style.display = 'none';
    }

    // ---------- mensagens ----------
    function receber(m) {
      if (!m || m.de !== 'sala' || m.tipo !== 'presenca:direto' || !m.dado || typeof m.dado !== 'object') return;
      const d = m.dado, de = String(m.nome || '').slice(0, 40);
      if (!/^ms:/.test(String(d.t || '')) || !/^[a-f0-9]{16}$/.test(String(d.s || '')) || !de) return;
      if (d.t === 'ms:convite') { if (JOGOS[d.j]) mostrarConvite(de, d); return; }
      if (!mesa || d.s !== mesa.sessao) return;
      if (mesa.souAnfitriao) {
        const p = mesa.jogadores.find((x) => mesmo(x.nome, de));
        if (d.t === 'ms:entrar' && !p && mesa.fase === 'sala') {
          if (mesa.jogadores.length >= JOGOS[mesa.jogo].max) { mandar(de, { t: 'ms:fim', m: 'A mesa está cheia.' }); return; }
          mesa.jogadores.push({ nome: de, bot: null }); mesa.chamados.delete(de.toLowerCase()); avisarSala(); camada.aviso(de + ' entrou na mesa.');
        } else if (d.t === 'ms:recusar') { mesa.chamados.delete(de.toLowerCase()); desenhar(); camada.aviso(de + ' recusou o convite.'); }
        else if (d.t === 'ms:sair' && p) {
          mesa.jogadores = mesa.jogadores.filter((x) => x !== p);
          if (mesa.fase === 'jogo' && JOGOS[mesa.jogo].sair) { JOGOS[mesa.jogo].sair(mesa.estado, p.nome); publicar(); }
          else avisarSala();
          camada.aviso(de + ' saiu da mesa.');
        } else if (d.t === 'ms:acao' && p && mesa.fase === 'jogo' && d.a && typeof d.a === 'object') {
          if (JOGOS[mesa.jogo].aplicar(mesa.estado, p.nome, d.a)) publicar();
        }
        return;
      }
      if (!mesmo(de, mesa.anfitriao)) return;
      if (d.t === 'ms:sala') { mesa.jogadores = Array.isArray(d.js) ? d.js.slice(0, 12) : mesa.jogadores; if (mesa.fase !== 'sala') { mesa.fase = 'sala'; mesa.tela = null; } desenhar(); }
      else if (d.t === 'ms:estado' && Number(d.v) > (mesa.versao || 0)) {
        mesa.versao = Number(d.v); mesa.visao = d.vi; mesa.jogadores = Array.isArray(d.js) ? d.js.slice(0, 12) : mesa.jogadores;
        if (mesa.fase === 'sala') { mesa.fase = 'jogo'; mesa.tela = null; }
        if (d.f) { mesa.fase = 'fim'; mesa.resultado = d.f; }
        else if (mesa.fase === 'fim') { mesa.fase = 'jogo'; mesa.resultado = null; }
        desenhar();
      } else if (d.t === 'ms:fim') { camada.aviso(String(d.m || 'A mesa foi fechada.').slice(0, 120)); mesa = null; if (janela) janela.style.display = 'none'; }
    }
    function mostrarConvite(de, d) {
      if (convite) fecharConvite();
      const def = JOGOS[d.j];
      const no = el('div', { class: 'vl-ms-convite', role: 'dialog', 'aria-label': 'Convite para jogar' }, [
        el('span', { class: 'glifo', 'aria-hidden': 'true', texto: def.glifo }),
        el('b', { texto: de + ' chamou você para ' + def.nome }),
        el('p', { class: 'vl-ms-nota', texto: def.texto }),
        el('div', { class: 'vl-ms-acoes' }, [
          el('button', { type: 'button', class: 'vl-ms-botao', texto: 'Recusar', onclick() { VL.comunidade.direto(de, { t: 'ms:recusar', s: d.s }); fecharConvite(); } }),
          el('button', { type: 'button', class: 'vl-ms-botao forte', texto: 'Entrar', onclick() {
            fecharConvite();
            if (mesa && mesa.souAnfitriao) sair();
            mesa = { jogo: d.j, sessao: d.s, anfitriao: de, souAnfitriao: false, jogadores: [], fase: 'sala', versao: 0 };
            mandar(de, { t: 'ms:entrar' });
            mostrar();
          } }),
        ]),
      ]);
      camada.area().appendChild(no);
      convite = { no, relogio: setTimeout(fecharConvite, 45000) };
    }
    function fecharConvite() { if (!convite) return; clearTimeout(convite.relogio); convite.no.remove(); convite = null; }

    let tirarOuvinte = null, tentativas = 0;
    const ligar = function () {
      if (VL.comunidade && VL.comunidade.aoAcao) { tirarOuvinte = VL.comunidade.aoAcao(receber); return; }
      if (++tentativas < 60) setTimeout(ligar, 1000);
    };
    ligar();
    ctx.aoParar(function () { sair(); fecharConvite(); if (tirarOuvinte) tirarOuvinte(); estilo.remove(); if (janela) janela.remove(); janela = null; });
    return { abrir, receber, mesa: () => mesa };
  }

  VL.mesa = { registrar, iniciar, JOGOS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
