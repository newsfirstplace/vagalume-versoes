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
      const mobisParede = new Map(); // id -> mobi de parede do quarto atual
      let planta = null, espessura = null, decoracao = {}; // do quarto atual (planta, paredes/piso, estampas)
      let porta = null, entrada = null, esperandoEntrada = false; // porta do quarto (1664) e onde o seu avatar apareceu ao entrar
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
        conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { mobis.clear(); mobisParede.clear(); decoracao = {}; selecionado = null; incompleto = false; pickitem = null; geracaoQuarto++; porta = null; entrada = null; esperandoEntrada = true; }),
        conexao.ouvir('entrada', ENTRADA.PORTA, function (l) { porta = codigos.lerPorta(l); }),
        // Quem entra aparece na porta, virado como ela: reserva para a porta do floor se o jogo não responder ao pedido.
        conexao.ouvir('entrada', ENTRADA.USUARIOS, function (l) {
          if (!esperandoEntrada || !VL.pessoas || VL.pessoas.meuId() == null) return;
          try {
            const eu = codigos.lerUsuarios(l).lista.find((u) => u.tipo === 1 && u.id === VL.pessoas.meuId());
            if (eu) { entrada = { x: eu.x, y: eu.y, direcao: eu.direcao }; esperandoEntrada = false; }
          } catch (e) { /* lista em outro formato: fica sem a reserva */ }
        }),
        // Planta, espessuras, decoração e mobis de parede do quarto atual (para copiar o quarto inteiro).
        conexao.ouvir('entrada', ENTRADA.PLANTA, function (l) { planta = codigos.lerPlanta(l); }),
        conexao.ouvir('entrada', ENTRADA.ESPESSURA, function (l) { espessura = codigos.lerEspessura(l); }),
        conexao.ouvir('entrada', ENTRADA.DECORACAO, function (l) { const d = codigos.lerDecoracao(l); if (codigos.CLASSE_DECORACAO[d.tipo]) decoracao[d.tipo] = d.valor; }),
        conexao.ouvir('entrada', ENTRADA.MOBIS_PAREDE, function (l) { for (const m of codigos.lerMobisParede(l)) mobisParede.set(m.id, m); }),
        conexao.ouvir('entrada', ENTRADA.MOBI_PAREDE_COLOCADO, function (l) { const m = codigos.lerMobiParede(l); mobisParede.set(m.id, m); }),
        conexao.ouvir('entrada', ENTRADA.MOBI_PAREDE_ATUALIZADO, function (l) { const m = codigos.lerMobiParede(l); mobisParede.set(m.id, m); }),
        conexao.ouvir('entrada', ENTRADA.MOBI_PAREDE_RETIRADO, function (l) { mobisParede.delete(parseInt(l.texto(), 10)); }),
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

      // ---------- ocultar mobis (pedido do usuário em 2026-11-26) ----------
      // Esconde mobis só na tela (o motor do jogo os deixa transparentes), para ver a construção sem sombras,
      // luzes ou um piso. Guarda o que foi escondido: por categoria/tipo (vale também para os que chegam
      // depois) e por id. Some ao trocar de quarto.
      const ocultos = { tipos: new Set(), ids: new Set(), rotulos: [] };
      let estadoOcultos = null;
      let chipOcultos = null;
      function idsOcultos() {
        const ids = new Set(ocultos.ids);
        if (ocultos.tipos.size) for (const m of mobis.values()) if (ocultos.tipos.has(m.tipo)) ids.add(m.id);
        return [...ids];
      }
      function aplicarOcultos() {
        const ids = idsOcultos();
        if (!ferramenta || !ferramenta.ocultarMobis || !ferramenta.ocultarMobis(ids)) {
          if (ids.length) camada.aviso('Não consegui falar com o desenho do quarto. Recarregue o hotel e tente de novo.', { tipo: 'erro' });
          return 0;
        }
        pintarOcultos(ids.length);
        return ids.length;
      }
      function pintarOcultos(n) {
        const total = n != null ? n : idsOcultos().length;
        const texto = ocultos.rotulos.length ? 'Ocultos: ' + ocultos.rotulos.join(', ') + ' (' + total + ' mobis).' : 'Nenhum mobi oculto.';
        if (estadoOcultos && estadoOcultos.isConnected) {
          estadoOcultos.replaceChildren(el('span', { texto }), ocultos.rotulos.length ? el('button', { type: 'button', class: 'vl-botao primario', texto: 'Mostrar tudo', onclick: mostrarOcultos }) : null);
        }
        // Lembrete na tela enquanto houver algo escondido, com o botão para desfazer.
        if (ocultos.rotulos.length) {
          if (!chipOcultos) {
            chipOcultos = el('div', { class: 'vl-chip-ocultos', role: 'status' });
            camada.area().appendChild(chipOcultos);
          }
          chipOcultos.replaceChildren(el('span', { texto: '👁 ' + total + ' mobis ocultos' }), el('button', { type: 'button', texto: 'Mostrar tudo', onclick: mostrarOcultos }));
        } else if (chipOcultos) { chipOcultos.remove(); chipOcultos = null; }
      }
      function mostrarOcultos() {
        ocultos.tipos.clear(); ocultos.ids.clear(); ocultos.rotulos = [];
        if (ferramenta && ferramenta.ocultarMobis) ferramenta.ocultarMobis([]);
        pintarOcultos(0);
      }
      function adicionarRotulo(r) { if (!ocultos.rotulos.includes(r)) ocultos.rotulos.push(r); }
      async function ocultarCategoria(nome) {
        if (!conexao.disponivel()) { exigir(); return; }
        if (!VL.loja || !VL.loja.classesDaCategoria) { camada.aviso('Ligue o módulo "Loja e inventário" para ocultar por categoria.', { tipo: 'erro' }); return; }
        camada.aviso('Procurando a categoria "' + nome + '" na loja…');
        try {
          const classes = await VL.loja.classesDaCategoria(nome);
          let noQuarto = 0;
          for (const c of classes) ocultos.tipos.add(c);
          for (const m of mobis.values()) if (classes.has(m.tipo)) noQuarto++;
          adicionarRotulo(nome);
          aplicarOcultos();
          camada.aviso(noQuarto ? noQuarto + ' mobis de "' + nome + '" ocultos.' : 'Nenhum mobi de "' + nome + '" neste quarto (os que chegarem também ficam ocultos).');
        } catch (erro) { camada.aviso(String(erro.message || erro), { tipo: 'erro' }); }
      }
      function ocultarClicado(iguais) {
        const m = exigir();
        if (!m) return;
        const d = dadosMobis ? dadosMobis.chao.get(m.tipo) : null;
        const nome = (d && d.nome) || ('tipo ' + m.tipo);
        if (iguais) { ocultos.tipos.add(m.tipo); adicionarRotulo('iguais a ' + nome); } else { ocultos.ids.add(m.id); adicionarRotulo(nome); }
        const n = aplicarOcultos();
        if (n) camada.aviso(iguais ? 'Todos os "' + nome + '" ocultos.' : '"' + nome + '" oculto.');
      }
      function ocultarMarcados() {
        const ids = ferramenta && ferramenta.idsMarcados ? ferramenta.idsMarcados() : [];
        if (!ids.length) { camada.aviso('Marque uma área no chão primeiro (aba Área).', { tipo: 'erro' }); return; }
        for (const id of ids) ocultos.ids.add(id);
        adicionarRotulo(ids.length + ' marcados');
        if (aplicarOcultos() && ferramenta.limparSelecao) ferramenta.limparSelecao();
      }
      // Mobis que chegam depois (colocados ou trocados de lugar) do tipo oculto também somem.
      cancelar.push(conexao.ouvir('entrada', ENTRADA.MOBI_COLOCADO, function () { if (ocultos.tipos.size) setTimeout(aplicarOcultos, 60); }));
      cancelar.push(conexao.ouvir('entrada', ENTRADA.MOBIS_DO_QUARTO, function () { if (ocultos.tipos.size) setTimeout(aplicarOcultos, 300); }));
      cancelar.push(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { if (ocultos.rotulos.length) { ocultos.tipos.clear(); ocultos.ids.clear(); ocultos.rotulos = []; pintarOcultos(0); } }));
      ctx.aoParar(function () { if (chipOcultos) chipOcultos.remove(); chipOcultos = null; });
      ctx.comando({
        nome: 'ocultar',
        uso: 'ocultar <categoria da loja> | clicado | iguais | marcados | nada',
        descricao: 'Esconde mobis só na sua tela, para ver a construção: uma categoria da loja (ex.: /ocultar sombras, /ocultar iluminação), o mobi clicado, os iguais a ele, os marcados na área. /ocultar nada mostra tudo de novo.',
        executar(pedido) {
          const termo = pedido.args.join(' ').trim();
          const t = codigos.semAcento(termo);
          if (!t) { camada.aviso('Diga o que ocultar: uma categoria da loja, clicado, iguais ou marcados.', { tipo: 'erro' }); return; }
          if (/^(nada|tudo de volta|mostrar|limpar|cancelar)$/.test(t)) mostrarOcultos();
          else if (t === 'clicado') ocultarClicado(false);
          else if (t === 'iguais') ocultarClicado(true);
          else if (t === 'marcados' || t === 'area') ocultarMarcados();
          else ocultarCategoria(termo);
        },
      });

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
          const botao = (rotulo, dica, fazer, classe) => el('button', { type: 'button', class: 'vl-botao' + (classe ? ' ' + classe : ''), texto: rotulo, title: dica, onclick: fazer });
          const mexer = (rotulo, dica, tecla, girar) => { const b = botaoMexer(rotulo, tecla, girar); b.title = dica; return b; };
          const secao = (titulo, filhos) => el('section', { class: 'vl-cons-secao' }, [el('h3', { class: 'vl-acoes-titulo', texto: titulo })].concat(filhos));
          const acao = (icone, titulo, texto, fazer) => el('button', { type: 'button', class: 'vl-cons-acao', onclick: fazer }, [
            el('span', { class: 'vl-cons-acao-ic', 'aria-hidden': 'true', texto: icone }),
            el('span', { class: 'vl-cons-acao-tx' }, [el('b', { texto: titulo }), el('small', { texto })]),
          ]);
          const grade = (filhos) => el('div', { class: 'vl-cons-acoes' }, filhos);
          const congelar = acao('❄', 'Congelar', 'Seu avatar não anda ao clicar no chão.', function () { alternarCongelar(); });
          const tele = acao('✦', 'Teleporte', 'Clique num piso e vá direto (precisa de direitos).', function () { alternarTeleporte(); });
          const espelhoBotao = acao('⧎', 'Modo espelho', 'O que você coloca, move, gira ou recolhe de um lado da linha se repete do outro.', function () { escolherEspelho(); });
          botoesModo = { congelar, tele, espelho: espelhoBotao };
          setTimeout(atualizarModo, 0);
          // Duas partes (pedido do usuário em 2026-11-22): Área (vários mobis) e Mobi (um só); o resto fica embaixo.
          const area = el('div', { class: 'vl-cons-painel', role: 'tabpanel', 'aria-label': 'Área' }, []);
          const mobi = el('div', { class: 'vl-cons-painel', role: 'tabpanel', 'aria-label': 'Mobi' }, [
            situacao,
            el('p', { class: 'vl-nota', texto: 'Clique num mobi no quarto para escolher com qual mexer.' }),
            el('div', { class: 'vl-cons-colunas' }, [
              secao('Posição', [
                el('div', { class: 'vl-cruz' }, [
                  mexer('↖', 'x − 1', 'ArrowLeft', false), mexer('↗', 'y − 1', 'ArrowUp', false),
                  mexer('↙', 'y + 1', 'ArrowDown', false), mexer('↘', 'x + 1', 'ArrowRight', false),
                ]),
                el('div', { class: 'vl-linha' }, [mexer('↺', 'Girar para a esquerda', 'ArrowLeft', true), mexer('↻', 'Girar para a direita', 'ArrowRight', true)]),
              ]),
              secao('Altura', [
                el('div', { class: 'vl-linha' }, [botaoAltura('−', -1), botaoAltura('+', 1),
                  botao('0', 'Altura 0', function () { const m = exigir(); if (m) aplicarAltura(m, 0); })]),
                historico,
              ]),
            ]),
            grade([
              acao('◐', 'Usar', 'Liga, desliga ou troca o estado do mobi.', function () { const m = exigir(); if (m) mandar(SAIDA.USAR_MOBI, [['i', m.id], ['i', 0]]); }),
              acao('⤓', 'Recolher', 'Devolve este mobi ao inventário.', function () { recolher(); }),
            ]),
            el('p', { class: 'vl-cuidado', texto: '⚠ Não clique sem parar: cada clique manda uma mensagem ao jogo, e o Habblet dá mute por flood.' }),
            el('p', { class: 'vl-nota', texto: 'No quarto: Ctrl+setas movem, Ctrl+Shift+← → giram e Shift+roda muda a altura do mobi.' }),
          ]);
          const geralAcoes = grade([congelar, tele, espelhoBotao]);
          const geral = el('div', { class: 'vl-cons-geral' }, [secao('Ferramentas do quarto', [geralAcoes])]);
          const fimOcultar = secao('Ocultar mobis (só na sua tela)', [grade([
            acao('◐', 'Sombras', 'Esconde os mobis da categoria Sombras da loja.', function () { ocultarCategoria('Sombras'); }),
            acao('✺', 'Iluminação', 'Esconde os mobis da categoria Iluminação da loja.', function () { ocultarCategoria('Iluminação'); }),
            acao('⌕', 'Outra categoria', 'Escreva no chat o nome de uma página da loja.', function () { escreverNoChat('ocultar '); }),
            acao('◎', 'O mobi clicado', 'Esconde só o último mobi que você clicou.', function () { ocultarClicado(false); }),
            acao('◎', 'Iguais ao clicado', 'Esconde todos os mobis do mesmo tipo do clicado (ex.: um piso).', function () { ocultarClicado(true); }),
            acao('▭', 'Os marcados', 'Esconde os mobis da área marcada em Área.', function () { ocultarMarcados(); }),
          ]), el('div', { class: 'vl-ocultos-estado' }), el('p', { class: 'vl-nota', texto: 'Nada muda para os outros nem no servidor. Volta ao normal com "Mostrar tudo", ao trocar de quarto ou ao recarregar.' })]);
          estadoOcultos = fimOcultar.querySelector('.vl-ocultos-estado');
          pintarOcultos();
          const fimGeral = secao('Quarto inteiro', [grade([
            acao('☷', 'Lista de mobis', 'Todos os mobis do chão deste quarto.', function () { listar(); }),
            acao('⧉', 'Copiar quarto', 'Guarda onde está cada mobi.', function () { copiarQuarto(); }),
            acao('⎘', 'Colar quarto', 'Monta de novo com mobis do seu inventário.', function () { colarQuarto(); }),
            acao('🛒', 'Comprar o que falta', 'Compra os mobis da cópia que não estão no seu inventário.', function () {
              if (!copiaQuarto) { camada.aviso('Copie um quarto primeiro.', { tipo: 'erro' }); return; }
              if (!VL.loja || !VL.loja.comprarTipos) { camada.aviso('Ligue o módulo "Loja e inventário" para comprar.', { tipo: 'erro' }); return; }
              comprarFaltasDaCopia(copiaQuarto, 'Faltam {n} mobis da cópia no seu inventário.').then(function (comprou) { if (comprou === null) camada.aviso('Nada a comprar: o inventário já tem tudo da cópia (ou não respondeu).'); });
            }),
          ])]);
          const fimArea = secao('3. Altura dos marcados', [grade([
            acao('═', 'Nivelar', 'Mesma altura para todos (você digita qual).', function () { escreverNoChat('nivelar '); }),
            acao('⟋', 'Escada', 'Altura subindo a cada piso.', function () { escreverNoChat('escada 0.5 x'); }),
          ]), el('p', { class: 'vl-nota', texto: 'Vale para a área arrastada no chão, até 40 mobis.' })]);
          const abas = [['area', 'Área', 'Vários mobis de uma vez', area], ['mobi', 'Mobi', 'Um mobi só', mobi]];
          const botoesAba = abas.map(([id, titulo, resumo]) => el('button', { type: 'button', role: 'tab', class: 'vl-cons-subaba', onclick() { subAba = id; mostrar(); } },
            [el('b', { texto: titulo }), el('small', { texto: resumo })]));
          function mostrar() {
            abas.forEach(([id, , , painel], i) => { painel.hidden = id !== subAba; botoesAba[i].setAttribute('aria-selected', String(id === subAba)); });
          }
          mostrar();
          alvo.replaceChildren(el('div', { class: 'vl-cons-subabas', role: 'tablist', 'aria-label': 'Construção' }, botoesAba), area, mobi, geral);
          const fechos = () => { area.appendChild(fimArea); geral.appendChild(fimOcultar); geral.appendChild(fimGeral); };
          const montarFerramenta = () => { const desmontar = ferramenta.montarPainel({ area, mobi, geral: geralAcoes }); fechos(); return desmontar; };
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
      // inventário, conferido ao vivo) com altura e estado fixos. Também mobis de parede, planta, papel de
      // parede/piso/paisagem e regulador de luz (2026-11-22; não conferidos ao vivo).
      let copiaQuarto = null;
      let extrasCopia = {}; // { planta, decoracao, regulador } da cópia (pedido do usuário em 2026-11-22)
      let colando = false;
      const CHAVE_COPIA = 'vl.copiaQuarto';
      const areaLocal = raiz.chrome && raiz.chrome.storage && raiz.chrome.storage.local;
      function guardarCopia() {
        if (!areaLocal || !copiaQuarto) return;
        areaLocal.set({ [CHAVE_COPIA]: { mobis: copiaQuarto, extras: extrasCopia, quando: Date.now() } }).catch(function () { /* sem espaço: fica só na memória */ });
      }
      if (areaLocal) {
        areaLocal.get(CHAVE_COPIA).then(function (r) {
          const o = r && r[CHAVE_COPIA];
          const lista = o && !copiaQuarto ? codigos.validarCopiaQuarto(o.mobis) : null;
          if (lista) { copiaQuarto = lista; extrasCopia = codigos.validarExtrasQuarto(o.extras); }
        }).catch(function () { /* sem cópia guardada */ });
      }
      // Espera uma mensagem que chega com o código; devolve o leitor ou null no tempo.
      function esperarMensagem(codigo, ms, pedir) {
        return new Promise(function (resolver) {
          let parar = null;
          const relogio = setTimeout(function () { if (parar) parar(); resolver(null); }, ms);
          parar = conexao.ouvir('entrada', codigo, function (l) { clearTimeout(relogio); parar(); resolver(l); });
          if (pedir) pedir();
        });
      }
      // ---------- permissão do dono para copiar o quarto (pedido do usuário em 2026-11-26) ----------
      // Quem quer copiar manda um pedido ao dono (pelo canal direto entre Vagalumes do quarto); só copia se ele
      // aceitar. O próprio dono copia sem pedir. O dono precisa estar no quarto e usar o Vagalume.
      const esperasCopia = new Map(); // quarto -> função que recebe a resposta
      const pedidosRecebidos = new Map(); // apelido -> último pedido (evita enxurrada)
      function souDono(dono) {
        const meuId = VL.pessoas && VL.pessoas.meuId ? VL.pessoas.meuId() : null;
        const eu = VL.pessoas && VL.pessoas.eu ? String(VL.pessoas.eu() || '').toLowerCase() : '';
        return !!dono && ((dono.id > 0 && meuId != null && dono.id === meuId) || (!!eu && dono.nome.toLowerCase() === eu));
      }
      async function pedirPermissaoCopia() {
        const quarto = VL.pessoas && VL.pessoas.quartoAtual ? VL.pessoas.quartoAtual() : null;
        const dono = VL.pessoas && VL.pessoas.quartoDono ? VL.pessoas.quartoDono() : null;
        if (!dono || !dono.nome) { camada.aviso('Não sei quem é o dono deste quarto. Saia e entre de novo e tente outra vez.', { tipo: 'erro' }); return false; }
        if (souDono(dono)) return true;
        const presente = VL.pessoas.lista && VL.pessoas.lista().some((n) => String(n).toLowerCase() === dono.nome.toLowerCase());
        if (!presente || !VL.comunidade || !VL.comunidade.usaVagalume(dono.nome)) {
          camada.aviso('Para copiar este quarto, o dono (' + dono.nome + ') precisa estar aqui e usar o Vagalume para autorizar.', { tipo: 'erro', duracaoMs: 8000 });
          return false;
        }
        camada.aviso('Pedido enviado a ' + dono.nome + '. Esperando ele aceitar (até 40 s)…', { duracaoMs: 6000 });
        const resposta = new Promise(function (resolver) {
          const relogio = setTimeout(function () { esperasCopia.delete(String(quarto)); resolver(null); }, 40000);
          esperasCopia.set(String(quarto), function (ok) { clearTimeout(relogio); esperasCopia.delete(String(quarto)); resolver(ok); });
        });
        const r = await VL.comunidade.direto(dono.nome, { t: 'copia:pedido', q: quarto });
        if (r && r.ok === false) { esperasCopia.delete(String(quarto)); camada.aviso('Não consegui mandar o pedido a ' + dono.nome + '.', { tipo: 'erro' }); return false; }
        const ok = await resposta;
        if (ok === true) { camada.aviso(dono.nome + ' aceitou o seu pedido de cópia. Copiando o quarto…', { tipo: 'ok', duracaoMs: 6000 }); return true; }
        camada.aviso(ok === false ? dono.nome + ' não autorizou copiar o quarto.' : dono.nome + ' não respondeu ao pedido.', { tipo: 'erro' });
        return false;
      }
      if (VL.comunidade && VL.comunidade.aoAcao) ctx.aoParar(VL.comunidade.aoAcao(receberCopia));
      else {
        // A Comunidade pode iniciar depois deste módulo: tenta de novo por um minuto.
        let tentativas = 0, parado = false;
        const tentar = function () { if (parado) return; if (VL.comunidade && VL.comunidade.aoAcao) ctx.aoParar(VL.comunidade.aoAcao(receberCopia)); else if (++tentativas < 60) setTimeout(tentar, 1000); };
        setTimeout(tentar, 1000);
        ctx.aoParar(function () { parado = true; });
      }
      function receberCopia(m) {
        if (!m || m.de !== 'sala' || m.tipo !== 'presenca:direto' || !m.dado || typeof m.dado !== 'object') return;
        const d = m.dado, nome = String(m.nome || '').slice(0, 40);
        const quarto = VL.pessoas && VL.pessoas.quartoAtual ? VL.pessoas.quartoAtual() : null;
        if (String(d.q) !== String(quarto) || !nome) return;
        if (d.t === 'copia:resposta') { const fn = esperasCopia.get(String(quarto)); if (fn) fn(d.ok === true); return; }
        if (d.t !== 'copia:pedido') return;
        const dono = VL.pessoas.quartoDono ? VL.pessoas.quartoDono() : null;
        if (!souDono(dono)) return; // só o dono responde
        const agora = Date.now();
        if (agora - (pedidosRecebidos.get(nome.toLowerCase()) || 0) < 10000) return;
        pedidosRecebidos.set(nome.toLowerCase(), agora);
        camada.confirmar(nome + ' quer copiar este quarto (' + (VL.pessoas.quartoNome() || 'seu quarto') + '). Com a cópia, ' + nome + ' pode montar um quarto igual com os mobis dele.', { titulo: 'Pedido para copiar o quarto', sim: 'Permitir', nao: 'Recusar' })
          .then(function (sim) { VL.comunidade.direto(nome, { t: 'copia:resposta', q: quarto, ok: sim }); });
      }
      async function copiarQuarto() {
        if (!conexao.disponivel()) { exigir(); return; }
        if (!mobis.size && !mobisParede.size) { camada.aviso('Nenhum mobi neste quarto para copiar.', { tipo: 'erro' }); return; }
        if (!(await pedirPermissaoCopia())) return;
        copiaQuarto = codigos.copiaDoQuarto([...mobis.values()], [...mobisParede.values()]);
        extrasCopia = {};
        // Floor: o mapa vem ao entrar no quarto; a porta é pedida agora (o editor de chão do jogo faz igual).
        if (planta) {
          const lPorta = await esperarMensagem(ENTRADA.PORTA, 2500, () => mandar(SAIDA.PEDIR_PORTA, []));
          const p = lPorta ? codigos.lerPorta(lPorta) : (porta || entrada);
          extrasCopia.planta = { mapa: planta.mapa, alturaParede: planta.alturaParede, parede: espessura ? espessura.parede : 0, piso: espessura ? espessura.piso : 0, porta: p || undefined, esconderParedes: espessura ? espessura.esconderParedes : undefined };
        }
        if (Object.keys(decoracao).length) extrasCopia.decoracao = Object.assign({}, decoracao);
        const dimmer = [...mobisParede.values()].find((m) => codigos.reguladorLigado(m.estado) != null);
        if (dimmer) {
          const lReg = await esperarMensagem(ENTRADA.REGULADOR, 2500, () => mandar(SAIDA.PEDIR_REGULADOR, []));
          if (lReg) extrasCopia.regulador = Object.assign(codigos.lerRegulador(lReg), { ligado: codigos.reguladorLigado(dimmer.estado) });
        }
        extrasCopia = codigos.validarExtrasQuarto(extrasCopia);
        guardarCopia();
        const partes = [copiaQuarto.length + ' mobis'];
        if (extrasCopia.planta) partes.push(extrasCopia.planta.porta ? 'floor com a porta' : 'floor (sem a porta: ao colar, o Vagalume escolhe um piso da borda)');
        if (extrasCopia.decoracao) partes.push('papel de parede, piso e paisagem');
        if (extrasCopia.regulador) partes.push('regulador de luz');
        camada.aviso('Cópia guardada: ' + partes.join(', ') + (incompleto ? ' (a lista do quarto pode estar incompleta)' : '') + '.'
          + (extrasCopia.planta ? '' : ' O floor não veio: saia e entre de novo no quarto e copie outra vez.'), { tipo: extrasCopia.planta ? 'ok' : 'erro', duracaoMs: 9000 });
        // Já oferece comprar o que falta no inventário para montar a cópia (pedido do usuário em 2026-11-22).
        comprarFaltasDaCopia(copiaQuarto, 'Para montar esta cópia, faltam {n} mobis no seu inventário (os que estão no quarto não contam).');
      }
      // Compra (uma confirmação, com preços) os mobis da cópia que não estão no inventário. Devolve true se comprou algo.
      // Devolve null (nada a comprar ou sem resposta), false (não comprou), true (comprou) ou 'cancelado'.
      // itensProntos evita ler o inventário de novo; opcoes vai para a loja (botão "Continuar sem esses mobis").
      async function comprarFaltasDaCopia(copia, motivo, itensProntos, opcoes) {
        if (!VL.loja || !VL.loja.comprarTipos) return false;
        const itens = itensProntos || await pedirInventario();
        if (!itens) return null;
        const faltam = codigos.planoDeColagem(copia, itens).faltam;
        const n = [...faltam.values()].reduce((s, q) => s + q, 0);
        if (!n) return null;
        const compra = await VL.loja.comprarTipos([...faltam].map(([tipo, quantidade]) => ({ tipo, quantidade })), motivo.replace('{n}', n), opcoes);
        if (compra && compra.cancelado) return 'cancelado';
        return !!(compra && compra.feitas);
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
      // Na primeira rodada vão até 3 de uma vez quando têm a mesma altura e o mesmo estado (o hotel aceitou 3
      // seguidos no /pickitem); nas outras, um por vez.
      // opcoes.sair(): para no meio (pedido do usuário em 2026-11-22: a colagem seguia no quarto de referência
      // depois que ele saiu). opcoes.mapa(): floor atual, para descobrir se a altura fixa da ferramenta conta a
      // partir do piso (em piso alto) e descontar a altura do piso. Sem nenhum mobi aceito nos 12 primeiros
      // pedidos, para (sem direitos no quarto).
      let estadosDiferentes = 0; // da última colocarLista: mobis no lugar certo mas com outro estado
      let paradaLista = null;    // da última colocarLista: 'saiu', 'recusado', 'limite' ou 'travou'
      let avisoLista = '';       // último aviso do hotel durante a última colocarLista
      // Sem nenhum mobi confirmado por esse tempo, o hotel parou de aceitar (vídeo do usuário em 2026-11-22:
      // "travou" em 570 de 987 e seguia tentando sem avisar).
      const SEM_AVANCO_MS = 45000;
      async function colocarLista(todos, opcoes) {
        const sair = (opcoes && opcoes.sair) || (() => false);
        const mapaAtual = (opcoes && opcoes.mapa) || (() => planta && planta.mapa);
        paradaLista = null;
        avisoLista = '';
        const jaNoQuarto = (opcoes && opcoes.jaNoQuarto) || new Set();
        const paredes = todos.filter((m) => m.parede);
        const colocar = todos.filter((m) => !m.parede);
        const certo = (m, lido) => lido.x === m.x && lido.y === m.y && Math.abs(lido.altura - (m.altura || 0)) < 0.01;
        const colocados = new Set(jaNoQuarto); // corrigidos no lugar: não se coloca de novo, só se move
        const prontos = new Set();
        const estadoCerto = new Set(); // ids com o estado da referência (ou sem estado para conferir)
        for (const m of colocar) if (codigos.estadoNumero(m.estado) == null) estadoCerto.add(m.itemId);
        // Se o hotel não fixar o estado em nenhum dos 5 primeiros, para de esperar por ele (não atrasa o resto).
        let tentouEstado = 0, acertouEstado = 0;
        const estadoOk = (id) => estadoCerto.has(id) || (tentouEstado >= 5 && !acertouEstado);
        const conferirEstado = (id, estado) => { const m = alvos.get(id); if (m && codigos.estadoNumero(estado) === codigos.estadoNumero(m.estado)) estadoCerto.add(id); };
        // Altura fixa absoluta (o normal) ou contada a partir do piso: decide no primeiro mobi que pousa em piso alto.
        let aPartirDoPiso = null;
        const fixadoCom = new Map(); // id -> altura fixa quando o pedido saiu
        const alturaPiso = (m) => codigos.alturaDoPiso(mapaAtual(), m.x, m.y) || 0;
        const alvoFixo = (m) => (m.altura || 0) - (aPartirDoPiso ? alturaPiso(m) : 0);
        let acordar = null;
        let ultimoAvanco = Date.now();
        function ouvir(l, colocado) {
          let lido = null;
          try { lido = codigos.lerMobi(l, true); } catch (e) { return; }
          const m = alvos.get(lido.id);
          if (!m) return;
          if (colocado && !colocados.has(lido.id)) { colocados.add(lido.id); ultimoAvanco = Date.now(); }
          // Só pelo mover (que sempre usa a altura fixa) e conferindo a cada vez: ao colocar, o hotel pode
          // empilhar no topo e coincidir por acaso.
          const f = fixadoCom.get(lido.id);
          if (!colocado && f != null && alturaPiso(m) > 0) {
            if (Math.abs(lido.altura - f) < 0.01) aPartirDoPiso = false;
            else if (Math.abs(lido.altura - (f + alturaPiso(m))) < 0.01) aPartirDoPiso = true;
          }
          if (certo(m, lido) && !prontos.has(lido.id)) { prontos.add(lido.id); ultimoAvanco = Date.now(); }
          conferirEstado(lido.id, lido.estado);
          if (acordar) acordar();
        }
        const alvos = new Map(colocar.map((m) => [m.itemId, m]));
        const pararA = conexao.ouvir('entrada', ENTRADA.MOBI_COLOCADO, (l) => ouvir(l, true));
        const pararB = conexao.ouvir('entrada', ENTRADA.MOBI_ATUALIZADO, (l) => ouvir(l, false));
        const pararC = conexao.ouvir('entrada', ENTRADA.ESTADO_MOBI, function (l) {
          try { const id = Number(l.texto()); l.inteiro(); conferirEstado(id, l.texto()); } catch (e) { return; }
          if (acordar) acordar();
        });
        // Avisos do hotel no meio (limite de mobis, lugar não permitido…): o último vai para o resumo.
        const pararAvisos = [ENTRADA.ALERTA, ENTRADA.NOTIFICACAO, ENTRADA.ALERTA_SIMPLES].map((cod) => conexao.ouvir('entrada', cod, function (l) {
          let texto = '';
          try { const a = codigos.lerAlerta(cod, l); texto = a.texto; } catch (e) { return; }
          if (/max_furniture|limite m[aá]ximo de mobis/i.test(texto)) paradaLista = 'limite';
          avisoLista = codigos.motivoDoFloor(texto) || avisoLista;
        }));
        const aguardar = (feito, ms) => new Promise(function (r) { if (feito()) { r(); return; } acordar = () => { if (feito()) r(); }; setTimeout(r, ms || 700); }).then(() => { acordar = null; });
        const ordem = (a, b) => (a.altura || 0) - (b.altura || 0) || (codigos.estadoNumero(a.estado) ?? -1) - (codigos.estadoNumero(b.estado) ?? -1);
        let pedidos = 0, avisadoEm = Date.now();
        try {
          await comAlturasFixas(async function (fixar) {
            for (let rodada = 0; rodada < FOLGAS_COLOCAR.length; rodada++) {
              const folga = FOLGAS_COLOCAR[rodada];
              const fila = colocar.filter((m) => !prontos.has(m.itemId)).sort(ordem);
              if (!fila.length) break;
              while (fila.length) {
                if (!ctx.ativo('construcao') || sair()) { paradaLista = 'saiu'; return; }
                if (paradaLista === 'limite') return;
                if (Date.now() - ultimoAvanco > SEM_AVANCO_MS) { paradaLista = 'travou'; return; }
                const chave = (m) => alvoFixo(m) + '|' + codigos.estadoNumero(m.estado);
                const lote = [fila.shift()];
                while (rodada === 0 && lote.length < 3 && fila.length && chave(fila[0]) === chave(lote[0])) lote.push(fila.shift());
                const inicio = Date.now();
                if (!(await fixar(alvoFixo(lote[0]), lote[0].estado))) return;
                const novos = lote.filter((m) => !colocados.has(m.itemId));
                for (const m of novos) {
                  fixadoCom.set(m.itemId, alvoFixo(m));
                  if (!(await mandar(SAIDA.COLOCAR_MOBI, [['s', m.itemId + ' ' + m.x + ' ' + m.y + ' ' + m.direcao]]))) return;
                  pedidos++;
                }
                if (novos.length) await aguardar(() => novos.every((m) => colocados.has(m.itemId)), 700 + 200 * (novos.length - 1));
                if (pedidos >= 12 && !colocados.size) { paradaLista = 'recusado'; return; }
                // Já pousou na altura e no estado certos? Senão move no lugar com a altura e o estado fixos.
                const mover = lote.filter((m) => colocados.has(m.itemId) && (!prontos.has(m.itemId) || !estadoOk(m.itemId)));
                for (const m of mover) {
                  if (sair()) { paradaLista = 'saiu'; return; }
                  if (!(await fixar(alvoFixo(m), m.estado))) return;
                  fixadoCom.set(m.itemId, alvoFixo(m));
                  if (!(await mandar(SAIDA.MOVER_MOBI, [['i', m.itemId], ['i', m.x], ['i', m.y], ['i', m.direcao]]))) return;
                }
                if (mover.length) await aguardar(() => mover.every((m) => prontos.has(m.itemId) && estadoOk(m.itemId)), 700 + 200 * (mover.length - 1));
                for (const m of lote) if (codigos.estadoNumero(m.estado) != null && prontos.has(m.itemId)) { tentouEstado++; if (estadoCerto.has(m.itemId)) acertouEstado++; }
                const resto = folga * lote.length - (Date.now() - inicio);
                if (resto > 0) await esperar(resto);
                if (Date.now() - avisadoEm > 4000) {
                  avisadoEm = Date.now();
                  camada.aviso('Colando: ' + prontos.size + ' de ' + colocar.length + ' mobis' + (rodada ? ' (repetindo os que faltaram, ' + (rodada + 1) + 'ª de 3 voltas)' : '') + '. Fique neste quarto até terminar.'
                    + (avisoLista ? ' Último aviso do hotel: ' + avisoLista + '.' : ''), { duracaoMs: 4500 });
                }
              }
              await esperar(500); // confirmações atrasadas antes de decidir quem repete
            }
          });
        } finally { pararA(); pararB(); pararC(); pararAvisos.forEach((fn) => fn()); }
        estadosDiferentes = [...prontos].filter((id) => !estadoCerto.has(id)).length;
        if (paradaLista) return prontos.size;
        return prontos.size + (paredes.length && ctx.ativo('construcao') ? await colocarParede(paredes, sair) : 0);
      }
      // Mobis de parede: "id :w=x,y l=a,b r" no mesmo pacote de colocar; confere pelo 2187 e repete os que faltaram.
      async function colocarParede(lista, sair) {
        const feitos = new Set();
        let acordar = null;
        const parar = conexao.ouvir('entrada', ENTRADA.MOBI_PAREDE_COLOCADO, function (l) {
          try { feitos.add(codigos.lerMobiParede(l).id); } catch (e) { return; }
          if (acordar) acordar();
        });
        try {
          for (const folga of FOLGAS_COLOCAR) {
            const rodada = lista.filter((m) => !feitos.has(m.itemId));
            if (!rodada.length) break;
            for (const m of rodada) {
              if (!ctx.ativo('construcao')) return feitos.size;
              if (sair && sair()) { paradaLista = 'saiu'; return feitos.size; }
              const inicio = Date.now();
              if (!(await mandar(SAIDA.COLOCAR_MOBI, [['s', m.itemId + ' ' + m.local]]))) return feitos.size;
              await new Promise(function (r) { if (feitos.has(m.itemId)) { r(); return; } acordar = () => { if (feitos.has(m.itemId)) r(); }; setTimeout(r, 700); });
              acordar = null;
              const resto = folga - (Date.now() - inicio);
              if (resto > 0) await esperar(resto);
            }
            await esperar(500);
          }
        } finally { parar(); }
        return feitos.size;
      }
      // Floor do quarto copiado (codigos.plantaParaColar: o mapa e a porta dele, sem as bordas vazias). Se este
      // quarto já tem o mesmo chão, não manda nada. Senão salva como o editor de chão do jogo e espera o quarto
      // recarregar; um aviso do hotel nesse meio é recusa (o motivo vai para quem cola).
      // Devolve { ok, igual, deslocar, largura, altura, portaOriginal, motivo }.
      // Aviso do hotel que é recusa do floor (a de tamanho veio assim: "O modelo que você está tentando criar é
      // muito grande!"). Notificação de lista só quando é do editor de chão, para não confundir com a de compra.
      const recusaDoFloor = (cod, a) => cod === ENTRADA.NOTIFICACAO ? /floor/i.test(a.tipo + ' ' + a.texto) : /floor|modelo|model|quadrad|tamanho|grande|porta|entrada|permiss/i.test(a.texto);
      async function aplicarPlanta(p) {
        const alvo = codigos.plantaParaColar(p, (copiaQuarto || []).filter((m) => !m.parede).map((m) => [m.x, m.y]));
        if (!alvo) return { ok: false, motivo: 'o floor da cópia não tem piso' };
        const r = { ok: false, igual: false, largura: alvo.largura, altura: alvo.altura, deslocar: alvo.deslocar, portaOriginal: alvo.portaOriginal };
        const atual = planta ? codigos.plantaParaColar({ mapa: planta.mapa }, []) : null;
        if (atual && atual.mapa === alvo.mapa && espessura && espessura.parede === p.parede && espessura.piso === p.piso && planta.alturaParede === p.alturaParede) {
          // Mesmo chão (colagem repetida): as posições seguem o recorte deste quarto.
          return Object.assign(r, { ok: true, igual: true, deslocar: { x: alvo.deslocar.x - atual.deslocar.x, y: alvo.deslocar.y - atual.deslocar.y } });
        }
        const pronto = esperarMensagem(ENTRADA.QUARTO_PRONTO, 15000);
        const mobisChegaram = esperarMensagem(ENTRADA.MOBIS_DO_QUARTO, 20000);
        let avisarRecusa = null;
        const recusa = new Promise((res) => { avisarRecusa = res; });
        const pararAvisos = [ENTRADA.ALERTA, ENTRADA.NOTIFICACAO, ENTRADA.ALERTA_SIMPLES].map((cod) => conexao.ouvir('entrada', cod, function (l) {
          try {
            const a = codigos.lerAlerta(cod, l);
            if (recusaDoFloor(cod, a)) avisarRecusa(codigos.motivoDoFloor(a.texto) || 'o hotel recusou');
          } catch (e) { /* aviso em outro formato */ }
        }));
        try {
          if (!(await mandar(SAIDA.SALVAR_PLANTA, [['s', alvo.mapa], ['i', alvo.porta.x], ['i', alvo.porta.y], ['i', alvo.porta.direcao], ['i', p.parede], ['i', p.piso], ['i', p.alturaParede]]))) return Object.assign(r, { motivo: 'não deu para mandar ao jogo' });
          const chegou = pronto.then((l) => (l ? 'pronto' : 'tempo'));
          let fim = await Promise.race([chegou, recusa]);
          // Um aviso de outra coisa no meio não pode desfazer um floor aceito: o quarto recarregando ganha.
          if (fim !== 'pronto' && fim !== 'tempo') {
            const motivo = fim;
            fim = await Promise.race([chegou.then((x) => (x === 'pronto' ? x : motivo)), esperar(2000).then(() => motivo)]);
          }
          if (fim !== 'pronto') return Object.assign(r, { motivo: fim === 'tempo' ? 'o hotel não respondeu (o quarto é seu?)' : fim });
        } finally { pararAvisos.forEach((fn) => fn()); }
        await Promise.race([mobisChegaram, esperar(4000)]); // a lista de mobis do quarto recarregado
        await esperar(300);
        r.ok = true;
        return r;
      }
      function deslocarSeMesmoFloor(p) {
        const alvo = codigos.plantaParaColar(p, []);
        const atual = planta ? codigos.plantaParaColar({ mapa: planta.mapa }, []) : null;
        if (!alvo || !atual || atual.mapa !== alvo.mapa) return null;
        return { x: alvo.deslocar.x - atual.deslocar.x, y: alvo.deslocar.y - atual.deslocar.y };
      }
      // Esvazia o quarto antes de colar (Ctrl+V de verdade): o :pickall do jogo recolhe tudo para o inventário do
      // dono. Espera a lista de mobis zerar (para de esperar com 3 s sem mudança). Devolve quantos ficaram.
      async function esvaziarQuarto(sair) {
        const total = () => mobis.size + mobisParede.size;
        if (!total()) return 0;
        if (!(await mandar(SAIDA.FALAR, [['s', ':pickall'], ['i', 0]]))) return total();
        let antes = total(), parado = 0;
        for (let t = 0; t < 120 && total() && !sair(); t++) {
          await esperar(500);
          if (total() !== antes) { antes = total(); parado = 0; } else if (++parado >= 6) break;
        }
        await esperar(400);
        return total();
      }
      // Toner de fundo e imagem de fundo: depois de colocados, recebem a cor e os dados da cópia.
      async function aplicarDadosEspeciais(lista, sair) {
        let n = 0;
        for (const m of lista) {
          if (sair()) break;
          if (!mobis.has(m.itemId)) continue;
          if (m.numeros && m.numeros.length >= 4 && m.numeros.slice(1, 4).every((v) => v >= 0 && v <= 255)) {
            const [ligado, matiz, saturacao, claridade] = m.numeros;
            await mandar(SAIDA.TONALIZADOR, [['i', m.itemId], ['i', matiz], ['i', saturacao], ['i', claridade]]);
            await esperar(700);
            const agora = mobis.get(m.itemId);
            if (agora && (ligado === 0 || ligado === 1) && codigos.estadoNumero(agora.estado) !== ligado) await mandar(SAIDA.USAR_MOBI, [['i', m.itemId], ['i', 0]]);
            n++;
          } else if (m.mapa) {
            const pares = Object.entries(m.mapa);
            const campos = [['i', m.itemId], ['i', pares.length * 2]];
            for (const [k, v] of pares) campos.push(['s', k], ['s', v]);
            await mandar(SAIDA.DADOS_OBJETO, campos);
            await esperar(250);
            n++;
          }
        }
        return n;
      }
      // Compara o quarto atual com a cópia (pedido do usuário em 2026-11-22: "poderia revisar?").
      let ultimaCopiaColada = null;
      async function mostrarConferencia(copia) {
        const r = codigos.conferirCopia(copia, [...mobis.values()], [...mobisParede.values()]);
        let dados = null;
        try { if (VL.dadosJogo) dados = await VL.dadosJogo.mobis(); } catch (e) { /* sem nomes */ }
        const nome = (tipo) => { const f = dados && (dados.chao.get(tipo) || dados.parede.get(tipo)); return (f && f.nome) || 'tipo ' + tipo; };
        const raro = (tipo) => { const f = dados && (dados.chao.get(tipo) || dados.parede.get(tipo)); return !!f && codigos.mobiRaro(f.classe, f.nome); };
        const resumo = (lista) => {
          const n = new Map();
          for (const t of lista) n.set(t, (n.get(t) || 0) + 1);
          return [...n].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, q]) => q + '× ' + nome(t)).join(', ') + (n.size > 8 ? '…' : '');
        };
        const totalChao = copia.filter((m) => !m.parede).length;
        const linhas = [
          r.certos + ' de ' + totalChao + ' mobis do chão iguais à cópia.',
          r.parede.certos + ' de ' + copia.filter((m) => m.parede).length + ' mobis de parede no lugar.',
        ];
        const faltaRaro = r.faltando.filter(raro), faltaOutro = r.faltando.filter((t) => !raro(t));
        if (faltaOutro.length) linhas.push('Faltando (' + faltaOutro.length + '): ' + resumo(faltaOutro));
        if (faltaRaro.length) linhas.push('Raros e LTD que não estavam no seu inventário (' + faltaRaro.length + '): ' + resumo(faltaRaro));
        if (r.altura.length) linhas.push('Altura diferente (' + r.altura.length + '): ' + resumo(r.altura));
        if (r.estado.length) linhas.push('Estado diferente (' + r.estado.length + '): ' + resumo(r.estado));
        if (r.parede.faltando.length) linhas.push('Parede faltando (' + r.parede.faltando.length + '): ' + resumo(r.parede.faltando));
        if (extrasCopia.planta) {
          const esperado = codigos.plantaParaColar(extrasCopia.planta, []);
          const atual = planta ? codigos.plantaParaColar({ mapa: planta.mapa }, []) : null;
          const tira = (p) => p ? p.mapa.split('\r').map((l) => l.replace(/X/g, 'x')) : [];
          const a = tira(atual), e = tira(esperado);
          let diferentes = 0;
          for (let y = 0; y < Math.max(a.length, e.length); y++) for (let x = 0; x < Math.max((a[y] || '').length, (e[y] || '').length); x++) if (((a[y] || '')[x] || 'x') !== ((e[y] || '')[x] || 'x')) diferentes++;
          linhas.push(!diferentes ? 'Floor igual ao da cópia.' : 'Floor diferente da cópia em ' + diferentes + ' pisos (o floor não foi aplicado ou o hotel mudou algo).');
          if (extrasCopia.planta.esconderParedes && espessura && !espessura.esconderParedes) linhas.push('No quarto copiado as paredes estão escondidas pela opção “Esconder paredes” das configurações do quarto. Aqui elas aparecem: para ficar igual, marque essa opção nas configurações deste quarto.');
        }
        await camada.dialogo({ titulo: 'Conferência do quarto colado', conteudo: el('div', null, linhas.map((t) => el('p', { style: 'margin:0 0 8px', texto: t }))),
          botoes: [{ rotulo: 'Fechar', valor: true, destaque: true, foco: true }] });
      }
      // Papel de parede, piso e paisagem: usa um item do inventário com a mesma estampa (compra se faltar).
      async function aplicarDecoracao(d, sair) {
        const feitos = [], faltaram = [];
        const NOMES = { wallpaper: 'papel de parede', floor: 'piso', landscape: 'paisagem' };
        for (const tipo of Object.keys(d)) {
          if (sair && sair()) break;
          if (decoracao[tipo] === d[tipo]) { feitos.push(NOMES[tipo]); continue; }
          const classe = codigos.CLASSE_DECORACAO[tipo];
          const achar = (itens) => (itens || []).find((i) => !i.chao && i.classe === classe && String(i.estado) === d[tipo]);
          let item = achar(await pedirInventario());
          if (!item && VL.loja && VL.loja.comprarDecoracao && (await VL.loja.comprarDecoracao(classe, d[tipo]))) {
            for (let i = 0; i < 3 && !item; i++) { await esperar(400); item = achar(await pedirInventario()); }
          }
          if (!item) { faltaram.push(NOMES[tipo] + ' ' + d[tipo]); continue; }
          if (sair && sair()) break;
          const aplicado = esperarMensagem(ENTRADA.DECORACAO, 3000);
          await mandar(SAIDA.APLICAR_DECORACAO, [['i', item.id]]);
          if (await aplicado) feitos.push(NOMES[tipo]); else faltaram.push(NOMES[tipo] + ' ' + d[tipo]);
        }
        return { feitos, faltaram };
      }
      // Regulador de luz: grava os efeitos da cópia (o selecionado por último, aplicando) e liga ou desliga.
      async function aplicarRegulador(r, sair) {
        const achar = () => [...mobisParede.values()].find((m) => codigos.reguladorLigado(m.estado) != null);
        if (!achar()) return false;
        const efeitos = r.efeitos.slice().sort((a, b) => (a.id === r.selecionado) - (b.id === r.selecionado));
        for (const e of efeitos) {
          if (sair && sair()) return false;
          await mandar(SAIDA.SALVAR_REGULADOR, [['i', e.id], ['i', e.tipo], ['s', e.cor], ['i', e.brilho], ['b', e.id === r.selecionado]]);
          await esperar(400);
        }
        await esperar(800);
        const dimmer = achar();
        if (dimmer && codigos.reguladorLigado(dimmer.estado) !== r.ligado) await mandar(SAIDA.LIGAR_REGULADOR, []);
        return true;
      }
      async function colarQuarto() {
        if (!conexao.disponivel()) { exigir(); return; }
        if (!copiaQuarto) { camada.aviso('Copie ou importe um quarto primeiro.', { tipo: 'erro' }); return; }
        if (colando || trabalhando) { camada.aviso('Espere a tarefa anterior terminar.'); return; }
        colando = true;
        try {
          // O que colar (só aparecem as partes que a cópia tem).
          const noQuarto = mobis.size + mobisParede.size;
          // Colagem que parou no meio: se metade ou mais do que está aqui já é da cópia (no mesmo floor), o padrão
          // é continuar, colocando só o que falta, em vez de recolher tudo.
          const mesmoFloor = extrasCopia.planta ? deslocarSeMesmoFloor(extrasCopia.planta) : { x: 0, y: 0 };
          const jaNoLugar = noQuarto && mesmoFloor ? copiaQuarto.length - codigos.faltandoNoQuarto(codigos.deslocarCopia(copiaQuarto, mesmoFloor), [...mobis.values()], [...mobisParede.values()]).length : 0;
          const continuar = noQuarto > 0 && jaNoLugar >= noQuarto * 0.5;
          const partes = [['mobis', 'Mobis do chão e da parede', true]];
          if (extrasCopia.planta) partes.unshift(['planta', 'Floor igual ao do quarto copiado, com a mesma porta (o quarto recarrega)', true]);
          if (noQuarto) partes.unshift(['esvaziar', continuar
            ? 'Recolher antes os ' + noQuarto + ' mobis deste quarto e colar tudo de novo (desmarcado: continua a colagem, ' + jaNoLugar + ' mobis da cópia já estão no lugar e só entra o que falta)'
            : 'Recolher antes os ' + noQuarto + ' mobis que já estão neste quarto: vão para o seu inventário e entram na colagem (a arrumação atual deste quarto se perde)', !continuar]);
          if (extrasCopia.decoracao) partes.push(['decoracao', 'Papel de parede, piso e paisagem', true]);
          if (extrasCopia.regulador) partes.push(['regulador', 'Configuração do regulador de luz', true]);
          const marcas = {};
          {
            const caixas = partes.map(function ([id, rotulo, ligado]) {
              const c = el('input', { type: 'checkbox', checked: ligado });
              marcas[id] = c;
              return el('label', { style: 'display:flex;gap:8px;align-items:center;margin:6px 0' }, [c, rotulo]);
            });
            const ok = await camada.dialogo({ titulo: 'Colar quarto', texto: 'O que colar neste quarto? Funciona em quarto seu. Antes de começar, aparecem os mobis que faltam no inventário. Fique no quarto até terminar.', conteudo: el('div', null, caixas),
              botoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Colar', valor: true, destaque: true, foco: true }] });
            if (!ok) return;
          }
          const quer = (id) => !marcas[id] || marcas[id].checked;
          // Tudo para se a pessoa trocar de quarto (o recarregar do floor mantém o mesmo quarto).
          const sala = VL.pessoas ? VL.pessoas.quartoAtual() : null;
          const sair = () => !ctx.ativo('construcao') || (sala != null && VL.pessoas.quartoAtual() !== sala);
          const parou = () => camada.aviso('Colagem parada: você saiu do quarto. Volte para ele e use Colar quarto de novo (com "Recolher antes" marcado).', { tipo: 'erro', duracaoMs: 12000 });
          const resumo = [];
          let recolheu = false;
          if (noQuarto && quer('esvaziar')) {
            camada.aviso('Recolhendo os mobis deste quarto…', { duracaoMs: 3000 });
            const ficaram = await esvaziarQuarto(sair);
            if (sair()) { parou(); return; }
            recolheu = ficaram < noQuarto;
            if (ficaram && !(await camada.confirmar(ficaram + ' mobis continuam neste quarto (o jogo só deixa o dono recolher tudo). Colar mesmo assim, com eles no quarto?', { titulo: 'Colar quarto', sim: 'Colar mesmo assim' }))) return;
          }
          let copia = copiaQuarto; // com o floor aplicado, as posições seguem o recorte do mapa
          // Sem recolher, o que já está no lugar fica de fora da compra e da colagem.
          const doQuarto = () => [[...mobis.values()], [...mobisParede.values()]];
          const pular = (c) => (recolheu || !(mobis.size + mobisParede.size) ? c : codigos.faltandoNoQuarto(c, ...doQuarto()));
          // Compra antes do floor (pedido do usuário: a janela demorava a aparecer depois do floor): o
          // inventário é lido uma vez agora e reaproveitado se nada for comprado.
          let itens = null, comprou = false;
          if (quer('mobis')) {
            camada.aviso('Conferindo o inventário…', { duracaoMs: 2500 });
            itens = await pedirInventario();
            // O que acabou de ser recolhido pode demorar a aparecer no inventário: lê de novo enquanto aumenta,
            // para não oferecer a compra de algo que está voltando.
            for (let i = 0; recolheu && itens && i < 4; i++) {
              await esperar(1000);
              const novos = await pedirInventario();
              if (!novos || novos.length <= itens.length) break;
              itens = novos;
            }
            if (!itens) { camada.aviso('O inventário não respondeu.', { tipo: 'erro' }); return; }
            const c = await comprarFaltasDaCopia(mesmoFloor ? pular(codigos.deslocarCopia(copiaQuarto, mesmoFloor)) : copiaQuarto, 'Faltam {n} mobis no seu inventário para colar o quarto inteiro.', itens, { pular: 'Continuar sem esses mobis' });
            if (c === 'cancelado') { camada.aviso('Colagem cancelada.'); return; }
            comprou = c === true;
          }
          if (sair()) { parou(); return; }
          if (extrasCopia.planta && quer('planta')) {
            camada.aviso('Aplicando o floor do quarto copiado…', { duracaoMs: 4000 });
            const r = await aplicarPlanta(extrasCopia.planta);
            if (sair()) { parou(); return; }
            const tam = r.largura ? ' (' + r.largura + ' × ' + r.altura + ' pisos)' : '';
            if (r.ok) {
              copia = codigos.deslocarCopia(copiaQuarto, r.deslocar);
              resumo.push(r.igual ? 'o floor já era igual' : 'floor aplicado' + tam + (r.portaOriginal ? '' : ', com a porta num piso da borda (a cópia não tinha a porta)'));
            } else if (!quer('mobis')) resumo.push('o floor' + tam + ' não foi aplicado: ' + r.motivo);
            else if (!(await camada.confirmar('O floor' + tam + ' não foi aplicado: ' + r.motivo + '. Sem ele, os mobis vão para o chão que este quarto tem agora e podem ficar fora do lugar. Colar os mobis mesmo assim?', { titulo: 'Colar quarto', sim: 'Colar mesmo assim', nao: 'Parar' }))) {
              camada.aviso('Colagem parada antes dos mobis.');
              return;
            } else resumo.push('o floor não foi aplicado (' + r.motivo + ')');
          }
          async function decoracaoERegulador() {
            if (sair()) return;
            if (extrasCopia.decoracao && quer('decoracao')) {
              const r = await aplicarDecoracao(extrasCopia.decoracao, sair);
              if (r.feitos.length) resumo.push(r.feitos.join(', ') + ' ok');
              if (r.faltaram.length) resumo.push('sem ' + r.faltaram.join(', ') + ' (não achei no inventário nem na loja)');
            }
            if (extrasCopia.regulador && quer('regulador') && !sair()) resumo.push((await aplicarRegulador(extrasCopia.regulador, sair)) ? 'regulador configurado' : 'sem regulador de luz no quarto');
          }
          if (!quer('mobis')) {
            await decoracaoERegulador();
            if (sair()) { parou(); return; }
            camada.aviso('Pronto: ' + resumo.join('; ') + '.', { duracaoMs: 10000 });
            return;
          }
          // Depois de comprar ou recolher, o inventário pode demorar a mostrar os itens: lê de novo até 3 vezes.
          const continuacao = recolheu || !(mobis.size + mobisParede.size) ? { faltam: copia, corrigir: [] } : codigos.planoContinuar(copia, ...doQuarto());
          const paraColocar = continuacao.faltam, corrigir = continuacao.corrigir;
          const iguais = copia.length - paraColocar.length - corrigir.length;
          if (iguais) resumo.push(iguais + ' já estavam no lugar');
          if (corrigir.length) resumo.push(corrigir.length + ' que já estavam no quarto foram acertados no lugar');
          if (!paraColocar.length && !corrigir.length) {
            await decoracaoERegulador();
            camada.aviso('Pronto: todos os mobis da cópia já estão no lugar' + (resumo.length ? '; ' + resumo.join('; ') : '') + '.', { tipo: 'ok', duracaoMs: 10000 });
            return;
          }
          let plano = codigos.planoDeColagem(paraColocar, itens);
          for (let i = 0; comprou && i < 3; i++) {
            const novos = await pedirInventario();
            if (novos) { itens = novos; plano = codigos.planoDeColagem(paraColocar, itens); }
            if (!plano.faltam.size) break;
            await esperar(400);
          }
          const faltam = [...plano.faltam.values()].reduce((s, n) => s + n, 0);
          if (!plano.colocar.length && !corrigir.length) { camada.aviso('Nenhum dos mobis que faltam está no seu inventário.', { tipo: 'erro' }); return; }
          if (sair()) { parou(); return; }
          camada.aviso('Colocando ' + plano.colocar.length + ' mobis' + (corrigir.length ? ' e acertando ' + corrigir.length : '') + (faltam ? ' (' + faltam + ' ficam de fora)' : '') + '. Fique neste quarto até terminar.', { duracaoMs: 5000 });
          const feitos = await colocarLista(plano.colocar.concat(corrigir), { sair, mapa: () => planta && planta.mapa, jaNoQuarto: new Set(corrigir.map((c) => c.itemId)) });
          if (paradaLista === 'saiu') { parou(); return; }
          if (paradaLista === 'recusado') {
            const ja = mobis.size + mobisParede.size;
            camada.aviso('O hotel não aceitou nenhum dos mobis que faltam' + (avisoLista ? ' (aviso dele: ' + avisoLista + ')' : ', sem mandar aviso') + '. A colagem parou. '
              + (ja ? 'Este quarto já tem ' + ja + ' mobis: pode ser o limite de mobis por quarto. Coloque um mobi à mão pelo inventário para ver a mensagem do jogo.' : 'Você é o dono ou tem direitos aqui?'), { tipo: 'erro', duracaoMs: 15000 });
            return;
          }
          if (paradaLista === 'limite' || paradaLista === 'travou') {
            ultimaCopiaColada = copia;
            setTimeout(function () { if (ctx.ativo('construcao')) mostrarConferencia(copia); }, 1500);
            camada.aviso((paradaLista === 'limite' ? 'O quarto chegou ao limite de mobis do hotel: ' : 'O hotel parou de aceitar os mobis (nada novo em 45 s): ')
              + feitos + ' de ' + (plano.colocar.length + corrigir.length) + ' colocados.' + (avisoLista && paradaLista !== 'limite' ? ' Último aviso do hotel: ' + avisoLista + '.' : '')
              + ' Para continuar, use Colar quarto de novo sem marcar "Recolher antes": só entra o que falta.', { tipo: 'erro', duracaoMs: 15000 });
            return;
          }
          const especiais = await aplicarDadosEspeciais(plano.colocar, sair);
          if (especiais) resumo.push(especiais + (especiais === 1 ? ' mobi com cor ou imagem de fundo configurado' : ' mobis com cor ou imagem de fundo configurados'));
          await decoracaoERegulador();
          if (sair()) { parou(); return; }
          ultimaCopiaColada = copia;
          setTimeout(function () { if (ctx.ativo('construcao')) mostrarConferencia(copia); }, 1500);
          camada.aviso('Pronto: ' + feitos + ' mobis colocados' + (resumo.length ? '; ' + resumo.join('; ') : '') + '.' + (estadosDiferentes ? ' ' + estadosDiferentes + ' ficaram com o estado diferente da cópia (o hotel não aceitou fixar).' : ''), { tipo: estadosDiferentes ? 'erro' : 'ok', duracaoMs: 10000 });
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
        nome: 'conferirquarto',
        uso: 'conferirquarto',
        descricao: 'Compara este quarto com a cópia guardada: mobis faltando, altura e estado diferentes, mobis de parede e floor.',
        executar() {
          if (!copiaQuarto) { camada.aviso('Copie ou importe um quarto primeiro.', { tipo: 'erro' }); return; }
          mostrarConferencia(ultimaCopiaColada || copiaQuarto);
        },
      });
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
      let lotesProprios = 0; // colocar e mover em lote do Vagalume (colar, preencher, espelho): o espelho não os repete
      async function comAlturasFixas(fn, opcoes) {
        const contar = !(opcoes && opcoes.contar === false);
        if (contar) lotesProprios++;
        try { return await comAlturasFixasDentro(fn, opcoes); } finally { if (contar) lotesProprios--; }
      }
      async function comAlturasFixasDentro(fn, opcoes) {
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
        let estadoAtual = null;
        try {
          if (opcoes && opcoes.semAltura) {
            // Sem altura fixa: o jogo empilha no topo do piso. Desliga também os modos automáticos.
            const livres = fixos.slice(); livres[0] = false;
            if (!(await enviarAjustes(livres))) return;
          }
          await fn(async function (altura, estado) {
            const z = codigos.alturaDoMobi(altura);
            if (z == null) throw new Error('Altura do mobi fora do limite aceito pelo hotel.');
            // Estado fixo (campos 4 e 5 da ferramenta do jogo, como o "Estado" do pincel): vale ao colocar e mover.
            const e = codigos.estadoNumero(estado);
            if (alturaAtual === z && estadoAtual === e) return true;
            fixos[1] = Math.round(z * 100);
            fixos[4] = e != null;
            fixos[5] = e != null ? e : anteriores[5];
            if (!(await enviarAjustes(fixos))) return false;
            alturaAtual = z;
            estadoAtual = e;
            await esperar(90);
            return true;
          });
        } finally {
          await enviarAjustes(anteriores);
        }
      }
      async function moverLista(plano, manterAltura, opcoesLote) {
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
          }, opcoesLote);
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
      // ---------- modo espelho (sugestão de usuários do Habblet em 2026-11-22) ----------
      // Com o modo ligado, o que você coloca pelo jogo ganha um par do outro lado da linha (outro mobi igual do
      // inventário, mesma altura, direção espelhada); mover, girar ou recolher um dos dois faz o mesmo no par.
      // A linha passa pelo piso onde o seu avatar está ao ligar. Mobis que já estavam no quarto não têm par.
      let espelho = null;                 // { eixo: 'vertical' | 'horizontal', centro: { x, y } }
      const pares = new Map();            // id -> id do par
      const doEspelho = new Set();        // ids que o próprio espelho mandou (não espelhar de volta)
      const colocadosPeloJogo = new Set();
      const movidosPeloJogo = new Set();
      async function tamanhoDe(tipo) {
        try { const d = VL.dadosJogo && (await VL.dadosJogo.mobis()).chao.get(tipo); if (d) return [d.largura || 1, d.comprimento || 1]; } catch (e) { /* sem o arquivo: 1 × 1 */ }
        return [1, 1];
      }
      function mostrarGuia() { if (ferramenta && ferramenta.definirGuia) ferramenta.definirGuia(espelho && planta ? codigos.pisosDaLinha(planta.mapa, espelho.eixo, espelho.centro) : []); }
      // Linha pelo meio do chão do quarto (como a guia do Photoshop) ou, se pedido, pelo piso onde o avatar está.
      const NOMES_ESPELHO = { x: 'paralela à parede da esquerda', y: 'paralela à parede da direita', vertical: 'vertical na tela', horizontal: 'horizontal na tela' };
      function ligarEspelho(eixo, ondeEstou, pisoEscolhido) {
        if (!NOMES_ESPELHO[eixo]) eixo = 'x';
        const eu = !pisoEscolhido && ondeEstou && VL.pessoas && VL.pessoas.meuIndice() != null ? VL.pessoas.posicaoDe(VL.pessoas.meuIndice()) : null;
        let centro = pisoEscolhido ? { x: pisoEscolhido.x, y: pisoEscolhido.y } : eu ? { x: eu.x, y: eu.y } : (planta ? codigos.meioDoFloor(planta.mapa) : null);
        if (!centro) { camada.aviso('Entre num quarto seu para usar o modo espelho.', { tipo: 'erro' }); return; }
        // As linhas da tela precisam passar por um piso inteiro.
        if (eixo === 'vertical' || eixo === 'horizontal') centro = { x: Math.round(centro.x), y: Math.round(centro.y) };
        espelho = { eixo, centro };
        pares.clear();
        mostrarGuia();
        atualizarModo();
        camada.aviso('Espelho ligado: linha ' + NOMES_ESPELHO[eixo] + (pisoEscolhido ? ', pelo piso que você clicou' : eu ? ', pelo piso onde você está' : ', no meio do quarto') + ' (a guia azul no chão). O que você colocar, mover, girar ou recolher de um lado aparece do outro, com outro mobi igual do inventário.' + (ondeEstou && !eu ? ' Não achei onde você está; usei o meio do quarto.' : ''), { tipo: 'ok', duracaoMs: 10000 });
      }
      // Escolher a linha com um clique no chão: a guia acompanha o mouse; Esc deixa no meio do quarto.
      function posicionarLinha(eixo) {
        const ok = ferramenta && ferramenta.escolherPiso && planta && ferramenta.escolherPiso(function (p) {
          ligarEspelho(eixo, false, p);
        }, function (p) { ferramenta.definirGuia(codigos.pisosDaLinha(planta.mapa, eixo, p)); });
        if (ok) camada.aviso('Clique no piso por onde a linha vai passar: a guia azul acompanha o mouse. Esc deixa a linha no meio do quarto.', { duracaoMs: 8000 });
        else { camada.aviso('Para escolher clicando, clique antes num piso livre do quarto (o Vagalume aprende onde fica o chão). Por enquanto, a linha fica no meio do quarto.'); ligarEspelho(eixo); }
      }
      function desligarEspelho(motivo) {
        if (!espelho) return;
        espelho = null;
        pares.clear();
        mostrarGuia();
        atualizarModo();
        camada.aviso(motivo || 'Modo espelho desligado.');
      }
      async function escolherEspelho() {
        if (!conexao.disponivel()) { exigir(); return; }
        const opcoes = [['x', 'Paralela à parede da esquerda', 'divide o quarto entre o lado da parede esquerda e o lado da frente'],
          ['y', 'Paralela à parede da direita', 'divide o quarto entre o lado da parede direita e o lado da frente'],
          ['vertical', 'Vertical na tela', 'esquerda e direita da tela (bom em quarto quadrado)'],
          ['horizontal', 'Horizontal na tela', 'cima e baixo da tela (bom em quarto quadrado)']];
        const atual = espelho ? espelho.eixo : 'x';
        const radios = {};
        const linhas = opcoes.map(function ([id, titulo, nota]) {
          const r = el('input', { type: 'radio', name: 'vl-espelho-eixo', checked: id === atual });
          radios[id] = r;
          return el('label', { style: 'display:flex;gap:8px;align-items:flex-start;margin:6px 0' }, [r, el('span', null, [el('b', { texto: titulo }), el('br'), el('small', { texto: nota })])]);
        });
        const clicar = el('input', { type: 'radio', name: 'vl-espelho-lugar', checked: true });
        const meio = el('input', { type: 'radio', name: 'vl-espelho-lugar' });
        linhas.push(el('p', { style: 'margin:12px 0 2px', texto: 'Onde fica a linha:' }));
        linhas.push(el('label', { style: 'display:flex;gap:8px;align-items:center;margin:4px 0' }, [clicar, 'Escolher clicando no chão (a guia acompanha o mouse)']));
        linhas.push(el('label', { style: 'display:flex;gap:8px;align-items:center;margin:4px 0' }, [meio, 'No meio do quarto']));
        const valor = await camada.dialogo({ titulo: 'Modo espelho', texto: 'Com o modo ligado, o que você colocar, mover, girar ou recolher de um lado da linha aparece do outro lado, com outro mobi igual do seu inventário. Mobis em cima da linha não têm outro lado.', conteudo: el('div', null, linhas),
          botoes: [{ rotulo: espelho ? 'Desligar' : 'Cancelar', valor: espelho ? 'desligar' : false }, { rotulo: 'Ligar', valor: 'ligar', destaque: true, foco: true }] });
        if (valor === 'desligar') desligarEspelho();
        else if (valor === 'ligar') {
          const eixo = (Object.keys(radios).find((k) => radios[k].checked)) || 'x';
          if (clicar.checked) posicionarLinha(eixo); else ligarEspelho(eixo);
        }
      }
      // Fila do espelho (pedido do usuário em 2026-11-22: colocando rápido, o outro lado não acompanhava). O que chega
      // enquanto a fila trabalha entra na próxima volta, tudo junto. O par sai como o jogo manda (sem mexer na
      // ferramenta de construção, que vale para os dois lados); se pousar em outra altura, é acertado depois.
      const pendColocar = [], pendMover = new Map();
      let drenando = false;
      let estoque = null, estoqueFresco = false; // tipo -> ids de chão do inventário
      async function tirarDoEstoque(tipo, fonte) {
        const livre = (id) => id !== fonte && !mobis.has(id) && !doEspelho.has(id);
        let ids = estoque && estoque.get(tipo);
        if ((!ids || !ids.some(livre)) && !estoqueFresco) {
          estoqueFresco = true;
          const itens = await pedirInventario();
          if (itens) { estoque = new Map(); for (const i of itens) if (i.chao) { if (!estoque.has(i.classe)) estoque.set(i.classe, []); estoque.get(i.classe).push(i.id); } }
          ids = estoque && estoque.get(tipo);
        }
        while (ids && ids.length) { const id = ids.shift(); if (livre(id)) return id; }
        return null;
      }
      function soltarIds(ids) { setTimeout(() => ids.forEach((id) => doEspelho.delete(id)), 3000); }
      async function drenarEspelho() {
        if (drenando) return;
        drenando = true;
        try {
          while (espelho && (pendColocar.length || pendMover.size)) {
            estoqueFresco = false;
            if (pendColocar.length) await espelharColocados(pendColocar.splice(0));
            if (pendMover.size) { const lista = [...pendMover.values()]; pendMover.clear(); await moverPares(lista); }
          }
        } catch (erro) {
          camada.aviso('Espelho: ' + (erro.message || erro), { tipo: 'erro' });
        } finally { drenando = false; }
      }
      // Manda um pacote por mobi (120 ms entre eles, sem esperar cada resposta); confere pela resposta do hotel
      // e repete uma vez, mais devagar, o que não veio. Devolve os ids confirmados.
      async function mandarEConferir(tarefas, cabecalho, campos, entrada) {
        const feitos = new Set();
        const alvo = new Set(tarefas.map((t) => t.id));
        let acordar = null;
        const parar = conexao.ouvir('entrada', entrada, function (l) {
          let m = null;
          try { m = codigos.lerMobi(l, true); } catch (e) { return; }
          if (alvo.has(m.id)) { feitos.add(m.id); if (acordar) acordar(); }
        });
        try {
          for (const folga of [120, 400]) {
            const faltam = tarefas.filter((t) => !feitos.has(t.id));
            if (!faltam.length) break;
            for (const t of faltam) { doEspelho.add(t.id); await mandar(cabecalho, campos(t)); await esperar(folga); }
            await new Promise(function (r) { const ok = () => faltam.every((t) => feitos.has(t.id)); if (ok()) { r(); return; } acordar = () => { if (ok()) r(); }; setTimeout(r, 1200); });
            acordar = null;
          }
        } finally { parar(); soltarIds(tarefas.map((t) => t.id)); }
        return feitos;
      }
      // Pares que pousaram em outra altura: acerta com a altura fixa, num lote só.
      async function acertarAlturas(tarefas) {
        const tortos = tarefas.filter((t) => mobis.has(t.id) && Math.abs((mobis.get(t.id).altura || 0) - t.altura) >= 0.01);
        if (!tortos.length) return;
        tortos.forEach((t) => doEspelho.add(t.id));
        try { await moverLista(tortos.map((t) => ({ id: t.id, x: t.x, y: t.y, direcao: t.direcao, altura: t.altura })), true, { contar: false }); } finally { soltarIds(tortos.map((t) => t.id)); }
      }
      async function espelharColocados(lista) {
        const tarefas = [], semEstoque = new Set();
        for (const m of lista) {
          if (!espelho) return;
          const alvo = codigos.espelharPonto(m, espelho.eixo, espelho.centro, await tamanhoDe(m.tipo));
          if (alvo.x === m.x && alvo.y === m.y) { camada.aviso('Esse mobi ficou em cima da linha do espelho, então não tem outro lado.'); continue; }
          if (codigos.alturaDoPiso(planta && planta.mapa, alvo.x, alvo.y) == null) { camada.aviso('O lado espelhado de (' + m.x + ', ' + m.y + ') fica fora do chão.', { tipo: 'erro' }); continue; }
          const id = await tirarDoEstoque(m.tipo, m.id);
          if (id == null) { semEstoque.add(m.tipo); continue; }
          doEspelho.add(id);
          tarefas.push({ id, fonte: m.id, x: alvo.x, y: alvo.y, direcao: alvo.direcao, altura: m.altura || 0 });
        }
        if (semEstoque.size) camada.aviso('Espelho: não há outro mobi igual no inventário para o outro lado' + (semEstoque.size > 1 ? ' (' + semEstoque.size + ' tipos)' : '') + '.', { tipo: 'erro' });
        if (!tarefas.length) return;
        const feitos = await mandarEConferir(tarefas, SAIDA.COLOCAR_MOBI, (t) => [['s', t.id + ' ' + t.x + ' ' + t.y + ' ' + t.direcao]], ENTRADA.MOBI_COLOCADO);
        for (const t of tarefas) if (feitos.has(t.id) && mobis.has(t.fonte)) { pares.set(t.fonte, t.id); pares.set(t.id, t.fonte); }
        await acertarAlturas(tarefas.filter((t) => feitos.has(t.id)));
      }
      async function moverPares(lista) {
        const tarefas = [];
        for (const m of lista) {
          if (!espelho) return;
          const par = pares.get(m.id);
          if (par == null) continue;
          if (!mobis.has(par)) { pares.delete(m.id); pares.delete(par); continue; }
          const alvo = codigos.espelharPonto(m, espelho.eixo, espelho.centro, await tamanhoDe(m.tipo));
          if (alvo.x === m.x && alvo.y === m.y) continue;
          tarefas.push({ id: par, x: alvo.x, y: alvo.y, direcao: alvo.direcao, altura: m.altura || 0 });
        }
        if (!tarefas.length) return;
        await mandarEConferir(tarefas, SAIDA.MOVER_MOBI, (t) => [['i', t.id], ['i', t.x], ['i', t.y], ['i', t.direcao]], ENTRADA.MOBI_ATUALIZADO);
        await acertarAlturas(tarefas);
      }
      function recolherPar(id) {
        const par = pares.get(id);
        pares.delete(id);
        if (par == null) return;
        pares.delete(par);
        if (!mobis.has(par)) return;
        doEspelho.add(par);
        mandar(SAIDA.PEGAR_MOBI, [['i', 10], ['i', par]]).finally(() => soltarIds([par]));
      }
      cancelar.push(
        conexao.ouvir('saida', SAIDA.COLOCAR_MOBI, function (l) {
          if (!espelho) return;
          const partes = String(l.texto()).split(' ');
          const id = Number(partes[0]);
          if (partes.length === 4 && !doEspelho.has(id) && !lotesProprios) colocadosPeloJogo.add(id);
        }),
        conexao.ouvir('entrada', ENTRADA.MOBI_COLOCADO, function (l) {
          let m = null;
          try { m = codigos.lerMobi(l, true); } catch (e) { return; }
          if (colocadosPeloJogo.delete(m.id)) { pendColocar.push(m); drenarEspelho(); }
        }),
        conexao.ouvir('saida', SAIDA.MOVER_MOBI, function (l) {
          const id = l.inteiro();
          if (espelho && pares.has(id) && !doEspelho.has(id) && !lotesProprios) movidosPeloJogo.add(id);
        }),
        conexao.ouvir('entrada', ENTRADA.MOBI_ATUALIZADO, function (l) {
          let m = null;
          try { m = codigos.lerMobi(l, true); } catch (e) { return; }
          if (movidosPeloJogo.delete(m.id)) { pendMover.set(m.id, m); drenarEspelho(); }
        }),
        conexao.ouvir('saida', SAIDA.PEGAR_MOBI, function (l) {
          l.inteiro();
          const id = l.inteiro();
          if (espelho && !doEspelho.has(id)) recolherPar(id);
        }),
        conexao.ouvir('entrada', ENTRADA.PLANTA, function () { setTimeout(mostrarGuia, 0); }),
        conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { desligarEspelho('Modo espelho desligado: você mudou de quarto.'); }),
      );
      ctx.aoParar(function () { espelho = null; });
      ctx.comando({
        nome: 'espelho',
        apelidos: ['simetria'],
        uso: 'espelho [esquerda|direita|vertical|horizontal|mover|desligar] [aqui]',
        descricao: 'Modo espelho: o que você coloca, move, gira ou recolhe de um lado da linha aparece do outro, com outro mobi igual do inventário. A linha passa pelo meio do quarto (com "aqui", pelo piso onde você está): esquerda e direita são paralelas às paredes; vertical e horizontal, na tela.',
        executar(pedido) {
          const a = String(pedido.args[0] || '').toLowerCase();
          const aqui = /^aqui$/i.test(String(pedido.args[1] || ''));
          const eixo = { esquerda: 'x', x: 'x', direita: 'y', y: 'y', vertical: 'vertical', v: 'vertical', horizontal: 'horizontal', h: 'horizontal' }[a];
          if (/^(desligar|off|sair)$/.test(a)) desligarEspelho();
          else if (/^(mover|posicionar|linha)$/.test(a)) posicionarLinha(espelho ? espelho.eixo : 'x');
          else if (eixo) ligarEspelho(eixo, aqui);
          else escolherEspelho();
        },
      });
      // :up do jogo com altura negativa: a prévia de colocar some (o mapa de alturas do servidor não guarda
      // número abaixo de 0). Acompanha o :up que sai (seu ou do Vagalume) e liga a prévia nessa altura; :up sem
      // número, positivo ou zero volta ao normal.
      cancelar.push(conexao.ouvir('saida', SAIDA.FALAR, function (l) {
        const m = /^\s*:up(?:\s+(-?\d+(?:[.,]\d+)?))?\s*$/i.exec(String(l.texto()));
        if (!m) return;
        const n = m[1] == null ? null : Number(m[1].replace(',', '.'));
        if (ferramenta && ferramenta.alturaForcada) ferramenta.alturaForcada(n != null && n < 0 ? n : alturaColocar);
      }));
      ctx.aoParar(function () { if (ferramenta && ferramenta.alturaForcada) ferramenta.alturaForcada(null); });
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
        const nome = (b, t) => { (b.querySelector('b') || b).textContent = t; };
        nome(botoesModo.congelar, congelado ? 'Descongelar' : 'Congelar');
        nome(botoesModo.tele, teleporteLigado ? 'Teleporte: ligado' : 'Teleporte');
        botoesModo.congelar.classList.toggle('ligado', congelado);
        botoesModo.tele.classList.toggle('ligado', teleporteLigado);
        if (botoesModo.espelho) {
          nome(botoesModo.espelho, espelho ? 'Espelho ligado' : 'Modo espelho');
          botoesModo.espelho.classList.toggle('ligado', !!espelho);
        }
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
      // Altura ao colocar (pedido do usuário em 2026-11-26): escolhe a altura antes de pôr o mobi, sem :up (que
      // dá mute por flood). Liga a "Altura fixa" da ferramenta do jogo (pacote 397, a mesma do pincel) e a prévia
      // de colocar e mover passa a mostrar o mobi nessa altura. Vale até desligar ou trocar de quarto.
      let alturaColocar = null;
      let alturaEscolhida = 1;
      async function definirAlturaColocar(h) {
        const ajustes = ajustesFerramenta.slice();
        ajustes[0] = h != null;
        if (h != null) ajustes[1] = Math.round(h * 100);
        if (!conexao.disponivel() || !(await mandar(SAIDA.FERRAMENTA_CONSTRUCAO, tiposFerramenta.map((tipo, i) => [tipo, ajustes[i]])))) return false;
        alturaColocar = h;
        ajustesFerramenta = ajustes;
        if (ferramenta && ferramenta.alturaForcada) ferramenta.alturaForcada(h);
        document.querySelectorAll('.vl-altura-colocar').forEach(pintarAlturaColocar);
        return true;
      }
      cancelar.push(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () {
        if (alturaColocar == null) return;
        alturaColocar = null;
        if (ferramenta && ferramenta.alturaForcada) ferramenta.alturaForcada(null);
        document.querySelectorAll('.vl-altura-colocar').forEach(pintarAlturaColocar);
      }));
      ctx.aoParar(function () { if (alturaColocar != null) definirAlturaColocar(null); });
      function pintarAlturaColocar(barra) {
        const ligada = alturaColocar != null;
        barra.classList.toggle('ligada', ligada);
        barra.querySelector('.vl-ac-valor').value = String(ligada ? alturaColocar : alturaEscolhida).replace('.', ',');
        const chave = barra.querySelector('.vl-ac-ligar');
        chave.textContent = ligada ? 'Fixada' : 'Fixar';
        chave.setAttribute('aria-pressed', String(ligada));
      }
      function barraAlturaColocar() {
        const barra = document.createElement('div');
        barra.className = 'vl-altura-colocar';
        barra.title = 'O mobi vai para esta altura ao colocar ou mover (a prévia mostra onde ele fica). Sem :up, sem mute.';
        const rotulo = document.createElement('span');
        rotulo.textContent = 'Altura';
        const botao = (texto, titulo, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = texto; b.title = titulo; b.addEventListener('click', function (ev) { ev.stopPropagation(); fn(); }); return b; };
        const valor = document.createElement('input');
        valor.className = 'vl-ac-valor';
        valor.inputMode = 'decimal';
        valor.setAttribute('aria-label', 'Altura ao colocar');
        const mudar = (h) => {
          h = Math.round(Math.max(0, Math.min(63, h)) * 100) / 100;
          alturaEscolhida = h;
          if (alturaColocar != null) definirAlturaColocar(h); else pintarAlturaColocar(barra);
        };
        valor.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') valor.blur(); });
        valor.addEventListener('change', function () { const h = Number(valor.value.replace(',', '.')); if (Number.isFinite(h)) mudar(h); else pintarAlturaColocar(barra); });
        const ligar = botao('Fixar', 'Ligar ou desligar a altura ao colocar', function () {
          definirAlturaColocar(alturaColocar != null ? null : alturaEscolhida).then(function (ok) { if (!ok) camada.aviso('Entre num quarto com a Conexão ligada para fixar a altura.', { tipo: 'erro' }); });
        });
        ligar.className = 'vl-ac-ligar';
        barra.append(rotulo, botao('−', 'Descer 0,5', () => mudar(alturaEscolhida - 0.5)), valor, botao('+', 'Subir 0,5', () => mudar(alturaEscolhida + 0.5)), ligar);
        pintarAlturaColocar(barra);
        return barra;
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
        b.after(barraAlturaColocar());
      }
      if (camada.estiloPagina) ctx.aoParar(camada.estiloPagina('colocar-varios',
        '[data-vl-pilha-botoes] { flex-wrap: wrap !important; row-gap: 6px !important; }'
        + ' [data-vl-pilha-botoes] > .btn-success, [data-vl-pilha-botoes] > .vl-colocar-varios { flex: 1 0 100% !important; width: 100% !important; max-width: none !important; margin-left: 0 !important; margin-right: 0 !important; white-space: nowrap; }'
        + ' .vl-altura-colocar { flex: 1 0 100%; display: flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 6px; background: rgba(0,0,0,.12); font-size: 12px; font-weight: 600; }'
        + ' .vl-altura-colocar > span { margin-right: auto; }'
        + ' .vl-altura-colocar button { min-width: 24px; height: 24px; padding: 0 6px; border: 1px solid rgba(0,0,0,.35); border-radius: 5px; background: #fff; color: #222; font-weight: 700; cursor: pointer; }'
        + ' .vl-altura-colocar .vl-ac-valor { width: 46px; height: 24px; text-align: center; border: 1px solid rgba(0,0,0,.35); border-radius: 5px; font-weight: 700; }'
        + ' .vl-altura-colocar.ligada { background: #d6f24a; color: #1c260a; box-shadow: 0 0 0 1px #7fa312; }'
        + ' .vl-altura-colocar.ligada .vl-ac-ligar { background: #1c260a; color: #d6f24a; border-color: #1c260a; }'));
      ctx.aoParar(function () { document.querySelectorAll('[data-vl-pilha-botoes]').forEach((e) => e.removeAttribute('data-vl-pilha-botoes')); });
      if (typeof MutationObserver === 'function' && document.body) {
        const observaInventario = new MutationObserver(function () { if (!vigiaInventario) vigiaInventario = requestAnimationFrame(botaoColocarVarios); });
        observaInventario.observe(document.body, { childList: true, subtree: true });
        ctx.aoParar(function () { observaInventario.disconnect(); cancelAnimationFrame(vigiaInventario); document.querySelectorAll('.vl-colocar-varios, .vl-altura-colocar').forEach((e) => e.remove()); });
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
        colocarLista, colocarNoTopo, colarQuarto, copiarQuarto, aplicarPlanta, ligarEspelho, desligarEspelho,
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
