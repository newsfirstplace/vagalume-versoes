// Vagalume — módulo "mencoes": avisa quando alguém fala o seu apelido ou um termo escolhido.
// O aviso é local: um som curto gerado na hora, um contorno no balão e uma lista na memória da aba.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo || !VL.mencoes || !VL.texto) return;
  const { nucleo, camada, jogo, texto } = VL;
  const el = camada.el;
  const MAX_RECENTES = 50;
  const PAUSA_SOM_MS = 1500;
  // [frequência em Hz, início em segundos]. Três notas em onda triangular, mais longas que as antigas
  // (que eram baixas demais, segundo o usuário em 2026-11-14), passando por um compressor para não estourar.
  const NOTAS = [[784, 0], [1046.5, 0.12], [1568, 0.24]];
  // Balão que menciona você (pedido do usuário em 2026-11-15: amarelo, mais bonito que um fundo):
  // contorno dourado com brilho que pulsa duas vezes quando a fala chega.
  const CSS_DESTAQUE = '[data-vl-mencao] { position: relative; border-radius: 9px; box-shadow: 0 0 0 2px #ffd23f, 0 0 10px 2px rgba(255, 210, 63, .55) !important;'
    + ' animation: vl-mencao-pulso 1s ease-out 2; }'
    + '@keyframes vl-mencao-pulso { 0% { box-shadow: 0 0 0 2px #ffd23f, 0 0 0 0 rgba(255, 210, 63, .9); } 70% { box-shadow: 0 0 0 2px #ffd23f, 0 0 0 9px rgba(255, 210, 63, 0); } 100% { box-shadow: 0 0 0 2px #ffd23f, 0 0 10px 2px rgba(255, 210, 63, .55); } }';
  // Só o SEU "@apelido" ganha cor (pedido do usuário em 2026-11-15): etiqueta dourada em relevo.
  // Etiqueta em todo @apelido dos balões (pedido do usuário em 2026-11-15, a partir de um print): fundo
  // escuro translúcido, borda e texto limão; a sua brilha. Passar o mouse mostra "Abrir perfil de …" e o
  // clique abre o perfil da pessoa pelo nome.
  const CSS_ARROBA = '[data-vl-arroba] { position: relative; color: #e9ff7a !important; font-weight: 700 !important; padding: 0 5px; margin: 0 1px; border-radius: 4px;'
    + ' background: rgba(20, 26, 37, .72) !important; border: 1.5px solid #d6f24a; text-shadow: none !important; cursor: pointer; pointer-events: auto; }'
    + '[data-vl-arroba="eu"] { box-shadow: 0 0 7px rgba(214, 242, 74, .65); }'
    + '[data-vl-arroba]:hover { background: #d6f24a !important; color: #12161f !important; }'
    + '[data-vl-arroba]:hover::after { content: attr(data-dica); position: absolute; left: 50%; bottom: calc(100% + 7px); transform: translateX(-50%); white-space: nowrap; pointer-events: none; z-index: 10;'
    + ' background: #12161f; color: #e6eaf1; border: 1px solid #36435c; border-radius: 6px; padding: 3px 8px; font: 600 11px/1.3 system-ui, sans-serif; box-shadow: 0 4px 12px rgba(0, 0, 0, .5); }';

  nucleo.definirModulo({
    id: 'mencoes',
    iniciar(ctx) {
      // O apelido vem da conta logada (o módulo Conexão do jogo sabe qual é); um apelido digitado em
      // versões antigas fica só como reserva, para quem está sem a conexão.
      function apelidoDaConta() {
        try { return VL.pessoas && typeof VL.pessoas.eu === 'function' ? (VL.pessoas.eu() || '') : ''; } catch (erro) { return ''; }
      }
      let apelidoUsado = '';
      function criar() {
        const s = ctx.secao();
        apelidoUsado = apelidoDaConta() || s.apelido || '';
        return VL.mencoes.criarDetector(Object.assign({}, s, { apelido: apelidoUsado }));
      }
      let detector = criar();
      // Quando o apelido da conta fica conhecido (ao entrar num quarto), o detector é refeito.
      function emDia() {
        const agora = apelidoDaConta() || ctx.secao().apelido || '';
        if (agora !== apelidoUsado) { detector = criar(); if (aoMudar) aoMudar(); }
      }
      const relogioApelido = setInterval(emDia, 3000);
      ctx.aoParar(function () { clearInterval(relogioApelido); });
      const recentes = []; // { autor, texto, quando, termo }
      let aoMudar = null; // redesenha a aba aberta, se houver
      let removerEstilo = null;
      let audio = null;
      let ultimoSom = 0;

      function avisarAba() {
        if (aoMudar) aoMudar();
      }

      function aplicarEstilo() {
        if (removerEstilo) {
          removerEstilo();
          removerEstilo = null;
        }
        if (ctx.secao().destacar) removerEstilo = camada.estiloPagina('mencoes', CSS_DESTAQUE);
      }

      function tirarDestaques() {
        document.querySelectorAll('[data-vl-mencao]').forEach(function (no) {
          no.removeAttribute('data-vl-mencao');
        });
      }

      // Duas notas curtas feitas com WebAudio: não há arquivo de som na extensão.
      function tocar() {
        const cfg = ctx.secao();
        if (!cfg.som || !(cfg.volume > 0)) return;
        const agora = Date.now();
        if (agora - ultimoSom < PAUSA_SOM_MS) return;
        ultimoSom = agora;
        try {
          const Contexto = window.AudioContext || window.webkitAudioContext;
          if (!Contexto) return;
          if (!audio) audio = new Contexto();
          if (audio.state === 'suspended') audio.resume().catch(function () {});
          const pico = Math.max(0.0002, Math.pow(cfg.volume / 100, 0.8) * 0.9);
          const base = audio.currentTime + 0.01;
          const compressor = audio.createDynamicsCompressor();
          compressor.threshold.value = -10;
          compressor.ratio.value = 6;
          compressor.connect(audio.destination);
          NOTAS.forEach(function (nota) {
            const t = base + nota[1];
            const osc = audio.createOscillator();
            const ganho = audio.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(nota[0], t);
            ganho.gain.setValueAtTime(0.0001, t);
            ganho.gain.exponentialRampToValueAtTime(pico, t + 0.015);
            ganho.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
            osc.connect(ganho);
            ganho.connect(compressor);
            osc.start(t);
            osc.stop(t + 0.34);
          });
        } catch (erro) {
          // Sem som (política do navegador ou falta de suporte): os avisos visuais continuam valendo.
        }
      }

      // Quem está silenciado não dispara aviso.
      function silenciado(autor) {
        if (!ctx.ativo('silenciar')) return false;
        const alvo = String(autor || '').trim().toLowerCase();
        return ctx.config().silenciar.apelidos.some((n) => n.toLowerCase() === alvo);
      }

      // Etiqueta em todo "@apelido" dos balões (todas as falas, inclusive as suas).
      let removerArroba = null;
      function estiloArroba() {
        if (removerArroba) { removerArroba(); removerArroba = null; }
        if (ctx.secao().corNoBalao) removerArroba = camada.estiloPagina('mencoes-arroba', CSS_ARROBA);
      }
      estiloArroba();
      function colorirArrobas(fala) {
        if (!ctx.secao().corNoBalao || !fala || !fala.el) return;
        const eu = String(apelidoDaConta() || ctx.secao().apelido || '').toLowerCase();
        const conhecidos = (VL.pessoas && VL.pessoas.lista ? VL.pessoas.lista() : []).concat(eu ? [apelidoDaConta() || ctx.secao().apelido] : []);
        jogo.marcarTrechos(fala.el, function (s) { return texto.trechosDeArroba(s, conhecidos); }, function (trecho, visivel) {
          const span = document.createElement('span');
          span.setAttribute('data-vl-arroba', eu && trecho.nome.toLowerCase() === eu ? 'eu' : 'outro');
          span.setAttribute('data-vl-perfil', trecho.nome);
          span.setAttribute('data-dica', 'Abrir perfil de ' + trecho.nome);
          span.textContent = visivel;
          return span;
        });
      }
      // Clique na etiqueta: abre o perfil (e não seleciona quem falou).
      ctx.escutar(window, 'click', function (ev) {
        const alvo = ev.target && ev.target.closest ? ev.target.closest('[data-vl-perfil]') : null;
        if (!alvo || !ev.isTrusted || ev.button !== 0) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const nome = alvo.getAttribute('data-vl-perfil');
        if (!VL.conexao || !VL.conexao.disponivel()) { camada.aviso('Ligue o módulo "Conexão do jogo" para abrir perfis.', { tipo: 'erro' }); return; }
        VL.conexao.enviar(VL.codigos.SAIDA.PERFIL_POR_NOME, [['s', nome]]);
      }, true);
      ctx.escutar(window, 'mousedown', function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest('[data-vl-perfil]')) ev.stopImmediatePropagation();
      }, true);
      ctx.aoParar(function () {
        if (removerArroba) removerArroba();
        document.querySelectorAll('[data-vl-arroba]').forEach(function (no) { no.replaceWith(document.createTextNode(no.textContent)); });
      });

      ctx.aoParar(jogo.observarFalas(function (fala) {
        colorirArrobas(fala);
        if (silenciado(fala.autor)) return;
        emDia();
        const termo = detector.testar(fala);
        if (!termo) return;
        recentes.push({ autor: fala.autor, texto: fala.texto, quando: fala.quando, termo });
        if (recentes.length > MAX_RECENTES) recentes.shift();
        if (ctx.secao().destacar && fala.el) {
          (jogo.corpoDoBalao(fala.el) || fala.el).setAttribute('data-vl-mencao', '');
        }
        tocar();
        ctx.emitir('mencoes:nova', { autor: fala.autor, texto: fala.texto, termo });
        avisarAba();
      }));

      // Mensagem privada (console) com o seu @apelido ou um dos termos: entra na lista e toca o som.
      // O texto vem do módulo Amigos (evento "amigos:mensagem").
      ctx.ouvir('amigos:mensagem', function (m) {
        if (!ctx.secao().console || !m || !m.texto) return;
        if (m.autor && silenciado(m.autor)) return;
        emDia();
        const termo = detector.testar({ autor: m.autor, texto: m.texto });
        if (!termo) return;
        recentes.push({ autor: (m.autor || 'amigo') + ' (console)', texto: m.texto, quando: Date.now(), termo });
        if (recentes.length > MAX_RECENTES) recentes.shift();
        tocar();
        ctx.emitir('mencoes:nova', { autor: m.autor, texto: m.texto, termo, console: true });
        avisarAba();
      });

      ctx.aoConfig(function (secao) {
        if (secao !== 'mencoes') return;
        detector = criar();
        aplicarEstilo();
        estiloArroba();
        if (!ctx.secao().destacar) tirarDestaques();
        avisarAba();
      });

      aplicarEstilo();

      ctx.aoParar(function () {
        if (removerEstilo) removerEstilo();
        removerEstilo = null;
        tirarDestaques();
        if (audio) {
          try {
            audio.close();
          } catch (erro) {
            // já estava fechado
          }
          audio = null;
        }
      });

      ctx.comando({
        nome: 'mencoes',
        uso: 'mencoes',
        descricao: 'Mostra as menções recentes.',
        executar() {
          if (ctx.ativo('painel')) {
            ctx.emitir('painel:abrir', { aba: 'mencoes' });
            return;
          }
          if (!recentes.length) {
            camada.aviso('Nenhuma menção nesta sessão.');
            return;
          }
          camada.aviso(recentes.slice(-5).reverse().map(function (m) {
            return texto.hora(m.quando) + ' ' + m.autor + ': ' + m.texto;
          }).join('\n'), { duracaoMs: 10000 });
        },
      });

      ctx.aba({
        id: 'mencoes',
        titulo: 'Menções',
        ordem: 15,
        montar(alvo) {
          function desenhar() {
            const cfg = ctx.secao();
            const nos = [];
            if (!apelidoUsado) {
              nos.push(el('p', {
                class: 'vl-nota',
                texto: ctx.ativo('conexao')
                  ? 'O seu apelido aparece aqui assim que você entrar num quarto.'
                  : 'Para avisar quando falarem o seu apelido, ligue o módulo "Conexão do jogo": é por ele que o Vagalume sabe qual é a conta logada.',
              }));
            }
            if (detector.vazio) {
              nos.push(el('p', {
                class: 'vl-vazio',
                texto: 'Nenhum apelido ou termo para monitorar ainda. Dá para acrescentar outros termos nos ajustes das Menções.',
              }));
            } else {
              const monitorados = [apelidoUsado ? (cfg.soComArroba ? '@' : '') + apelidoUsado + ' (sua conta)' : ''].concat(cfg.termos || []).filter(Boolean);
              nos.push(el('p', { class: 'vl-nota', texto: 'Monitorando: ' + monitorados.join(', ') + '.' }));
              if (!recentes.length) {
                nos.push(el('p', { class: 'vl-vazio', texto: 'Nenhuma menção nesta sessão.' }));
              } else {
                nos.push(el('ul', { class: 'vl-lista' }, recentes.slice().reverse().map((m) => el('li', { class: 'vl-item' }, [
                  el('span', { class: 'vl-hora', texto: texto.hora(m.quando) }),
                  ' ',
                  el('span', { class: 'vl-autor', texto: m.autor || '?' }),
                  ' ' + m.texto,
                ]))));
              }
            }
            nos.push(el('div', { class: 'vl-linha' }, [
              el('button', {
                type: 'button', class: 'vl-botao', 'data-foco': 'limpar', texto: 'Limpar lista', disabled: !recentes.length,
                onclick() {
                  recentes.length = 0;
                  desenhar();
                },
              }),
            ]));
            nos.push(el('p', { class: 'vl-nota', texto: 'A lista fica só na memória desta aba e some ao recarregar.' }));
            camada.trocar(alvo, nos);
          }
          desenhar();
          aoMudar = desenhar;
          return function () {
            aoMudar = null;
          };
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
