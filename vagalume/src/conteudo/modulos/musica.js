// Vagalume — módulo "musica": o que a pessoa está ouvindo, pelo Last.fm, no quadro de informações.
// Pedido do usuário em 2026-11-14: algo como o "rich presence" do Discord, sem usar a missão.
// - Cada pessoa põe o próprio apelido do Last.fm em Conexões (e liga o Spotify ao Last.fm no site dele).
// - Ao abrir o quadro de alguém com o ponto verde (usa o Vagalume), a seu Vagalume pergunta o apelido
//   por um sussurro técnico; o Vagalume da pessoa responde do mesmo jeito. Esses sussurros, e a cópia
//   que o servidor devolve a quem mandou, são segurados antes de chegar ao jogo: ninguém os vê. Os
//   sussurros comuns são entregues ao jogo normalmente. Uma pergunta por pessoa a cada 10 minutos.
// - Com o apelido, o fundo da extensão pergunta ao Last.fm (sem cookies) a cada 30 s enquanto o quadro
//   estiver aberto. Só funciona com as duas pessoas no mesmo quarto (o quadro já exige isso).
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.lastfm) return;
  const { nucleo, camada, lastfm } = VL;
  const CSS = '.vl-musica { display: flex; align-items: center; gap: 8px; margin: 2px 6px 4px; padding: 6px; border-radius: 8px; border: 1px solid rgba(214, 242, 74, .35); background: linear-gradient(180deg, rgba(27, 35, 48, .95), rgba(14, 18, 26, .95)); cursor: pointer; min-width: 0; }'
    + '.vl-musica:hover { border-color: #d6f24a; }'
    + '.vl-musica-capa { flex: none; width: 38px; height: 38px; border-radius: 6px; background: #1b2330 center / cover no-repeat; display: grid; place-items: center; color: #d6f24a; font: 700 16px/1 system-ui, sans-serif; }'
    + '.vl-musica-texto { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }'
    + '.vl-musica-estado { display: flex; align-items: center; gap: 5px; font: 700 9.5px/1.2 system-ui, sans-serif; letter-spacing: .04em; text-transform: uppercase; color: #8ea06b; }'
    + '.vl-musica.agora .vl-musica-estado { color: #d6f24a; }'
    + '.vl-musica-barras { display: none; align-items: flex-end; gap: 1px; height: 9px; }'
    + '.vl-musica.agora .vl-musica-barras { display: inline-flex; }'
    + '.vl-musica-barras i { width: 2px; background: #d6f24a; border-radius: 1px; animation: vl-musica-barra .9s ease-in-out infinite; }'
    + '.vl-musica-barras i:nth-child(2) { animation-delay: -.3s; } .vl-musica-barras i:nth-child(3) { animation-delay: -.6s; }'
    + '@keyframes vl-musica-barra { 0%, 100% { height: 3px; } 50% { height: 9px; } }'
    + '.vl-musica-nome { font: 700 11.5px/1.25 system-ui, sans-serif; color: #f2f7e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }'
    + '.vl-musica-artista { font: 500 10.5px/1.25 system-ui, sans-serif; color: #b9c4a3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }'
    + '.vl-musica-conectar { width: calc(100% - 12px); text-align: left; }';

  nucleo.definirModulo({
    id: 'musica',
    iniciar(ctx) {
      const tirarCss = camada.estiloPagina('musica', CSS);
      ctx.aoParar(tirarCss);

      // Pergunta ao fundo; guarda por 30 s.
      const respostas = new Map(); // usuário -> { quando, resposta }
      const pendentes = new Map(); // usuário -> Promise
      function consultar(usuario) {
        const chave = usuario.toLowerCase();
        const g = respostas.get(chave);
        if (g && Date.now() - g.quando < 30000) return Promise.resolve(g.resposta);
        if (pendentes.has(chave)) return pendentes.get(chave);
        const p = chrome.runtime.sendMessage({ tipo: 'musica:agora', usuario }).then(function (r) {
          respostas.set(chave, { quando: Date.now(), resposta: r });
          pendentes.delete(chave);
          return r;
        }, function () { pendentes.delete(chave); return { ok: false, erro: 'rede' }; });
        pendentes.set(chave, p);
        return p;
      }

      function meuUsuario() { return String(ctx.secao().usuario || '').trim(); }

      // Confirmação de dono do Last.fm, guardada no storage.local (vl.lastfmConfirmado): { usuario, conta }.
      // Só se compartilha o apelido confirmado, e só na conta do Habblet em que foi confirmado.
      const CHAVE_CONFIRMADO = 'vl.lastfmConfirmado';
      const area = raiz.chrome && chrome.storage && chrome.storage.local;
      let confirmado = null;
      let confirmacaoCarregada = !area;
      let aConfirmar = null; // { usuario, codigo }
      if (area) area.get(CHAVE_CONFIRMADO).then(function (r) {
        confirmado = r[CHAVE_CONFIRMADO] || null;
        confirmacaoCarregada = true;
        avisarPainel();
        cuidar();
      }).catch(function () { confirmacaoCarregada = true; cuidar(); });
      function minhaConta() { return VL.pessoas && VL.pessoas.meuId ? VL.pessoas.meuId() : null; }
      function estaConfirmado() {
        const u = meuUsuario();
        return !!(confirmado && u && confirmado.usuario.toLowerCase() === u.toLowerCase() && (confirmado.conta == null || minhaConta() == null || confirmado.conta === minhaConta()));
      }
      function avisarPainel() { ctx.emitir('musica:estado', estado()); }
      function estado() {
        const u = meuUsuario();
        return { usuario: u, valido: lastfm.usuarioValido(u), confirmado: estaConfirmado(), codigo: aConfirmar && aConfirmar.usuario.toLowerCase() === u.toLowerCase() ? aConfirmar.codigo : '' };
      }
      function comecarConfirmacao() {
        const u = meuUsuario();
        if (!lastfm.usuarioValido(u)) return estado();
        if (!aConfirmar || aConfirmar.usuario.toLowerCase() !== u.toLowerCase()) aConfirmar = { usuario: u, codigo: lastfm.codigoConfirmacao() };
        avisarPainel();
        return estado();
      }
      function verificar() {
        const u = meuUsuario();
        if (!aConfirmar || aConfirmar.usuario.toLowerCase() !== u.toLowerCase()) return Promise.resolve({ ok: false, erro: 'sem-codigo' });
        return chrome.runtime.sendMessage({ tipo: 'musica:verificar', usuario: u, codigo: aConfirmar.codigo }).then(function (r) {
          if (r && r.ok && r.confere) {
            confirmado = { usuario: r.nome || u, conta: minhaConta() };
            aConfirmar = null;
            if (area) area.set({ [CHAVE_CONFIRMADO]: confirmado }).catch(function () {});
            respostas.clear();
          }
          avisarPainel();
          cuidar();
          return r;
        }, function () { return { ok: false, erro: 'rede' }; });
      }
      VL.musica = { estado, comecarConfirmacao, verificar };
      ctx.aoParar(function () { delete VL.musica; });
      ctx.aoConfig(function (secao) { if (secao === 'musica') avisarPainel(); });
      function eu() { return VL.pessoas && VL.pessoas.eu ? String(VL.pessoas.eu() || '') : ''; }

      // Apelidos do Last.fm dos outros, aprendidos pelos recados: apelido no Habblet -> { usuario, quando }.
      const lastfmDe = new Map();
      const perguntouEm = new Map();
      const respondeuEm = new Map();
      const nomePorIndice = new Map();
      const DEZ_MINUTOS = 600000;
      const k = (n) => String(n || '').trim().toLowerCase();
      function souEu(nome) { return !!eu() && k(nome) === k(eu()); }
      function usaVagalume(nome) { return !!(VL.comunidade && VL.comunidade.usaVagalume(nome)); }
      const conexao = VL.conexao || null;
      const codigos = VL.codigos;

      function perguntar(nome) {
        if (!conexao || !codigos || !usaVagalume(nome)) return;
        const agora = Date.now();
        if (agora - (perguntouEm.get(k(nome)) || 0) < 20000) return;
        perguntouEm.set(k(nome), agora);
        conexao.enviar(codigos.SAIDA.SUSSURRAR, [['s', nome + ' ' + lastfm.PEDIDO], ['i', 0]]);
        // Sem resposta em 6 s: guarda "não mostra" (a pessoa pode estar sem a opção ou sem apelido).
        setTimeout(function () { if (!lastfmDe.has(k(nome)) || Date.now() - lastfmDe.get(k(nome)).quando > DEZ_MINUTOS) lastfmDe.set(k(nome), { usuario: '', quando: Date.now() }); }, 6000);
      }

      // Quadro -> apelido do Last.fm: o seu, de Conexões; o dos outros, pelo recado.
      function usuarioDoQuadro(quadro) {
        const nomeEl = quadro.querySelector('.goldfish.fw-bold');
        const nome = nomeEl ? nomeEl.textContent.trim() : '';
        if (!nome) return '';
        if (souEu(nome)) return lastfm.usuarioValido(meuUsuario()) ? meuUsuario() : '';
        const g = lastfmDe.get(k(nome));
        if (!g || Date.now() - g.quando > DEZ_MINUTOS) { perguntar(nome); return g ? g.usuario : ''; }
        return g.usuario;
      }

      function cartao(usuario) {
        const caixa = document.createElement('div');
        caixa.className = 'vl-musica';
        caixa.dataset.usuario = usuario;
        const capa = document.createElement('div');
        capa.className = 'vl-musica-capa';
        capa.textContent = '♪';
        const texto = document.createElement('div');
        texto.className = 'vl-musica-texto';
        const estado = document.createElement('div');
        estado.className = 'vl-musica-estado';
        const barras = document.createElement('span');
        barras.className = 'vl-musica-barras';
        barras.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
        const rotulo = document.createElement('span');
        rotulo.textContent = 'Last.fm…';
        estado.append(barras, rotulo);
        const nome = document.createElement('div');
        nome.className = 'vl-musica-nome';
        const artista = document.createElement('div');
        artista.className = 'vl-musica-artista';
        texto.append(estado, nome, artista);
        caixa.append(capa, texto);
        caixa.addEventListener('click', function (ev) {
          ev.stopPropagation();
          const url = caixa.dataset.url || ('https://www.last.fm/user/' + encodeURIComponent(usuario));
          window.open(url, '_blank', 'noopener,noreferrer');
        });
        caixa.mostrar = function (r) {
          const f = r && r.ok ? r.faixa : null;
          caixa.classList.toggle('agora', !!(f && f.agora));
          if (r && !r.ok) {
            rotulo.textContent = r.erro === 'sem-chave' ? 'Last.fm: falta a chave' : r.erro === 'nao-existe' ? 'Last.fm: usuário não existe' : 'Last.fm indisponível';
            nome.textContent = r.erro === 'sem-chave' ? 'O Vagalume ainda não tem a chave da API' : usuario;
            artista.textContent = '';
            return;
          }
          if (!f) { rotulo.textContent = 'Last.fm'; nome.textContent = 'Nada ouvido ainda'; artista.textContent = usuario; return; }
          rotulo.textContent = f.agora ? 'Ouvindo agora' : 'Ouviu por último · ' + lastfm.tempoAtras(f.quando);
          nome.textContent = f.nome;
          nome.title = f.nome + (f.album ? ' — ' + f.album : '');
          artista.textContent = f.artista;
          caixa.dataset.url = f.url || '';
          caixa.title = (f.agora ? 'Ouvindo agora: ' : 'Ouviu por último: ') + f.nome + ' — ' + f.artista + ' (abrir no Last.fm)';
          if (f.capa) { capa.style.backgroundImage = 'url("' + f.capa + '")'; capa.textContent = ''; }
          else { capa.style.backgroundImage = ''; capa.textContent = '♪'; }
        };
        return caixa;
      }

      function conviteConexao() {
        const caixa = document.createElement('button');
        caixa.type = 'button';
        caixa.className = 'vl-musica vl-musica-conectar';
        caixa.title = 'Abrir Conexões para configurar o Last.fm';
        const capa = document.createElement('span');
        capa.className = 'vl-musica-capa';
        capa.textContent = '♪';
        const texto = document.createElement('span');
        texto.className = 'vl-musica-texto';
        const titulo = document.createElement('span');
        titulo.className = 'vl-musica-estado';
        titulo.textContent = 'Música no perfil';
        const chamada = document.createElement('span');
        chamada.className = 'vl-musica-nome';
        chamada.textContent = 'Conecte o Last.fm';
        const detalhe = document.createElement('span');
        detalhe.className = 'vl-musica-artista';
        detalhe.textContent = 'Mostre o que você está ouvindo';
        texto.append(titulo, chamada, detalhe);
        caixa.append(capa, texto);
        caixa.addEventListener('click', function (ev) { ev.stopPropagation(); ctx.emitir('painel:abrir', { aba: 'conexoes' }); });
        return caixa;
      }

      function atualizar(caixa) {
        consultar(caixa.dataset.usuario).then(function (r) { if (caixa.isConnected) caixa.mostrar(r); });
      }

      function cuidar() {
        if (!confirmacaoCarregada) return;
        const ligado = ctx.secao().mostrar;
        document.querySelectorAll('.nitro-infostand').forEach(function (quadro) {
          const velho = quadro.querySelector(':scope > .vl-musica');
          const temAvatar = !!quadro.querySelector('.body-image .avatar-image');
          const nome = quadro.querySelector('.goldfish.fw-bold');
          const mostrarConvite = ligado && temAvatar && nome && souEu(nome.textContent) && !estaConfirmado();
          if (mostrarConvite) {
            if (velho && velho.classList.contains('vl-musica-conectar')) return;
            if (velho) velho.remove();
            quadro.insertBefore(conviteConexao(), quadro.querySelector(':scope > .vl-atalhos-quadro'));
            return;
          }
          const usuario = ligado && temAvatar ? usuarioDoQuadro(quadro) : '';
          if (!usuario) { if (velho) velho.remove(); return; }
          if (velho && !velho.classList.contains('vl-musica-conectar') && velho.dataset.usuario === usuario) return;
          if (velho) velho.remove();
          const novo = cartao(usuario);
          quadro.insertBefore(novo, quadro.querySelector(':scope > .vl-atalhos-quadro'));
          atualizar(novo);
        });
      }
      let pendente = false;
      const observador = new MutationObserver(function () {
        if (pendente) return;
        pendente = true;
        setTimeout(function () { pendente = false; cuidar(); }, 150);
      });
      if (document.body) observador.observe(document.body, { childList: true, subtree: true, characterData: true });
      const relogio = setInterval(function () { document.querySelectorAll('.nitro-infostand > .vl-musica:not(.vl-musica-conectar)').forEach(atualizar); }, 30000);
      ctx.aoParar(function () { observador.disconnect(); clearInterval(relogio); document.querySelectorAll('.vl-musica').forEach((e) => e.remove()); });
      ctx.aoConfig(function (secao) { if (secao === 'musica') { respostas.clear(); document.querySelectorAll('.vl-musica').forEach((e) => e.remove()); cuidar(); } });
      cuidar();

      // Recados por sussurro: segura todo sussurro que chega, responde ou anota os recados técnicos
      // e devolve ao jogo, do jeito que chegaram, todos os outros.
      if (conexao && codigos) {
        const E = codigos.ENTRADA;
        const soltar = conexao.bloquear('entrada', E.SUSSURRO);
        const parar = [
          conexao.ouvir('entrada', E.QUARTO_PRONTO, function () { nomePorIndice.clear(); }),
          conexao.ouvir('entrada', E.USUARIOS, function (l) {
            let lista;
            try { lista = codigos.lerUsuarios(l).lista; } catch (erro) { return; }
            for (const u of lista) nomePorIndice.set(u.indice, u.nome);
          }),
          conexao.ouvir('entrada', E.SUSSURRO, function (l, bytes) {
            let recado = null;
            let fala = null;
            try { fala = codigos.lerFala(l); recado = lastfm.lerRecado(fala.texto); } catch (erro) { recado = null; }
            if (!recado) { conexao.injetar(E.SUSSURRO, [['r', Array.from(bytes)]]); return; } // sussurro comum
            const nome = nomePorIndice.get(fala.indice);
            if (!nome || souEu(nome)) return; // a cópia do seu próprio recado: some
            if (recado.tipo === 'pedido') {
              if (!ctx.secao().compartilhar || !estaConfirmado()) return; // só o Last.fm confirmado como seu
              if (Date.now() - (respondeuEm.get(k(nome)) || 0) < 15000) return;
              respondeuEm.set(k(nome), Date.now());
              conexao.enviar(codigos.SAIDA.SUSSURRAR, [['s', nome + ' ' + lastfm.resposta(meuUsuario())], ['i', 0]]);
            } else {
              lastfmDe.set(k(nome), { usuario: recado.usuario, quando: Date.now() });
              cuidar();
            }
          }),
        ];
        ctx.aoParar(function () { soltar(); parar.forEach((f) => f()); });
      }

      ctx.comando({
        nome: 'musica',
        uso: 'musica',
        descricao: 'Mostra o que você está ouvindo no Last.fm (configure a conta em Conexões).',
        executar() {
          const usuario = meuUsuario();
          if (!lastfm.usuarioValido(usuario)) {
            camada.aviso('Ponha o seu apelido do Last.fm em Conexões (ou: /opcao musica.usuario seu_apelido).', { tipo: 'erro' });
            return;
          }
          consultar(usuario).then(function (r) {
            const f = r && r.ok ? r.faixa : null;
            if (!r || !r.ok) camada.aviso(r && r.erro === 'sem-chave' ? 'Falta a chave da API do Last.fm no Vagalume.' : 'Não deu para falar com o Last.fm agora.', { tipo: 'erro' });
            else if (!f) camada.aviso('O Last.fm ainda não tem músicas de ' + usuario + '.');
            else camada.aviso((f.agora ? 'Ouvindo agora: ' : 'Ouviu por último (' + lastfm.tempoAtras(f.quando) + '): ') + f.nome + ' — ' + f.artista);
          });
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
