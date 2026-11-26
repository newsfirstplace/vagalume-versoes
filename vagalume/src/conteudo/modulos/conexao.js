// Vagalume — módulo "conexao": liga o adaptador de conexão (o fundo o instala no mundo da página
// quando este módulo está ligado) e reúne as funções que dependem dele. Cada função tem chave
// própria na seção `conexao`. Nada sai da aba: o registro e o histórico de quartos ficam só na
// memória, e o registro só vira arquivo se o usuário pedir.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.conexao || !VL.codigos || !VL.jogo) return;
  const { nucleo, camada, conexao, codigos, jogo } = VL;
  const { SAIDA, ENTRADA } = codigos;
  const LIMITE_REGISTRO = 1000;
  const LIMITE_QUARTOS = 30;
  const MARCA_SAIU = 'data-vl-saiu';
  let avisouRecarga = false;

  // Os balões do Habblet não guardam quem falou; só o apelido escrito nele (conferido ao vivo).
  function autorDoBalao(el) {
    const fala = el && jogo.lerFala(el);
    return fala && fala.autor ? fala.autor.toLowerCase() : null;
  }

  function emCampoDeTexto(alvo) { return VL.jogo.campoOcupado(alvo); }

  nucleo.definirModulo({
    id: 'conexao',
    iniciar(ctx) {
      const linhas = [];
      let pararRegistro = null;
      const desfazer = new Map();        // chave da função -> lista de funções que a desligam
      const quartos = [];                // { id, modelo, quando }, mais recente no fim
      const presentes = new Map();       // índice -> id do usuário, no quarto atual
      const nomes = new Map();           // índice -> apelido, no quarto atual
      let listaInicialRecebida = false;
      let audioVisitantes = null;
      const tituloOriginal = document.title;
      let meuNome = '';
      const sairam = new Set();          // apelidos (minúsculas) de quem saiu do quarto atual
      let meuIndice = null;
      let minhaPosicao = null;
      let falaPendente = null;           // { texto, quando } da última fala mandada
      let destinoPendente = null;        // { x, y, quando } do último clique de andar
      let removerEstiloSaiu = null;

      // ---------- registro (mapeamento de códigos) ----------

      function anotar(resumo) {
        const seta = resumo.direcao === 'saida' ? '→' : '←';
        linhas.push(camada.carimbo(true) + ' ' + seta + ' ' + resumo.cabecalho + ' (' + resumo.tamanho + ' bytes) ' + (resumo.palpite || ''));
        if (linhas.length > LIMITE_REGISTRO) linhas.splice(0, linhas.length - LIMITE_REGISTRO);
      }
      function ligarRegistro() { if (!pararRegistro) pararRegistro = conexao.registro(anotar); }
      function desligarRegistro() { if (pararRegistro) { pararRegistro(); pararRegistro = null; } }

      // ---------- quem sou eu, onde estou ----------

      function novoQuarto(id, modelo) {
        posicoes.clear();
        if (acompanhando) { camada.aviso('Parei de acompanhar ' + acompanhando.nome + ': você mudou de quarto.'); acompanhando = null; }
        meuIndice = null;
        minhaPosicao = null;
        presentes.clear();
        nomes.clear();
        listaInicialRecebida = false;
        sairam.clear();
        document.querySelectorAll('[' + MARCA_SAIU + ']').forEach((no) => no.removeAttribute(MARCA_SAIU));
        const ultimo = quartos[quartos.length - 1];
        if (!ultimo || ultimo.id !== id) {
          const sabido = infoQuartos.get(id) || {};
          const q = { id, modelo, quando: Date.now(), nome: sabido.nome || '', dono: sabido.dono || '', donoId: sabido.donoId || 0, foto: sabido.foto || '' };
          quartos.push(q);
          if (quartos.length > LIMITE_QUARTOS) quartos.shift();
          // O nome aparece por alguns segundos no aviso do jogo ao entrar (.nitro-room-tools-info, primeiro texto).
          let tentativas = 0;
          const lerNome = setInterval(function () {
            const info = typeof document.querySelector === 'function' ? document.querySelector('.nitro-room-tools-info') : null;
            const texto = info && info.firstElementChild && info.firstElementChild.firstElementChild;
            const nome = texto ? texto.textContent.trim() : '';
            if (q.nome || nome || ++tentativas > 40) { clearInterval(lerNome); if (nome && !q.nome) q.nome = nome.slice(0, 60); }
          }, 250);
        }
      }

      const pontosPorNome = new Map(); // apelido em minúsculas -> pontos de conquista
      const posicoes = new Map();      // índice -> { x, y } (destino, se estiver andando)
      let acompanhando = null;         // { indice, nome }
      let ultimoPassoAcompanhar = 0;
      const visuaisPorNome = new Map(); // apelido em minúsculas -> { nome, visual, genero } (para copiar o visual)
      let nivelClube = null;             // do USER_PERMISSIONS (411); null enquanto não chegou
      const efeitoPorIndice = new Map();  // índice -> efeito atual (UNIT_EFFECT), para devolver depois de um efeito só na tela
      const tiposPorNome = new Map();  // apelido em minúsculas -> 1 pessoa, 2 pet, 3 bot, 4 bot alugável
      const infoQuartos = new Map(); // id -> { nome, dono, foto } (do 687)
      let eu = null; // { id, nome, visual, genero }, do 2725 (chega no login ou quando pedido pelo 357)
      const sempre = [
        conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function (l) {
          const modelo = l.texto();
          novoQuarto(l.inteiro(), modelo);
        }),
        // Nome, dono e foto do quarto (para a lista de últimos quartos). Formato lido no cliente (2026-11-16).
        conexao.ouvir('entrada', ENTRADA.INFO_QUARTO, function (l) {
          try {
            l.booleano();
            const id = l.inteiro();
            const nome = l.texto();
            const donoId = l.inteiro();
            const dono = l.texto();
            l.inteiro(); l.inteiro(); l.inteiro(); l.texto(); l.inteiro(); l.inteiro(); l.inteiro(); l.inteiro();
            const nTags = l.inteiro();
            for (let i = 0; i < nTags && i < 20; i++) l.texto();
            const mascara = l.inteiro();
            const foto = mascara & 1 ? l.texto() : '';
            for (const q of quartos) if (q.id === id) { q.nome = String(nome).slice(0, 60); q.dono = String(dono).slice(0, 40); q.donoId = donoId; if (foto) q.foto = foto; }
            infoQuartos.set(id, { nome: String(nome).slice(0, 60), dono: String(dono).slice(0, 40), donoId, foto });
          } catch (erro) { /* formato diferente: fica o nome lido da tela */ }
        }),
        conexao.ouvir('saida', SAIDA.FALAR, function (l) { falaPendente = { texto: l.texto(), quando: Date.now() }; }),
        conexao.ouvir('saida', SAIDA.GRITAR, function (l) { falaPendente = { texto: l.texto(), quando: Date.now() }; }),
        conexao.ouvir('saida', SAIDA.ANDAR, function (l) { destinoPendente = { x: l.inteiro(), y: l.inteiro(), quando: Date.now() }; }),
      ];
      // Apelido do próprio usuário no título da aba (opção nomeNoTitulo).
      function atualizarTitulo() {
        if (meuIndice != null && nomes.has(meuIndice)) meuNome = nomes.get(meuIndice);
        const quer = ctx.secao().nomeNoTitulo && meuNome;
        const novo = quer ? meuNome + ' · ' + tituloOriginal : tituloOriginal;
        if (document.title !== novo && (quer || document.title.endsWith(' · ' + tituloOriginal))) document.title = novo;
      }
      ctx.aoParar(function () { if (document.title.endsWith(' · ' + tituloOriginal)) document.title = tituloOriginal; });

      function aoFalaRecebida(l) {
        const fala = codigos.lerFala(l);
        if (falaPendente && fala.texto === falaPendente.texto && Date.now() - falaPendente.quando < 4000) {
          meuIndice = fala.indice;
          falaPendente = null;
          atualizarTitulo();
        }
      }
      sempre.push(conexao.ouvir('entrada', ENTRADA.FALA, aoFalaRecebida));
      sempre.push(conexao.ouvir('entrada', ENTRADA.GRITO, aoFalaRecebida));
      sempre.push(conexao.ouvir('entrada', ENTRADA.ESTADOS, function (l) {
        const estados = codigos.lerEstados(l);
        if (meuIndice == null && destinoPendente && Date.now() - destinoPendente.quando < 4000) {
          // Quem começou a andar para o piso que eu cliquei: se for um só, sou eu.
          const candidatos = estados.filter(function (e) {
            const d = codigos.destinoDoMovimento(e.acoes);
            return d && d.x === destinoPendente.x && d.y === destinoPendente.y;
          });
          if (candidatos.length === 1) { meuIndice = candidatos[0].indice; destinoPendente = null; atualizarTitulo(); }
        }
        const meu = estados.find((e) => e.indice === meuIndice);
        if (meu) minhaPosicao = codigos.destinoDoMovimento(meu.acoes) || { x: meu.x, y: meu.y };
        for (const e of estados) {
          const destino = codigos.destinoDoMovimento(e.acoes);
          const pos = destino || { x: e.x, y: e.y };
          posicoes.set(e.indice, pos);
          if (acompanhando && e.indice === acompanhando.indice) seguirPasso(e, destino);
        }
      }));
      // Acompanhar: o jogo não anda até um piso ocupado, então o alvo é o piso que a pessoa acabou de
      // deixar (o rastro). Parada, sem rastro, vai para o piso vizinho do lado de quem acompanha.
      function vizinhoDe(pos) {
        if (!minhaPosicao) return { x: pos.x + 1, y: pos.y };
        const dx = Math.sign(minhaPosicao.x - pos.x);
        const dy = Math.sign(minhaPosicao.y - pos.y);
        if (!dx && !dy) return null;
        return { x: pos.x + dx, y: pos.y + dy };
      }
      function seguirPasso(e, destino) {
        if (destino) {
          // Andando: (e.x, e.y) é o piso que a pessoa está deixando agora.
          acompanhando.rastro = { x: e.x, y: e.y };
          irAte(acompanhando.rastro, false);
          return;
        }
        const parada = { x: e.x, y: e.y };
        const alvo = acompanhando.rastro && (acompanhando.rastro.x !== parada.x || acompanhando.rastro.y !== parada.y) ? acompanhando.rastro : vizinhoDe(parada);
        if (alvo) irAte(alvo, true);
      }
      // Anda até um piso. Ao acompanhar, no máximo um pedido a cada 150 ms enquanto a pessoa anda
      // (antes eram 500 ms e só andava a mais de 1 piso do rastro, o que deixava 2 pisos de distância).
      function irAte(pos, sempreVai) {
        if (!pos || !conexao.disponivel()) return;
        if (!sempreVai) {
          // Colado: só deixa de pedir quando já está indo (ou já está) exatamente para esse piso.
          if (minhaPosicao && minhaPosicao.x === pos.x && minhaPosicao.y === pos.y) return;
          if (Date.now() - ultimoPassoAcompanhar < 150) return;
        }
        ultimoPassoAcompanhar = Date.now();
        conexao.enviar(SAIDA.ANDAR, [['i', pos.x], ['i', pos.y]]);
      }
      function indiceDe(nome) {
        const n = String(nome || '').trim().toLowerCase();
        for (const [indice, apelido] of nomes) if (String(apelido).toLowerCase() === n) return indice;
        return null;
      }
      // Clique do meio num balão: anda até quem falou.
      ctx.escutar(window, 'mousedown', function (ev) {
        if (ev.button !== 1 || !ev.isTrusted || !ctx.secao().meioAnda || camada.contem(ev)) return;
        const balao = jogo.balaoDe(ev.target);
        const fala = balao && jogo.lerFala(balao);
        const indice = fala && indiceDe(fala.autor);
        if (indice == null || indice === meuIndice) return;
        ev.preventDefault();
        ev.stopPropagation();
        const pos = posicoes.get(indice);
        const alvo = pos && vizinhoDe(pos);
        if (alvo) irAte(alvo, true);
      }, true);
      function tocarCampainhaVisitante() {
        if (ctx.secao().somVisitantes) tocarDingDong([[0, 784], [0.23, 587]], 0.42);
      }
      // Ding-dong pelo Web Audio (notas [atraso, frequência] e duração de cada uma).
      function tocarDingDong(notas, duracao) {
        try {
          const Contexto = window.AudioContext || window.webkitAudioContext;
          if (!Contexto) return;
          if (!audioVisitantes) audioVisitantes = new Contexto();
          if (audioVisitantes.state === 'suspended') audioVisitantes.resume().catch(function () {});
          const inicio = audioVisitantes.currentTime + 0.02;
          for (const [atraso, frequencia] of notas) {
            const quando = inicio + atraso;
            for (const [multiplicador, volume] of [[1, 0.055], [2, 0.012]]) {
              const oscilador = audioVisitantes.createOscillator();
              const ganho = audioVisitantes.createGain();
              oscilador.type = 'sine';
              oscilador.frequency.setValueAtTime(frequencia * multiplicador, quando);
              ganho.gain.setValueAtTime(0.0001, quando);
              ganho.gain.exponentialRampToValueAtTime(volume, quando + 0.012);
              ganho.gain.exponentialRampToValueAtTime(0.0001, quando + duracao);
              oscilador.connect(ganho);
              ganho.connect(audioVisitantes.destination);
              oscilador.start(quando);
              oscilador.stop(quando + duracao + 0.02);
            }
          }
        } catch (erro) { /* o navegador pode bloquear o áudio até a primeira interação */ }
      }
      ctx.aoParar(function () { if (audioVisitantes) audioVisitantes.close().catch(function () {}); });
      sempre.push(conexao.ouvir('entrada', ENTRADA.USUARIOS, function (l) {
        const primeiraLista = !listaInicialRecebida;
        if (quartos.length) listaInicialRecebida = true;
        let visitanteNovo = false;
        for (const u of codigos.lerUsuarios(l).lista) {
          if (!primeiraLista && !presentes.has(u.indice) && u.tipo === 1 && (!eu || u.id !== eu.id)) visitanteNovo = true;
          const chaveNome = String(u.nome).trim().toLowerCase();
          if (tiposPorNome.size > 3000) tiposPorNome.clear();
          tiposPorNome.set(chaveNome, u.tipo);
          if (u.visual) { if (visuaisPorNome.size > 3000) visuaisPorNome.clear(); visuaisPorNome.set(chaveNome, { nome: u.nome, visual: u.visual, genero: u.genero || 'M' }); }
          if (u.pontos != null) { if (pontosPorNome.size > 3000) pontosPorNome.clear(); pontosPorNome.set(chaveNome, u.pontos); }
          presentes.set(u.indice, u.id);
          posicoes.set(u.indice, { x: u.x, y: u.y });
          nomes.set(u.indice, u.nome);
          if (eu && u.id === eu.id && u.tipo === 1) meuIndice = u.indice;
          if (u.indice === meuIndice) atualizarTitulo();
          if (sairam.delete(chaveNome)) remarcarSaidas();
        }
        if (visitanteNovo) {
          const q = quartos[quartos.length - 1];
          const meuApelido = String(eu && eu.nome || meuNome || '').trim().toLowerCase();
          if (q && (eu && q.donoId > 0 ? q.donoId === eu.id : !!meuApelido && q.dono.toLowerCase() === meuApelido)) tocarCampainhaVisitante();
        }
      }));
      sempre.push(conexao.ouvir('entrada', ENTRADA.SAIU, function (l) {
        const indice = Number(l.texto());
        const id = presentes.get(indice);
        const nomeSaiu = nomes.get(indice);
        presentes.delete(indice);
        posicoes.delete(indice);
        if (acompanhando && acompanhando.indice === indice) { camada.aviso(acompanhando.nome + ' saiu do quarto; parei de acompanhar.'); acompanhando = null; }
        if (nomeSaiu && id != null && (!eu || id !== eu.id)) { sairam.add(String(nomeSaiu).trim().toLowerCase()); remarcarSaidas(); }
      }));
      ctx.aoParar(function () { sempre.forEach((cancelar) => cancelar()); });
      // Pontos de conquista de quem já apareceu nos quartos desta aba (para o Silenciar).
      sempre.push(conexao.ouvir('entrada', ENTRADA.MEUS_DADOS, function (l) {
        try { eu = codigos.lerMeusDados(l); } catch (erro) { return; }
        if (eu.nome && eu.visual) visuaisPorNome.set(eu.nome.trim().toLowerCase(), { nome: eu.nome, visual: eu.visual, genero: eu.genero });
        for (const [indice, id] of presentes) if (id === eu.id) meuIndice = indice;
        atualizarTitulo();
      }));
      // Se a aba abriu antes da extensão estar pronta, os dados do login já passaram: pede de novo ao entrar no quarto.
      sempre.push(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () {
        if (!eu && conexao.disponivel()) conexao.enviar(SAIDA.MEUS_DADOS, []);
      }));
      // O pacote do login pode chegar antes da Conexão ser ativada. Amigos e grupos
      // precisam do ID mesmo quando a pessoa não entra em outro quarto.
      let tentativasMeusDados = 0;
      const relogioMeusDados = setInterval(function () {
        if (eu || tentativasMeusDados >= 6) { clearInterval(relogioMeusDados); return; }
        if (!conexao.disponivel() || !conexao.conectado()) return;
        tentativasMeusDados++;
        conexao.enviar(SAIDA.MEUS_DADOS, []);
      }, 5000);
      ctx.aoParar(function () { clearInterval(relogioMeusDados); });
      // Troca de roupa no quarto (UNIT_INFO): atualiza o visual guardado da pessoa.
      sempre.push(conexao.ouvir('entrada', ENTRADA.INFO_UNIDADE, function (l) {
        const indice = l.inteiro();
        const visual = l.texto();
        const genero = l.texto();
        const nome = nomes.get(indice);
        if (nome && visual) visuaisPorNome.set(String(nome).trim().toLowerCase(), { nome, visual, genero: genero || 'M' });
      }));
      sempre.push(conexao.ouvir('entrada', ENTRADA.PERMISSOES, function (l) { nivelClube = l.inteiro(); }));
      sempre.push(conexao.ouvir('entrada', ENTRADA.EFEITO, function (l) { const i = l.inteiro(); efeitoPorIndice.set(i, l.inteiro()); }));
      sempre.push(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { efeitoPorIndice.clear(); }));
      // Chega ao lado da pessoa (se ainda não estiver) e vira para ela. Resolve com true quando está ao
      // lado, ou false se não deu (pessoa fora do quarto, posição desconhecida, demorou demais).
      function chegarPerto(nome) {
        const indice = indiceDe(nome);
        const alvo = indice == null ? null : posicoes.get(indice);
        if (!alvo || !conexao.disponivel()) return Promise.resolve(false);
        const ao = () => { const p = minhaPosicao || (meuIndice != null ? posicoes.get(meuIndice) : null); return p && Math.max(Math.abs(p.x - alvo.x), Math.abs(p.y - alvo.y)) <= 1 && (p.x !== alvo.x || p.y !== alvo.y); };
        const virar = () => conexao.enviar(SAIDA.OLHAR_PARA, [['i', alvo.x], ['i', alvo.y]], { forcar: true });
        if (ao()) { virar(); return Promise.resolve(true); }
        const destino = vizinhoDe(alvo);
        if (!destino) return Promise.resolve(false);
        irAte(destino, true);
        // Desiste quando o avatar fica parado sem chegar (piso ao lado ocupado ou atrás de um balcão),
        // ou depois de 8 s; nesse caso vira para a pessoa de onde está (visto ao vivo em 2026-11-15).
        return new Promise(function (resolver) {
          const inicio = Date.now();
          let ultima = null;
          let paradoDesde = Date.now();
          (function olhar() {
            if (ao()) { setTimeout(function () { virar(); resolver(true); }, 350); return; }
            const p = minhaPosicao || (meuIndice != null ? posicoes.get(meuIndice) : null);
            const chave = p ? p.x + ',' + p.y : '';
            if (chave !== ultima) { ultima = chave; paradoDesde = Date.now(); }
            if (Date.now() - inicio > 8000 || (Date.now() - inicio > 1200 && Date.now() - paradoDesde > 1500)) { virar(); resolver(false); return; }
            setTimeout(olhar, 150);
          })();
        });
      }
      function listaDoQuarto() {
        const meu = VL.pessoas && VL.pessoas.eu ? String(VL.pessoas.eu() || '').toLowerCase() : '';
        const saida = [];
        for (const indice of presentes.keys()) {
          const nome = nomes.get(indice);
          if (!nome || String(nome).toLowerCase() === meu) continue;
          if (tiposPorNome.get(String(nome).trim().toLowerCase()) !== 1) continue;
          saida.push(nome);
        }
        return saida.sort((a, b) => a.localeCompare(b));
      }
      function visualDe(nome) {
        const chave = String(nome || '').trim().toLowerCase();
        if (!chave) return null;
        const noQuarto = visuaisPorNome.get(chave);
        if (noQuarto && noQuarto.visual) return noQuarto;
        if (eu && eu.visual && eu.nome.trim().toLowerCase() === chave) {
          return { nome: eu.nome, visual: eu.visual, genero: eu.genero };
        }
        // O console funciona também no lobby e com amigos que estão em outros quartos.
        const amigos = VL.amigos && VL.amigos.lista ? VL.amigos.lista() : [];
        const amigo = amigos.find((p) => p.visual && String(p.nome || '').trim().toLowerCase() === chave);
        return amigo ? { nome: amigo.nome, visual: amigo.visual, genero: amigo.genero || 'M' } : null;
      }
      VL.pessoas = { quartoAtual() { const q = quartos[quartos.length - 1]; return q ? q.id : null; }, quartoNome() { const q = quartos[quartos.length - 1]; return q && q.nome ? q.nome : ''; }, quartoDono() { const q = quartos[quartos.length - 1]; return q && (q.dono || q.donoId) ? { nome: q.dono || '', id: q.donoId || 0 } : null; }, lista: listaDoQuarto, meuId() { return eu ? eu.id : null; }, eu() { if (eu) return eu.nome; return meuIndice == null ? null : (nomes.get(meuIndice) || null); }, pontosDe(nome) { const p = pontosPorNome.get(String(nome || '').trim().toLowerCase()); return p == null ? null : p; }, tipoDe(nome) { const t = tiposPorNome.get(String(nome || '').trim().toLowerCase()); return t == null ? null : t; }, visualDe, nivelClube() { return nivelClube; }, chegarPerto, indiceDe, meuIndice() { return meuIndice; }, efeitoDe(indice) { return efeitoPorIndice.get(indice) || 0; }, posicaoDe(indice) { return posicoes.get(indice) || null; }, acompanhando() { return acompanhando ? acompanhando.nome : null; } };
      ctx.aoParar(function () { delete VL.pessoas; });

      // ---------- congelar o avatar ----------
      // Segura os pedidos de andar (3320): clicar no chão ou num mobi não move o avatar.
      let descongelar = null;
      // A marca no <html> deixa a aba Construção mostrar o estado do botão.
      const marcarCongelado = (sim) => { if (sim) document.documentElement.setAttribute('data-vl-congelado', ''); else document.documentElement.removeAttribute('data-vl-congelado'); };
      ctx.aoParar(function () { if (descongelar) descongelar(); descongelar = null; marcarCongelado(false); });
      ctx.comando({
        nome: 'congelar',
        uso: 'congelar',
        descricao: 'Liga ou desliga: o avatar para de andar quando você clica no quarto. Setas e comandos de andar também ficam parados.',
        executar() {
          if (!conexao.disponivel()) { camada.aviso('Recarregue o hotel com a Conexão ligada.', { tipo: 'erro' }); return; }
          if (descongelar) { descongelar(); descongelar = null; marcarCongelado(false); camada.aviso('Avatar solto: ele volta a andar.'); return; }
          descongelar = conexao.bloquear('saida', SAIDA.ANDAR);
          marcarCongelado(true);
          camada.aviso('Avatar congelado. Use /congelar de novo para soltar.');
        },
      });

      // ---------- falas de quem saiu ----------

      function remarcarSaidas() {
        if (!ctx.secao().escurecerQuemSaiu) return;
        document.querySelectorAll(jogo.SELETORES.balao[0]).forEach(function (no) {
          if (sairam.has(autorDoBalao(no))) no.setAttribute(MARCA_SAIU, '');
          else no.removeAttribute(MARCA_SAIU);
        });
      }
      ctx.aoParar(jogo.observarFalas(function (fala) {
        if (fala.el && ctx.secao().escurecerQuemSaiu && sairam.has(String(fala.autor || '').toLowerCase())) fala.el.setAttribute(MARCA_SAIU, '');
      }));

      // ---------- funções que bloqueiam mensagens ----------

      const BLOQUEIOS = {
        esconderMeuDigitando: [['saida', SAIDA.DIGITANDO], ['saida', SAIDA.PAROU_DE_DIGITAR]],
        ocultarDigitando: [['entrada', ENTRADA.DIGITANDO]],
        antiGiro: [['saida', SAIDA.OLHAR_PARA]],
        cliqueSemAviso: [['saida', SAIDA.CLICAR_USUARIO]],
      };

      function aplicar() {
        const opcoes = ctx.secao();
        for (const [chave, lista] of Object.entries(BLOQUEIOS)) {
          const quer = opcoes[chave] === true;
          if (quer && !desfazer.has(chave)) desfazer.set(chave, lista.map(([dir, cod]) => conexao.bloquear(dir, cod)));
          else if (!quer && desfazer.has(chave)) { desfazer.get(chave).forEach((fn) => fn()); desfazer.delete(chave); }
        }
        if (opcoes.escurecerQuemSaiu && !removerEstiloSaiu) {
          removerEstiloSaiu = camada.estiloPagina('saiu', '[' + MARCA_SAIU + '] { opacity: .4 !important; filter: grayscale(.8) !important; }');
          remarcarSaidas();
        } else if (!opcoes.escurecerQuemSaiu && removerEstiloSaiu) {
          removerEstiloSaiu();
          removerEstiloSaiu = null;
          document.querySelectorAll('[' + MARCA_SAIU + ']').forEach((no) => no.removeAttribute(MARCA_SAIU));
        }
      }
      aplicar();
      ctx.aoConfig(function (secao) { if (secao === 'conexao') { aplicar(); atualizarTitulo(); } });
      ctx.aoParar(function () {
        for (const lista of desfazer.values()) lista.forEach((fn) => fn());
        desfazer.clear();
        if (removerEstiloSaiu) removerEstiloSaiu();
        removerEstiloSaiu = null;
        document.querySelectorAll('[' + MARCA_SAIU + ']').forEach((no) => no.removeAttribute(MARCA_SAIU));
        desligarRegistro();
      });

      // ---------- andar com as setinhas ----------

      // Seta anda um passo. O Shift+seta (virar) saiu a pedido do usuário em 2026-11-14: virar agora é
      // pelas setas ao lado do quadro do próprio avatar (módulo Interface) ou pelo comando /olhar.
      ctx.escutar(window, 'keydown', function (ev) { if (ctx.secao().setinhas) VL.jogo.segurarModificador(ev); }, true);
      // Cada seta segue um eixo do piso; duas juntas fazem a diagonal da tela (codigos.passoSetas).
      // O passo sai 45 ms depois da primeira seta, para dar tempo de a segunda chegar.
      const setasApertadas = new Set(); // seguradas agora
      const setasDaJanela = new Set();  // apertadas nos últimos 45 ms (um toque rápido também conta)
      let relogioSeta = 0;
      function andarComSetas() {
        relogioSeta = 0;
        const pos = minhaPosicao || (meuIndice != null ? posicoes.get(meuIndice) : null);
        if (!pos) { setasDaJanela.clear(); camada.aviso('Clique uma vez no chão ou fale algo para o Vagalume saber onde você está.'); return; }
        const teclas = Array.from(new Set([...setasDaJanela, ...setasApertadas]));
        setasDaJanela.clear();
        const alvo = codigos.passoSetas(pos, teclas);
        if (alvo) conexao.enviar(SAIDA.ANDAR, [['i', alvo.x], ['i', alvo.y]]);
      }
      ctx.escutar(document, 'keydown', function (evento) {
        if (!ctx.secao().setinhas || !codigos.EIXOS_SETAS[evento.key]) return;
        if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return;
        if (emCampoDeTexto(evento.target) || camada.contem(evento)) return;
        evento.preventDefault();
        evento.stopPropagation(); // senão o jogo abre o chat e as próximas setas vão para ele
        setasApertadas.add(evento.key);
        setasDaJanela.add(evento.key);
        if (!relogioSeta) relogioSeta = setTimeout(andarComSetas, 45);
      }, true);
      ctx.escutar(document, 'keyup', function (evento) { setasApertadas.delete(evento.key); }, true);
      ctx.escutar(window, 'blur', function () { setasApertadas.clear(); });

      // Virar o avatar para um lado da tela: olha para o piso vizinho naquela direção. Com o anti-giro
      // ligado, o giro pedido aqui passa mesmo assim (o anti-giro é para o clique no avatar).
      ctx.comando({
        nome: 'olhar',
        apelidos: ['virar'],
        uso: 'olhar <cima | baixo | esquerda | direita | ne | no | se | so>',
        descricao: 'Vira o seu avatar para um lado da tela, sem andar. Também pelas setas ao lado do seu quadro.',
        executar(pedido) {
          if (!exigirAdaptador()) return;
          const lado = codigos.LADOS[String(pedido.args[0] || '').toLowerCase()];
          if (!lado) { camada.aviso('Use: ' + codigos.NOMES_LADOS.join(', ') + '.', { tipo: 'erro' }); return; }
          const pos = minhaPosicao || (meuIndice != null ? posicoes.get(meuIndice) : null);
          if (!pos) { camada.aviso('Clique uma vez no chão ou fale algo para o Vagalume saber onde você está.'); return; }
          conexao.enviar(SAIDA.OLHAR_PARA, [['i', pos.x + lado[0]], ['i', pos.y + lado[1]]], { forcar: true });
        },
      });

      // ---------- latência (/ping) ----------
      // O pedido de latência do cliente (295) não teve resposta no teste; o de visuais salvos (2742)
      // é respondido na hora pelo 3315. Mede-se o tempo entre os dois. A resposta não é guardada.
      // Conferido de novo em 2026-11-14: o 295 continua sem resposta; o 2742 → 3315 volta em ~200 ms.
      // O comando /ping saiu (pedido do usuário): quem mostra a latência agora é o contador, que chama
      // VL.latencia.medir() de tempos em tempos. Uma medida por vez; sem resposta em 5 s, devolve null.
      let esperaPing = null;
      sempre.push(conexao.ouvir('entrada', ENTRADA.VISUAIS, function () {
        if (!esperaPing) return;
        const ms = Math.round(performance.now() - esperaPing.inicio);
        clearTimeout(esperaPing.relogio);
        const fim = esperaPing.resolver;
        esperaPing = null;
        fim(ms);
      }));
      // Uma amostra: manda o pedido e espera a resposta (no máximo 3 s). O envio e a chegada passam
      // pelo adaptador de forma síncrona, então o tempo é a ida e volta pela rede mais o atraso do
      // navegador para entregar a resposta (maior quando o jogo está ocupado desenhando).
      function amostra() {
        if (esperaPing) return esperaPing.promessa;
        if (!conexao.disponivel() || !conexao.conectado()) return Promise.resolve(null);
        let resolver;
        const promessa = new Promise((r) => { resolver = r; });
        esperaPing = {
          inicio: performance.now(),
          promessa,
          resolver,
          relogio: setTimeout(function () { esperaPing = null; resolver(null); }, 3000),
        };
        conexao.enviar(SAIDA.PEDIR_VISUAIS, [['i', 0]]);
        return promessa;
      }
      // Uma medida = 3 amostras seguidas; vale a mediana (um pico isolado não conta). Mínimo, máximo e
      // variação ficam em VL.latencia.ultima, para a dica do contador.
      let rodada = null;
      function medirLatencia() {
        if (rodada) return rodada;
        rodada = (async function () {
          const tempos = [];
          for (let i = 0; i < 3; i++) {
            const ms = await amostra();
            if (ms != null) tempos.push(ms);
            if (i < 2) await new Promise((r) => setTimeout(r, 120));
          }
          rodada = null;
          if (!tempos.length) { if (VL.latencia) VL.latencia.ultima = null; return null; }
          const ordem = tempos.slice().sort((x, y) => x - y);
          const mediana = ordem[Math.floor(ordem.length / 2)];
          if (VL.latencia) VL.latencia.ultima = { mediana, minimo: ordem[0], maximo: ordem[ordem.length - 1], amostras: tempos.length };
          return mediana;
        })();
        return rodada;
      }
      VL.latencia = { medir: medirLatencia, ultima: null };
      ctx.aoParar(function () { delete VL.latencia; if (esperaPing) { clearTimeout(esperaPing.relogio); esperaPing.resolver(null); esperaPing = null; } });

      // ---------- anti-ausente ----------
      // Liberado pelo usuário em 2026-11-13. A versão antiga mandava a expressão "Inativo" (5), que
      // faz o contrário: põe o avatar dormindo (zzz). Agora, a cada minuto sem nenhuma ação sua,
      // repete a dança em que você está (0 = parado), o que não muda nada na tela e conta como ação.
      let ultimaAcao = Date.now();
      let minhaDanca = 0;
      sempre.push(conexao.ouvir('saida', SAIDA.DANCAR, function (l) { try { minhaDanca = l.inteiro(); } catch (erro) { minhaDanca = 0; } }));
      sempre.push(conexao.ouvir('saida', SAIDA.ANDAR, function () { minhaDanca = 0; }));
      sempre.push(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { minhaDanca = 0; }));
      for (const cod of [SAIDA.FALAR, SAIDA.GRITAR, SAIDA.ANDAR, SAIDA.OLHAR_PARA, SAIDA.CLICAR_MOBI, SAIDA.DANCAR, SAIDA.PLACA]) {
        sempre.push(conexao.ouvir('saida', cod, function () { ultimaAcao = Date.now(); }));
      }
      const relogioAusente = setInterval(function () {
        if (!ctx.secao().antiAusente || !conexao.conectado() || !quartos.length) return;
        if (Date.now() - ultimaAcao < 55000) return;
        conexao.enviar(SAIDA.DANCAR, [['i', minhaDanca]]);
        ultimaAcao = Date.now() - 5000 + Math.round(Math.random() * 10000); // pequena variação entre os envios
      }, 15000);
      ctx.aoParar(function () { clearInterval(relogioAusente); });

      // ---------- simular direitos ----------
      // Liberado pelo usuário em 2026-11-13. Em quarto onde você não tem direitos, entrega ao seu jogo
      // o aviso "você tem direitos" (780, nível 1), para ver os menus de quem tem. Só na sua tela: o
      // servidor continua recusando o que você não pode fazer.
      let direitosNoQuarto = false;
      let relogioDireitos = null;
      sempre.push(conexao.ouvir('entrada', ENTRADA.DIREITOS, function (l) { if (l.inteiro() > 0) direitosNoQuarto = true; }));
      sempre.push(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () {
        direitosNoQuarto = false;
        clearTimeout(relogioDireitos);
        relogioDireitos = setTimeout(function () {
          if (!ctx.ativo('conexao') || !ctx.secao().simularDireitos || direitosNoQuarto) return;
          conexao.injetar(ENTRADA.DIREITOS, [['i', 1]]);
        }, 2500);
      }));
      ctx.aoParar(function () { clearTimeout(relogioDireitos); });

      // ---------- referências a quartos nas falas ----------
      // Ctrl+clique numa fala com "room:123" ou "quarto:123" oferece entrar no quarto 123.
      ctx.escutar(window, 'click', function (ev) {
        if (!ctx.secao().referencias || !ev.isTrusted || ev.button !== 0) return;
        if (!(ev.ctrlKey || ev.metaKey) || ev.altKey || camada.contem(ev)) return;
        const balao = jogo.balaoDe(ev.target);
        const fala = balao && jogo.lerFala(balao);
        const ids = fala ? codigos.referenciasDeQuarto(fala.texto) : [];
        if (!ids.length) return;
        // Fala com link http: o Ctrl+clique fica com o módulo do chat, para não abrir duas perguntas.
        if (VL.texto && VL.texto.acharLinks(fala.texto).length && ctx.ativo('chat')) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (!exigirAdaptador()) return;
        camada.confirmar('Entrar no quarto ' + ids[0] + '?' + (ids.length > 1 ? ' A fala cita ' + ids.length + ' quartos; vale o primeiro.' : ''), { titulo: 'Referência a quarto', sim: 'Entrar' })
          .then(function (ok) { if (ok) entrar(ids[0]); });
      }, true);

      // ---------- comandos do Habblet ao entrar em cada quarto ----------

      let filaEntrada = [];
      function limparFilaEntrada() { filaEntrada.forEach(clearTimeout); filaEntrada = []; }
      sempre.push(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () {
        limparFilaEntrada();
        const linhas = codigos.linhasAoEntrar(ctx.secao().aoEntrar, ctx.config().comandos.prefixo);
        linhas.forEach(function (linha, i) {
          // Espera o quarto carregar; depois uma linha a cada 1,2 s, para não cair no anti-flood.
          filaEntrada.push(setTimeout(function () {
            if (ctx.ativo('conexao')) conexao.enviar(SAIDA.FALAR, [['s', linha], ['i', 0]]);
          }, 2000 + i * 1200));
        });
      }));
      ctx.aoParar(limparFilaEntrada);

      // ---------- conexão perdida e volta ao quarto depois de recarregar ----------

      // Guardado no sessionStorage da aba do hotel: sobrevive ao recarregar e some ao fechar a aba.
      const CHAVE_ULTIMO = 'vagalume.ultimoQuarto';
      const LIMITE_VOLTA_MS = 2 * 60 * 1000;
      function lerUltimo() {
        try { return JSON.parse(sessionStorage.getItem(CHAVE_ULTIMO) || 'null'); } catch (erro) { return null; }
      }
      function gravarUltimo() {
        const atual = quartos[quartos.length - 1];
        if (!atual) return;
        try { sessionStorage.setItem(CHAVE_ULTIMO, JSON.stringify({ id: atual.id, visto: Date.now() })); } catch (erro) { /* sem armazenamento: só não volta */ }
      }
      const ultimoAoAbrir = lerUltimo(); // lido antes de qualquer quarto desta carga
      const relogio = setInterval(gravarUltimo, 20000);
      ctx.aoParar(function () { clearInterval(relogio); });
      ctx.escutar(window, 'pagehide', gravarUltimo);
      sempre.push(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { setTimeout(gravarUltimo, 0); }));

      let estavaConectado = false;
      let tentouVoltar = false;
      ctx.aoParar(conexao.aoEstado(function (estado) {
        if (estado.conectado && !tentouVoltar) {
          tentouVoltar = true;
          const u = ultimoAoAbrir;
          if (ctx.secao().voltarAoRelogar && u && Number.isInteger(u.id) && Date.now() - u.visto <= LIMITE_VOLTA_MS) {
            // Pede o quarto assim que o servidor confirma o login (manda os dados da conta, 2725);
            // se esse sinal não vier, tenta depois de 4 s. Se o jogo já levou ao mesmo quarto, não faz nada.
            let feito = false;
            const voltar = function () {
              if (feito) return;
              feito = true;
              clearTimeout(reserva);
              pararSinal();
              const atual = quartos[quartos.length - 1];
              if (ctx.ativo('conexao') && (!atual || atual.id !== u.id)) entrar(u.id);
            };
            const reserva = setTimeout(voltar, 4000);
            const pararSinal = conexao.ouvir('entrada', ENTRADA.MEUS_DADOS, function () { setTimeout(voltar, 250); });
            ctx.aoParar(function () { clearTimeout(reserva); pararSinal(); });
          }
        }
        if (estavaConectado && !estado.conectado && ctx.secao().avisarQueda) {
          gravarUltimo();
          camada.confirmar('A conexão com o hotel caiu. Recarregar agora?' + (ctx.secao().voltarAoRelogar ? ' O Vagalume tenta te levar de volta a este quarto.' : ''),
            { titulo: 'Conexão perdida', sim: 'Recarregar', nao: 'Agora não' })
            .then(function (ok) { if (ok) location.reload(); });
        }
        estavaConectado = estado.conectado;
      }));

      // ---------- aviso de recarga ----------

      setTimeout(function () {
        if (!ctx.ativo('conexao') || conexao.disponivel() || avisouRecarga) return;
        avisouRecarga = true;
        camada.aviso('A conexão do Vagalume vale depois de recarregar o hotel.');
      }, 3000);

      function exigirAdaptador() {
        if (conexao.disponivel()) return true;
        camada.aviso('Adaptador de conexão ausente. Recarregue o hotel.', { tipo: 'erro' });
        return false;
      }

      // Como o navegador do jogo faz (conferido ao vivo): pedir a entrada (2312) e os dados do quarto
      // (2230, com "entrar" = 1). Só o 2312 funciona quando já se está num quarto, mas não da vista do hotel.
      // Pede os dados do quarto com o encaminhamento ligado: o servidor manda o jogo entrar e o próprio
      // jogo abre o quarto (mandar o 2312 direto chega ao servidor, mas a tela do jogo não acompanha).
      function entrar(id) {
        conexao.enviar(SAIDA.DADOS_QUARTO, [['i', id], ['i', 0], ['i', 1]]).then(function (r) {
          if (!r.ok) camada.aviso('Não deu para entrar no quarto: ' + r.motivo + '.', { tipo: 'erro' });
        });
      }

      // ---------- comandos ----------

      // ---------- avisos do quarto: campainha, direitos e curtidas ----------
      let quartoAbertoEm = 0;
      let notaDoQuarto = null;
      sempre.push(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { quartoAbertoEm = Date.now(); notaDoQuarto = null; }));
      sempre.push(conexao.ouvir('entrada', ENTRADA.CAMPAINHA, function (l) {
        if (!ctx.secao().avisarCampainha) return;
        let nome = '';
        try { nome = l.texto(); } catch (erro) { /* formato diferente */ }
        camada.aviso((nome ? nome : 'Alguém') + ' tocou a campainha do quarto.');
        // O jogo só manda a campainha a quem tem direitos no quarto: toca um ding-dong de porta, mais longo.
        if (ctx.secao().somCampainha !== false) tocarDingDong([[0, 659], [0.38, 523], [1.1, 659], [1.48, 523]], 0.7);
      }));
      // Direitos chegam pelo 780 e também no estado do próprio avatar ("/flatctrl N/" no 1640).
      // Os que já vêm na entrada não são novidade; avisa uma vez quando passa de 0 para mais.
      let meuNivel = null;
      sempre.push(conexao.ouvir('entrada', ENTRADA.QUARTO_PRONTO, function () { meuNivel = null; }));
      function nivelDeDireitos(nivel) {
        const antes = meuNivel;
        meuNivel = nivel;
        if (!(nivel > 0) || (antes !== null && antes > 0)) return;
        if (ctx.secao().avisarDireitos && Date.now() - quartoAbertoEm > 3000) camada.aviso('Você recebeu direitos neste quarto.', { tipo: 'ok' });
      }
      sempre.push(conexao.ouvir('entrada', ENTRADA.DIREITOS, function (l) {
        let nivel;
        try { nivel = l.inteiro(); } catch (erro) { return; }
        nivelDeDireitos(nivel);
      }));
      sempre.push(conexao.ouvir('entrada', ENTRADA.ESTADOS, function (l) {
        if (meuIndice == null) return;
        let estados;
        try { estados = codigos.lerEstados(l); } catch (erro) { return; }
        const meu = estados.find((e) => e.indice === meuIndice);
        if (!meu) return;
        const m = /\/flatctrl (\d+)/.exec(meu.acoes || '');
        nivelDeDireitos(m ? Number(m[1]) : 0);
      }));
      // Mute (826), antiflood (566) e quarto silenciado (2533).
      sempre.push(conexao.ouvir('entrada', ENTRADA.MUTE_RESTANTE, function (l) {
        let s;
        try { s = l.inteiro(); } catch (erro) { return; }
        if (!(s > 0)) return;
        const o = ctx.secao();
        if (o.avisarMute) camada.aviso('Você está sem poder falar por ' + tempoLegivel(s) + '.', { tipo: 'erro' });
        if (Number.isInteger(o.placaNoMute) && o.placaNoMute >= 0 && conexao.disponivel()) conexao.enviar(SAIDA.PLACA, [['i', o.placaNoMute]]);
      }));
      sempre.push(conexao.ouvir('entrada', ENTRADA.ANTIFLOOD, function (l) {
        let s;
        try { s = l.inteiro(); } catch (erro) { return; }
        if (s > 0 && ctx.secao().avisarMute) camada.aviso('Antiflood: espere ' + tempoLegivel(s) + ' para falar de novo.');
      }));
      sempre.push(conexao.ouvir('entrada', ENTRADA.QUARTO_MUTADO, function (l) {
        let mutado;
        try { mutado = l.booleano(); } catch (erro) { return; }
        if (ctx.secao().avisarMute && Date.now() - quartoAbertoEm > 3000) camada.aviso(mutado ? 'O dono silenciou o quarto: ninguém sem direitos pode falar.' : 'O quarto voltou a aceitar falas.');
      }));
      function tempoLegivel(s) {
        if (s < 60) return s + ' s';
        const m = Math.floor(s / 60);
        return m < 60 ? m + ' min' + (s % 60 ? ' ' + (s % 60) + ' s' : '') : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
      }
      sempre.push(conexao.ouvir('entrada', ENTRADA.NOTA_QUARTO, function (l) {
        let nota;
        try { nota = l.inteiro(); } catch (erro) { return; }
        if (ctx.secao().avisarCurtidas && notaDoQuarto != null && nota > notaDoQuarto) camada.aviso('O quarto ganhou curtida: nota ' + nota + '.');
        notaDoQuarto = nota;
      }));

      ctx.comando({
        nome: 'acompanhar',
        alvoX: true,
        apelidos: ['andarjunto'],
        uso: 'acompanhar [apelido]',
        descricao: 'Anda atrás de alguém do quarto sempre que essa pessoa se mexe. Sem apelido, para.',
        executar(pedido) {
          if (!exigirAdaptador()) return;
          const nome = pedido.args.join(' ').trim();
          if (!nome) {
            camada.aviso(acompanhando ? 'Parei de acompanhar ' + acompanhando.nome + '.' : 'Você não está acompanhando ninguém.');
            acompanhando = null;
            return;
          }
          const indice = indiceDe(nome);
          if (indice == null) { camada.aviso('Não achei esse apelido neste quarto.', { tipo: 'erro' }); return; }
          if (indice === meuIndice) { camada.aviso('Esse é você.', { tipo: 'erro' }); return; }
          acompanhando = { indice, nome: nomes.get(indice), rastro: null };
          camada.aviso('Acompanhando ' + acompanhando.nome + '. Para parar: ' + (VL.comandos ? VL.comandos.inicioDigitado(ctx.secao('comandos').prefixo) : '/') + 'acompanhar (sem apelido).');
          const pos = posicoes.get(indice);
          const alvo = pos && vizinhoDe(pos);
          if (alvo) irAte(alvo, true);
        },
      });

      ctx.comando({
        nome: 'ir',
        uso: 'ir <número do quarto>',
        descricao: 'Entra no quarto pelo número.',
        executar(pedido) {
          const id = Number(pedido.args[0]);
          if (!Number.isInteger(id) || id <= 0) { camada.aviso('Use: ir <número do quarto>', { tipo: 'erro' }); return; }
          if (exigirAdaptador()) entrar(id);
        },
      });

      // Sussurro para várias pessoas: um sussurro do jogo para cada apelido.
      // A vírgula separa destinatários, mas há apelidos com vírgula (visto ao vivo): junta as partes
      // vizinhas quando a junção é o apelido de alguém que já apareceu num quarto desta aba.
      function separarApelidos(texto) {
        const partes = texto.split(',');
        const saida = [];
        for (let i = 0; i < partes.length;) {
          let fim = i;
          for (let j = partes.length - 1; j > i; j--) {
            if (tiposPorNome.has(partes.slice(i, j + 1).join(',').trim().toLowerCase())) { fim = j; break; }
          }
          const nome = partes.slice(i, fim + 1).join(',').trim();
          if (nome) saida.push(nome);
          i = fim + 1;
        }
        return saida;
      }

      ctx.comando({
        nome: 'sussurrar',
        alvoX: true,
        uso: 'sussurrar <apelido,apelido,…> <texto>',
        descricao: 'Sussurra o mesmo texto para várias pessoas do quarto.',
        executar(pedido) {
          if (!exigirAdaptador()) return;
          const nomes = separarApelidos(String(pedido.args[0] || '')).slice(0, 10);
          const texto = pedido.args.slice(1).join(' ').trim().slice(0, 100);
          if (!nomes.length || !texto) { camada.aviso('Use: sussurrar <apelido,apelido> <texto>', { tipo: 'erro' }); return; }
          nomes.forEach(function (nome, i) {
            setTimeout(function () { conexao.enviar(SAIDA.SUSSURRAR, [['s', nome + ' ' + texto], ['i', 0]]); }, i * 700);
          });
        },
      });

      ctx.comando({
        nome: 'conexao',
        uso: 'conexao',
        descricao: 'Mostra se o adaptador de conexão está instalado e conectado.',
        executar() {
          if (!exigirAdaptador()) return undefined;
          camada.aviso(conexao.conectado() ? 'Conectado ao jogo.' : 'Adaptador instalado, ainda sem conexão com o jogo.');
          return undefined;
        },
      });

      ctx.comando({
        nome: 'quartos',
        uso: 'quartos',
        descricao: 'Lista os quartos visitados nesta sessão (só na memória), com nome, horário, ID e um botão para ir.',
        executar() {
          if (!quartos.length) { camada.aviso('Nenhum quarto visitado desde que o hotel abriu.'); return undefined; }
          const el = camada.el;
          const hora = (q) => { const d = new Date(q.quando); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
          const atual = quartos[quartos.length - 1];
          const vistos = new Set();
          const unicos = quartos.slice().reverse().filter((q) => { if (vistos.has(q.id)) return false; vistos.add(q.id); return true; });
          const linhas = unicos.map(function (q) {
            const nome = q.nome || 'Quarto ' + q.id;
            const aqui = q === atual;
            const ir = el('button', { type: 'button', class: 'vl-amigo-botao', texto: aqui ? 'Aqui' : 'Ir', title: aqui ? 'Você está neste quarto' : 'Ir para ' + nome });
            if (aqui) ir.disabled = true;
            ir.addEventListener('click', function (ev) { ev.stopPropagation(); entrar(q.id); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
            // Foto: a do Habblet (quartos oficiais têm); senão, a primeira letra.
            const foto = el('div', { class: 'vl-amigo-foto', 'data-letra': q.foto ? '' : nome.charAt(0).toUpperCase(), style: 'overflow:hidden;' });
            if (q.foto) {
              const img = el('img', { alt: '', src: 'https://images.habblet.city/habblet-camera/thumbnails/' + encodeURIComponent(q.foto).replace(/%2F/g, '/'), style: 'width:100%;height:100%;object-fit:cover;display:block;' });
              img.addEventListener('error', function () { img.remove(); foto.setAttribute('data-letra', nome.charAt(0).toUpperCase()); });
              foto.appendChild(img);
            }
            return el('div', { class: 'vl-amigo' + (aqui ? ' online' : '') }, [
              foto,
              el('div', { class: 'vl-amigo-texto' }, [
                el('div', { class: 'vl-amigo-nome', texto: nome }),
                el('div', { class: 'vl-amigo-missao', texto: 'Visitado às ' + hora(q) + ' · ID ' + q.id + (q.dono ? ' · de ' + q.dono : '') }),
              ]),
              el('div', { class: 'vl-amigo-botoes' }, [ir]),
            ]);
          });
          camada.dialogo({ titulo: 'Últimos quartos', texto: 'Do mais recente ao mais antigo, só desta sessão.', conteudo: el('div', { class: 'vl-amigos' }, [el('div', { class: 'vl-amigos-lista' }, linhas)]), largo: true });
          return undefined;
        },
      });

      ctx.comando({
        nome: 'reentrar',
        apelidos: ['rejoin'],
        uso: 'reentrar',
        descricao: 'Sai e entra de novo no quarto atual.',
        executar() {
          if (!exigirAdaptador()) return undefined;
          const atual = quartos[quartos.length - 1];
          if (!atual) camada.aviso('Ainda não sei em que quarto você está.', { tipo: 'erro' });
          else entrar(atual.id);
          return undefined;
        },
      });

      ctx.comando({
        nome: 'voltar',
        uso: 'voltar',
        descricao: 'Volta ao quarto anterior.',
        executar() {
          if (!exigirAdaptador()) return undefined;
          const anterior = quartos[quartos.length - 2];
          if (!anterior) camada.aviso('Não há quarto anterior nesta sessão.', { tipo: 'erro' });
          else entrar(anterior.id);
          return undefined;
        },
      });

      // Ícone "Quarto anterior" na barra do hotel, entre o Hotel e o Navegador de quartos (pedido do usuário
      // em 2026-11-19: no lugar do botão da aba Quarto). Faz o mesmo que o comando voltar.
      const PORTA = [
        '................',
        '......kkkkkkkkk.',
        '......kfffffffk.',
        '......kfdddddfk.',
        '......kfdDdDdfk.',
        '......kfdDdDdfk.',
        '......kfdddddfk.',
        '......kfdddddfk.',
        '......kfddddyfk.',
        '......kfdddddfk.',
        '......kfdDdDdfk.',
        '......kfdDdDdfk.',
        '......kfdddddfk.',
        '......kfdddddfk.',
        '......kkkkkkkkk.',
        '................',
      ];
      const SETA = [
        '', '', '', '', '', '', '',
        '...kk',
        '..kgk',
        '.kggkkkkkkk',
        'kgggggggggk',
        '.kGGkkkkkkk',
        '..kGk',
        '...kk',
      ];
      const CORES_ICONE = { k: '#1a1f12', f: '#c9c2b0', d: '#9a6532', D: '#6b4220', y: '#f2c94c', g: '#d6f24a', G: '#8fae22' };
      function svgVoltar() {
        let r = '';
        for (const mapa of [PORTA, SETA]) {
          mapa.forEach(function (linha, y) {
            for (let x = 0; x < linha.length; x++) {
              const c = CORES_ICONE[linha[x]];
              if (c) r += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + c + '"/>';
            }
          });
        }
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">' + r + '</svg>');
      }
      const tirarEstiloVoltar = camada.estiloPagina('conexao-voltar',
        '.nitro-toolbar .vl-icone-voltar { width: 32px; height: 32px; flex: none; align-self: center; cursor: pointer; '
        + 'background: url("' + svgVoltar() + '") center / 30px 30px no-repeat; image-rendering: pixelated; }'
        + '.nitro-toolbar .vl-icone-voltar.sem-anterior { opacity: .45; filter: grayscale(.6); }');
      let iconeVoltar = null;
      function cuidarDoIconeVoltar() {
        if (typeof document.querySelector !== 'function') return;
        const navegador = ctx.secao().iconeVoltar !== false ? document.querySelector('.nitro-toolbar .navigation-item.icon-rooms') : null;
        if (!navegador) { if (iconeVoltar) iconeVoltar.remove(); return; }
        if (!iconeVoltar) {
          iconeVoltar = document.createElement('div');
          iconeVoltar.className = 'navigation-item vl-icone-voltar';
          iconeVoltar.setAttribute('role', 'button');
          iconeVoltar.addEventListener('click', function (ev) {
            ev.stopPropagation();
            if (!exigirAdaptador()) return;
            const anterior = quartos[quartos.length - 2];
            if (!anterior) camada.aviso('Não há quarto anterior nesta sessão.', { tipo: 'erro' });
            else entrar(anterior.id);
          });
        }
        const anterior = quartos[quartos.length - 2];
        iconeVoltar.classList.toggle('sem-anterior', !anterior);
        const titulo = anterior ? 'Quarto anterior' + (anterior.nome ? ': ' + anterior.nome : '') : 'Quarto anterior (nenhum nesta sessão)';
        if (iconeVoltar.title !== titulo) iconeVoltar.title = titulo;
        iconeVoltar.setAttribute('aria-label', titulo);
        if (navegador.previousElementSibling !== iconeVoltar) navegador.before(iconeVoltar);
      }
      let voltarPendente = false;
      const observarVoltar = typeof MutationObserver === 'function' ? new MutationObserver(function () {
        if (voltarPendente) return;
        voltarPendente = true;
        setTimeout(function () { voltarPendente = false; cuidarDoIconeVoltar(); }, 300);
      }) : null;
      if (observarVoltar && document.body) observarVoltar.observe(document.body, { childList: true, subtree: true });
      const relogioVoltar = setInterval(cuidarDoIconeVoltar, 2000); // nome e estado do quarto anterior
      cuidarDoIconeVoltar();
      ctx.aoParar(function () {
        if (observarVoltar) observarVoltar.disconnect();
        clearInterval(relogioVoltar);
        if (iconeVoltar) iconeVoltar.remove();
        if (typeof tirarEstiloVoltar === 'function') tirarEstiloVoltar();
      });

      // Ações do avatar, pelas mesmas mensagens que o menu do jogo manda. Úteis em macros.
      function mandar(cabecalho, campos) {
        if (!exigirAdaptador()) return;
        conexao.enviar(cabecalho, campos).then(function (r) {
          if (!r.ok) camada.aviso('Não deu para mandar ao jogo: ' + r.motivo + '.', { tipo: 'erro' });
        });
      }
      function numeroEntre(bruto, min, max) {
        const n = Number(bruto);
        return Number.isInteger(n) && n >= min && n <= max ? n : null;
      }
      for (const [nome, tipo] of Object.entries(codigos.EXPRESSOES)) {
        ctx.comando({
          nome,
          uso: nome,
          descricao: { acenar: 'Seu avatar acena.', beijo: 'Seu avatar manda um beijo.', rir: 'Seu avatar ri.' }[nome],
          executar() { mandar(SAIDA.EXPRESSAO, [['i', tipo]]); },
        });
      }
      // Danças: as 4 do menu do jogo e as extras (codigos.DANCAS_EXTRAS), por número ou pelo nome.
      // Só entram as danças com animação registrada no motor do jogo (VL.dancasProprias); o Habblet
      // só tem as 4 do menu, e mandar outro número não anima nada (visto ao vivo em 2026-11-19).
      const EXTRAS = (VL.dancasProprias && VL.dancasProprias.lista && VL.dancasProprias.lista()) || {};
      const simples = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      function dancaPedida(texto) {
        if (texto == null || texto === '') return 1;
        const n = Number(String(texto).trim());
        if (Number.isInteger(n)) return (n >= 0 && n <= codigos.MAX_DANCA) || EXTRAS[n] ? n : null;
        const alvo = simples(texto);
        if (!alvo) return null;
        const nomes = Object.assign({ 1: 'Hap-Hop', 2: 'Pogo Mogo', 3: 'Duck Funk', 4: 'Rollie', 0: 'parar' }, EXTRAS);
        const achado = Object.keys(nomes).find((k) => simples(nomes[k]) === alvo) || Object.keys(nomes).find((k) => simples(nomes[k]).startsWith(alvo));
        return achado == null ? null : Number(achado);
      }
      const listaExtras = Object.keys(EXTRAS).map((k) => k + ' ' + EXTRAS[k]).join(', ');
      ctx.comando({
        nome: 'dancar',
        apelidos: ['dançar'],
        uso: 'dancar [número ou nome]',
        descricao: 'Dança: 1 a ' + codigos.MAX_DANCA + ' são as do menu do jogo' + (listaExtras ? '; também ' + listaExtras : '') + '. 0 para de dançar.',
        executar(pedido) {
          const n = dancaPedida(pedido.args.join(' '));
          if (n == null) camada.aviso('Dança desconhecida. Use 0 a ' + codigos.MAX_DANCA + (listaExtras ? ' ou uma destas: ' + listaExtras : ' (Hap-Hop, Pogo Mogo, Duck Funk, Rollie)') + '.', { tipo: 'erro', duracaoMs: 8000 });
          else mandar(SAIDA.DANCAR, [['i', n]]);
        },
      });

      // Danças extras no menu "Dançar" do avatar, logo depois de Rollie, com as mesmas classes dos itens
      // do jogo. O React redesenha o menu: um observador põe os itens de novo e tira os que sobraram
      // em outra parte do menu.
      function cuidarDoMenuDancas() {
        if (typeof document.querySelectorAll !== 'function') return;
        const ligada = ctx.secao().dancasExtras !== false;
        for (const velho of document.querySelectorAll('.nitro-context-menu .vl-danca')) {
          const pai = velho.parentElement;
          const temRollie = ligada && pai && [...pai.children].some((c) => !c.classList.contains('vl-danca') && c.textContent.trim() === 'Rollie');
          if (!temRollie) velho.remove();
        }
        if (!ligada) return;
        for (const item of document.querySelectorAll('.nitro-context-menu .list-item')) {
          if (item.classList.contains('vl-danca') || item.textContent.trim() !== 'Rollie') continue;
          if (item.nextElementSibling && item.nextElementSibling.classList.contains('vl-danca')) continue;
          let depois = item;
          for (const k of Object.keys(EXTRAS)) {
            const novo = document.createElement('div');
            novo.className = 'd-flex w-100 align-items-center justify-content-center menu-item list-item vl-danca';
            novo.textContent = EXTRAS[k];
            novo.title = 'Dança ' + k;
            novo.dataset.vlDanca = k;
            depois.after(novo);
            depois = novo;
          }
        }
      }
      const tirarEstiloDancas = camada.estiloPagina('conexao-dancas',
        '.nitro-context-menu .vl-danca::before { content: ""; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: #d6f24a; box-shadow: 0 0 4px rgba(214, 242, 74, .8); flex: none; }');
      let dancasPendente = false;
      const observarDancas = typeof MutationObserver === 'function' ? new MutationObserver(function () {
        if (dancasPendente) return;
        dancasPendente = true;
        Promise.resolve().then(function () { dancasPendente = false; cuidarDoMenuDancas(); });
      }) : null;
      if (observarDancas && document.body) observarDancas.observe(document.body, { childList: true, subtree: true });
      // O clique saía no item, mas não fazia nada (2026-11-19, print do usuário): o menu do jogo é
      // redesenhado entre apertar e soltar o botão e o "click" se perde. A dança sai já no apertar,
      // escutado na captura do documento (vale mesmo que o item seja trocado), e o jogo não vê o
      // apertar (não fecha o menu nem anda).
      function aoApertarDanca(ev) {
        const alvo = ev.target && ev.target.closest ? ev.target.closest('.vl-danca') : null;
        if (!alvo || ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        const n = Number(alvo.dataset.vlDanca);
        if (Number.isInteger(n)) mandar(SAIDA.DANCAR, [['i', n]]);
      }
      function engolir(ev) {
        if (ev.target && ev.target.closest && ev.target.closest('.vl-danca')) { ev.preventDefault(); ev.stopPropagation(); }
      }
      if (typeof document.addEventListener === 'function') {
        document.addEventListener('pointerdown', aoApertarDanca, true);
        for (const tipo of ['mousedown', 'mouseup', 'pointerup', 'click']) document.addEventListener(tipo, engolir, true);
      }
      ctx.aoParar(function () {
        if (typeof document.removeEventListener === 'function') {
          document.removeEventListener('pointerdown', aoApertarDanca, true);
          for (const tipo of ['mousedown', 'mouseup', 'pointerup', 'click']) document.removeEventListener(tipo, engolir, true);
        }
        if (observarDancas) observarDancas.disconnect();
        if (typeof document.querySelectorAll === 'function') document.querySelectorAll('.vl-danca').forEach((n) => n.remove());
        if (typeof tirarEstiloDancas === 'function') tirarEstiloDancas();
      });
      ctx.comando({
        nome: 'placa',
        uso: 'placa <0-' + codigos.MAX_PLACA + '>',
        descricao: 'Levanta uma placa (0 a 10 são números; acima, os ícones).',
        executar(pedido) {
          const n = numeroEntre(pedido.args[0], 0, codigos.MAX_PLACA);
          if (n == null) camada.aviso('Use um número de 0 a ' + codigos.MAX_PLACA + '.', { tipo: 'erro' });
          else mandar(SAIDA.PLACA, [['i', n]]);
        },
      });
      ctx.comando({
        nome: 'sentar',
        uso: 'sentar',
        descricao: 'Seu avatar senta no chão.',
        executar() { mandar(SAIDA.POSTURA, [['i', 1]]); },
      });

      ctx.comando({
        nome: 'registro',
        uso: 'registro [ligar | desligar | exportar | limpar]',
        descricao: 'Ferramenta de diagnóstico, para quem desenvolve: anota os códigos das mensagens do jogo (só na memória). No uso normal, não precisa.',
        executar(pedido) {
          const acao = String(pedido.args[0] || '').toLowerCase();
          if (!exigirAdaptador()) return undefined;
          if (acao === 'ligar' || acao === '') {
            ligarRegistro();
            camada.aviso('Registro ligado. Faça a ação no jogo e depois use o comando registro exportar.');
          } else if (acao === 'desligar') {
            desligarRegistro();
            camada.aviso('Registro desligado. ' + linhas.length + ' linhas na memória.');
          } else if (acao === 'limpar') {
            linhas.length = 0;
            camada.aviso('Registro limpo.');
          } else if (acao === 'exportar') {
            if (!linhas.length) camada.aviso('O registro está vazio.');
            else camada.baixar('vagalume-registro-' + camada.carimbo(true) + '.txt', linhas.join('\n') + '\n');
          } else {
            camada.aviso('Uso: registro [ligar | desligar | exportar | limpar]', { tipo: 'erro' });
          }
          return undefined;
        },
      });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
