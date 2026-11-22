// Vagalume — módulo "construcao": ajuda a arrumar os mobis do chão do quarto.
// Depende do adaptador de conexão (módulo "conexao" ligado e hotel recarregado). O Vagalume acompanha
// a lista de mobis que o jogo recebe e sabe qual foi o último clicado; o servidor continua decidindo
// tudo (sem direitos no quarto, os pedidos são recusados por ele).
// Códigos conferidos ao vivo em 2026-11-13 no quarto do próprio usuário (docs/analise/codigos.md).
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.conexao || !VL.codigos) return;
  const { nucleo, camada, conexao, codigos } = VL;
  const { SAIDA, ENTRADA } = codigos;

  function emCampoDeTexto(alvo) { return VL.jogo.campoOcupado(alvo); }

  nucleo.definirModulo({
    id: 'construcao',
    iniciar(ctx) {
      document.documentElement?.setAttribute('data-vl-construcao-alturas', 'nativa-397');
      ctx.aoParar(() => document.documentElement?.removeAttribute('data-vl-construcao-alturas'));
      const mobis = new Map(); // id -> mobi
      const MAX_DESFAZER = 50;
      const desfazer = []; // posições anteriores: { id, x, y, direcao, altura }
      const refazer = [];
      let grupoHistorico = null;
      const ignorando = new Map(); // id -> { vezes, ate }: movimentos mandados pelo próprio desfazer
      const foto = (m) => ({ id: m.id, x: m.x, y: m.y, direcao: m.direcao, altura: m.altura });
      let selecionado = null;  // id do último mobi clicado
      let pickitem = null; // { primeiro, sala }: espera dois cliques no mesmo mobi
      let geracaoQuarto = 0;
      let incompleto = false;
      // Formato do ROOM_CONSTRUCTION_TOOL do cliente 3495: altura, incremento,
      // estado e direção (interruptor/valor), opções de personagem/iguais e área.
      const tiposFerramenta = ['b', 'i', 'b', 'i', 'b', 'i', 'b', 'i', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'i', 'i', 'i', 'i', 'b', 'b', 'b', 'b'];
      let ajustesFerramenta = tiposFerramenta.map((tipo) => tipo === 'b' ? false : 0);

      function registrarCliquePickitem(id) {
        if (!pickitem) return;
        if (pickitem.sala !== geracaoQuarto) { pickitem = null; return; }
        if (!mobis.has(id)) { camada.aviso('Escolha um mobi do chão que esteja na lista deste quarto.', { tipo: 'erro' }); return; }
        if (pickitem.primeiro !== id) {
          pickitem.primeiro = id;
          camada.aviso('Mobi escolhido. Clique nele mais uma vez para conferir todos os iguais.');
          return;
        }
        const sala = pickitem.sala;
        pickitem = null;
        prepararPickitem(id, sala).catch(function (erro) {
          camada.aviso('Não consegui preparar o /pickitem: ' + (erro.message || erro), { tipo: 'erro' });
        });
      }

      const cancelar = [
        conexao.ouvir('saida', SAIDA.FERRAMENTA_CONSTRUCAO, function (l) {
          ajustesFerramenta = tiposFerramenta.map((tipo) => tipo === 'b' ? l.booleano() : l.inteiro());
        }),
        conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { mobis.clear(); selecionado = null; incompleto = false; pickitem = null; geracaoQuarto++; }),
        conexao.ouvir('entrada', ENTRADA.MOBIS_DO_QUARTO, function (l) {
          // Quartos grandes chegam em várias partes: junta todas (o quarto novo limpa a lista).
          const r = codigos.lerMobisDoQuarto(l);
          for (const m of r.mobis) mobis.set(m.id, m);
          incompleto = incompleto || r.incompleto;
        }),
        conexao.ouvir('entrada', ENTRADA.MOBI_COLOCADO, function (l) { const m = codigos.lerMobi(l); mobis.set(m.id, m); }),
        conexao.ouvir('entrada', ENTRADA.MOBI_ATUALIZADO, function (l) { const m = codigos.lerMobi(l); mobis.set(m.id, m); }),
        conexao.ouvir('entrada', ENTRADA.MOBI_RETIRADO, function (l) {
          const id = Number(l.texto());
          mobis.delete(id);
          if (selecionado === id) selecionado = null;
        }),
        conexao.ouvir('entrada', ENTRADA.ESTADO_MOBI, function (l) {
          const m = mobis.get(Number(l.texto()));
          l.inteiro();
          if (m) m.estado = l.texto();
        }),
        conexao.ouvir('saida', SAIDA.CLICAR_MOBI, function (l) {
          selecionado = l.inteiro();
          registrarCliquePickitem(selecionado);
        }),
        conexao.ouvir('saida', SAIDA.USAR_MOBI, function (l) {
          const id = l.inteiro();
          if (pickitem && pickitem.primeiro === id) registrarCliquePickitem(id);
        }),
        conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { desfazer.length = 0; refazer.length = 0; grupoHistorico = null; }),
        // Todo movimento que sai (do jogo ou do Vagalume) guarda onde o mobi estava, menos os do próprio desfazer.
        conexao.ouvir('saida', SAIDA.MOVER_MOBI, function (l) {
          const id = l.inteiro();
          const agora = Date.now();
          const ignorar = ignorando.get(id);
          if (ignorar && ignorar.ate > agora) { if (--ignorar.vezes <= 0) ignorando.delete(id); return; }
          ignorando.delete(id);
          const m = mobis.get(id);
          if (!m) return;
          if (grupoHistorico) {
            if (!grupoHistorico.has(id)) grupoHistorico.set(id, foto(m));
            refazer.length = 0;
            return;
          }
          desfazer.push(foto(m));
          if (desfazer.length > MAX_DESFAZER) desfazer.shift();
          refazer.length = 0;
        }),
      ];
      ctx.aoParar(function () { cancelar.forEach((fn) => fn()); });

      function exigir() {
        if (!conexao.disponivel()) {
          camada.aviso('Ligue o módulo "Conexão do jogo" e recarregue o hotel para usar a construção.', { tipo: 'erro' });
          return null;
        }
        const m = mobis.get(selecionado);
        if (!m) { camada.aviso('Clique primeiro num mobi do chão do quarto.', { tipo: 'erro' }); return null; }
        return m;
      }

      function mandar(cabecalho, campos) {
        return conexao.enviar(cabecalho, campos).then(function (r) {
          if (!r.ok) camada.aviso('Não deu para mandar ao jogo: ' + r.motivo + '.', { tipo: 'erro' });
          return r.ok;
        });
      }

      // Posição otimista (pedido do usuário em 2026-11-15): o mobi já conta como movido assim que o pedido
      // sai, então cliques rápidos se somam em vez de partirem todos da posição antiga. O servidor corrige
      // pelo MOBI_ATUALIZADO, se for o caso.
      function mover(m, destino) {
        const pedido = mandar(SAIDA.MOVER_MOBI, [['i', m.id], ['i', destino.x], ['i', destino.y], ['i', destino.direcao]]);
        const atual = mobis.get(m.id);
        if (atual) { atual.x = destino.x; atual.y = destino.y; atual.direcao = destino.direcao; }
        setTimeout(atualizarSituacao, 0);
        return pedido;
      }

      // Shift e Ctrl sozinhos não chegam ao jogo (ele abriria o chat e os atalhos parariam lá).
      ctx.escutar(window, 'keydown', function (ev) {
        const o = ctx.secao();
        if (o.teclado || o.desfazer || o.alturaScroll) VL.jogo.segurarModificador(ev);
      }, true);

      // Ctrl+seta move o mobi selecionado um piso pelos eixos do chão; Ctrl+Shift+←/→ gira.
      ctx.escutar(document, 'keydown', function (ev) {
        if (!ctx.secao().teclado || !ev.ctrlKey || ev.altKey || ev.metaKey) return;
        if (!codigos.EIXOS[ev.key]) return;
        if (emCampoDeTexto(ev.target) || camada.contem(ev)) return;
        const m = mobis.get(selecionado);
        if (!m || !conexao.disponivel()) return;
        const destino = codigos.mexer(m, ev.key, ev.shiftKey);
        if (!destino) return;
        ev.preventDefault();
        ev.stopPropagation();
        mover(m, destino);
      }, true);

      // ---------- desfazer e refazer (Ctrl+Z, Ctrl+Y ou Ctrl+Shift+Z) ----------
      // Só movimentos, giros e alturas de mobis do chão que ainda estão no quarto. Colocar e recolher não entram.
      function voltar(de, para) {
        if (trabalhando) { camada.aviso('Espere a ação de construção terminar.'); return false; }
        const pilha = de === 'desfazer' ? desfazer : refazer;
        const outra = de === 'desfazer' ? refazer : desfazer;
        while (pilha.length) {
          const alvo = pilha.pop();
          if (alvo.grupo) {
            const atuais = alvo.grupo.map((item) => mobis.get(item.id)).filter(Boolean).map(foto);
            if (!atuais.length) continue;
            outra.push({ grupo: atuais });
            emLote(async function () {
              const plano = alvo.grupo.filter((item) => mobis.has(item.id)).slice().sort((a, b) => a.altura - b.altura);
              for (const item of plano) ignorando.set(item.id, { vezes: 1, ate: Date.now() + plano.length * 700 + 5000 });
              await moverLista(plano, true);
              ctx.emitir('construcao:historico');
            }).catch((erro) => console.warn('[Vagalume] Falha ao desfazer grupo:', erro));
            return true;
          }
          const m = mobis.get(alvo.id);
          if (!m) continue; // saiu do quarto
          outra.push(foto(m));
          const mudaAltura = Math.abs((alvo.altura || 0) - (m.altura || 0)) > 0.001;
          ignorando.set(m.id, { vezes: mudaAltura ? 2 : 1, ate: Date.now() + 8000 });
          mover(m, alvo).then(function () { if (mudaAltura) aplicarAltura(Object.assign({}, m, alvo), alvo.altura || 0); });
          selecionado = m.id;
          return true;
        }
        camada.aviso(para);
        return false;
      }
      ctx.escutar(document, 'keydown', function (ev) {
        if (!ctx.secao().desfazer || !ev.ctrlKey || ev.altKey || ev.metaKey || ev.repeat) return;
        const tecla = String(ev.key || '').toLowerCase();
        const refazendo = tecla === 'y' || (tecla === 'z' && ev.shiftKey);
        if (tecla !== 'z' && !refazendo) return;
        if (emCampoDeTexto(ev.target) || camada.contem(ev) || !conexao.disponivel()) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (refazendo) voltar('refazer', 'Nada para refazer.');
        else voltar('desfazer', 'Nada para desfazer neste quarto.');
      }, true);

      // ---------- altura ----------
      // Nos atalhos individuais, o comando `:up N` liga um modo em que o próximo
      // mobi movido fica na altura N, e `:up` sozinho desliga (conferido ao vivo, aceita decimais).
      // O Vagalume liga o modo, move o mobi no mesmo lugar e desliga. Em maiúsculas, para outras
      // extensões que tratam `:up` como atalho deixarem passar.
      const alturasUsadas = [];
      let filaAltura = Promise.resolve();
      const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
      // Altura rápida (pedido do usuário em 2026-11-15: "subir uma vez e depois subir de novo está muito
      // lento" e cliques rápidos bugavam). Cada clique já soma na altura pendente (mostrada na hora);
      // cliques seguidos se juntam e saem uma vez 150 ms depois do último; o ":UP N" só é mandado quando
      // a altura muda, e o ":UP" que desliga sai uma vez, 1,5 s depois da última mudança.
      const pendentes = new Map(); // id -> { m, alvo }
      let relogioAltura = 0;
      let relogioDesligarUp = 0;
      let upLigado = null;
      function alturaPendente(m) { const p = pendentes.get(m.id); return p ? p.alvo : m.altura; }
      function aplicarAltura(m, z) {
        if (trabalhando) { camada.aviso('Espere a ação de construção terminar.'); return filaAltura; }
        const alvo = codigos.alturaValida(z);
        if (alvo == null) { camada.aviso('Altura entre 0 e ' + codigos.MAX_ALTURA + ', com até duas casas decimais.', { tipo: 'erro' }); return filaAltura; }
        pendentes.set(m.id, { m, alvo });
        atualizarSituacao();
        clearTimeout(relogioAltura);
        return new Promise(function (resolver) {
          relogioAltura = setTimeout(function () { enviarAlturas().then(resolver, resolver); }, 150);
        });
      }
      function enviarAlturas() {
        const lista = [...pendentes.values()];
        pendentes.clear();
        filaAltura = filaAltura.then(async function () {
          for (const { m, alvo } of lista) {
            if (upLigado !== alvo) {
              if (!(await mandar(SAIDA.FALAR, [['s', ':UP ' + alvo], ['i', 0]]))) return;
              upLigado = alvo;
              await esperar(90); // o servidor trata o comando antes do movimento (mesma conexão, em ordem)
            }
            const atual = mobis.get(m.id) || m;
            await mandar(SAIDA.MOVER_MOBI, [['i', m.id], ['i', atual.x], ['i', atual.y], ['i', atual.direcao]]);
            if (mobis.get(m.id)) mobis.get(m.id).altura = alvo; // otimista; o servidor confirma pelo 3776
            if (lista.length > 3) await esperar(300); // muitos de uma vez (escada, nivelar): devagar, para não levar mute
            const i = alturasUsadas.indexOf(alvo);
            if (i >= 0) alturasUsadas.splice(i, 1);
            alturasUsadas.unshift(alvo);
            if (alturasUsadas.length > 8) alturasUsadas.pop();
          }
          atualizarHistorico();
          atualizarSituacao();
          clearTimeout(relogioDesligarUp);
          relogioDesligarUp = setTimeout(function () {
            if (upLigado == null || pendentes.size) return;
            upLigado = null;
            mandar(SAIDA.FALAR, [['s', ':UP'], ['i', 0]]);
          }, 1500);
        }).catch(function (erro) { console.warn('[Vagalume] Falha ao mudar a altura:', erro); });
        return filaAltura;
      }
      ctx.aoParar(function () {
        clearTimeout(relogioAltura);
        clearTimeout(relogioDesligarUp);
        if (upLigado != null && conexao.disponivel()) conexao.enviar(SAIDA.FALAR, [['s', ':UP'], ['i', 0]]);
      });

      // Shift+roda sobre o quarto muda a altura do mobi selecionado; os giros se somam e a mudança
      // vai uma vez só, depois de uma pausa (cada mudança manda dois comandos ao jogo).
      let somaRoda = 0;
      let relogioRoda = null;
      ctx.escutar(window, 'wheel', function (ev) {
        if (!ctx.secao().alturaScroll || !ev.shiftKey || ev.ctrlKey || ev.altKey) return;
        if (camada.contem(ev) || !ev.target || typeof ev.target.closest !== 'function' || ev.target.closest('.nitro-card, .nitro-toolbar, .nitro-infostand-container')) return;
        const m = mobis.get(selecionado);
        if (!m || !conexao.disponivel()) return;
        ev.preventDefault();
        ev.stopPropagation();
        const delta = ev.deltaY || ev.deltaX;
        somaRoda += delta < 0 ? 1 : delta > 0 ? -1 : 0;
        clearTimeout(relogioRoda);
        relogioRoda = setTimeout(function () {
          const passos = somaRoda;
          somaRoda = 0;
          const atual = mobis.get(selecionado);
          if (!atual || !passos) return;
          const novo = codigos.alturaValida(alturaPendente(atual) + passos * ctx.secao().passoAltura);
          if (novo == null) return;
          camada.aviso('Altura ' + novo);
          aplicarAltura(atual, novo);
        }, 150);
      }, { capture: true, passive: false });
      ctx.aoParar(function () { clearTimeout(relogioRoda); });

      // ---------- aba "Construção" no painel ----------

      const el = camada.el;
      let situacao = null; // parágrafo da aba que mostra o mobi selecionado, enquanto a aba existe
      function descrever() {
        if (!conexao.disponivel()) return 'Ligue o módulo "Conexão do jogo" e recarregue o hotel.';
        const m = mobis.get(selecionado);
        if (!m) return 'Clique num mobi do chão do quarto para selecioná-lo. ' + mobis.size + ' mobis no chão.';
        return 'Selecionado: mobi ' + m.id + ' (tipo ' + m.tipo + ') em (' + m.x + ', ' + m.y + '), altura ' + m.altura + ', direção ' + m.direcao + (m.estado ? ', estado ' + m.estado : '') + '.';
      }
      // Cartão do mobi selecionado: ícone e nome (dados de mobis do jogo, quando já lidos), posição,
      // altura e direção.
      let dadosMobis = null;
      function atualizarSituacao() {
        if (!situacao || !situacao.isConnected) return;
        const m = conexao.disponivel() ? mobis.get(selecionado) : null;
        if (!m) { situacao.replaceChildren(el('div', { class: 'vl-sel-vazio', texto: descrever() })); return; }
        const d = dadosMobis ? dadosMobis.chao.get(m.tipo) : null;
        const img = el('img', { class: 'vl-sel-img', alt: '' });
        const src = d && VL.dadosJogo ? VL.dadosJogo.iconeDe(d.classe) : '';
        if (src) img.src = src; else img.hidden = true;
        situacao.replaceChildren(
          el('span', { class: 'vl-sel-foto' }, [img]),
          el('div', { class: 'vl-sel-texto' }, [
            el('strong', { texto: (d && d.nome) || ('Mobi tipo ' + m.tipo) }),
            el('div', { class: 'vl-sel-dados' }, [
              el('span', { texto: 'x ' + m.x }), el('span', { texto: 'y ' + m.y }), el('span', { class: pendentes.has(m.id) ? 'vl-pendente' : '', texto: 'altura ' + alturaPendente(m) }), el('span', { texto: 'direção ' + m.direcao }),
            ]),
          ]),
        );
      }
      cancelar.push(conexao.ouvir('saida', SAIDA.CLICAR_MOBI, function () { setTimeout(atualizarSituacao, 0); }));
      cancelar.push(conexao.ouvir('entrada', ENTRADA.MOBI_ATUALIZADO, function () { setTimeout(atualizarSituacao, 0); }));
      cancelar.push(conexao.ouvir('entrada', ENTRADA.ESTADO_MOBI, function () { setTimeout(atualizarSituacao, 0); }));

      // Aviso de cliques seguidos (pedido do usuário em 2026-11-15): cada movimento e cada ":UP" vão ao
      // servidor, e o Habblet dá mute por flood a quem manda demais em pouco tempo.
      const cliquesRecentes = [];
      let ultimoAvisoCliques = 0;
      function contarClique() {
        const agora = Date.now();
        cliquesRecentes.push(agora);
        while (cliquesRecentes.length && agora - cliquesRecentes[0] > 2000) cliquesRecentes.shift();
        if (cliquesRecentes.length >= 6 && agora - ultimoAvisoCliques > 15000) {
          ultimoAvisoCliques = agora;
          camada.aviso('Calma nos cliques! Clicar sem parar manda muitas mensagens ao jogo e o Habblet pode te dar mute por flood. Clique, espere o mobi mudar e clique de novo.', { tipo: 'erro', duracaoMs: 8000 });
        }
      }
      function botaoMexer(rotulo, tecla, girar) {
        return el('button', {
          type: 'button', class: 'vl-botao', texto: rotulo,
          onclick() { contarClique(); const m = exigir(); if (m) { const d = codigos.mexer(m, tecla, girar); if (d) mover(m, d); } },
        });
      }

      let historico = null; // linha da aba com as últimas alturas usadas
      function atualizarHistorico() {
        if (!historico || !historico.isConnected) return;
        historico.replaceChildren(
          el('span', { class: 'vl-nota', texto: alturasUsadas.length ? 'Últimas alturas:' : 'As alturas que você usar aparecem aqui.' }),
          ...alturasUsadas.map((z) => el('button', { type: 'button', class: 'vl-botao', texto: String(z), onclick() { const m = exigir(); if (m) aplicarAltura(m, z); } }))
        );
      }
      function botaoAltura(rotulo, sinal) {
        return el('button', {
          type: 'button', class: 'vl-botao', texto: rotulo,
          onclick() { contarClique(); const m = exigir(); if (m) aplicarAltura(m, alturaPendente(m) + sinal * ctx.secao().passoAltura); },
        });
      }

      let ferramenta = null;
      let subAba = 'area';
      ctx.aba({
        id: 'construcao',
        titulo: 'Construção',
        ordem: 45,
        montar(alvo) {
          // Repaginada em 2026-11-15 (pedido do usuário: "deixe prático para quem for usar").
          situacao = el('div', { class: 'vl-sel' });
          historico = el('div', { class: 'vl-linha vl-alturas' });
          atualizarHistorico();
          const arquivo = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
          arquivo.addEventListener('change', function () {
            const f = arquivo.files && arquivo.files[0];
            if (f && f.size <= 2000000) f.text().then(importarQuarto);
            arquivo.value = '';
          });
          const botao = (rotulo, dica, fazer, classe) => el('button', { type: 'button', class: 'vl-botao' + (classe ? ' ' + classe : ''), texto: rotulo, title: dica, onclick: fazer });
          const mexer = (rotulo, dica, tecla, girar) => { const b = botaoMexer(rotulo, tecla, girar); b.title = dica; return b; };
          const secao = (titulo, filhos) => el('section', { class: 'vl-cons-secao' }, [el('h3', { class: 'vl-acoes-titulo', texto: titulo })].concat(filhos));
          const congelar = botao('Congelar (não andar)', 'O avatar não anda ao clicar no chão enquanto você constrói', function () { alternarCongelar(); });
          const tele = botao('Teleporte', 'Clique num piso e vá direto (:tele do jogo; precisa de direitos)', function () { alternarTeleporte(); });
          botoesModo = { congelar, tele };
          setTimeout(atualizarModo, 0);
          // Duas partes (pedido do usuário em 2026-11-22): Área (vários mobis) e Mobi (um só); o resto fica embaixo.
          const area = el('div', { class: 'vl-cons-painel', role: 'tabpanel', 'aria-label': 'Área' }, []);
          const mobi = el('div', { class: 'vl-cons-painel', role: 'tabpanel', 'aria-label': 'Mobi' }, [
            situacao,
            el('p', { class: 'vl-cuidado', texto: '⚠ Não clique sem parar: cada clique manda uma mensagem ao jogo, e o Habblet dá mute por flood.' }),
            el('div', { class: 'vl-cons-colunas' }, [
              secao('Mover e girar', [
                el('div', { class: 'vl-cruz' }, [
                  mexer('↖', 'x − 1', 'ArrowLeft', false), mexer('↗', 'y − 1', 'ArrowUp', false),
                  mexer('↙', 'y + 1', 'ArrowDown', false), mexer('↘', 'x + 1', 'ArrowRight', false),
                ]),
                el('div', { class: 'vl-linha' }, [mexer('↺ Girar', 'Girar para a esquerda', 'ArrowLeft', true), mexer('↻ Girar', 'Girar para a direita', 'ArrowRight', true)]),
              ]),
              secao('Altura', [
                el('div', { class: 'vl-linha' }, [botaoAltura('−', -1), botaoAltura('+', 1),
                  botao('0', 'Altura 0', function () { const m = exigir(); if (m) aplicarAltura(m, 0); })]),
                historico,
              ]),
            ]),
            secao('Ações', [el('div', { class: 'vl-linha' }, [
              botao('Usar', 'Liga, desliga ou muda o estado', function () { const m = exigir(); if (m) mandar(SAIDA.USAR_MOBI, [['i', m.id], ['i', 0]]); }),
              botao('Recolher…', 'Volta o mobi para o inventário', function () { recolher(); }),
              botao('Lista de mobis', 'Todos os mobis do chão', function () { listar(); }),
            ])]),
            el('p', { class: 'vl-nota', texto: 'Atalhos no quarto: Ctrl+setas movem o mobi, Ctrl+Shift+← → giram, Shift+roda muda a altura.' }),
          ]);
          const geral = el('div', { class: 'vl-cons-geral' }, [
            secao('Modo construção', [el('div', { class: 'vl-linha' }, [congelar, tele])]),
          ]);
          const fimGeral = secao('Quarto inteiro', [el('div', { class: 'vl-linha' }, [
            botao('Copiar quarto', 'Guarda a posição de todos os mobis', function () { copiarQuarto(); }),
            botao('Colar quarto…', 'Coloca de novo, com mobis do inventário', function () { colarQuarto(); }),
            botao('Exportar', 'Salva a cópia num arquivo', function () { exportarQuarto(); }),
            botao('Importar…', 'Traz uma cópia de um arquivo', function () { arquivo.click(); }),
            arquivo,
          ])]);
          const fimArea = secao('Altura da área', [
            el('div', { class: 'vl-linha' }, [
              botao('Nivelar…', 'Mesma altura para toda a área', function () { escreverNoChat('nivelar '); }),
              botao('Escada…', 'Altura subindo a cada piso', function () { escreverNoChat('escada 0.5 x'); }),
            ]),
            el('p', { class: 'vl-nota', texto: 'Até 40 mobis por vez.' }),
          ]);
          const abas = [['area', 'Área', 'Vários mobis de uma vez', area], ['mobi', 'Mobi', 'Um mobi só', mobi]];
          const botoesAba = abas.map(([id, titulo, resumo]) => el('button', { type: 'button', role: 'tab', class: 'vl-cons-subaba', onclick() { subAba = id; mostrar(); } },
            [el('b', { texto: titulo }), el('small', { texto: resumo })]));
          function mostrar() {
            abas.forEach(([id, , , painel], i) => { painel.hidden = id !== subAba; botoesAba[i].setAttribute('aria-selected', String(id === subAba)); });
          }
          mostrar();
          alvo.replaceChildren(el('div', { class: 'vl-cons-subabas', role: 'tablist', 'aria-label': 'Construção' }, botoesAba), area, mobi, geral);
          const fechos = () => { area.appendChild(fimArea); geral.appendChild(fimGeral); };
          const montarFerramenta = () => { const desmontar = ferramenta.montarPainel({ area, mobi, geral }); fechos(); return desmontar; };
          let desmontarFerramenta = ferramenta && ferramenta.montarPainel ? montarFerramenta() : null;
          const aguardarFerramenta = !desmontarFerramenta ? setTimeout(function () {
            if (alvo.isConnected && ferramenta && ferramenta.montarPainel) desmontarFerramenta = montarFerramenta();
            else fechos();
          }, 0) : null;
          atualizarSituacao();
          if (!dadosMobis && VL.dadosJogo) VL.dadosJogo.mobis().then(function (d) { dadosMobis = d; atualizarSituacao(); }, function () {});
          return function () { if (aguardarFerramenta) clearTimeout(aguardarFerramenta); if (desmontarFerramenta) desmontarFerramenta(); situacao = null; historico = null; };
        },
      });

      // ---------- copiar e colar quarto ----------
      // Copiar: guarda tipo, posição, direção e altura de cada mobi do chão. Colar: em outro quarto
      // seu, coloca mobis do seu inventário nas mesmas posições (o id no quarto é o mesmo do
      // inventário, conferido ao vivo) e acerta a altura pelo :UP. Mobis de parede ficam de fora.
      let copiaQuarto = null;
      let colando = false;
      function copiarQuarto() {
        if (!conexao.disponivel()) { exigir(); return; }
        if (!mobis.size) { camada.aviso('Nenhum mobi no chão deste quarto para copiar.', { tipo: 'erro' }); return; }
        copiaQuarto = codigos.copiaDoQuarto([...mobis.values()]);
        camada.aviso('Cópia guardada: ' + copiaQuarto.length + ' mobis' + (incompleto ? ' (a lista do quarto pode estar incompleta)' : '') + '. Exporte para ter um backup em arquivo.', { tipo: 'ok' });
      }
      function exportarQuarto() {
        if (!copiaQuarto) { camada.aviso('Copie um quarto primeiro.', { tipo: 'erro' }); return; }
        camada.baixar('vagalume-quarto-' + camada.carimbo(true) + '.json', JSON.stringify({ app: 'vagalume', tipo: 'quarto', mobis: copiaQuarto }, null, 1), 'application/json;charset=utf-8');
      }
      function importarQuarto(texto) {
        let obj;
        try { obj = JSON.parse(texto); } catch (erro) { camada.aviso('Arquivo inválido.', { tipo: 'erro' }); return; }
        const lista = obj && obj.app === 'vagalume' && obj.tipo === 'quarto' ? codigos.validarCopiaQuarto(obj.mobis) : null;
        if (!lista) { camada.aviso('Este arquivo não é uma cópia de quarto do Vagalume.', { tipo: 'erro' }); return; }
        copiaQuarto = lista;
        camada.aviso('Cópia importada: ' + lista.length + ' mobis. Entre num quarto seu e cole.', { tipo: 'ok' });
      }
      function pedirInventario() {
        return new Promise(function (resolver) {
          const itens = [];
          const parar = conexao.ouvir('entrada', codigos.ENTRADA.INVENTARIO, function (l) {
            const r = codigos.lerInventario(l);
            itens.push(...r.itens);
            if (r.indice >= r.total - 1) { parar(); clearTimeout(relogio); resolver(itens); }
          });
          const relogio = setTimeout(function () { parar(); resolver(null); }, 8000);
          conexao.enviar(SAIDA.PEDIR_INVENTARIO, []);
        });
      }
      // Coloca itens do inventário com a altura fixa da ferramenta nativa.
      // Colocar em cima do que já está em cada piso (o que o jogo faz sozinho sem altura fixa): só o
      // pacote de colocar, e o próximo sai quando o servidor confirma o anterior (no máximo 700 ms),
      // com 110 ms entre envios. Altura fixa e modos automáticos da ferramenta ficam desligados no lote.
      // Cada piso só conta quando chega o 1534 de um mobi naquele piso. O servidor recusa alguns pedidos
      // seguidos rápido demais: os que faltam voltam (o mesmo item, que continua no inventário) em
      // rodadas com mais folga entre envios.
      const FOLGAS_COLOCAR = [110, 350, 700];
      async function colocarNoTopo(colocar) {
        const pendentes = new Map(colocar.map((m) => [m.x + ',' + m.y, m]));
        let acordar = null;
        const parar = conexao.ouvir('entrada', ENTRADA.MOBI_COLOCADO, function (l) {
          let m = null;
          try { m = codigos.lerMobi(l); } catch (e) { return; }
          if (pendentes.delete(m.x + ',' + m.y) && acordar) acordar();
        });
        try {
          await comAlturasFixas(async function () {
            for (const folga of FOLGAS_COLOCAR) {
              const rodada = [...pendentes.values()];
              if (!rodada.length) break;
              for (const m of rodada) {
                if (!ctx.ativo('construcao')) return;
                const chave = m.x + ',' + m.y;
                if (!pendentes.has(chave)) continue;
                const inicio = Date.now();
                if (!(await mandar(SAIDA.COLOCAR_MOBI, [['s', m.itemId + ' ' + m.x + ' ' + m.y + ' ' + m.direcao]]))) return;
                await new Promise(function (r) { acordar = r; setTimeout(r, 700); if (!pendentes.has(chave)) r(); });
                acordar = null;
                const resto = folga - (Date.now() - inicio);
                if (resto > 0) await esperar(resto);
              }
              await esperar(500); // confirmações atrasadas antes de decidir quem repete
            }
          }, { semAltura: true });
        } finally { parar(); }
        return colocar.length - pendentes.size;
      }
      // Com altura fixa: cada mobi só conta quando o servidor mostra o mesmo id no piso e na altura certos
      // (pelo 1534 ao colocar ou pelo 3776 ao mover). O que falhar volta em mais duas rodadas, mais lentas.
      async function colocarLista(colocar) {
        const certo = (m, lido) => lido.x === m.x && lido.y === m.y && Math.abs(lido.altura - (m.altura || 0)) < 0.01;
        const colocados = new Set();
        const prontos = new Set();
        let acordar = null;
        function ouvir(l, colocado) {
          let lido = null;
          try { lido = codigos.lerMobi(l); } catch (e) { return; }
          const m = alvos.get(lido.id);
          if (!m) return;
          if (colocado) colocados.add(lido.id);
          if (certo(m, lido)) prontos.add(lido.id);
          if (acordar) acordar();
        }
        const alvos = new Map(colocar.map((m) => [m.itemId, m]));
        const pararA = conexao.ouvir('entrada', ENTRADA.MOBI_COLOCADO, (l) => ouvir(l, true));
        const pararB = conexao.ouvir('entrada', ENTRADA.MOBI_ATUALIZADO, (l) => ouvir(l, false));
        const aguardar = (feito) => new Promise(function (r) { if (feito()) { r(); return; } acordar = () => { if (feito()) r(); }; setTimeout(r, 700); }).then(() => { acordar = null; });
        try {
          await comAlturasFixas(async function (fixar) {
            for (const folga of FOLGAS_COLOCAR) {
              const rodada = colocar.filter((m) => !prontos.has(m.itemId)).sort((a, b) => (a.altura || 0) - (b.altura || 0));
              if (!rodada.length) break;
              for (const m of rodada) {
                if (!ctx.ativo('construcao')) return;
                if (prontos.has(m.itemId)) continue;
                const inicio = Date.now();
                if (!(await fixar(m.altura || 0))) return;
                if (!colocados.has(m.itemId)) {
                  if (!(await mandar(SAIDA.COLOCAR_MOBI, [['s', m.itemId + ' ' + m.x + ' ' + m.y + ' ' + m.direcao]]))) return;
                  await aguardar(() => colocados.has(m.itemId));
                  if (!colocados.has(m.itemId)) continue; // recusado: volta na próxima rodada
                }
                // Já pousou na altura certa? Senão move no lugar com a altura fixa (inclusive zero).
                if (!prontos.has(m.itemId)) {
                  if (!(await mandar(SAIDA.MOVER_MOBI, [['i', m.itemId], ['i', m.x], ['i', m.y], ['i', m.direcao]]))) return;
                  await aguardar(() => prontos.has(m.itemId));
                }
                const resto = folga - (Date.now() - inicio);
                if (resto > 0) await esperar(resto);
                if (prontos.size && prontos.size % 20 === 0) camada.aviso(prontos.size + ' de ' + colocar.length + ' colocados…');
              }
              await esperar(500); // confirmações atrasadas antes de decidir quem repete
            }
          });
        } finally { pararA(); pararB(); }
        return prontos.size;
      }
      async function colarQuarto() {
        if (!conexao.disponivel()) { exigir(); return; }
        if (!copiaQuarto) { camada.aviso('Copie ou importe um quarto primeiro.', { tipo: 'erro' }); return; }
        if (colando || trabalhando) { camada.aviso('Espere a tarefa anterior terminar.'); return; }
        colando = true;
        try {
          const itens = await pedirInventario();
          if (!itens) { camada.aviso('O inventário não respondeu.', { tipo: 'erro' }); return; }
          const plano = codigos.planoDeColagem(copiaQuarto, itens);
          const faltam = [...plano.faltam.values()].reduce((s, n) => s + n, 0);
          if (!plano.colocar.length) { camada.aviso('Nenhum dos mobis da cópia está no seu inventário.', { tipo: 'erro' }); return; }
          const ok = await camada.confirmar('Colocar ' + plano.colocar.length + ' mobis do seu inventário neste quarto, nas posições da cópia?' + (faltam ? ' Faltam ' + faltam + ' no inventário; esses ficam de fora.' : ''),
            { titulo: 'Colar quarto', sim: 'Colocar' });
          if (!ok) return;
          const feitos = await colocarLista(plano.colocar);
          camada.aviso('Pronto: ' + feitos + ' mobis colocados.', { tipo: 'ok' });
        } finally {
          colando = false;
        }
      }
      // ---------- tipo no quadro de informações do mobi ----------
      // O quadro do jogo (.nitro-infostand) já mostra posição, altura, direção e id; falta o tipo.
      function marcarTipoNoQuadro() {
        if (!ctx.secao().tipoNoQuadro) return;
        const m = mobis.get(selecionado);
        if (!m) return;
        const quadro = [...document.querySelectorAll('.nitro-infostand')].find((q) => q.textContent.includes(String(m.id)));
        if (!quadro) return;
        let linha = quadro.querySelector('.vl-tipo-mobi');
        if (!linha) {
          linha = document.createElement('div');
          linha.className = 'vl-tipo-mobi';
          linha.style.cssText = 'cursor:pointer;font-size:11px;color:#d6f24a;padding:2px 0;';
          linha.title = 'Copiar o número do tipo';
          linha.addEventListener('click', function (ev) {
            ev.stopPropagation();
            camada.copiar(linha.dataset.tipo).then(function (ok) { camada.aviso(ok ? 'Tipo ' + linha.dataset.tipo + ' copiado.' : 'Não deu para copiar.'); });
          });
          quadro.appendChild(linha);
        }
        linha.dataset.tipo = String(m.tipo);
        linha.textContent = 'Tipo ' + m.tipo + ' (Vagalume)';
      }
      // "Colocar mais" usa o botão nativo do inventário: o jogo prende o mobi ao cursor
      // e deixa a pessoa escolher o piso, como em "Colocar no Quarto".
      function botaoColocarMais() {
        const m = mobis.get(selecionado);
        if (!m) return;
        const quadro = [...document.querySelectorAll('.nitro-infostand')].find((q) => q.textContent.includes(String(m.id)));
        if (!quadro || quadro.querySelector('.vl-colocar-mais')) return;
        const compre = [...quadro.querySelectorAll('button, .btn')].find((b) => /compr/i.test(b.textContent));
        const b = document.createElement('button');
        b.type = 'button';
        b.className = (compre ? compre.className + ' ' : 'btn btn-sm ') + 'vl-colocar-mais';
        b.textContent = 'Colocar mais';
        b.title = 'Selecionar outro igual do inventário para colocar onde quiser (Vagalume)';
        b.addEventListener('click', function (ev) { ev.stopPropagation(); colocarMais(m); });
        b.style.marginLeft = '6px';
        if (compre) compre.after(b); else quadro.appendChild(b);
      }
      let colocandoMais = false;
      function esperarNoInventario(encontrar, tempo = 3500) {
        return new Promise(function (resolver) {
          let pronto = false;
          const concluir = (valor) => { if (pronto) return; pronto = true; vigia.disconnect(); clearTimeout(relogio); resolver(valor); };
          const vigia = new MutationObserver(() => { const valor = encontrar(); if (valor) concluir(valor); });
          const relogio = setTimeout(() => concluir(null), tempo);
          vigia.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
          const atual = encontrar();
          if (atual) concluir(atual);
        });
      }
      async function colocarMais(m) {
        if (colocandoMais) return;
        if (!conexao.disponivel()) { exigir(); return; }
        colocandoMais = true;
        let ocultar = null;
        let busca = null;
        let buscaAnterior = null;
        try {
          const itens = await pedirInventario();
          if (!itens) throw new Error('O inventário não respondeu.');
          if (!itens.some((i) => i.classe === m.tipo && i.chao !== false)) throw new Error('Você não tem outro desse mobi no inventário.');
          const dados = dadosMobis || await VL.dadosJogo?.mobis();
          if (!dados) throw new Error('Não consegui identificar o mobi no inventário.');
          dadosMobis = dados;
          const ficha = dados.chao.get(m.tipo);
          const icone = ficha && VL.dadosJogo.iconeDe(ficha.classe);
          if (!icone) throw new Error('Não consegui identificar o mobi no inventário.');
          let inventario = document.querySelector('.nitro-inventory');
          if (!inventario) {
            const abrir = document.querySelector('.navigation-item.icon-inventory');
            if (!abrir) throw new Error('Não achei o inventário do jogo.');
            ocultar = document.createElement('style');
            ocultar.textContent = '.nitro-inventory { visibility: hidden !important; }';
            document.head.appendChild(ocultar);
            abrir.click();
            inventario = await esperarNoInventario(() => document.querySelector('.nitro-inventory'));
          }
          if (!inventario) throw new Error('O inventário do jogo não abriu.');
          const abaMobis = [...inventario.querySelectorAll('div,button')].find((e) => !e.children.length && e.textContent.trim() === 'Mobis');
          if (abaMobis) abaMobis.click();
          busca = await esperarNoInventario(() => inventario.querySelector('input.form-control'));
          if (!busca) throw new Error('Não achei a busca do inventário.');
          buscaAnterior = busca.value;
          const acharItem = () => [...inventario.querySelectorAll('.layout-grid-item')].find((e) => e.style.backgroundImage.includes(icone));
          let cartao = acharItem();
          if (!cartao) {
            VL.jogo.definirValor(busca, ficha.nome);
            cartao = await esperarNoInventario(acharItem);
          }
          if (!cartao) throw new Error('Não achei esse mobi na lista do inventário.');
          cartao.click();
          const colocar = await esperarNoInventario(() => acharItem()?.classList.contains('active') && [...inventario.querySelectorAll('.btn-success')].find((e) => e.textContent.trim() === 'Colocar no Quarto'));
          if (!colocar) throw new Error('Não achei a ação de colocar do inventário.');
          colocar.click();
          if (!await esperarNoInventario(() => !document.querySelector('.nitro-inventory'))) throw new Error('O jogo não iniciou o posicionamento do mobi.');
          camada.aviso('Escolha no quarto onde colocar o mobi. Esc cancela.', { tipo: 'ok' });
        } catch (erro) {
          if (busca && busca.isConnected && buscaAnterior !== null) VL.jogo.definirValor(busca, buscaAnterior);
          camada.aviso(erro.message || 'Não consegui selecionar o mobi no inventário.', { tipo: 'erro' });
        } finally {
          ocultar?.remove();
          colocandoMais = false;
        }
      }
      cancelar.push(conexao.ouvir('saida', SAIDA.CLICAR_MOBI, function () { setTimeout(function () { marcarTipoNoQuadro(); botaoColocarMais(); }, 400); }));
      ctx.aoParar(function () { document.querySelectorAll('.vl-tipo-mobi, .vl-colocar-mais').forEach((e) => e.remove()); });

      // ---------- Área ----------
      let area = null;
      let trabalhando = false;
      const ultimos = []; // os dois últimos mobis clicados, para marcar a área pelos cantos
      cancelar.push(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { area = null; ultimos.length = 0; }));
      cancelar.push(conexao.ouvir('saida', SAIDA.CLICAR_MOBI, function () {
        setTimeout(function () {
          const m = mobis.get(selecionado);
          if (!m || (ultimos.length && ultimos[ultimos.length - 1].id === m.id)) return;
          ultimos.push({ id: m.id, x: m.x, y: m.y });
          if (ultimos.length > 2) ultimos.shift();
        }, 0);
      }));
      const textoArea = (a) => '(' + a.x1 + ', ' + a.y1 + ') a (' + a.x2 + ', ' + a.y2 + ')';
      function mobisDaArea() {
        if (!conexao.disponivel()) { exigir(); return null; }
        if (!area) { camada.aviso('Marque uma área primeiro: clique em dois mobis (os cantos) e use /area, ou /area x1 y1 x2 y2.', { tipo: 'erro' }); return null; }
        const lista = codigos.mobisNaArea([...mobis.values()], area);
        if (!lista.length) { camada.aviso('Nenhum mobi do chão na área ' + textoArea(area) + '.', { tipo: 'erro' }); return null; }
        return lista;
      }
      async function emLote(fn) {
        if (trabalhando || colando) { camada.aviso('Espere a tarefa anterior terminar.'); return; }
        trabalhando = true;
        try { await fn(); } finally { trabalhando = false; }
      }
      function emLoteGrupo(fn) {
        return emLote(async function () {
          grupoHistorico = new Map();
          try { await fn(); } finally {
            const fotos = grupoHistorico ? [...grupoHistorico.values()] : [];
            grupoHistorico = null;
            if (fotos.length) {
              desfazer.push({ grupo: fotos });
              if (desfazer.length > MAX_DESFAZER) desfazer.shift();
            }
          }
        });
      }
      async function recolherIds(ids) {
        let feitos = 0;
        for (const id of ids) {
          if (!ctx.ativo('construcao')) break;
          if (await mandar(SAIDA.PEGAR_MOBI, [['i', 10], ['i', id]])) feitos++;
          await esperar(250);
        }
        return feitos;
      }

      function aguardarRetiradas(ids) {
        return new Promise(function (resolver) {
          const faltam = new Set(ids);
          let relogio;
          let terminou = false;
          const concluir = function () {
            if (terminou) return;
            terminou = true;
            clearTimeout(relogio);
            pararRetiradas();
            pararQuarto();
            resolver();
          };
          const pararRetiradas = conexao.ouvir('entrada', ENTRADA.MOBI_RETIRADO, function (l) {
            faltam.delete(Number(l.texto()));
            if (!faltam.size) concluir();
          });
          const pararQuarto = conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, concluir);
          relogio = setTimeout(concluir, 2200);
        });
      }

      async function recolherPickitem(ids, sala, tipo) {
        const fila = ids.map((id) => ({ id, tentativa: 0 }));
        let rodadasSemRetirada = 0;
        while (fila.length && sala === geracaoQuarto && ctx.ativo('construcao')) {
          const lote = fila.splice(0, 3).filter((p) => mobis.get(p.id)?.tipo === tipo);
          if (!lote.length) continue;
          const inicio = Date.now();
          const confirmacao = aguardarRetiradas(lote.map((p) => p.id));
          await Promise.all(lote.map((p) => mandar(SAIDA.PEGAR_MOBI, [['i', 10], ['i', p.id]])));
          await confirmacao;
          if (sala !== geracaoQuarto) break;
          const retirados = lote.filter((p) => !mobis.has(p.id)).length;
          rodadasSemRetirada = retirados ? 0 : rodadasSemRetirada + 1;
          for (const p of lote) {
            if (mobis.has(p.id) && p.tentativa < 2) fila.push({ id: p.id, tentativa: p.tentativa + 1 });
          }
          if (rodadasSemRetirada >= 3) break;
          if (fila.length) await esperar(retirados ? Math.max(0, 750 - (Date.now() - inicio)) : 2000);
        }
        return ids.filter((id) => !mobis.has(id)).length;
      }

      async function prepararPickitem(id, sala) {
        const escolhido = mobis.get(id);
        if (sala !== geracaoQuarto || !escolhido) return;
        if (incompleto) { camada.aviso('A lista de mobis deste quarto está incompleta. Saia e entre novamente antes de usar /pickitem.', { tipo: 'erro' }); return; }
        const tipo = escolhido.tipo;
        let dados = null;
        try { if (VL.dadosJogo) dados = await VL.dadosJogo.mobis(); } catch (erro) { /* o tipo numérico continua disponível */ }
        if (sala !== geracaoQuarto) return;
        const iguais = [...mobis.values()].filter((m) => m.tipo === tipo)
          .sort((a, b) => b.altura - a.altura || b.y - a.y || b.x - a.x);
        if (!iguais.length || incompleto) { camada.aviso('Não consegui reunir todos os mobis desse tipo no quarto.', { tipo: 'erro' }); return; }
        const d = dados && dados.chao.get(tipo);
        const nome = d && d.nome ? d.nome : 'Mobi tipo ' + tipo;
        const confirmado = await camada.dialogoMobis({
          titulo: 'Recolher mobis iguais?',
          texto: 'Os ' + iguais.length + ' mobis deste tipo no quarto voltarão para o inventário de seus donos. Confira antes de continuar.',
          itens: [{ nome, icone: d && VL.dadosJogo.iconeDe(d.classe), quantidade: iguais.length }],
          botoes: [
            { rotulo: 'Cancelar', valor: false, foco: true },
            { rotulo: 'Recolher todos', valor: true, destaque: true },
          ],
        });
        if (!confirmado || sala !== geracaoQuarto || incompleto) return;
        return emLote(async function () {
          const feitos = await recolherPickitem(iguais.map((m) => m.id), sala, tipo);
          camada.aviso(sala === geracaoQuarto
            ? feitos === iguais.length
              ? 'Os ' + feitos + ' mobis "' + nome + '" saíram do quarto.'
              : feitos + ' de ' + iguais.length + ' mobis "' + nome + '" saíram do quarto. Os restantes não foram confirmados pelo jogo; confira seus direitos e tente novamente.'
            : 'A coleta foi interrompida porque você mudou de quarto.', { tipo: sala === geracaoQuarto && feitos === iguais.length ? 'ok' : 'erro' });
        });
      }

      ctx.comando({
        nome: 'pickitem',
        uso: 'pickitem [cancelar]',
        descricao: 'Clique duas vezes no mesmo mobi do chão para recolher todos os mobis desse tipo no quarto, após conferir imagem, nome e quantidade.',
        executar(pedido) {
          if (pedido.args[0] === 'cancelar') { pickitem = null; camada.aviso('Seleção do /pickitem cancelada.'); return; }
          if (!conexao.disponivel()) { camada.aviso('Entre no quarto com a Conexão do jogo ligada para usar /pickitem.', { tipo: 'erro' }); return; }
          if (!mobis.size || incompleto) { camada.aviso('A lista de mobis do chão está vazia ou incompleta. Entre novamente no quarto antes de usar /pickitem.', { tipo: 'erro' }); return; }
          if (trabalhando || colando) { camada.aviso('Espere a ação de construção terminar.'); return; }
          pickitem = { primeiro: null, sala: geracaoQuarto };
          camada.aviso('Clique duas vezes no mesmo mobi do chão. Depois você confirma a coleta de todos os iguais.');
        },
      });
      function numerosDe(args) { return args.join(' ').split(/[\s,;]+/).filter(Boolean); }
      function deslocamento(args) {
        const n = numerosDe(args);
        const dx = Number(n[0]);
        const dy = Number(n[1]);
        if (!Number.isInteger(dx) || !Number.isInteger(dy) || (!dx && !dy) || Math.abs(dx) > 64 || Math.abs(dy) > 64) return null;
        return { dx, dy };
      }

      ctx.comando({
        nome: 'area',
        uso: 'area [x1 y1 x2 y2 | limpar]',
        descricao: 'Primeiro passo das ferramentas de área. Clique num mobi de um canto, depois num mobi do canto oposto, e digite area (sem números). Ou passe os pisos: area 3 4 8 9 (x1 y1 x2 y2; a posição aparece na aba Construção do painel). Depois use moverarea, duplicar, recolherarea, preencher, substituir ou limparrepetidos.',
        executar(pedido) {
          const a = numerosDe(pedido.args);
          if (a[0] === 'limpar') { area = null; camada.aviso('Área desmarcada.'); return; }
          let nova;
          if (a.length >= 4) {
            const n = a.slice(0, 4).map(Number);
            if (!n.every((v) => Number.isInteger(v) && v >= 0 && v < 256)) { camada.aviso('Use quatro números inteiros: x1 y1 x2 y2.', { tipo: 'erro' }); return; }
            nova = codigos.areaDe({ x: n[0], y: n[1] }, { x: n[2], y: n[3] });
          } else if (!a.length) {
            if (ultimos.length < 2) {
              camada.aviso(area ? 'Área marcada: ' + textoArea(area) + '.' : 'Clique em dois mobis (os cantos da área) e use /area de novo, ou passe x1 y1 x2 y2.');
              return;
            }
            nova = codigos.areaDe(ultimos[0], ultimos[1]);
          } else { camada.aviso('Uso: /area x1 y1 x2 y2', { tipo: 'erro' }); return; }
          area = nova;
          const n = codigos.mobisNaArea([...mobis.values()], area).length;
          const p = VL.comandos ? VL.comandos.inicioDigitado(ctx.secao('comandos').prefixo) : '/';
          camada.aviso('Área marcada: ' + textoArea(area) + ', com ' + n + ' mobis do chão. Agora: ' + p + 'moverarea 1 0 (move), ' + p + 'duplicar 0 3 (copia ao lado), ' + p + 'recolherarea, ' + p + 'preencher ou ' + p + 'limparrepetidos.', { duracaoMs: 10000 });
        },
      });

      // ---------- girar, espelhar, nivelar e escada na área (pedido do usuário em 2026-11-15) ----------
      // Move a lista na ordem do plano. Se um mobi chega a um piso onde ainda está outro da mesma lista,
      // o jogo o empilha por cima (visto ao vivo em 2026-11-15: ficou a 0,65); no fim, ele é movido de
      // novo para o mesmo piso, já livre, e o jogo recalcula a altura.
      async function comAlturasFixas(fn, opcoes) {
        clearTimeout(relogioAltura);
        await enviarAlturas();
        clearTimeout(relogioDesligarUp);
        if (upLigado != null) {
          await mandar(SAIDA.FALAR, [['s', ':UP'], ['i', 0]]);
          upLigado = null;
        }
        const anteriores = ajustesFerramenta.slice();
        const fixos = anteriores.slice();
        // O lote decide altura, direção e quais IDs alterar. Suspende os modos
        // automáticos de mobis iguais/área para não atingir objetos fora dele.
        for (const i of [2, 4, 6, 10, 11, 12, 13, 14, 19, 20, 21, 22]) fixos[i] = false;
        fixos[0] = true;
        const enviarAjustes = (valores) => mandar(SAIDA.FERRAMENTA_CONSTRUCAO, tiposFerramenta.map((tipo, i) => [tipo, valores[i]]));
        let alturaAtual = null;
        try {
          if (opcoes && opcoes.semAltura) {
            // Sem altura fixa: o jogo empilha no topo do piso. Desliga também os modos automáticos.
            const livres = fixos.slice(); livres[0] = false;
            if (!(await enviarAjustes(livres))) return;
          }
          await fn(async function (altura) {
            const z = codigos.alturaValida(altura);
            if (z == null) throw new Error('Altura do mobi fora do limite aceito pelo hotel.');
            if (alturaAtual === z) return true;
            fixos[1] = Math.round(z * 100);
            if (!(await enviarAjustes(fixos))) return false;
            alturaAtual = z;
            await esperar(90);
            return true;
          });
        } finally {
          await enviarAjustes(anteriores);
        }
      }
      async function moverLista(plano, manterAltura) {
        if (manterAltura) {
          // Congela todas as alturas antes do primeiro pacote. Não consulta a altura
          // recalculada pelo servidor depois que parte da pilha já foi deslocada.
          const destinos = plano.filter((p) => mobis.has(p.id)).map((p) => Object.assign({}, p, {
            altura: p.altura == null ? (mobis.get(p.id).altura || 0) : p.altura,
          })).sort((a, b) => a.altura - b.altura);
          let feitos = 0;
          await comAlturasFixas(async function (fixar) {
            for (const p of destinos) {
              if (!ctx.ativo('construcao')) break;
              if (!(await fixar(p.altura))) break;
              if (!(await mandar(SAIDA.MOVER_MOBI, [['i', p.id], ['i', p.x], ['i', p.y], ['i', p.direcao]]))) break;
              feitos++;
              await esperar(250);
            }
          });
          return feitos;
        }
        let feitos = 0;
        const onde = new Map(); // id -> "x,y" atual dos mobis da lista
        for (const p of plano) { const m = mobis.get(p.id); if (m) onde.set(p.id, m.x + ',' + m.y); }
        const empilhados = [];
        for (const p of plano) {
          if (!ctx.ativo('construcao')) break;
          const alvo = p.x + ',' + p.y;
          const ocupado = [...onde.entries()].some(([id, pos]) => id !== p.id && pos === alvo);
          if (await mandar(SAIDA.MOVER_MOBI, [['i', p.id], ['i', p.x], ['i', p.y], ['i', p.direcao]])) feitos++;
          onde.set(p.id, alvo);
          if (ocupado) empilhados.push(p);
          await esperar(250);
        }
        for (const p of empilhados) {
          if (!ctx.ativo('construcao')) break;
          await mandar(SAIDA.MOVER_MOBI, [['i', p.id], ['i', p.x], ['i', p.y], ['i', p.direcao]]);
          await esperar(250);
        }
        return feitos;
      }
      function girarArea() {
        const lista = mobisDaArea();
        if (!lista) return;
        return emLote(async function () {
          const feitos = await moverLista(codigos.planoGirarArea(lista, area));
          const w = area.x2 - area.x1 + 1;
          const h = area.y2 - area.y1 + 1;
          area = { x1: area.x1, y1: area.y1, x2: area.x1 + h - 1, y2: area.y1 + w - 1 };
          camada.aviso(feitos + ' de ' + lista.length + ' mobis girados 90°. A área agora é ' + textoArea(area) + '. Se algum não couber, o jogo deixa onde estava.', { tipo: 'ok', duracaoMs: 8000 });
        });
      }
      function espelharArea(eixo) {
        const lista = mobisDaArea();
        if (!lista) return;
        return emLote(async function () {
          const feitos = await moverLista(codigos.planoEspelharArea(lista, area, eixo));
          camada.aviso(feitos + ' de ' + lista.length + ' mobis espelhados (' + (eixo === 'y' ? 'frente e trás' : 'esquerda e direita') + ').', { tipo: 'ok' });
        });
      }
      function alturasNaArea(eixo, base, passo) {
        const lista = mobisDaArea();
        if (!lista) return;
        if (lista.length > 40) { camada.aviso('São ' + lista.length + ' mobis: marque uma área com até 40, para não levar mute do jogo.', { tipo: 'erro' }); return; }
        const plano = codigos.planoEscada(lista, eixo, base, passo);
        for (const p of plano) { const m = mobis.get(p.id); if (m) pendentes.set(m.id, { m, alvo: p.altura }); }
        atualizarSituacao();
        clearTimeout(relogioAltura);
        enviarAlturas();
        camada.aviso(plano.length + ' mobis recebendo a altura nova, devagar (cerca de ' + Math.ceil(plano.length * 0.5) + ' s).');
      }
      function escreverNoChat(resto) {
        const campo = VL.jogo && VL.jogo.entradaChat();
        if (!campo) { camada.aviso('Entre num quarto para usar o chat.', { tipo: 'erro' }); return; }
        const p = VL.comandos ? VL.comandos.inicioDigitado(ctx.config().comandos.prefixo) : '/';
        VL.jogo.definirValor(campo, p + resto);
        campo.focus();
      }
      ctx.comando({
        nome: 'girararea',
        uso: 'girararea',
        descricao: 'Gira 90° tudo da área marcada (posições e direção de cada mobi), a partir do mesmo canto.',
        executar() { return girarArea(); },
      });
      ctx.comando({
        nome: 'espelhararea',
        uso: 'espelhararea [x | y]',
        descricao: 'Espelha a área marcada: x troca esquerda e direita; y, frente e trás. Os mobis viram junto.',
        executar(pedido) { return espelharArea(String(pedido.args[0] || 'x').toLowerCase() === 'y' ? 'y' : 'x'); },
      });
      ctx.comando({
        nome: 'nivelar',
        uso: 'nivelar <altura>',
        descricao: 'Põe todos os mobis da área marcada na mesma altura (ex.: nivelar 1.5).',
        executar(pedido) {
          const z = codigos.alturaValida(Number(String(pedido.args[0] || '').replace(',', '.')));
          if (z == null) { camada.aviso('Uso: /nivelar <altura>, de 0 a ' + codigos.MAX_ALTURA + '.', { tipo: 'erro' }); return; }
          alturasNaArea('x', z, 0);
        },
      });
      ctx.comando({
        nome: 'escada',
        uso: 'escada <passo> [x | y] [altura inicial]',
        descricao: 'Faz uma escada com os mobis da área marcada: a altura sobe o passo a cada piso ao longo do eixo (ex.: escada 0.5 x).',
        executar(pedido) {
          const passo = Number(String(pedido.args[0] || '').replace(',', '.'));
          const eixo = String(pedido.args[1] || 'x').toLowerCase() === 'y' ? 'y' : 'x';
          const base = pedido.args[2] != null ? Number(String(pedido.args[2]).replace(',', '.')) : 0;
          if (!isFinite(passo) || passo === 0 || Math.abs(passo) > 10 || !isFinite(base)) { camada.aviso('Uso: /escada <passo> [x|y] [altura inicial], por exemplo /escada 0.5 x.', { tipo: 'erro' }); return; }
          alturasNaArea(eixo, base, passo);
        },
      });
      // Teleporte do jogo (:tele): com direitos no quarto, clicar num piso leva o avatar direto para lá.
      let teleporteLigado = false;
      function alternarTeleporte() {
        if (!VL.jogo || !VL.jogo.enviarFala(':tele')) { camada.aviso('Entre num quarto para usar o teleporte.', { tipo: 'erro' }); return; }
        teleporteLigado = !teleporteLigado;
        camada.aviso(teleporteLigado ? 'Teleporte ligado: clique num piso para ir direto (precisa de direitos no quarto).' : 'Teleporte desligado.');
        atualizarModo();
      }
      ctx.comando({
        nome: 'teleporte',
        apelidos: ['tele'],
        uso: 'teleporte',
        descricao: 'Liga ou desliga o teleporte do jogo (:tele): clicar num piso leva o avatar direto para lá, em quartos com direitos.',
        executar() { alternarTeleporte(); },
      });
      function alternarCongelar() {
        const c = nucleo.comandos && nucleo.comandos.achar('congelar');
        if (!c) { camada.aviso('Ligue o módulo "Conexão do jogo" para congelar o avatar.', { tipo: 'erro' }); return; }
        c.executar({ nome: 'congelar', args: [], resto: '' });
        setTimeout(atualizarModo, 100);
      }
      let botoesModo = null;
      function atualizarModo() {
        if (!botoesModo) return;
        const congelado = document.documentElement.hasAttribute('data-vl-congelado');
        botoesModo.congelar.textContent = congelado ? 'Descongelar' : 'Congelar (não andar)';
        botoesModo.tele.textContent = teleporteLigado ? 'Teleporte: ligado' : 'Teleporte';
      }
      ctx.aoParar(function () { botoesModo = null; });

      ctx.comando({
        nome: 'moverarea',
        uso: 'moverarea dx dy',
        descricao: 'Move tudo da área marcada: moverarea 1 0 anda 1 piso no eixo x; moverarea 0 -2, 2 pisos para trás no eixo y. A altura final é a que o jogo der no destino.',
        executar(pedido) {
          const d = deslocamento(pedido.args);
          if (!d) { camada.aviso('Uso: /moverarea dx dy (inteiros, por exemplo 1 0).', { tipo: 'erro' }); return; }
          const lista = mobisDaArea();
          if (!lista) return;
          return emLote(async function () {
            let feitos = 0;
            for (const p of codigos.planoMoverArea(lista, d.dx, d.dy)) {
              if (!ctx.ativo('construcao')) break;
              if (await mandar(SAIDA.MOVER_MOBI, [['i', p.id], ['i', p.x], ['i', p.y], ['i', p.direcao]])) feitos++;
              await esperar(250);
            }
            if (area) area = { x1: area.x1 + d.dx, y1: area.y1 + d.dy, x2: area.x2 + d.dx, y2: area.y2 + d.dy };
            camada.aviso(feitos + ' de ' + lista.length + ' mobis mandados para o novo lugar. A área acompanhou: ' + (area ? textoArea(area) : '—') + '.', { tipo: 'ok' });
          });
        },
      });

      ctx.comando({
        nome: 'recolherarea',
        apelidos: ['pickarea'],
        uso: 'recolherarea',
        descricao: 'Recolhe para o inventário do dono todos os mobis do chão da área marcada, depois de confirmar.',
        executar() {
          const lista = mobisDaArea();
          if (!lista) return;
          return camada.confirmar(lista.length + ' mobis da área ' + textoArea(area) + ' voltam para o inventário de quem é o dono.', { titulo: 'Recolher a área?', sim: 'Recolher' }).then(function (ok) {
            if (!ok) return;
            return emLote(async function () {
              const feitos = await recolherIds(lista.map((m) => m.id));
              camada.aviso(feitos + ' mobis recolhidos.', { tipo: 'ok' });
            });
          });
        },
      });

      ctx.comando({
        nome: 'duplicar',
        uso: 'duplicar dx dy',
        descricao: 'Copia a área marcada para outro lugar usando mobis iguais do seu inventário (mesma direção e altura). dx e dy dizem quantos pisos para o lado: duplicar 0 3 põe a cópia 3 pisos adiante no eixo y; duplicar 4 0, 4 pisos no eixo x.',
        executar(pedido) {
          const d = deslocamento(pedido.args);
          if (!d) { camada.aviso('Uso: /duplicar dx dy (inteiros, por exemplo 0 3).', { tipo: 'erro' }); return; }
          const lista = mobisDaArea();
          if (!lista) return;
          return emLote(async function () {
            const itens = await pedirInventario();
            if (!itens) { camada.aviso('O inventário não respondeu.', { tipo: 'erro' }); return; }
            const plano = codigos.planoDuplicar(lista, d.dx, d.dy, itens);
            const faltam = [...plano.faltam.values()].reduce((s, n) => s + n, 0);
            if (!plano.colocar.length) { camada.aviso('Nenhum mobi igual aos da área está no seu inventário.', { tipo: 'erro' }); return; }
            const ok = await camada.confirmar('Colocar ' + plano.colocar.length + ' mobis do seu inventário, ' + d.dx + ' pisos em x e ' + d.dy + ' em y a partir da área?' + (faltam ? ' Faltam ' + faltam + ' no inventário; esses ficam de fora.' : ''), { titulo: 'Duplicar área', sim: 'Colocar' });
            if (!ok) return;
            const feitos = await colocarLista(plano.colocar);
            camada.aviso('Pronto: ' + feitos + ' mobis colocados.', { tipo: 'ok' });
          });
        },
      });

      ctx.comando({
        nome: 'substituir',
        uso: 'substituir <tipo novo>',
        descricao: 'Troca os mobis do mesmo tipo do selecionado (na área marcada, ou no quarto todo) por mobis do tipo novo do seu inventário, no mesmo piso, direção e altura. O tipo aparece na aba Inventário e em /mobis.',
        executar(pedido) {
          const classe = Number(pedido.args[0]);
          if (!Number.isInteger(classe) || classe <= 0) { camada.aviso('Uso: /substituir <tipo novo> (o número do tipo, como na aba Inventário).', { tipo: 'erro' }); return; }
          const m = exigir();
          if (!m) return;
          if (m.tipo === classe) { camada.aviso('O mobi selecionado já é desse tipo.', { tipo: 'erro' }); return; }
          const universo = area ? codigos.mobisNaArea([...mobis.values()], area) : [...mobis.values()];
          const alvos = universo.filter((x) => x.tipo === m.tipo);
          return emLote(async function () {
            const itens = await pedirInventario();
            if (!itens) { camada.aviso('O inventário não respondeu.', { tipo: 'erro' }); return; }
            const plano = codigos.planoSubstituir(alvos, classe, itens);
            if (!plano.trocar.length) { camada.aviso('Não há mobis do tipo ' + classe + ' no chão do seu inventário.', { tipo: 'erro' }); return; }
            const ok = await camada.confirmar('Trocar ' + plano.trocar.length + ' mobis do tipo ' + m.tipo + (area ? ' da área ' + textoArea(area) : ' do quarto') + ' por mobis do tipo ' + classe + '? Os antigos voltam para o inventário do dono.' + (plano.faltam ? ' Faltam ' + plano.faltam + ' no inventário; esses ficam como estão.' : ''), { titulo: 'Substituir mobis', sim: 'Trocar' });
            if (!ok) return;
            const recolhidos = await recolherIds(plano.trocar.map((p) => p.velho));
            await esperar(400);
            const feitos = await colocarLista(plano.trocar);
            camada.aviso('Pronto: ' + recolhidos + ' recolhidos e ' + feitos + ' colocados.', { tipo: 'ok' });
          });
        },
      });

      ctx.comando({
        nome: 'preencher',
        apelidos: ['colocarvarios'],
        uso: 'preencher [tipo]',
        descricao: 'Coloca um mobi do seu inventário em cada piso livre da área marcada. Sem tipo, usa o do mobi selecionado (e a direção dele).',
        executar(pedido) {
          if (!conexao.disponivel()) { exigir(); return; }
          if (!area) { camada.aviso('Marque uma área primeiro: clique em dois mobis (os cantos) e use /area, ou /area x1 y1 x2 y2.', { tipo: 'erro' }); return; }
          const pisos = (area.x2 - area.x1 + 1) * (area.y2 - area.y1 + 1);
          if (pisos > codigos.MAX_PISOS_PREENCHER) { camada.aviso('Área grande demais: ' + pisos + ' pisos (o máximo é ' + codigos.MAX_PISOS_PREENCHER + ').', { tipo: 'erro' }); return; }
          let classe = Number(pedido.args[0]);
          let direcao = 0;
          if (!pedido.args.length) {
            const m = exigir();
            if (!m) return;
            classe = m.tipo;
            direcao = m.direcao;
          }
          if (!Number.isInteger(classe) || classe <= 0) { camada.aviso('Uso: /preencher [tipo] (o número do tipo, como na aba Inventário).', { tipo: 'erro' }); return; }
          return preencherArea(area, classe, direcao, 'mobis do tipo ' + classe);
        },
      });
      // Altura de cada mobi do plano: "pilha" = topo do que já está no piso; "chao" = o chão do piso;
      // "altura" = a mesma altura para todos. Topo e chão vêm do motor do jogo (contam mobis de vários
      // pisos); sem ele, o topo cai na conta pelos mobis conhecidos e o chão em 0.
      function comAltura(colocar, modo, altura) {
        const pisos = [...new Set(colocar.map((m) => m.x + ',' + m.y))];
        const indice = new Map(pisos.map((k, i) => [k, i]));
        const lidas = ferramenta && ferramenta.alturasPisos ? ferramenta.alturasPisos(pisos.map((k) => k.split(',').map(Number))) : null;
        const tipo = colocar.length ? colocar[0].tipo : null;
        const h = alturaDoMobi(lidas, tipo);
        return colocar.map(function (m) {
          const i = indice.get(m.x + ',' + m.y);
          let z = m.altura || 0;
          if (modo === 'altura') z = altura;
          else if (modo === 'chao') z = lidas && lidas.chaos && lidas.chaos[i] != null ? lidas.chaos[i] : 0;
          else if (lidas && lidas.topos && lidas.topos[i] != null) z = lidas.topos[i];
          return Object.assign({}, m, { altura: Math.round((z + (m.camada || 0) * h) * 100) / 100 });
        });
      }
      // Altura de um mobi (o passo entre camadas): pela prévia carregada no jogo, ou por um igual no quarto.
      function alturaDoMobi(lidas, tipo) {
        if (lidas && Number(lidas.alturaMobi) > 0) return Number(lidas.alturaMobi);
        for (const m of mobis.values()) if (m.tipo === tipo && Number(m.alturaMobi) > 0) return m.alturaMobi;
        return 1; // shortcut: sem prévia carregada nem igual no quarto, supõe 1; a prévia corrige ao carregar
      }
      // Escolha antes de colocar: empilhar, no chão ou numa altura. O painel fica de lado, sem escurecer,
      // e a prévia no quarto acompanha cada mudança.
      const ICONES_ALTURA = {
        pilha: 'M4 18h16M6 14h12M8 10h8M12 3v4M9.5 5.5 12 3l2.5 2.5',
        chao: 'M3 19h18M12 4v10M8.5 10.5 12 14l3.5-3.5',
        altura: 'M12 3v18M8.5 6.5 12 3l3.5 3.5M8.5 17.5 12 21l3.5-3.5M4 12h3M17 12h3',
      };
      function iconeAltura(modo) {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
        const p = document.createElementNS(ns, 'path'); p.setAttribute('d', ICONES_ALTURA[modo]); svg.appendChild(p);
        return camada.el('span', { class: 'vl-alt-icone', 'aria-hidden': 'true' }, [svg]);
      }
      async function escolherAltura(planoDe, info, previa) {
        const el = camada.el;
        let modo = 'pilha';
        let camadas = 1;
        let plano = planoDe(1);
        const inicial = Math.max(0, ...comAltura(plano.colocar, 'pilha').map((m) => m.altura));
        const campo = el('input', { type: 'number', min: 0, max: codigos.MAX_ALTURA, step: 0.05, class: 'vl-campo', 'aria-label': 'Altura', value: String(inicial) });
        const regua = el('input', { type: 'range', min: 0, max: codigos.MAX_ALTURA, step: 0.05, value: String(inicial), 'aria-label': 'Altura (régua)' });
        const passo = (d) => () => { const h = codigos.alturaValida(Math.min(codigos.MAX_ALTURA, Math.max(0, (Number(campo.value) || 0) + d))); campo.value = String(h); regua.value = String(h); atualizar(); };
        const caixaValor = el('div', { class: 'vl-alt-valor', hidden: true }, [
          el('div', { class: 'vl-alt-passos' }, [
            el('button', { type: 'button', class: 'vl-botao', texto: '−', 'aria-label': 'Descer 0,5', onclick: passo(-0.5) }),
            campo,
            el('button', { type: 'button', class: 'vl-botao', texto: '+', 'aria-label': 'Subir 0,5', onclick: passo(0.5) }),
          ]),
          regua,
        ]);
        const opcoes = [
          ['pilha', 'Empilhar por cima', 'No topo do que já está em cada piso'],
          ['chao', 'Colocar no chão', 'Na altura do chão do quarto'],
          ['altura', 'Escolher altura', 'A mesma altura para todos'],
        ];
        const botoes = opcoes.map(([valor, titulo, resumo]) => el('button', { type: 'button', class: 'vl-alt-opcao', 'aria-pressed': 'false', onclick() { modo = valor; atualizar(); if (valor === 'altura') campo.focus(); } },
          [iconeAltura(valor), el('span', null, [el('b', { texto: titulo }), el('small', { texto: resumo })])]));
        const numCamadas = el('output', { class: 'vl-alt-num', 'aria-live': 'polite', texto: '1' });
        const mudarCamadas = (d) => () => { camadas = Math.min(codigos.MAX_CAMADAS, Math.max(1, camadas + d)); plano = planoDe(camadas); atualizar(); };
        const linhaCamadas = el('div', { class: 'vl-alt-passos' }, [
          el('button', { type: 'button', class: 'vl-botao', texto: '−', 'aria-label': 'Menos uma camada', onclick: mudarCamadas(-1) }),
          numCamadas,
          el('button', { type: 'button', class: 'vl-botao', texto: '+', 'aria-label': 'Mais uma camada', onclick: mudarCamadas(1) }),
        ]);
        const qtd = el('span', { class: 'vl-alt-qtd', style: 'display:inline;font-size:inherit;margin:0' });
        const aviso = el('p', { class: 'vl-alt-aviso' });
        function atualizar() {
          botoes.forEach((b, i) => b.setAttribute('aria-pressed', String(opcoes[i][0] === modo)));
          caixaValor.hidden = modo !== 'altura';
          numCamadas.textContent = camadas + (camadas === 1 ? ' mobi por piso' : ' mobis por piso');
          qtd.textContent = (plano.colocar.length + plano.pendentes.length) + '× ';
          aviso.textContent = plano.faltam ? 'Faltam ' + plano.faltam + ' no inventário. Ao colocar, o Vagalume oferece comprar os que faltam.' : '';
          aviso.hidden = !plano.faltam;
          const h = codigos.alturaValida(campo.value);
          previa(comAltura(plano.colocar.concat(plano.pendentes), modo, h == null ? 0 : h)); // já com os que faltam
        }
        campo.addEventListener('input', () => { regua.value = campo.value; atualizar(); });
        regua.addEventListener('input', () => { campo.value = regua.value; atualizar(); });
        const cabeca = el('div', { class: 'vl-alt-mobi' }, [
          info.icone ? el('img', { src: info.icone, alt: '' }) : null,
          el('div', null, [
            el('b', null, [qtd, info.nome]),
            el('span', { texto: 'Área ' + info.area + ' · um por piso livre' }),
          ]),
        ]);
        const conteudo = el('div', null, [
          cabeca,
          aviso,
          el('p', { class: 'vl-alt-rotulo', texto: 'Altura' }),
          el('div', { class: 'vl-alt-opcoes', role: 'group', 'aria-label': 'Altura dos mobis' }, botoes),
          caixaValor,
          el('p', { class: 'vl-alt-rotulo', style: 'margin-top:14px', texto: 'Camadas' }),
          linhaCamadas,
        ]);
        atualizar();
        const ok = await camada.dialogo({ titulo: 'Colocar vários', conteudo, lateral: true,
          botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Colocar', valor: 'ok', destaque: true, foco: true }] });
        if (!ok) return null;
        const h = modo === 'altura' ? codigos.alturaValida(campo.value) : 0;
        if (h == null) { camada.aviso('Altura inválida: use um número de 0 a ' + codigos.MAX_ALTURA + '.', { tipo: 'erro' }); return null; }
        if (modo !== 'pilha' && comAltura(plano.colocar.concat(plano.pendentes), modo, h).some((m) => codigos.alturaValida(m.altura) == null)) { camada.aviso('Com essas camadas a pilha passaria da altura máxima (' + codigos.MAX_ALTURA + ').', { tipo: 'erro' }); return null; }
        return { modo, altura: h, camadas, plano };
      }
      function preencherArea(alvo, classe, direcao, nome, itensProntos) {
        const previa = (lista) => { if (ferramenta) ferramenta.previaColocacao(classe, direcao, (lista || []).map((m) => ({ x: m.x, y: m.y, z: m.altura }))); };
        return emLote(async function () {
          try {
            let itens = itensProntos || await pedirInventario();
            if (!itens) { camada.aviso('O inventário não respondeu.', { tipo: 'erro' }); return; }
            const planoDe = (n) => {
              const p = codigos.planoPreencher(alvo, classe, [...mobis.values()], itens, direcao, n);
              p.colocar.forEach((m) => { m.tipo = classe; });
              return p;
            };
            let ficha = null;
            try { const dados = await VL.dadosJogo.mobis(); ficha = dados && dados.chao && dados.chao.get(classe); } catch (e) { /* sem ícone */ }
            const escolha = await escolherAltura(planoDe, { nome: ficha && ficha.nome ? ficha.nome : nome.replace(/^"|"$/g, ''), area: textoArea(alvo), icone: ficha ? VL.dadosJogo.iconeDe(ficha.classe) : null }, previa);
            if (!escolha) return;
            let plano = escolha.plano;
            // Faltam no inventário: a compra (uma confirmação, com o preço) vem antes, com a prévia ainda no quarto.
            if (plano.faltam) {
              if (!VL.loja || !VL.loja.comprarTipos) camada.aviso('Ligue o módulo "Loja e inventário" para comprar os que faltam.', { tipo: 'erro' });
              else {
                const compra = await VL.loja.comprarTipos([{ tipo: classe, quantidade: plano.faltam }], 'Faltam ' + plano.faltam + ' para completar a área.');
                for (let i = 0; compra && compra.feitas && i < 3; i++) {
                  const novos = await pedirInventario();
                  if (novos) { itens = novos; plano = planoDe(escolha.camadas); }
                  if (plano.colocar.length >= escolha.plano.colocar.length + compra.feitas) break; // os comprados já chegaram
                  await esperar(400);
                }
              }
            }
            previa(null);
            if (!plano.colocar.length) { camada.aviso('Não há ' + nome + ' no seu inventário.', { tipo: 'erro' }); return; }
            escolha.lista = comAltura(plano.colocar, escolha.modo, escolha.altura);
            // Empilhar: o jogo pousa cada um no topo (rápido). Chão ou altura: fixa a altura de cada um.
            let feitos = 0;
            if (escolha.modo === 'pilha') {
              const n = Math.max(...escolha.lista.map((m) => m.camada || 0)) + 1;
              for (let k = 0; k < n; k++) {
                if (!ctx.ativo('construcao')) break;
                feitos += await colocarNoTopo(escolha.lista.filter((m) => (m.camada || 0) === k));
              }
            } else feitos = await colocarLista(escolha.lista);
            const total = escolha.lista.length;
            camada.aviso('Pronto: ' + feitos + ' de ' + total + ' mobis colocados.', { tipo: feitos === total ? 'ok' : 'erro' });
          } finally { previa(null); }
        }).finally(() => previa(null)); // também quando outra tarefa ainda está rodando
      }

      // "Colocar Vários" no inventário do jogo: pega o mobi escolhido (pelo ícone do cartão), fecha o
      // inventário, deixa marcar a área no chão e põe um por piso livre.
      async function colocarVarios() {
        if (!conexao.disponivel()) { exigir(); return; }
        if (!ferramenta) { camada.aviso('A ferramenta de construção não está pronta.', { tipo: 'erro' }); return; }
        const inv = document.querySelector('.nitro-inventory');
        const cartao = inv && inv.querySelector('.layout-grid-item.active');
        const url = cartao && /url\(["']?([^"')]+)/.exec(cartao.style.backgroundImage || '');
        if (!url) { camada.aviso('Escolha antes um mobi de chão no inventário.', { tipo: 'erro' }); return; }
        let tipo = 0, ficha = null;
        try {
          const dados = await VL.dadosJogo.mobis();
          for (const [id, f] of dados.chao) if (VL.dadosJogo.iconeDe(f.classe) === url[1]) { tipo = id; ficha = f; break; }
        } catch (e) { /* sem os dados do jogo não dá para saber o tipo */ }
        if (!tipo) { camada.aviso('Só dá para colocar vários mobis de chão (não achei o tipo deste).', { tipo: 'erro' }); return; }
        const itens = await pedirInventario();
        if (!itens) { camada.aviso('O inventário não respondeu.', { tipo: 'erro' }); return; }
        const fechar = inv.querySelector('.nitro-card-header-close');
        if (fechar) fechar.click();
        camada.aviso('Arraste no chão para marcar onde colocar ' + (ficha.nome || 'o mobi') + '. Esc cancela.', { duracaoMs: 7000 });
        const grande = (a) => (a.x2 - a.x1 + 1) * (a.y2 - a.y1 + 1) > codigos.MAX_PISOS_PREENCHER;
        ferramenta.comecarSelecao(false, function (alvo) {
          if (grande(alvo)) { ferramenta.previaColocacao(tipo, 0, []); camada.aviso('Área grande demais (o máximo é ' + codigos.MAX_PISOS_PREENCHER + ' pisos).', { tipo: 'erro' }); return; }
          preencherArea(alvo, tipo, 0, '"' + (ficha.nome || 'Tipo ' + tipo) + '"', itens);
        }, function (alvo) {
          // Prévia ao vivo enquanto arrasta: os mobis aparecem em cada piso livre, em cima das pilhas.
          const plano = grande(alvo) ? { colocar: [] } : codigos.planoPreencher(alvo, tipo, [...mobis.values()], itens, 0);
          ferramenta.previaColocacao(tipo, 0, comAltura(plano.colocar.concat(plano.pendentes || []), 'pilha').map((m) => ({ x: m.x, y: m.y, z: m.altura })));
        });
      }
      let vigiaInventario = 0;
      function botaoColocarVarios() {
        vigiaInventario = 0;
        const inv = document.querySelector('.nitro-inventory');
        if (!inv || inv.querySelector('.vl-colocar-varios')) return;
        const nativo = [...inv.querySelectorAll('.btn-success')].find((b) => b.textContent.trim() === 'Colocar no Quarto');
        if (!nativo) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = nativo.className.replace('btn-success', 'btn-primary') + ' vl-colocar-varios';
        b.textContent = 'Colocar Vários';
        b.title = 'Marque uma área no chão e o Vagalume põe um destes mobis em cada piso livre';
        b.addEventListener('click', function (ev) { ev.stopPropagation(); colocarVarios(); });
        // Um embaixo do outro, cada um com a largura toda (só um atributo no pai: o React continua dono dos nós).
        if (nativo.parentElement) nativo.parentElement.setAttribute('data-vl-pilha-botoes', '');
        nativo.after(b);
      }
      if (camada.estiloPagina) ctx.aoParar(camada.estiloPagina('colocar-varios',
        '[data-vl-pilha-botoes] { flex-wrap: wrap !important; row-gap: 6px !important; }'
        + ' [data-vl-pilha-botoes] > .btn-success, [data-vl-pilha-botoes] > .vl-colocar-varios { flex: 1 0 100% !important; width: 100% !important; max-width: none !important; margin-left: 0 !important; margin-right: 0 !important; white-space: nowrap; }'));
      ctx.aoParar(function () { document.querySelectorAll('[data-vl-pilha-botoes]').forEach((e) => e.removeAttribute('data-vl-pilha-botoes')); });
      if (typeof MutationObserver === 'function' && document.body) {
        const observaInventario = new MutationObserver(function () { if (!vigiaInventario) vigiaInventario = requestAnimationFrame(botaoColocarVarios); });
        observaInventario.observe(document.body, { childList: true, subtree: true });
        ctx.aoParar(function () { observaInventario.disconnect(); cancelAnimationFrame(vigiaInventario); document.querySelectorAll('.vl-colocar-varios').forEach((e) => e.remove()); });
      }

      ctx.comando({
        nome: 'limparrepetidos',
        uso: 'limparrepetidos',
        descricao: 'Recolhe mobis repetidos (mesmo tipo, piso, direção e altura) na área marcada, ou no quarto todo, depois de confirmar. Fica um de cada.',
        executar() {
          if (!conexao.disponivel()) { exigir(); return; }
          const universo = area ? codigos.mobisNaArea([...mobis.values()], area) : [...mobis.values()];
          const sobra = codigos.repetidos(universo);
          if (!sobra.length) { camada.aviso('Nada para limpar: não há mobis iguais empilhados no mesmo piso (mesmo tipo, direção e altura) ' + (area ? 'na área marcada.' : 'no quarto.') + ' Mobis só parecidos ou em pisos diferentes ficam.', { duracaoMs: 8000 }); return; }
          return camada.confirmar(sobra.length + ' mobis repetidos ' + (area ? 'na área ' + textoArea(area) : 'no quarto') + ' voltam para o inventário do dono. Fica um de cada.', { titulo: 'Limpar repetidos?', sim: 'Recolher' }).then(function (ok) {
            if (!ok) return;
            return emLote(async function () {
              const feitos = await recolherIds(sobra);
              camada.aviso(feitos + ' repetidos recolhidos.', { tipo: 'ok' });
            });
          });
        },
      });

      ctx.comando({ nome: 'copiarquarto', apelidos: ['backup'], uso: 'copiarquarto', descricao: 'Guarda a disposição dos mobis do chão deste quarto (use antes de recolher tudo).', executar: copiarQuarto });
      ctx.comando({ nome: 'colarquarto', apelidos: ['pasteroom'], uso: 'colarquarto', descricao: 'Coloca mobis do seu inventário nas posições da cópia, depois de confirmar.', executar() { colarQuarto(); } });
      ctx.comando({ nome: 'exportarquarto', uso: 'exportarquarto', descricao: 'Baixa a cópia do quarto num arquivo.', executar: exportarQuarto });

      ctx.comando({
        nome: 'mobis',
        uso: 'mobis',
        descricao: 'Lista os mobis do chão deste quarto, com posição e estado.',
        executar() { listar(); },
      });

      // ---------- wireds do quarto ----------
      // Os nomes dos tipos vêm das ofertas que o módulo Loja guardou ao ver páginas da loja
      // (localStorage `vl.ofertasVistas`): o nome da oferta de wired é a classe, como "wf_trg_walks_on_furni".
      const GRUPOS_WIRED = [
        { prefixo: 'wf_trg_', nome: 'Ativador' },
        { prefixo: 'wf_cnd_', nome: 'Condição' },
        { prefixo: 'wf_act_', nome: 'Efeito' },
        { prefixo: 'wf_xtra_', nome: 'Extra' },
        { prefixo: 'wf_slc_', nome: 'Seletor' },
      ];
      function tiposVistos() {
        try { const v = JSON.parse(localStorage.getItem('vl.ofertasVistas') || '{}'); return v && typeof v === 'object' ? v : {}; } catch (erro) { return {}; }
      }
      function grupoDoWired(nome) {
        const n = String(nome || '').toLowerCase();
        const g = GRUPOS_WIRED.find((x) => n.startsWith(x.prefixo));
        return g ? g.nome : (n.startsWith('wf_') ? 'Wired' : null);
      }
      // Marcadores locais continuam à vista mesmo quando :wired esconde os sprites do quarto.
      // Eles usam os IDs e posições que o jogo já entregou ao Vagalume; não alteram o quarto.
      let camadaWireds = null;
      let relogioWireds = null;
      let arquivoWireds = null;
      let geracaoWireds = 0;
      let geracaoDosMarcadores = geracaoQuarto;
      const wiredsRecordados = new Map();
      const marcadoresWireds = new Map();
      function atualizarWiredsOcultos() {
        if (!camadaWireds) return;
        if (geracaoDosMarcadores !== geracaoQuarto) { wiredsRecordados.clear(); geracaoDosMarcadores = geracaoQuarto; }
        const vistos = tiposVistos();
        for (const m of mobis.values()) {
          const f = arquivoWireds && arquivoWireds.chao.get(m.tipo);
          const v = f ? { n: f.classe, w: /^wf_/i.test(f.classe) } : vistos[m.tipo];
          if (!v || !grupoDoWired(v.n) && !v.w) continue;
          wiredsRecordados.set(m.id, { m, nome: v.n, grupo: grupoDoWired(v.n) || 'Wired', icone: f && VL.dadosJogo ? VL.dadosJogo.iconeDe(f.classe) : '' });
        }
        const lista = [...wiredsRecordados.values()];
        const presentes = new Set();
        const pilhas = new Map();
        const mapa = VL.mapaQuarto;
        for (const w of lista.slice(0, 200)) {
          const id = w.m.id;
          presentes.add(id);
          const lembrado = !mobis.has(id);
          let botao = marcadoresWireds.get(id);
          if (!botao) {
            botao = camada.el('button', { type: 'button', class: 'vl-wired-fantasma', title: w.grupo + ' · ' + w.nome + ' · ID ' + id, 'aria-label': 'Abrir wired ' + id, onclick() { mandar(SAIDA.USAR_MOBI, [['i', id], ['i', 0]]); } }, [
              w.icone ? camada.el('img', { src: w.icone, alt: '' }) : camada.el('span', { texto: '⚡' }),
              camada.el('small', { texto: String(id) }),
            ]);
            marcadoresWireds.set(id, botao);
            camadaWireds.appendChild(botao);
          }
          botao.classList.toggle('lembrado', lembrado);
          botao.title = w.grupo + ' · ' + w.nome + ' · ID ' + id + (lembrado ? ' · última posição conhecida' : '');
          const chave = w.m.x + ',' + w.m.y;
          const deslocamento = Math.min(5, pilhas.get(chave) || 0);
          pilhas.set(chave, deslocamento + 1);
          const p = mapa && mapa.telaDoPiso(w.m.x, w.m.y, w.m.altura || 0);
          botao.hidden = !p;
          if (p) { botao.style.left = (p.x + deslocamento * 12) + 'px'; botao.style.top = (p.y - deslocamento * 10) + 'px'; }
        }
        for (const [id, no] of marcadoresWireds) if (!presentes.has(id)) { no.remove(); marcadoresWireds.delete(id); }
      }
      async function alternarWiredsOcultos(ligar) {
        const novo = ligar == null ? !camadaWireds : !!ligar;
        if (!novo) {
          geracaoWireds++;
          clearInterval(relogioWireds); relogioWireds = null;
          if (camadaWireds) camadaWireds.remove();
          camadaWireds = null; marcadoresWireds.clear(); wiredsRecordados.clear();
          ctx.emitir('wireds:visibilidade', { visivel: false });
          return false;
        }
        if (camadaWireds) return true;
        if (!conexao.disponivel()) { camada.aviso('Ligue a Conexão do jogo e recarregue o hotel.', { tipo: 'erro' }); return false; }
        const minhaGeracao = ++geracaoWireds;
        camadaWireds = camada.el('div', { class: 'vl-wireds-fantasmas', 'aria-label': 'Wireds conhecidos neste quarto' });
        camada.area().appendChild(camadaWireds);
        if (!arquivoWireds) try { arquivoWireds = await VL.dadosJogo.mobis(); } catch (erro) { arquivoWireds = null; }
        if (!camadaWireds || minhaGeracao !== geracaoWireds) return false;
        atualizarWiredsOcultos();
        relogioWireds = setInterval(atualizarWiredsOcultos, 250);
        ctx.emitir('wireds:visibilidade', { visivel: true });
        camada.aviso('Wireds conhecidos destacados no quarto. Eles continuam visíveis para você após :wired. Use /verwireds para desligar.');
        if (!VL.mapaQuarto || !VL.mapaQuarto.calibrado()) camada.aviso('Clique num piso do quarto para posicionar os marcadores.', { duracaoMs: 6000 });
        return true;
      }
      const apiWiredsOcultos = { alternar: alternarWiredsOcultos, visivel: () => !!camadaWireds };
      VL.wiredsQuarto = apiWiredsOcultos;
      ctx.aoParar(function () { alternarWiredsOcultos(false); if (VL.wiredsQuarto === apiWiredsOcultos) VL.wiredsQuarto = null; });
      ctx.comando({ nome: 'verwireds', uso: 'verwireds', descricao: 'Mostra ou esconde marcadores dos wireds do quarto, inclusive após :wired.', executar() { alternarWiredsOcultos(); } });
      async function listarWireds() {
        if (!conexao.disponivel()) { exigir(); return; }
        const vistos = tiposVistos();
        // A classe de cada tipo vem do arquivo de mobis do jogo; as ofertas vistas na loja ficam de reserva.
        let arquivo = null;
        try { arquivo = VL.dadosJogo ? await VL.dadosJogo.mobis() : null; } catch (e) { arquivo = null; }
        const lista = [];
        let semNome = 0;
        for (const m of mobis.values()) {
          const f = arquivo ? arquivo.chao.get(m.tipo) : null;
          const v = f ? { n: f.classe, w: /^wf_/i.test(f.classe) } : vistos[m.tipo];
          if (!v) { semNome++; continue; }
          const grupo = grupoDoWired(v.n) || (v.w ? 'Wired' : null);
          if (grupo) lista.push({ m, grupo, nome: v.n });
        }
        const p = VL.comandos ? VL.comandos.inicioDigitado(ctx.secao('comandos').prefixo) : '/';
        if (!lista.length) {
          camada.aviso(semNome
            ? 'Não achei wireds conhecidos neste quarto. O Vagalume só reconhece os tipos que já viu na loja: abra uma vez as páginas de wired (' + p + 'lojapagina ativadores, condicoes, efeitos…) e tente de novo.'
            : 'Nenhum wired neste quarto.', { duracaoMs: 9000 });
          return;
        }
        const ordem = GRUPOS_WIRED.map((g) => g.nome).concat('Wired');
        lista.sort((a, b) => ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo) || a.m.y - b.m.y || a.m.x - b.m.x);
        let dados = null;
        try { dados = VL.dadosJogo ? await VL.dadosJogo.mobis() : null; } catch (e) { dados = null; }
        const itens = lista.slice(0, 300).map(function (w) {
          const abrir = camada.el('button', {
            type: 'button', class: 'vl-amigo-botao', texto: 'Abrir',
            title: 'Seleciona e abre a janela deste wired',
            onclick() {
              selecionado = w.m.id;
              mandar(SAIDA.USAR_MOBI, [['i', w.m.id], ['i', 0]]);
              // fecha o diálogo (ele escuta o Esc na janela)
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
            },
          });
          return linhaDeMobi(w.m, dados, w.grupo, [abrir, botaoComprar([{ tipo: w.m.tipo, quantidade: 1 }])]);
        });
        camada.dialogo({
          titulo: lista.length + (lista.length === 1 ? ' wired no quarto' : ' wireds no quarto'),
          texto: 'Ativadores, condições, efeitos e extras deste quarto. "Abrir" seleciona o wired e abre a janela dele (só para quem tem direitos).' + (semNome ? ' ' + semNome + ' mobis são de tipos que o Vagalume ainda não reconhece.' : ''),
          conteudo: camada.el('div', { class: 'vl-amigos' }, [camada.el('div', { class: 'vl-amigos-lista', style: 'max-height: 50vh; overflow: auto;' }, itens)]),
          largo: true,
        });
      }

      ctx.comando({
        nome: 'wireds',
        apelidos: ['wiredsquarto'],
        uso: 'wireds',
        descricao: 'Lista os wireds do quarto (ativadores, condições, efeitos, extras) com a posição; "Abrir" abre a janela do wired.',
        executar() { listarWireds(); },
      });

      // Uma linha da lista (mobis e wireds): ícone, nome, informações e botões (pedido do usuário em 2026-11-16).
      function linhaDeMobi(m, dados, extras, botoes) {
        const el = camada.el;
        const f = dados ? dados.chao.get(m.tipo) : null;
        const nome = (f && f.nome) || 'Tipo ' + m.tipo;
        const foto = el('div', { class: 'vl-amigo-foto', 'data-letra': f ? '' : '?' });
        if (f && VL.dadosJogo) {
          const img = el('img', { alt: '', src: VL.dadosJogo.iconeDe(f.classe), style: 'display:block;max-width:34px;max-height:34px;margin:auto;image-rendering:pixelated;' });
          img.addEventListener('error', function () { img.remove(); foto.setAttribute('data-letra', nome.charAt(0).toUpperCase()); });
          foto.appendChild(img);
        }
        return el('div', { class: 'vl-amigo' + (m.id === selecionado ? ' online' : '') }, [
          foto,
          el('div', { class: 'vl-amigo-texto' }, [
            el('div', { class: 'vl-amigo-nome', texto: (extras ? extras + ' · ' : '') + nome + (m.id === selecionado ? ' (selecionado)' : '') }),
            el('div', { class: 'vl-amigo-missao', texto: '(' + m.x + ', ' + m.y + ') · altura ' + m.altura + ' · direção ' + m.direcao + (m.estado ? ' · estado ' + m.estado : '') + ' · id ' + m.id }),
          ]),
          el('div', { class: 'vl-amigo-botoes' }, botoes),
        ]);
      }
      function botaoComprar(lista, rotulo) {
        const b = camada.el('button', { type: 'button', class: 'vl-amigo-botao', texto: rotulo || 'Comprar', title: 'Comprar na loja (mostra o preço antes)' });
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (!VL.loja || !VL.loja.comprarTipos) { camada.aviso('Ligue o módulo "Loja e inventário" para comprar.', { tipo: 'erro' }); return; }
          VL.loja.comprarTipos(lista);
        });
        return b;
      }
      async function listar() {
        if (!conexao.disponivel()) { exigir(); return; }
        if (!mobis.size) { camada.aviso('Nenhum mobi no chão deste quarto (ou o quarto foi aberto antes de ligar a conexão).'); return; }
        let dados = null;
        try { dados = VL.dadosJogo ? await VL.dadosJogo.mobis() : null; } catch (e) { dados = null; }
        const porTipo = new Map();
        for (const m of mobis.values()) porTipo.set(m.tipo, (porTipo.get(m.tipo) || 0) + 1);
        const el = camada.el;
        const linhas = [...mobis.values()].slice(0, 300).map((m) => linhaDeMobi(m, dados, '', [botaoComprar([{ tipo: m.tipo, quantidade: 1 }])]));
        const todos = botaoComprar([...porTipo].map(([tipo, quantidade]) => ({ tipo, quantidade })), 'Comprar todos (' + mobis.size + ')');
        todos.className = 'vl-botao primario';
        camada.dialogo({
          titulo: mobis.size + ' mobis no chão',
          texto: porTipo.size + ' tipos diferentes.' + (incompleto ? ' A lista pode estar incompleta: um mobi veio num formato que o Vagalume ainda não lê.' : '') + ' "Comprar todos" compra uma unidade de cada mobi da lista (o preço total aparece antes).',
          conteudo: el('div', { class: 'vl-amigos' }, [todos, el('div', { class: 'vl-amigos-lista', style: 'max-height: 50vh; overflow: auto;' }, linhas)]),
          largo: true,
        });
      }

      function recolher() {
        const m = exigir();
        if (!m) return;
        camada.confirmar('O mobi ' + m.id + ' em (' + m.x + ', ' + m.y + ') volta para o inventário de quem é o dono.', { titulo: 'Recolher o mobi?', sim: 'Recolher' }).then(function (ok) {
          if (ok) mandar(SAIDA.PEGAR_MOBI, [['i', 10], ['i', m.id]]);
        });
      }

      ctx.comando({
        nome: 'altura',
        uso: 'altura <n>',
        descricao: 'Põe o mobi selecionado na altura n (ex.: 1 ou 0.35), pelo :up do jogo.',
        executar(pedido) {
          const m = exigir();
          if (!m) return;
          aplicarAltura(m, Number(String(pedido.args[0] || '').replace(',', '.')));
        },
      });

      // Usar a posição, a direção ou a altura de um mobi em outro.
      let posicaoGuardada = null;
      ctx.comando({
        nome: 'copiarposicao',
        uso: 'copiarposicao',
        descricao: 'Guarda a posição, a direção e a altura do mobi selecionado.',
        executar() {
          const m = exigir();
          if (!m) return;
          posicaoGuardada = foto(m);
          camada.aviso('Guardado: (' + m.x + ', ' + m.y + '), direção ' + m.direcao + ', altura ' + m.altura + '.');
        },
      });
      ctx.comando({
        nome: 'colarposicao',
        apelidos: ['usarposicao'],
        uso: 'colarposicao [tudo|lugar|direcao|altura]',
        descricao: 'Aplica no mobi selecionado o que foi guardado com copiarposicao (tudo, se não disser).',
        executar(pedido) {
          const m = exigir();
          if (!m) return;
          if (!posicaoGuardada) { camada.aviso('Use antes /copiarposicao num mobi.', { tipo: 'erro' }); return; }
          const parte = String(pedido.args[0] || 'tudo').toLowerCase().replace('ç', 'c').replace('ã', 'a');
          const g = posicaoGuardada;
          if (!['tudo', 'lugar', 'direcao', 'altura'].includes(parte)) { camada.aviso('Use tudo, lugar, direcao ou altura.', { tipo: 'erro' }); return; }
          if (parte === 'altura') { aplicarAltura(m, g.altura || 0); return; }
          const destino = { x: parte === 'direcao' ? m.x : g.x, y: parte === 'direcao' ? m.y : g.y, direcao: parte === 'lugar' ? m.direcao : g.direcao };
          mover(m, destino).then(function (ok) {
            if (ok && parte === 'tudo' && Math.abs((g.altura || 0) - (m.altura || 0)) > 0.001) aplicarAltura(Object.assign({}, m, destino), g.altura || 0);
          });
        },
      });

      ctx.comando({
        nome: 'girar',
        uso: 'girar',
        descricao: 'Gira o mobi selecionado (o último que você clicou).',
        executar() { const m = exigir(); if (m) mover(m, codigos.mexer(m, 'ArrowRight', true)); },
      });

      ctx.comando({
        nome: 'mover',
        uso: 'mover <x> <y>',
        descricao: 'Leva o mobi selecionado para o piso (x, y).',
        executar(pedido) {
          const m = exigir();
          if (!m) return;
          const x = Number(pedido.args[0]);
          const y = Number(pedido.args[1]);
          if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 200 || y > 200) {
            camada.aviso('Use: mover <x> <y>, com números inteiros.', { tipo: 'erro' });
            return;
          }
          mover(m, { x, y, direcao: m.direcao });
        },
      });

      ctx.comando({
        nome: 'usar',
        uso: 'usar',
        descricao: 'Usa o mobi selecionado (o mesmo que o duplo clique).',
        executar() { const m = exigir(); if (m) mandar(SAIDA.USAR_MOBI, [['i', m.id], ['i', 0]]); },
      });

      ctx.comando({
        nome: 'pegar',
        uso: 'pegar',
        descricao: 'Recolhe o mobi selecionado para o inventário, depois de confirmar.',
        executar() { recolher(); },
      });

      // ---------- ferramenta de construção (seleção no chão e janela completa; construcao-ferramenta.js) ----------
      ferramenta = VL.ferramentaConstrucao ? VL.ferramentaConstrucao(ctx, {
        mobis,
        selecionado: () => selecionado,
        definirArea(a) { area = a; },
        emLote,
        emLoteGrupo,
        moverLista,
        alturaPendente,
        alturas(plano) {
          for (const p of plano) { const m = mobis.get(p.id); if (m && p.altura != null) pendentes.set(m.id, { m, alvo: p.altura }); }
          atualizarSituacao();
          clearTimeout(relogioAltura);
          return enviarAlturas();
        },
        mandar,
        esperar,
        recolherIds,
        pedirInventario,
        colocarLista, colocarNoTopo,
        desfazer() { return voltar('desfazer', 'Nada para desfazer neste quarto.'); },
        refazer() { return voltar('refazer', 'Nada para refazer.'); },
        alternarCongelar,
        alternarTeleporte,
        teleporteLigado: () => teleporteLigado,
      }) : null;
      ctx.comando({
        nome: 'ferramenta',
        apelidos: ['construir'],
        uso: 'ferramenta',
        descricao: 'Abre a ferramenta de construção integrada à página Construção do painel Vagalume.',
        executar() { if (ferramenta) ferramenta.abrirJanela(); },
      });
      ctx.comando({
        nome: 'selecionar',
        uso: 'selecionar',
        descricao: 'Começa a selecionar uma área arrastando no chão (como no Paint).',
        executar() { if (ferramenta) { ferramenta.abrirJanela(); ferramenta.comecarSelecao(); } },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
