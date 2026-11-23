// Vagalume — módulo "amigos": lista de amigos e console (mensagens privadas).
// Depende do adaptador de conexão (módulo "conexao" ligado e hotel recarregado).
// Conferido ao vivo em 2026-11-13: pedir a lista (1523) e o formato da resposta (3130), e mandar
// mensagem privada (3567). NÃO conferidos: a mensagem recebida (1587) e a atualização de amigos
// (2800), que seguem o formato conhecido desse tipo de cliente; se o Habblet for diferente, esses
// avisos simplesmente não aparecem.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.conexao || !VL.codigos) return;
  const { nucleo, camada, conexao, codigos } = VL;
  const { SAIDA, ENTRADA } = codigos;

  const chave = (apelido) => String(apelido || '').trim().toLowerCase();

  nucleo.definirModulo({
    id: 'amigos',
    iniciar(ctx) {
      const amigos = new Map();  // id -> { id, nome, online, podeSeguir, relacionamento }
      const porNome = new Map(); // apelido em minúsculas -> id
      let recebendo = null;      // amigos dos fragmentos em andamento
      let pediu = false;

      function guardar(lista) {
        const anteriores = new Map(amigos);
        amigos.clear();
        porNome.clear();
        for (const a of lista) {
          const antes = anteriores.get(a.id);
          amigos.set(a.id, { ...a, visual: a.visual || (antes && antes.visual) || '' });
          porNome.set(chave(a.nome), a.id);
        }
        if (typeof aplicarSoAmigos === 'function') setTimeout(function () { aplicarSoAmigos(false); }, 0);
      }

      // Missão do amigo como dica ao passar o mouse na lista de amigos do jogo (a lista não a mostra).
      ctx.escutar(document, 'mouseover', function (ev) {
        if (!ctx.secao().missaoNaDica || !ev.target || typeof ev.target.closest !== 'function') return;
        const linha = ev.target.closest('.nitro-friends .friend-row');
        if (!linha) return;
        const id = porNome.get(chave(linha.textContent || ''));
        const a = id != null ? amigos.get(id) : null;
        const dica = a && a.missao ? a.nome + ': ' + a.missao : '';
        if (dica && linha.title !== dica) linha.title = dica;
      }, true);

      function pedirLista() {
        if (!conexao.disponivel() || !conexao.conectado()) return;
        pediu = true;
        conexao.enviar(SAIDA.PEDIR_AMIGOS, []);
      }

      const cancelar = [
        conexao.ouvir('entrada', ENTRADA.AMIGOS, function (l) {
          const r = codigos.lerAmigos(l);
          if (r.indice === 0 || !recebendo) recebendo = [];
          recebendo.push(...r.amigos);
          if (r.indice >= r.total - 1) { guardar(recebendo); recebendo = null; const j = document.querySelector('.nitro-navigator'); if (j && j.getClientRects().length) rodada(); }
        }),
        conexao.ouvir('entrada', ENTRADA.ATUALIZA_AMIGOS, function (l) {
          let mudancas;
          try { mudancas = codigos.lerAtualizacaoAmigos(l); } catch (erro) { return; } // formato diferente: ignora
          for (const m of mudancas) {
            if (m.tipo === -1) {
              const a = amigos.get(m.id);
              amigos.delete(m.id);
              if (a) porNome.delete(chave(a.nome));
              continue;
            }
            const antes = amigos.get(m.id);
            amigos.set(m.id, { id: m.id, nome: m.nome, online: m.online, podeSeguir: m.podeSeguir, relacionamento: m.relacionamento, missao: m.missao, visual: m.visual || (antes && antes.visual) || '' });
            porNome.set(chave(m.nome), m.id);
            if (ctx.secao().avisarOnline && antes && antes.online !== m.online) {
              camada.aviso(m.nome + (m.online ? ' entrou no hotel.' : ' saiu do hotel.'));
            }
          }
        }),
        conexao.ouvir('entrada', ENTRADA.MENSAGEM_RECEBIDA, function (l) {
          let msg;
          try { msg = codigos.lerMensagemRecebida(l); } catch (erro) { return; }
          const de = amigos.get(msg.de);
          // Para o módulo Menções: menção pelo console conta como menção.
          ctx.emitir('amigos:mensagem', { autor: de ? de.nome : '', de: msg.de, texto: msg.texto });
          // O convite de jogo vira um cartão de chamada no módulo Jogos: sem o aviso de mensagem.
          if (!ctx.secao().avisarMensagens || conversaAberta(de ? de.nome : '') || /vl-jogo-[xdp][wb]9\d{11}/.test(msg.texto)) return;
          camada.aviso('Mensagem de ' + (de ? de.nome : 'um amigo') + ': ' + msg.texto.slice(0, 200), { duracaoMs: 8000 });
        }),
        // "@amigo texto" dito no quarto também vai para o console do amigo.
        conexao.ouvir('saida', SAIDA.FALAR, aoFalar),
        conexao.ouvir('saida', SAIDA.GRITAR, aoFalar),
      ];
      ctx.aoParar(function () { cancelar.forEach((fn) => fn()); });
      // Para outros módulos (Silenciar): saber se um apelido é de amigo.
      VL.amigos = { lista() { return [...amigos.values()]; }, idDe(nome) { const id = porNome.get(chave(nome)); return id == null ? null : id; }, seguir(id) { return conexao.enviar(SAIDA.SEGUIR_AMIGO, [['i', id]]); }, perfil(id) { return conexao.enviar(SAIDA.PERFIL, [['i', id], ['b', true]]); }, eAmigo(nome) { const n = String(nome || '').trim().toLowerCase(); if (!n) return false; for (const a of amigos.values()) if (String(a.nome).toLowerCase() === n) return true; return false; } };
      ctx.aoParar(function () { delete VL.amigos; });

      // A conversa com esse amigo está à vista no console (janela aberta, não minimizada, aba dele à frente)?
      // O jogo escreve o nome do amigo da aba ativa no separador .nitro-messenger-header-text (lido no cliente).
      function conversaAberta(nome) {
        const cab = document.querySelector('.nitro-friends-messenger .nitro-messenger-header-text');
        if (!cab || !cab.getClientRects().length) return false;
        const n = String(nome || '').trim().toLowerCase();
        return !n || cab.textContent.toLowerCase().includes(n);
      }
      function aoFalar(l) {
        if (!ctx.secao().mencaoPorConsole) return;
        const m = codigos.mencaoNaFala(l.texto());
        if (!m) return;
        const id = porNome.get(chave(m.apelido));
        if (id == null) return; // não é amigo: o jogo recusaria a mensagem
        conexao.enviar(SAIDA.MENSAGEM_PRIVADA, [['i', id], ['s', m.texto]]);
      }

      // Convites para quartos pelo console: segurados antes de chegar ao jogo, se a opção estiver ligada.
      let desfazerConvites = null;
      function aplicar() {
        const quer = ctx.secao().silenciarConvites === true;
        if (quer && !desfazerConvites) desfazerConvites = conexao.bloquear('entrada', ENTRADA.CONVITE);
        else if (!quer && desfazerConvites) { desfazerConvites(); desfazerConvites = null; }
      }
      aplicar();
      ctx.aoConfig(function (secao) { if (secao === 'amigos') aplicar(); });
      ctx.aoParar(function () { if (desfazerConvites) desfazerConvites(); });

      // A lista chega no login, antes de o Vagalume escutar: pede de novo quando a conexão estiver de pé.
      ctx.aoParar(conexao.aoEstado(function (estado) { if (estado.conectado && !pediu) pedirLista(); }));
      setTimeout(pedirLista, 1500);
      // Depois de relogar, o pedido pode sair antes de o servidor terminar o login e ficar sem resposta
      // (o navegador ficava sem os amigos): pede de novo no sinal de login e a cada 5 s até a lista chegar.
      // Com o navegador aberto, a busca de onde os amigos estão também se refaz sozinha (no máximo a cada
      // 15 s), mesmo sem a janela mudar (pedido do usuário em 2026-11-16).
      cancelar.push(conexao.ouvir('entrada', ENTRADA.MEUS_DADOS, function () { setTimeout(pedirLista, 500); }));
      const relogioAmigos = setInterval(function () {
        if (!amigos.size && conexao.conectado()) pedirLista();
        const janela = document.querySelector('.nitro-navigator');
        if (janela && janela.getClientRects().length) rodada();
      }, 5000);
      ctx.aoParar(function () { clearInterval(relogioAmigos); });

      // ---------- amigos embaixo de cada quarto do navegador ----------
      // Para saber onde cada amigo online está, sem ir até lá: pede "seguir" (3997) e segura a resposta
      // antes de chegar ao jogo — o 160 (o quarto, que faria o jogo entrar nele) ou o 3048 (não deu,
      // que faria o jogo mostrar um alerta). Um amigo por vez, a cada 350 ms, só com o navegador aberto
      // e no máximo uma rodada por minuto. O id de cada linha do navegador vem do script da página
      // principal/ids-quartos.js (atributo data-vl-quarto).
      const quartoDoAmigo = new Map(); // id do amigo -> id do quarto
      let ultimaRodada = 0;
      let rodando = false;
      function rodada() {
        if (rodando || !ctx.secao().amigosNoNavegador || !conexao.conectado()) return;
        if (Date.now() - ultimaRodada < 15000) return;
        if (!amigos.size) return; // a lista ainda não chegou: a rodada sai quando ela chegar
        const fila = [...amigos.values()].filter((a) => a.online && a.podeSeguir);
        ultimaRodada = Date.now();
        if (!fila.length) { quartoDoAmigo.clear(); desenharNavegador(); return; }
        rodando = true;
        let atual = null;
        let relogio = null;
        const soltar = [conexao.bloquear('entrada', ENTRADA.ENCAMINHAR_QUARTO), conexao.bloquear('entrada', ENTRADA.SEGUIR_FALHOU)];
        const ouvir = [
          conexao.ouvir('entrada', ENTRADA.ENCAMINHAR_QUARTO, function (l) { if (atual) { quartoDoAmigo.set(atual.id, l.inteiro()); proximo(); } }),
          conexao.ouvir('entrada', ENTRADA.SEGUIR_FALHOU, function () { if (atual) { quartoDoAmigo.delete(atual.id); proximo(); } }),
        ];
        const novos = new Set(fila.map((a) => a.id));
        for (const id of [...quartoDoAmigo.keys()]) if (!novos.has(id)) quartoDoAmigo.delete(id);
        function fim() {
          clearTimeout(relogio);
          // Um pouco depois da última resposta, para não soltar um 160 atrasado para o jogo.
          setTimeout(function () { soltar.forEach((f) => f()); ouvir.forEach((f) => f()); rodando = false; desenharNavegador(); }, 400);
        }
        function proximo() {
          clearTimeout(relogio);
          atual = fila.shift() || null;
          desenharNavegador();
          if (!atual) { fim(); return; }
          setTimeout(function () {
            conexao.enviar(SAIDA.SEGUIR_AMIGO, [['i', atual.id]]);
            relogio = setTimeout(function () { if (atual) { quartoDoAmigo.delete(atual.id); proximo(); } }, 2500);
          }, 350);
        }
        proximo();
      }
      function linhaDeAmigos(lista, aqui) {
        const caixa = document.createElement('div');
        caixa.className = 'vl-nav-amigos';
        const fotos = document.createElement('span');
        fotos.className = 'vl-nav-fotos';
        for (const a of lista.slice(0, 3)) {
          const f = document.createElement('span');
          f.className = 'vl-nav-foto';
          f.title = a.nome;
          f.textContent = String(a.nome || '?').charAt(0).toUpperCase();
          let normalizada = false;
          if (a.visual) {
            const reserva = document.createElement('img');
            reserva.className = 'vl-nav-foto-reserva';
            reserva.alt = '';
            reserva.onload = function () { if (!normalizada) f.replaceChildren(reserva); };
            reserva.src = 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(a.visual) + '&headonly=1&direction=2&head_direction=3';
          }
          function carregarCabeca(tentativa) {
            chrome.runtime.sendMessage({ tipo: 'avatar:miniatura', figura: a.visual }).then(function (r) {
              if (!r || !r.ok || !/^data:image\/png;base64,/.test(r.url || '')) throw new Error('miniatura indisponível');
              const img = document.createElement('img');
              img.alt = '';
              img.width = 22;
              img.height = 24;
              img.onload = function () { normalizada = true; f.replaceChildren(img); };
              img.src = r.url;
            }).catch(function () {
              if (!tentativa && f.isConnected) setTimeout(function () {
                if (f.isConnected) carregarCabeca(1);
              }, 4000);
            });
          }
          if (a.visual) carregarCabeca(0);
          fotos.appendChild(f);
        }
        const nomes = lista.map((a) => a.nome);
        let texto = nomes.slice(0, 3).join(', ');
        if (nomes.length > 3) texto += ' e mais ' + (nomes.length - 3);
        if (aqui) texto = texto ? texto + ', aqui com você' : 'Você está aqui';
        const rotulo = document.createElement('span');
        rotulo.className = 'vl-nav-nomes';
        rotulo.textContent = texto;
        caixa.append(fotos, rotulo);
        return caixa;
      }
      function desenharNavegador() {
        const ligado = ctx.secao().amigosNoNavegador;
        const porQuarto = new Map();
        if (ligado) for (const [idAmigo, idQuarto] of quartoDoAmigo) {
          const a = amigos.get(idAmigo);
          if (!a) continue;
          if (!porQuarto.has(idQuarto)) porQuarto.set(idQuarto, []);
          porQuarto.get(idQuarto).push(a);
        }
        const aqui = VL.pessoas && VL.pessoas.quartoAtual ? VL.pessoas.quartoAtual() : null;
        document.querySelectorAll('.nitro-navigator .navigator-item').forEach(function (item) {
          const id = Number(item.getAttribute('data-vl-quarto'));
          const lista = (porQuarto.get(id) || []).sort((a, b) => a.nome.localeCompare(b.nome));
          const souAqui = ligado && aqui != null && id === aqui;
          const chaveLinha = lista.map((a) => a.id + ':' + a.visual + ':' + a.nome).join(',') + '|' + souAqui;
          const velha = item.querySelector('.vl-nav-amigos');
          if (!lista.length && !souAqui) {
            if (velha) velha.remove();
            item.removeAttribute('data-vl-com-amigos');
            return;
          }
          if (velha && velha.dataset.chave === chaveLinha) return;
          if (velha) velha.remove();
          const nova = linhaDeAmigos(lista, souAqui);
          nova.dataset.chave = chaveLinha;
          item.setAttribute('data-vl-com-amigos', '');
          item.appendChild(nova);
        });
      }
      const CSS_NAV = '.nitro-navigator .navigator-item[data-vl-com-amigos] { flex-wrap: wrap !important; height: auto !important; row-gap: 3px; }'
        + '.vl-nav-amigos { flex-basis: 100%; display: flex; align-items: center; gap: 8px; min-width: 0; padding: 2px 2px 3px 44px; }'
        + '.vl-nav-fotos { display: flex; align-items: center; gap: 4px; flex: none; }'
        + '.vl-nav-foto { position: relative; display: grid; place-items: center; flex: 0 0 22px; width: 22px; height: 24px; font-size: 11px; overflow: visible; }'
        + '.nitro-navigator .vl-nav-foto > img { display: block !important; position: static !important; width: 22px !important; height: 24px !important; min-width: 0 !important; max-width: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; object-fit: contain; transform: none !important; }'
        + '.nitro-navigator .vl-nav-foto > img.vl-nav-foto-reserva { position: absolute !important; left: -13px !important; top: -17px !important; width: 48px !important; height: 69px !important; }'
        + '.vl-nav-nomes { margin-left: 0; font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; opacity: .85; }';
      let tirarCssNav = null;
      let observadorNav = null;
      function ligarNavegador() {
        const quer = ctx.secao().amigosNoNavegador;
        if (quer && !tirarCssNav) tirarCssNav = camada.estiloPagina('amigos-navegador', CSS_NAV);
        if (!quer && tirarCssNav) { tirarCssNav(); tirarCssNav = null; }
        if (quer && !observadorNav && document.body) {
          let pendente = false;
          let aberto = false;
          observadorNav = new MutationObserver(function () {
            if (pendente) return;
            pendente = true;
            setTimeout(function () {
              pendente = false;
              // O jogo deixa a janela na página mesmo fechada: conta só se estiver visível.
              const janela = document.querySelector('.nitro-navigator');
              const agora = !!(janela && janela.getClientRects().length);
              if (agora) rodada(); // ao abrir e enquanto a lista muda (no máximo a cada 15 s)
              aberto = agora;
              if (agora) desenharNavegador();
            }, 200);
          });
          observadorNav.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-vl-quarto'] });
        }
        if (!quer && observadorNav) { observadorNav.disconnect(); observadorNav = null; }
        desenharNavegador();
      }
      ligarNavegador();
      ctx.aoConfig(function (secao) { if (secao === 'amigos') ligarNavegador(); });
      ctx.aoParar(function () {
        if (observadorNav) observadorNav.disconnect();
        if (tirarCssNav) tirarCssNav();
        document.querySelectorAll('.vl-nav-amigos').forEach((e) => e.remove());
        document.querySelectorAll('[data-vl-com-amigos]').forEach((e) => e.removeAttribute('data-vl-com-amigos'));
      });

      // ---------- mostrar só amigos e destacar amigos (pedido do usuário em 2026-11-14) ----------
      // Só na sua tela. "Só amigos": a lista de pessoas que o servidor manda (374) é segurada e entregue
      // ao jogo sem quem não é seu amigo; quem já estava no quarto sai pela mensagem de saída (2661).
      // Você, bots e pets ficam. Vale até desligar ou recarregar o hotel (como na BANANA); ao desligar,
      // o Vagalume entra de novo no quarto para todos voltarem. O destaque dos amigos agora é o do quarto
      // lotado (mais abaixo): quem não é amigo vira fantasma por alguns segundos.
      const noQuarto = new Map();    // índice -> { id, nome, tipo }
      const efeitoReal = new Map();  // índice -> efeito mandado pelo servidor
      const bytesDe = new Map();     // índice -> bytes da entidade no 374 (para devolver à tela)
      const posicaoDe = new Map();   // índice -> { x, y } mais recente
      const estadoDe = new Map();    // índice -> bytes do último estado parado (postura, altura, direção)
      const dancaDe = new Map();     // índice -> dança atual (0 parado)
      const maoDe = new Map();       // índice -> item de mão (0 nada)
      const ociosoDe = new Map();    // índice -> dormindo (zzz)
      let soltarFiltro = null;
      function souEu(e) {
        const meuId = VL.pessoas && VL.pessoas.meuId ? VL.pessoas.meuId() : null;
        const meuNome = VL.pessoas && VL.pessoas.eu ? VL.pessoas.eu() : null;
        return (meuId != null && e.id === meuId) || (!!meuNome && chave(meuNome) === chave(e.nome));
      }
      function ficaNaTela(e) { return e.tipo !== 1 || souEu(e) || porNome.has(chave(e.nome)); }
      function sabeQuemSouEu() { return !!(VL.pessoas && ((VL.pessoas.meuId && VL.pessoas.meuId() != null) || (VL.pessoas.eu && VL.pessoas.eu()))); }

      // Quarto lotado (pedido do usuário em 2026-11-15, como a BANANA, mas com outra aparência): ao entrar
      // num quarto com muita gente, quem não é amigo recebe um efeito só na sua tela por alguns segundos
      // (de fábrica, Fantasma, o mesmo da BANANA: leve); depois volta o efeito de verdade de cada um.
      const EFEITO_DESCONHECIDO = { fantasma: 13, raiox: 11, moscas: 10 };
      const marcados = new Set();   // índices com o efeito de desconhecido agora
      let lotadoAte = 0;            // até quando o destaque do quarto lotado vale
      let relogioLotado = null;
      let relogioContagem = null;
      let jaDestacouNoQuarto = false;
      function efeitoDesconhecido() { return EFEITO_DESCONHECIDO[ctx.secao().desconhecidos] || 13; }
      function ehDesconhecido(e) { return e && e.tipo === 1 && !souEu(e) && !porNome.has(chave(e.nome)); }
      function marcar(indice) { conexao.injetar(ENTRADA.EFEITO, [['i', indice], ['i', efeitoDesconhecido()], ['i', 0]]); marcados.add(indice); }
      function desmarcarTodos() {
        clearTimeout(relogioLotado);
        lotadoAte = 0;
        for (const i of marcados) if (noQuarto.has(i)) conexao.injetar(ENTRADA.EFEITO, [['i', i], ['i', efeitoReal.get(i) || 0], ['i', 0]]);
        marcados.clear();
      }
      function destacarLotado(segundos) {
        desmarcarTodos();
        let n = 0;
        for (const [indice, e] of noQuarto) if (ehDesconhecido(e)) { marcar(indice); n++; }
        if (!n) return 0;
        lotadoAte = Date.now() + segundos * 1000;
        relogioLotado = setTimeout(desmarcarTodos, segundos * 1000);
        return n;
      }
      function talvezLotado() {
        clearTimeout(relogioContagem);
        relogioContagem = setTimeout(function () {
          const s = ctx.secao();
          if (jaDestacouNoQuarto || !s.destacarLotado || !sabeQuemSouEu()) return;
          let pessoas = 0;
          for (const e of noQuarto.values()) if (e.tipo === 1) pessoas++;
          if (pessoas < (Number(s.lotado) || 20)) return;
          jaDestacouNoQuarto = true;
          destacarLotado(Number(s.segundosLotado) || 5);
        }, 1200); // a lista de quem está no quarto chega em partes
      }
      cancelar.push(
        conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { marcados.clear(); lotadoAte = 0; clearTimeout(relogioLotado); jaDestacouNoQuarto = false; noQuarto.clear(); efeitoReal.clear(); bytesDe.clear(); posicaoDe.clear(); estadoDe.clear(); dancaDe.clear(); maoDe.clear(); ociosoDe.clear(); aplicarSoAmigos(false); }),
        conexao.ouvir('entrada', ENTRADA.ESTADOS, function (l, bytes) {
          let lista;
          try { lista = codigos.lerEstados(l); } catch (erro) { return; }
          for (const s of lista) {
            posicaoDe.set(s.indice, codigos.destinoDoMovimento(s.acoes) || { x: s.x, y: s.y });
            // Só o estado parado (sem "/mv"): andando, o próprio jogo manda o estado final ao chegar.
            if (s.inicio != null && s.fim != null && !/\/mv /.test(s.acoes)) estadoDe.set(s.indice, bytes.slice(s.inicio, s.fim));
            else if (/\/mv /.test(s.acoes)) estadoDe.delete(s.indice);
          }
        }),
        conexao.ouvir('entrada', ENTRADA.DANCA, function (l) { try { const i = l.inteiro(); dancaDe.set(i, l.inteiro()); } catch (erro) { /* */ } }),
        conexao.ouvir('entrada', ENTRADA.ITEM_MAO, function (l) { try { const i = l.inteiro(); maoDe.set(i, l.inteiro()); } catch (erro) { /* */ } }),
        conexao.ouvir('entrada', ENTRADA.INATIVO, function (l) { try { const i = l.inteiro(); ociosoDe.set(i, l.booleano()); } catch (erro) { /* */ } }),
        conexao.ouvir('entrada', ENTRADA.USUARIOS, function (l, bytes) {
          let r;
          try { r = codigos.lerUsuarios(l); } catch (erro) { r = null; }
          if (r) for (const e of r.lista) {
            noQuarto.set(e.indice, { id: e.id, nome: e.nome, tipo: e.tipo });
            if (e.inicio != null && e.fim != null) bytesDe.set(e.indice, bytes.slice(e.inicio, e.fim));
            posicaoDe.set(e.indice, { x: e.x, y: e.y });
          }
          if (soltarFiltro) {
            // A lista original foi segurada: entrega ao jogo só quem fica (ou tudo, se não deu para ler).
            let filtrada = null;
            try { filtrada = sabeQuemSouEu() ? codigos.filtrarUsuarios(VL.protocolo.criarLeitor(bytes), bytes, ficaNaTela, 190000) : null; } catch (erro) { filtrada = null; }
            if (!filtrada) conexao.injetar(ENTRADA.USUARIOS, [['r', Array.from(bytes)]]);
            else for (const p of filtrada.pedacos) if (p.quantidade) conexao.injetar(ENTRADA.USUARIOS, [['i', p.quantidade], ['r', p.bytes]]);
          }
          // quem chega enquanto o destaque do quarto lotado vale também fica marcado
          if (r && lotadoAte > Date.now()) for (const e of r.lista) if (ehDesconhecido(e)) marcar(e.indice);
          talvezLotado();
        }),
        conexao.ouvir('entrada', ENTRADA.SAIU, function (l) { const i = Number(l.texto()); noQuarto.delete(i); efeitoReal.delete(i); bytesDe.delete(i); posicaoDe.delete(i); estadoDe.delete(i); dancaDe.delete(i); maoDe.delete(i); ociosoDe.delete(i); }),
        conexao.ouvir('entrada', ENTRADA.EFEITO, function (l) {
          const indice = l.inteiro();
          efeitoReal.set(indice, l.inteiro());
          const e = noQuarto.get(indice);
          if (lotadoAte > Date.now() && marcados.has(indice)) setTimeout(function () { if (lotadoAte > Date.now()) marcar(indice); }, 50);
        }),
      );
      // As falas de quem foi escondido chegam ao jogo sem nome (o jogo não conhece mais a pessoa):
      // com o modo ligado, esses balões ficam escondidos também.
      if (VL.jogo) ctx.aoParar(VL.jogo.observarFalas(function (fala) {
        if (!soltarFiltro || !fala || !fala.el) return;
        const autor = String(fala.autor || '').trim();
        if (!autor || (!porNome.has(chave(autor)) && noQuartoTemNome(autor) && !souEu({ nome: autor }))) fala.el.style.display = 'none';
      }));
      function noQuartoTemNome(nome) { const n = chave(nome); for (const e of noQuarto.values()) if (e.tipo === 1 && chave(e.nome) === n) return true; return false; }
      // "Só amigos" agora é uma opção (amigos.soAmigos, pedido do usuário em 2026-11-15): vale enquanto
      // estiver ligada, em todos os quartos, também depois de recarregar. Começa a filtrar assim que a
      // lista de amigos e o próprio avatar forem conhecidos (o filtro pega a próxima lista de pessoas).
      function aplicarSoAmigos(avisar) {
        const quer = ctx.secao().soAmigos === true;
        if (quer && !soltarFiltro) {
          if (!conexao.disponivel() || !amigos.size || !sabeQuemSouEu()) {
            if (avisar) camada.aviso('Só amigos ligado: começa assim que o Vagalume tiver a sua lista de amigos (entre num quarto).');
            if (!amigos.size) pedirLista();
            return;
          }
          ligarSoAmigos(avisar);
        } else if (!quer && soltarFiltro) desligarSoAmigos(avisar);
      }
      function ligarSoAmigos(avisar) {
        soltarFiltro = conexao.bloquear('entrada', ENTRADA.USUARIOS);
        let saiu = 0;
        for (const [indice, e] of noQuarto) if (!ficaNaTela(e)) { conexao.injetar(ENTRADA.SAIU, [['s', String(indice)]]); saiu += 1; }
        if (avisar) camada.aviso('Só amigos: ' + (saiu ? saiu + ' pessoa(s) escondida(s) da sua tela.' : 'ninguém para esconder agora.') + ' Vale em todos os quartos enquanto estiver ligado.');
      }
      // Ao desligar, quem foi escondido volta sem sair do quarto: o Vagalume entrega ao jogo os dados
      // de cada um (guardados do 374 original) com a posição de agora (do 1640).
      function desligarSoAmigos(avisar) {
        if (soltarFiltro) soltarFiltro();
        soltarFiltro = null;
        const partes = [];
        const devolvidos = [];
        for (const [indice, e] of noQuarto) {
          if (ficaNaTela(e) || !bytesDe.has(indice)) continue;
          devolvidos.push(indice);
          const pos = posicaoDe.get(indice);
          let b = bytesDe.get(indice);
          try { if (pos) b = codigos.trocarPosicao(b, pos.x, pos.y); } catch (erro) { /* fica a posição de quando entrou */ }
          partes.push(b);
        }
        if (!partes.length) { if (avisar) camada.aviso('Só amigos desligado.'); return; }
        const total = partes.reduce((s, p) => s + p.length, 0);
        const junto = new Uint8Array(total);
        let pos = 0;
        for (const p of partes) { junto.set(p, pos); pos += p.length; }
        const pedido = conexao.injetar(ENTRADA.USUARIOS, [['i', partes.length], ['r', Array.from(junto)]]);
        // Depois de voltarem à tela: postura (sentado, deitado), altura e direção de cada um, dança e
        // efeito — sem isso todos voltavam em pé, virados para o mesmo lado (print do usuário em 2026-11-15).
        const estados = devolvidos.map((i) => estadoDe.get(i)).filter(Boolean);
        if (estados.length) {
          const tam = estados.reduce((s, p) => s + p.length, 0);
          const tudo = new Uint8Array(tam);
          let p2 = 0;
          for (const e of estados) { tudo.set(e, p2); p2 += e.length; }
          conexao.injetar(ENTRADA.ESTADOS, [['i', estados.length], ['r', Array.from(tudo)]]);
        }
        for (const i of devolvidos) {
          if (dancaDe.get(i) > 0) conexao.injetar(ENTRADA.DANCA, [['i', i], ['i', dancaDe.get(i)]]);
          if (efeitoReal.get(i) > 0) conexao.injetar(ENTRADA.EFEITO, [['i', i], ['i', efeitoReal.get(i)], ['i', 0]]);
          if (maoDe.get(i) > 0) conexao.injetar(ENTRADA.ITEM_MAO, [['i', i], ['i', maoDe.get(i)]]);
          if (ociosoDe.get(i)) conexao.injetar(ENTRADA.INATIVO, [['i', i], ['b', true]]);
        }
        pedido.then(function (r) {
          camada.aviso(r.ok ? 'Só amigos desligado: ' + partes.length + ' pessoa(s) de volta.' : 'Não deu para devolver as pessoas: ' + r.motivo + '. Entre de novo no quarto.', { tipo: r.ok ? 'ok' : 'erro' });
        });
      }
      ctx.aoParar(function () { if (soltarFiltro) soltarFiltro(); soltarFiltro = null; clearTimeout(relogioContagem); desmarcarTodos(); });
      // ---------- achar alguém no quarto (pedido do usuário em 2026-11-15) ----------
      // O Vagalume sabe o piso da pessoa, mas não onde ele está na tela. Então pede ao próprio jogo: abre
      // a lista do :chooser escondida, clica na pessoa (o jogo a seleciona e põe o menu dela em cima do
      // avatar; conferido ao vivo: o clique vale no div.grid de dentro da linha), lê a posição desse menu,
      // aproxima a câmera até ela, volta alguns segundos depois e então acende o Holofote na pessoa (só na
      // sua tela), devolvendo depois o efeito de verdade dela.
      const EFEITO_ACHAR = 1; // Holofote
      function esperarPor(fn, ms) {
        return new Promise(function (resolver) {
          const fim = Date.now() + ms;
          (function olhar() { const r = fn(); if (r || Date.now() > fim) { resolver(r || null); return; } setTimeout(olhar, 80); })();
        });
      }
      let achando = false;
      function canvasDoQuarto() {
        for (const s of (VL.jogo ? VL.jogo.SELETORES.quarto : ['canvas'])) { const c = document.querySelector(s); if (c && c.offsetWidth > 100) return c; }
        return null;
      }
      // Arrasta a câmera do jogo como se fosse o mouse (o jogo aceita eventos simulados: o zoom do Vagalume
      // já manda assim). Começa no meio do quarto e anda em passos, um por quadro.
      async function arrastarCamera(c, dx, dy) {
        const r = c.getBoundingClientRect();
        const x0 = r.left + r.width / 2;
        const y0 = r.top + r.height / 2;
        const mandar = (tipo, x, y, botoes) => {
          const Classe = tipo.indexOf('pointer') === 0 ? PointerEvent : MouseEvent;
          c.dispatchEvent(new Classe(tipo, { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0, buttons: botoes, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
        };
        mandar('pointerdown', x0, y0, 1); mandar('mousedown', x0, y0, 1);
        // Movimento contínuo pelo tempo (um passo por quadro), acelerando e freando (pedido do usuário em
        // 2026-11-15: "mais rápido e mais fluido"). Distâncias maiores levam um pouco mais.
        const duracao = Math.min(520, 260 + Math.hypot(dx, dy) * 0.12);
        const suave = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
        const inicio = performance.now();
        let x = x0;
        let y = y0;
        for (;;) {
          const k = Math.min(1, (performance.now() - inicio) / duracao);
          x = x0 + dx * suave(k);
          y = y0 + dy * suave(k);
          mandar('pointermove', x, y, 1); mandar('mousemove', x, y, 1);
          if (k >= 1) break;
          await new Promise((res) => requestAnimationFrame(res));
        }
        mandar('pointerup', x, y, 0); mandar('mouseup', x, y, 0);
      }
      async function achar(nome) {
        const k = chave(nome);
        let alvo = null;
        for (const [indice, e] of noQuarto) if (e.tipo === 1 && chave(e.nome) === k) { alvo = { indice, nome: e.nome }; break; }
        if (!alvo) for (const [indice, e] of noQuarto) if (e.tipo === 1 && chave(e.nome).startsWith(k)) { alvo = { indice, nome: e.nome }; break; }
        if (!alvo) { camada.aviso(nome + ' não está neste quarto.', { tipo: 'erro' }); return; }
        if (achando) return;
        achando = true;
        const raizHtml = document.documentElement;
        raizHtml.setAttribute('data-vl-achando', '');
        let abriu = false;
        let ponto = null;
        const antes = new Set(document.querySelectorAll('.nitro-context-menu'));
        try {
          let lista = document.querySelector('.nitro-user-chooser-widget');
          if (!lista && VL.jogo) { abriu = VL.jogo.enviarFala(':chooser'); lista = await esperarPor(() => document.querySelector('.nitro-user-chooser-widget'), 3000); }
          if (lista) {
            const busca = lista.querySelector('.search-filter');
            if (busca && VL.jogo) { VL.jogo.definirValor(busca, alvo.nome); await new Promise((r) => setTimeout(r, 150)); }
            const linha = [...lista.querySelectorAll('.user-row')].find((r) => {
              const primeiro = r.querySelector('.row-text');
              return chave(primeiro ? primeiro.textContent : r.textContent).startsWith(chave(alvo.nome));
            });
            const clicavel = linha && (linha.querySelector('.grid') || linha.firstElementChild);
            if (clicavel) {
              clicavel.click();
              // Só o menu que apareceu agora, com o apelido exato no cabeçalho (o placar de jogos do quarto
              // também é um menu flutuante e pode ter o nome: foi o que levou o zoom ao lugar errado).
              const menu = await esperarPor(() => [...document.querySelectorAll('.nitro-context-menu')].find((m) => {
                if (antes.has(m) || m.classList.contains('nitro-widget-high-score') || !m.getClientRects().length) return false;
                const cab = m.querySelector('.menu-header');
                return chave(cab ? cab.textContent : '') === chave(alvo.nome);
              }), 1500);
              if (menu) { const r = menu.getBoundingClientRect(); ponto = { x: r.left + r.width / 2, y: r.bottom + 45 }; }
            }
            if (abriu) { const fechar = lista.querySelector('.nitro-card-header-close'); if (fechar) fechar.click(); }
          }
        } catch (erro) { console.warn('[Vagalume] Falha ao achar:', erro); }
        raizHtml.removeAttribute('data-vl-achando');
        achando = false;
        const acender = function () {
          const antes = efeitoReal.get(alvo.indice) || 0;
          conexao.injetar(ENTRADA.EFEITO, [['i', alvo.indice], ['i', EFEITO_ACHAR], ['i', 0]]);
          setTimeout(function () { if (noQuarto.has(alvo.indice)) conexao.injetar(ENTRADA.EFEITO, [['i', alvo.indice], ['i', efeitoReal.get(alvo.indice) || antes], ['i', 0]]); }, 6000);
        };
        // Onde a pessoa está agora. O menu dela acompanha o avatar e é a verdade do jogo, mas, com a pessoa
        // fora da tela, o jogo prende o menu na borda (vídeo do usuário em 2026-11-15: o zoom caía longe):
        // menu na borda conta como "está além daqui". Sem menu, vale o piso dela pela calibração.
        const piso = VL.pessoas && VL.pessoas.posicaoDe ? VL.pessoas.posicaoDe(alvo.indice) : null;
        function menuDoAlvo() {
          return [...document.querySelectorAll('.nitro-context-menu')].find((m) => {
            if (m.classList.contains('nitro-widget-high-score') || !m.getClientRects().length) return false;
            const cab = m.querySelector('.menu-header');
            return chave(cab ? cab.textContent : '') === chave(alvo.nome);
          }) || null;
        }
        function ondeEsta() {
          const m = menuDoAlvo();
          if (m) {
            const r = m.getBoundingClientRect();
            const naBorda = r.left < 4 || r.top < 4 || r.right > window.innerWidth - 4 || r.bottom > window.innerHeight - 4;
            if (!naBorda) return { x: r.left + r.width / 2, y: r.bottom + 45, certo: true };
            const conta = piso && VL.mapaQuarto && VL.mapaQuarto.calibrado() ? VL.mapaQuarto.telaDoPiso(piso.x, piso.y, 0) : null;
            if (conta) return { x: conta.x, y: conta.y - 35, certo: true };
            return { x: r.left + r.width / 2, y: r.bottom + 45, certo: false };
          }
          const conta = piso && VL.mapaQuarto && VL.mapaQuarto.calibrado() ? VL.mapaQuarto.telaDoPiso(piso.x, piso.y, 0) : null;
          return conta ? { x: conta.x, y: conta.y - 35, certo: true } : null;
        }
        const quadro = canvasDoQuarto();
        const camera = VL.zoomCamera;
        if (camera) camera.normal(true);
        let p = ondeEsta() || ponto;
        if (p && quadro) {
          const r = quadro.getBoundingClientRect();
          const meio = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          // Arrasta a câmera do jogo até a pessoa ficar perto do meio, medindo de novo a cada vez.
          for (let volta = 0; volta < 4 && p; volta++) {
            const dx = meio.x - p.x;
            const dy = meio.y - p.y;
            if (Math.abs(dx) < r.width * 0.12 && Math.abs(dy) < r.height * 0.12) break;
            await arrastarCamera(quadro, dx, dy);
            if (VL.mapaQuarto) VL.mapaQuarto.deslocar(dx, dy);
            // o menu acompanha o avatar no quadro seguinte: dois quadros bastam
            await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
            p = ondeEsta() || { x: meio.x, y: meio.y };
          }
        }
        if (p && camera) {
          camera.para(2.6, p, true);
          setTimeout(function () { camera.normal(); setTimeout(acender, 700); }, 2600);
        } else {
          acender();
          if (!ponto) camada.aviso('Não deu para achar ' + alvo.nome + ' na tela; ' + (VL.zoomCamera ? '' : 'ligue o Zoom do quarto para a câmera ir até a pessoa. ') + 'O Holofote mostra onde está.');
        }
      }
      if (camada.estiloPagina) ctx.aoParar(camada.estiloPagina('amigos-achar', 'html[data-vl-achando] .draggable-window:has(.nitro-user-chooser-widget) { opacity: 0 !important; pointer-events: none !important; }'));
      ctx.comando({
        nome: 'achar',
        apelidos: ['encontrar'],
        alvoX: true,
        uso: 'achar <apelido | x>',
        descricao: 'Mostra onde a pessoa está no quarto: a câmera vai até ela, volta, e ela fica com um holofote por alguns segundos (só na sua tela).',
        executar(pedido) {
          if (!exigir()) return;
          const nome = String(pedido.args[0] || '').replace(/^@/, '');
          if (!nome) { camada.aviso('Diga quem: /achar <apelido>.', { tipo: 'erro' }); return; }
          achar(nome);
        },
      });
      ctx.comando({
        nome: 'lotado',
        apelidos: ['destacar'],
        uso: 'lotado [segundos]',
        descricao: 'Destaca agora os seus amigos no quarto: quem não é amigo muda de aparência por alguns segundos (só na sua tela).',
        executar(pedido) {
          if (!exigir()) return;
          const seg = Math.min(60, Math.max(1, Number(pedido.args[0]) || Number(ctx.secao().segundosLotado) || 5));
          const n = destacarLotado(seg);
          camada.aviso(n ? n + ' pessoa(s) que não são suas amigas destacadas por ' + seg + ' s.' : 'Ninguém para destacar: só amigos no quarto (ou a lista ainda não chegou).');
        },
      });
      ctx.aoConfig(function (secao) {
        if (secao !== 'amigos') return;
        aplicarSoAmigos(true);
      });
      ctx.comando({
        nome: 'soamigos',
        uso: 'soamigos',
        descricao: 'Liga ou desliga: esconde da sua tela quem não é seu amigo, em todos os quartos (o mesmo que a opção "Mostrar só amigos").',
        executar() {
          if (!exigir()) return;
          ctx.alterar('amigos', { soAmigos: !(ctx.secao().soAmigos === true) }); // o aoConfig liga ou desliga
        },
      });

      function exigir() {
        if (conexao.disponivel()) return true;
        camada.aviso('Ligue o módulo "Conexão do jogo" e recarregue o hotel.', { tipo: 'erro' });
        return false;
      }

      ctx.comando({
        nome: 'seguir',
        alvoX: true,
        uso: 'seguir <apelido>',
        descricao: 'Vai para o quarto em que o amigo está (se ele permitir).',
        executar(pedido) {
          if (!exigir()) return;
          const id = porNome.get(chave(pedido.args[0]));
          if (id == null) { camada.aviso('Esse apelido não está na sua lista de amigos.', { tipo: 'erro' }); return; }
          conexao.enviar(SAIDA.SEGUIR_AMIGO, [['i', id]]);
        },
      });

      // Janela de amigos do Vagalume (pedido do usuário em 2026-11-14): cabeça do avatar (gerador de
      // imagens do próprio Habblet), apelido, missão, e botões para seguir, mandar mensagem e abrir o perfil.
      const el = camada.el;
      const RELACAO = { 1: '❤', 2: '☺', 3: '💀' };
      function cabeca(visual) {
        const img = document.createElement('img');
        img.className = 'vl-amigo-cabeca';
        img.alt = '';
        img.loading = 'lazy';
        if (visual) img.src = 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(visual) + '&headonly=1&direction=2&head_direction=3';
        return img;
      }
      function fecharJanela() { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); }
      function escreverNoChat(texto) {
        const campo = VL.jogo && VL.jogo.entradaChat();
        if (!campo) { camada.aviso('Entre num quarto para escrever.', { tipo: 'erro' }); return; }
        VL.jogo.definirValor(campo, texto);
        campo.focus();
      }
      function linhaDoAmigo(a) {
        const p = VL.comandos ? VL.comandos.inicioDigitado(ctx.config().comandos.prefixo) : '/';
        const botoes = [];
        const botao = (rotulo, dica, fazer, desligado) => {
          const b = el('button', { type: 'button', class: 'vl-amigo-botao', title: dica, texto: rotulo });
          if (desligado) b.disabled = true;
          b.addEventListener('click', function (ev) { ev.stopPropagation(); fazer(); });
          return b;
        };
        botoes.push(botao('Seguir', a.online ? (a.podeSeguir ? 'Ir para o quarto em que ' + a.nome + ' está' : a.nome + ' não deixa ser seguido') : 'Offline', function () { conexao.enviar(SAIDA.SEGUIR_AMIGO, [['i', a.id]]); fecharJanela(); }, !a.online || !a.podeSeguir));
        botoes.push(botao('Mensagem', 'Escrever uma mensagem privada', function () { fecharJanela(); setTimeout(function () { escreverNoChat(p + 'msg ' + a.nome + ' '); }, 50); }));
        botoes.push(botao('Perfil', 'Abrir o perfil no jogo', function () { conexao.enviar(SAIDA.PERFIL, [['i', a.id], ['b', true]]); fecharJanela(); }));
        return el('div', { class: 'vl-amigo' + (a.online ? ' online' : '') }, [
          el('div', { class: 'vl-amigo-foto', 'data-letra': a.visual ? '' : String(a.nome || '?').charAt(0).toUpperCase() }, [a.visual ? cabeca(a.visual) : null, el('span', { class: 'vl-amigo-ponto', title: a.online ? 'Online' : 'Offline' })]),
          el('div', { class: 'vl-amigo-texto' }, [
            el('div', { class: 'vl-amigo-nome' }, [document.createTextNode(a.nome), RELACAO[a.relacionamento] ? el('span', { class: 'vl-amigo-relacao', texto: ' ' + RELACAO[a.relacionamento] }) : null]),
            el('div', { class: 'vl-amigo-missao', texto: a.missao || (a.online ? 'Online' : 'Offline'), title: a.missao || '' }),
          ]),
          el('div', { class: 'vl-amigo-botoes' }, botoes),
        ]);
      }
      ctx.comando({
        nome: 'amigos',
        uso: 'amigos',
        descricao: 'Abre a lista de amigos do Vagalume: quem está online, seguir, mensagem e perfil.',
        executar() {
          if (!exigir()) return;
          if (!amigos.size) { pedirLista(); camada.aviso('Pedi a lista ao jogo; tente de novo em um instante.'); return; }
          const todos = [...amigos.values()].sort((a, b) => (a.relacionamento > 0 ? 0 : 1) - (b.relacionamento > 0 ? 0 : 1) || a.nome.localeCompare(b.nome));
          const busca = el('input', { type: 'search', class: 'vl-amigos-busca', placeholder: 'Procurar amigo…', 'aria-label': 'Procurar amigo' });
          const corpo = el('div', { class: 'vl-amigos-lista' });
          function desenhar() {
            const q = String(busca.value || '').trim().toLowerCase();
            const visiveis = todos.filter((a) => !q || a.nome.toLowerCase().includes(q));
            const on = visiveis.filter((a) => a.online);
            const off = visiveis.filter((a) => !a.online);
            const nos = [];
            nos.push(el('div', { class: 'vl-amigos-grupo', texto: 'Online (' + on.length + ')' }));
            nos.push(...(on.length ? on.map(linhaDoAmigo) : [el('p', { class: 'vl-nota', texto: 'Ninguém online agora.' })]));
            nos.push(el('div', { class: 'vl-amigos-grupo', texto: 'Offline (' + off.length + ')' }));
            nos.push(...off.map(linhaDoAmigo));
            corpo.replaceChildren(...nos);
          }
          busca.addEventListener('input', desenhar);
          busca.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
          desenhar();
          camada.dialogo({
            titulo: 'Amigos',
            texto: todos.filter((a) => a.online).length + ' online de ' + todos.length + '.',
            conteudo: el('div', { class: 'vl-amigos' }, [busca, corpo]),
            largo: true,
          });
          setTimeout(function () { busca.focus(); }, 30);
        },
      });

      ctx.comando({
        nome: 'msg',
        alvoX: true,
        uso: 'msg <apelido> <texto>',
        descricao: 'Manda uma mensagem privada para um amigo.',
        executar(pedido) {
          if (!exigir()) return;
          const apelido = pedido.args[0];
          const texto = pedido.args.slice(1).join(' ').trim();
          const id = porNome.get(chave(apelido));
          if (!apelido || !texto) { camada.aviso('Use: msg <apelido> <texto>', { tipo: 'erro' }); return; }
          if (id == null) { camada.aviso(apelido + ' não está na sua lista de amigos.', { tipo: 'erro' }); return; }
          conexao.enviar(SAIDA.MENSAGEM_PRIVADA, [['i', id], ['s', texto.slice(0, 255)]]).then(function (r) {
            camada.aviso(r.ok ? 'Mensagem enviada para ' + amigos.get(id).nome + '.' : 'Não deu para enviar: ' + r.motivo + '.', { tipo: r.ok ? 'ok' : 'erro' });
          });
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
