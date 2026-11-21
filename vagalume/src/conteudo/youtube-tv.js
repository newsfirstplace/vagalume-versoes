// Vagalume — janela própria de YouTube, aberta pelo botão nativo do Habblet.
// A sessão compartilhada usa somente a presença já existente entre Vagalumes do mesmo quarto.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.camada || !VL.youtube) return;
  const el = VL.camada.el;
  const CHAVE = 'vl.youtube.videos';
  const LIMITE = 30;
  function itemValido(item) {
    const id = VL.youtube.idVideo(item && item.id);
    return id ? { id, nome: String(item.nome || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 72) || 'Vídeo ' + id } : null;
  }
  function tempoRede(d) {
    const p = Number(d && d.p);
    const quando = Number(d && d.q);
    if (!Number.isFinite(p) || p < 0 || p > 86400) return 0;
    return Math.max(0, p + (d.e === 1 && Number.isFinite(quando) ? Math.max(0, Math.min(30, (Date.now() - quando) / 1000)) : 0));
  }
  function idSessao() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  function iniciar(ctx) {
    let janela = null;
    let iframe = null;
    let entrada, nome, palco, aviso, estadoSala, assistindo, filaLista, tituloVideo, chatLista, chatEntrada, chatEnviar;
    let buscaLista, buscaPainel, playlistPainel, botaoBuscar, geracaoBusca = 0;
    let botaoCriar, botaoCriarPrivado, botaoEntrar, botaoSair, botaoPausa, botaoAnterior, botaoProximo, botaoFavorito;
    let conviteCampo, convitePainel, conviteRecebido, conviteTexto, convitePendente = null, privada = false;
    let fila = [], filaRemota = [], favoritos = [], atual = null, playerTempo = 0, playerEstado = 2, playerQuando = Date.now();
    let modo = 'solo', sessao = '', anfitriao = '', quarto = '', aberto = false, editado = false;
    let ouvindoAcao = null, relogio = null, ultimoEnvio = 0, ultimoPing = 0, inicioBusca = 0, ultimoEstadoHost = 0;
    let minimizada = false, ultimoChat = 0;
    let filaAcoes = [], temporizadorAcao = null, proximaAcao = 0;
    const participantes = new Map();
    const convidados = new Set(), cabecas = new Map();
    const meuNome = () => String(VL.pessoas && VL.pessoas.eu && VL.pessoas.eu() || '');
    const quartoAtual = () => String(VL.pessoas && VL.pessoas.quartoAtual && VL.pessoas.quartoAtual() || '');
    const nomeChave = (n) => String(n || '').trim().toLowerCase();
    const canal = () => VL.comunidade && VL.comunidade.acao && VL.comunidade.aoAcao && quartoAtual();
    function processarAcoes() {
      if (temporizadorAcao || !filaAcoes.length) return;
      const espera = Math.max(0, proximaAcao - Date.now());
      if (espera) { temporizadorAcao = setTimeout(function () { temporizadorAcao = null; processarAcoes(); }, espera); return; }
      const item = filaAcoes.shift();
      if (item.quarto === quartoAtual() && canal()) {
        proximaAcao = Date.now() + 1650; // a presença aceita uma ação a cada 1,5 s
        VL.comunidade.acao(item.dado);
      }
      if (filaAcoes.length) processarAcoes();
    }
    function enviar(d, para) {
      if (!canal()) return false;
      if (para) {
        if (!VL.comunidade.direto) return false;
        VL.comunidade.direto(para, d);
        return true;
      }
      if (d.t === 'yt:estado') filaAcoes = filaAcoes.filter((item) => item.dado.t !== 'yt:estado' || item.dado.s !== d.s);
      if (filaAcoes.length >= 20) { if (d.t === 'yt:chat' && aviso) aviso.textContent = 'A sala está ocupada. Aguarde um instante para enviar.'; return false; }
      filaAcoes.push({ dado: d, quarto: quartoAtual() });
      processarAcoes();
      return true;
    }
    function estadoPublico(para) {
      const estado = { t: 'yt:estado', s: sessao, v: atual ? atual.id : '', n: atual ? atual.nome.slice(0, 72) : '', l: fila.slice(0, 5).map((v) => [v.id, v.nome.slice(0, 30)]), p: Math.round(tempoAtual()), q: Date.now(), e: playerEstado === 1 ? 1 : 0, para: para || '*', u: [...participantes.keys()].slice(0, 12) };
      while (estado.u.length && JSON.stringify(estado).length > 560) estado.u.pop();
      return estado;
    }
    function tempoAtual() { return playerTempo + (playerEstado === 1 ? Math.max(0, (Date.now() - playerQuando) / 1000) : 0); }
    function publicar(forcar) {
      if (modo !== 'host' || !sessao || !quartoAtual()) return;
      if (!forcar && Date.now() - ultimoEnvio < 1800) return;
      ultimoEnvio = Date.now();
      if (privada) { for (const nome of participantes.keys()) enviar(estadoPublico(nome), nome); }
      else enviar(estadoPublico());
    }
    function enviarComando(func, args) {
      if (!iframe || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: args || [] }), 'https://www.youtube.com');
    }
    function desenharAssistindo() {
      if (!assistindo) return;
      assistindo.replaceChildren();
      const nomes = modo === 'host' ? [meuNome(), ...participantes.keys()] : modo === 'viewer' ? [anfitriao, ...participantes.keys(), meuNome()] : [meuNome()];
      for (const n of [...new Set(nomes.filter(Boolean))].slice(0, 20)) {
        const inicial = n.trim().slice(0, 1).toUpperCase();
        const avatar = el('span', { class: 'vl-tv-avatar', texto: inicial });
        const pessoa = VL.pessoas && VL.pessoas.visualDe && VL.pessoas.visualDe(n);
        const visual = pessoa && typeof pessoa === 'object' ? pessoa.visual : pessoa;
        if (typeof visual === 'string' && /^[a-z]{2}-\d+(-\d+)*(\.[a-z]{2}-\d+(-\d+)*)*$/.test(visual)) {
          // Cabeça em tamanho grande do servidor de imagens do Habblet, reduzida no círculo: fica nítida
          // (a miniatura de 22 × 24 ampliada ficava borrada; pedido do usuário em 2026-11-20).
          const img = el('img', { alt: '', src: 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(visual) + '&headonly=1&direction=3&head_direction=3&size=l' });
          img.addEventListener('load', function () { avatar.textContent = ''; avatar.appendChild(img); avatar.classList.add('com-foto'); });
        }
        assistindo.appendChild(el('span', { class: 'vl-tv-pessoa', title: n, 'aria-label': n }, [avatar]));
      }
    }
    function limparChat() { if (chatLista) chatLista.replaceChildren(); }
    function mostrarChat(autor, texto) {
      if (!chatLista) return;
      const linha = el('div', { class: 'vl-tv-chat-mensagem' }, [
        el('strong', { texto: String(autor).slice(0, 32) }), el('span', { texto }),
      ]);
      chatLista.appendChild(linha);
      if (chatLista.children.length > 80) chatLista.replaceChildren(...Array.from(chatLista.children).slice(-80));
      chatLista.scrollTop = chatLista.scrollHeight;
    }
    function enviarChat() {
      const texto = String(chatEntrada && chatEntrada.value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 180);
      if (!texto) return;
      if (!canal() || !sessao || !['host', 'viewer'].includes(modo)) { aviso.textContent = 'Crie uma sessão ou entre em uma para conversar.'; return; }
      if (Date.now() - ultimoChat < 1600) { aviso.textContent = 'Aguarde um instante antes da próxima mensagem.'; return; }
      const dado = { t: 'yt:chat', s: sessao, x: texto };
      if (privada && modo === 'host') {
        for (const nome of participantes.keys()) enviar({ ...dado, a: meuNome() }, nome);
      } else if (!enviar(dado, privada ? anfitriao : '')) return;
      ultimoChat = Date.now();
      chatEntrada.value = '';
      mostrarChat(meuNome(), texto);
    }
    function enviarConvite() {
      const para = String(conviteCampo && conviteCampo.value || '').trim().slice(0, 32);
      if (modo !== 'host' || !privada || !canal() || !VL.comunidade.direto) return;
      if (!para || nomeChave(para) === nomeChave(meuNome())) { aviso.textContent = 'Informe o apelido de outro Vagalume no quarto.'; return; }
      if (!convidados.has(nomeChave(para)) && convidados.size >= 4) { aviso.textContent = 'Esta sala aceita até quatro convidados.'; return; }
      const sessaoAtual = sessao;
      VL.comunidade.direto(para, { t: 'yt:convite', s: sessaoAtual }).then(function (r) {
        if (modo !== 'host' || sessao !== sessaoAtual) return;
        if (!r || !r.ok) { aviso.textContent = 'Não encontrei esse Vagalume conectado neste quarto.'; return; }
        convidados.add(nomeChave(para));
        conviteCampo.value = '';
        aviso.textContent = 'Convite enviado para ' + para + '. Aguardando resposta.';
      });
    }
    function atualizarSala() {
      if (!estadoSala) return;
      estadoSala.textContent = modo === 'host' ? privada ? 'Sala por convite neste quarto' : 'Sala aberta para Vagalumes neste quarto'
        : modo === 'viewer' ? 'Assistindo com ' + anfitriao + (privada ? ' • por convite' : '')
          : modo === 'joining' ? privada ? 'Entrando na sala de ' + anfitriao + '…' : 'Procurando sessão neste quarto…'
            : 'Assista sozinho ou entre numa sessão do quarto';
      botaoCriar.hidden = modo !== 'solo';
      botaoCriarPrivado.hidden = modo !== 'solo';
      botaoEntrar.hidden = modo !== 'solo';
      botaoSair.hidden = modo === 'solo';
      convitePainel.hidden = modo !== 'host' || !privada;
      botaoPausa.disabled = !atual || modo === 'viewer' || modo === 'joining';
      if (chatEntrada) { chatEntrada.disabled = false; chatEnviar.disabled = !['host', 'viewer'].includes(modo); chatEntrada.placeholder = 'Digite sua mensagem'; }
      desenharAssistindo();
    }
    function guardar() {
      editado = true;
      chrome.storage.local.set({ [CHAVE]: { fila, favoritos } }).catch(function () { if (aviso) aviso.textContent = 'Não foi possível guardar a lista.'; });
    }
    function desenharFila() {
      if (!filaLista) return;
      const lista = modo === 'viewer' ? filaRemota : fila;
      filaLista.replaceChildren();
      if (!lista.length) filaLista.appendChild(el('p', { class: 'vl-nota', texto: modo === 'viewer' ? 'O anfitrião ainda não montou a playlist.' : 'Adicione um link para montar sua playlist.' }));
      for (const item of lista) {
        const selecionar = el('button', { type: 'button', class: 'vl-tv-item' + (atual && atual.id === item.id ? ' ativo' : ''), title: 'Assistir ' + item.nome, onclick() {
          if (modo === 'viewer' || modo === 'joining') { aviso.textContent = 'Saia da sessão para escolher outro vídeo.'; return; }
          tocar(item, 0, true);
        } }, [el('span', { class: 'vl-tv-play', texto: '▶' }), el('span', { class: 'vl-tv-item-texto', texto: item.nome })]);
        const remover = el('button', { type: 'button', class: 'vl-tv-remover', title: 'Remover da playlist', 'aria-label': 'Remover ' + item.nome, texto: '×', hidden: modo === 'viewer', onclick() {
          fila = fila.filter((v) => v.id !== item.id); guardar(); desenharFila();
        } });
        filaLista.appendChild(el('div', { class: 'vl-tv-item-linha' }, [selecionar, remover]));
      }
      const pos = lista.findIndex((v) => atual && v.id === atual.id);
      botaoAnterior.disabled = pos <= 0 || modo === 'viewer' || modo === 'joining';
      botaoProximo.disabled = pos < 0 || pos === lista.length - 1 || modo === 'viewer' || modo === 'joining';
      botaoFavorito.disabled = !atual;
      botaoFavorito.textContent = atual && favoritos.some((v) => v.id === atual.id) ? '★' : '☆';
      atualizarSala();
    }
    function montarIframe(item, segundos, reproduzir) {
      const params = new URLSearchParams({ playsinline: '1', enablejsapi: '1', origin: location.origin, autoplay: reproduzir ? '1' : '0', start: String(Math.max(0, Math.floor(segundos || 0))) });
      iframe = el('iframe', { src: 'https://www.youtube.com/embed/' + item.id + '?' + params.toString(), title: 'YouTube: ' + item.nome,
        allowfullscreen: true, allow: 'autoplay; encrypted-media; picture-in-picture', referrerpolicy: 'strict-origin-when-cross-origin' });
      iframe.addEventListener('load', function () {
        if (!iframe || !iframe.contentWindow) return;
        iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'vagalume-tv' }), 'https://www.youtube.com');
        enviarComando('addEventListener', ['onStateChange']);
      });
      palco.replaceChildren(iframe);
    }
    function tocar(item, segundos, reproduzir) {
      if (!item) return;
      atual = item;
      playerTempo = Math.max(0, Number(segundos) || 0);
      playerEstado = reproduzir ? 1 : 2;
      playerQuando = Date.now();
      tituloVideo.textContent = item.nome;
      montarIframe(item, playerTempo, reproduzir);
      aviso.textContent = 'Se o YouTube bloquear a incorporação deste vídeo, abra-o no próprio YouTube.';
      desenharFila();
      publicar(true);
    }
    function adicionarItem(item, reproduzir) {
      if (modo === 'viewer' || modo === 'joining') { aviso.textContent = 'Saia da sessão para escolher outro vídeo.'; return; }
      fila = [item, ...fila.filter((v) => v.id !== item.id)].slice(0, LIMITE);
      guardar(); desenharFila();
      if (reproduzir) tocar(item, 0, true);
      else aviso.textContent = 'Vídeo adicionado à playlist.';
    }
    function adicionar(reproduzir) {
      const id = VL.youtube.idVideo(entrada.value);
      if (!id) { buscar(); return; }
      const item = itemValido({ id, nome: nome.value });
      entrada.value = ''; nome.value = '';
      adicionarItem(item, reproduzir);
    }
    function desenharResultados(itens) {
      buscaLista.replaceChildren();
      if (!itens.length) buscaLista.appendChild(el('p', { class: 'vl-nota', texto: 'Nenhum vídeo encontrado. Tente outro nome.' }));
      for (const bruto of itens) {
        const item = itemValido(bruto);
        if (!item) continue;
        const escolher = el('button', { type: 'button', class: 'vl-tv-resultado', title: 'Assistir ' + item.nome, onclick() {
          adicionarItem(item, true);
          if (modo !== 'viewer' && modo !== 'joining') { buscaPainel.hidden = true; playlistPainel.hidden = false; }
        } }, [
          el('img', { src: 'https://i.ytimg.com/vi/' + item.id + '/mqdefault.jpg', alt: '', loading: 'lazy' }),
          el('span', { class: 'vl-tv-resultado-texto' }, [el('strong', { texto: item.nome }), el('small', { texto: String(bruto.canal || '').slice(0, 48) })]),
        ]);
        const juntar = el('button', { type: 'button', class: 'vl-tv-resultado-add', title: 'Adicionar à playlist', 'aria-label': 'Adicionar ' + item.nome, texto: '+', onclick() { adicionarItem(item, false); } });
        buscaLista.appendChild(el('div', { class: 'vl-tv-resultado-linha' }, [escolher, juntar]));
      }
      buscaPainel.hidden = false; playlistPainel.hidden = true;
    }
    async function buscar() {
      const termo = String(entrada.value || '').trim().slice(0, 100);
      if (termo.length < 2) { aviso.textContent = 'Digite pelo menos duas letras para pesquisar vídeos.'; return; }
      if (VL.youtube.idVideo(termo)) { adicionar(true); return; }
      const geracao = ++geracaoBusca, estaJanela = janela;
      botaoBuscar.disabled = true;
      buscaLista.replaceChildren(el('p', { class: 'vl-nota', texto: 'Pesquisando vídeos…' }));
      buscaPainel.hidden = false; playlistPainel.hidden = true;
      aviso.textContent = 'Pesquisando vídeos do YouTube dentro do Vagalume…';
      try {
        const r = await chrome.runtime.sendMessage({ tipo: 'youtube:pesquisar', termo });
        if (janela !== estaJanela || geracao !== geracaoBusca) return;
        if (!r || !r.ok) { buscaLista.replaceChildren(el('p', { class: 'vl-nota', texto: 'A busca está indisponível agora. Tente novamente mais tarde.' })); return; }
        desenharResultados(Array.isArray(r.itens) ? r.itens : []);
      } catch (erro) {
        if (janela === estaJanela && geracao === geracaoBusca) buscaLista.replaceChildren(el('p', { class: 'vl-nota', texto: 'Não foi possível consultar a busca agora.' }));
      } finally { if (janela === estaJanela && geracao === geracaoBusca) botaoBuscar.disabled = false; }
    }
    function aceitarEstado(m) {
      const d = m && m.dado;
      if (!d || d.t !== 'yt:estado' || !/^[a-f0-9]{16}$/.test(String(d.s || '')) || !m.nome) return;
      if (d.para !== '*' && nomeChave(d.para) !== nomeChave(meuNome())) return;
      if (modo !== 'joining' && modo !== 'viewer') return;
      if (privada && (d.s !== sessao || nomeChave(m.nome) !== nomeChave(anfitriao))) return;
      if (modo === 'viewer' && (d.s !== sessao || nomeChave(m.nome) !== nomeChave(anfitriao))) return;
      ultimoEstadoHost = Date.now();
      if (modo === 'joining') {
        modo = 'viewer'; sessao = d.s; anfitriao = String(m.nome).slice(0, 32);
        ultimoPing = Date.now(); enviar({ t: 'yt:entrar', s: sessao }, privada ? anfitriao : '');
      }
      const id = VL.youtube.idVideo(d.v);
      if (Array.isArray(d.u)) {
        participantes.clear();
        for (const n of d.u.slice(0, 12)) if (typeof n === 'string' && n.length <= 32 && ![anfitriao, meuNome()].some((p) => nomeChave(p) === nomeChave(n))) participantes.set(n, Date.now());
      }
      filaRemota = Array.isArray(d.l) ? d.l.slice(0, 5).map((v) => itemValido({ id: v && v[0], nome: v && v[1] })).filter(Boolean) : [];
      const segundos = tempoRede(d);
      const tocando = d.e === 1;
      if (id) {
        const item = itemValido({ id, nome: d.n });
        if (!atual || atual.id !== id || !iframe) tocar(item, segundos, tocando);
        else {
          if (Math.abs(playerTempo - segundos) > 2.5) enviarComando('seekTo', [segundos, true]);
          enviarComando(tocando ? 'playVideo' : 'pauseVideo');
          playerTempo = segundos; playerEstado = tocando ? 1 : 2; playerQuando = Date.now();
        }
      }
      aviso.textContent = tocando ? 'Reprodução sincronizada com ' + anfitriao + '. Se o navegador bloquear o início automático, clique no player.' : 'A sessão está pausada.';
      desenharFila();
    }
    function aoAcao(m) {
      if (!m || m.de !== 'sala' || !['presenca:acao', 'presenca:direto'].includes(m.tipo) || !m.dado || nomeChave(m.nome) === nomeChave(meuNome())) return;
      const d = m.dado;
      if (d.t === 'yt:convite' && m.tipo === 'presenca:direto' && /^[a-f0-9]{16}$/.test(String(d.s || ''))) {
        if (modo !== 'solo') return;
        abrir();
        convitePendente = { s: d.s, nome: String(m.nome).slice(0, 32) };
        conviteTexto.textContent = convitePendente.nome + ' convidou você para assistir neste quarto.';
        conviteRecebido.hidden = false;
        return;
      }
      if (!aberto || (privada ? m.tipo !== 'presenca:direto' : m.tipo !== 'presenca:acao')) return;
      if (d.t === 'yt:pedido' && modo === 'host' && !privada) {
        participantes.set(String(m.nome).slice(0, 32), Date.now());
        desenharAssistindo();
        publicar(true);
      } else if (d.t === 'yt:entrar' && modo === 'host' && d.s === sessao) {
        if (privada && !convidados.has(nomeChave(m.nome))) return;
        participantes.set(String(m.nome).slice(0, 32), Date.now()); desenharAssistindo();
        if (privada) publicar(true);
      } else if (d.t === 'yt:sair' && modo === 'host' && d.s === sessao) {
        participantes.delete(String(m.nome).slice(0, 32)); desenharAssistindo();
      } else if (d.t === 'yt:chat' && ['host', 'viewer'].includes(modo) && d.s === sessao && typeof d.x === 'string' && d.x.length <= 180 && (modo !== 'host' || participantes.has(String(m.nome).slice(0, 32))) && (modo !== 'viewer' || nomeChave(m.nome) === nomeChave(anfitriao) || !privada)) {
        const texto = d.x.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
        if (texto) {
          mostrarChat(privada && modo === 'viewer' ? String(d.a || m.nome).slice(0, 32) : m.nome, texto);
          if (privada && modo === 'host') for (const nome of participantes.keys()) if (nomeChave(nome) !== nomeChave(m.nome)) enviar({ t: 'yt:chat', s: sessao, x: texto, a: m.nome }, nome);
        }
      } else if (d.t === 'yt:estado') aceitarEstado(m);
      else if (d.t === 'yt:encerrar' && modo === 'viewer' && d.s === sessao && nomeChave(m.nome) === nomeChave(anfitriao)) {
        modo = 'solo'; sessao = ''; anfitriao = ''; privada = false; filaRemota = []; participantes.clear(); limparChat(); desenharFila();
        aviso.textContent = 'A sessão compartilhada terminou.';
      }
    }
    function aoPlayer(ev) {
      if (!iframe || ev.source !== iframe.contentWindow || ev.origin !== 'https://www.youtube.com') return;
      let d;
      try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch (erro) { return; }
      if (!d || typeof d !== 'object') return;
      const info = d.info && typeof d.info === 'object' ? d.info : {};
      const tempo = Number(info.currentTime);
      if (Number.isFinite(tempo) && tempo >= 0 && tempo < 86400) { playerTempo = tempo; playerQuando = Date.now(); }
      const estado = Number(d.event === 'onStateChange' ? d.info : info.playerState);
      if ([0, 1, 2, 3, 5].includes(estado)) {
        const mudou = playerEstado !== estado;
        if (mudou) { playerTempo = tempoAtual(); playerQuando = Date.now(); }
        playerEstado = estado;
        if (botaoPausa) botaoPausa.textContent = estado === 1 ? 'Pausar' : 'Reproduzir';
        if (modo === 'host' && mudou && [0, 1, 2].includes(estado)) publicar(false);
      }
    }
    function sair() {
      filaAcoes = filaAcoes.filter((item) => item.dado.t !== 'yt:estado' && item.dado.t !== 'yt:chat');
      if (modo === 'host') {
        if (privada) for (const nome of participantes.keys()) enviar({ t: 'yt:encerrar', s: sessao }, nome);
        else enviar({ t: 'yt:encerrar', s: sessao });
      } else if (modo === 'viewer') enviar({ t: 'yt:sair', s: sessao }, privada ? anfitriao : '');
      modo = 'solo'; sessao = ''; anfitriao = ''; privada = false; convitePendente = null; filaRemota = []; participantes.clear(); convidados.clear(); limparChat(); desenharFila();
    }
    function fechar() {
      if (!janela) return;
      sair();
      filaAcoes = filaAcoes.filter((item) => item.dado.t === 'yt:encerrar' || item.dado.t === 'yt:sair');
      if (relogio) { clearInterval(relogio); relogio = null; }
      window.removeEventListener('message', aoPlayer);
      if (iframe) { iframe.remove(); iframe = null; }
      janela.remove(); janela = null; aberto = false; minimizada = false;
    }
    function abrir() {
      if (!ouvindoAcao && VL.comunidade && VL.comunidade.aoAcao) ouvindoAcao = VL.comunidade.aoAcao(aoAcao);
      if (janela) { janela.hidden = false; if (minimizada) alternarMinimizada(); janela.focus(); return; }
      aberto = true; quarto = quartoAtual();
      editado = false;
      entrada = el('input', { type: 'text', class: 'vl-campo', placeholder: 'Busque pelo nome ou cole um link', 'aria-label': 'Pesquisar vídeo ou colar link do YouTube' });
      nome = el('input', { type: 'text', class: 'vl-campo', maxlength: 72, placeholder: 'Título opcional para link', 'aria-label': 'Nome do vídeo na playlist' });
      aviso = el('p', { class: 'vl-nota vl-tv-aviso', role: 'status', texto: 'Cole um link para assistir. Sua playlist fica salva neste navegador.' });
      estadoSala = el('span', { class: 'vl-tv-estado', role: 'status' });
      assistindo = el('div', { class: 'vl-tv-assistindo' });
      filaLista = el('div', { class: 'vl-tv-lista' });
      buscaLista = el('div', { class: 'vl-tv-lista' });
      playlistPainel = el('div', { class: 'vl-tv-playlist' }, [el('h3', { texto: 'Sua playlist' }), filaLista]);
      buscaPainel = el('div', { class: 'vl-tv-resultados', hidden: true }, [
        el('div', { class: 'vl-tv-resultados-topo' }, [el('h3', { texto: 'Resultados' }), el('button', { type: 'button', class: 'vl-botao pequeno', texto: 'Playlist', onclick() { buscaPainel.hidden = true; playlistPainel.hidden = false; } })]),
        buscaLista,
      ]);
      chatLista = el('div', { class: 'vl-tv-chat-lista', role: 'log', 'aria-label': 'Mensagens da sessão' });
      chatEntrada = el('input', { type: 'text', class: 'vl-campo', maxlength: 180, autocomplete: 'off', 'aria-label': 'Mensagem do chat do YouTube' });
      chatEnviar = el('button', { type: 'button', class: 'vl-botao primario', texto: 'Enviar', onclick: enviarChat });
      chatEntrada.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); enviarChat(); } });
      tituloVideo = el('strong', { class: 'vl-tv-titulo-video', texto: 'Nenhum vídeo disponível' });
      palco = el('div', { class: 'vl-tv-palco' }, [el('div', { class: 'vl-tv-vazio', texto: 'Escolha um vídeo para assistir' })]);
      botaoCriar = el('button', { type: 'button', class: 'vl-botao', texto: 'Sala do quarto', onclick() {
        if (!canal()) { aviso.textContent = 'Entre em um quarto com a Comunidade Vagalume ligada para compartilhar.'; return; }
        modo = 'host'; privada = false; sessao = idSessao(); anfitriao = meuNome(); participantes.clear(); convidados.clear(); limparChat(); atualizarSala();
      } });
      botaoEntrar = el('button', { type: 'button', class: 'vl-botao', texto: 'Assistir junto', onclick() {
        if (!canal()) { aviso.textContent = 'Entre em um quarto com a Comunidade Vagalume ligada para assistir junto.'; return; }
        modo = 'joining'; privada = false; inicioBusca = Date.now(); limparChat(); atualizarSala(); enviar({ t: 'yt:pedido' });
      } });
      botaoCriarPrivado = el('button', { type: 'button', class: 'vl-botao', texto: 'Sala por convite', onclick() {
        if (!canal() || !VL.comunidade.direto) { aviso.textContent = 'Entre em um quarto com a Comunidade Vagalume ligada para convidar.'; return; }
        modo = 'host'; privada = true; sessao = idSessao(); anfitriao = meuNome(); participantes.clear(); convidados.clear(); limparChat(); atualizarSala();
        aviso.textContent = 'Convide pelo apelido. Só quem aceitar poderá entrar nesta sala.';
        conviteCampo.focus();
      } });
      conviteCampo = el('input', { type: 'text', class: 'vl-campo', maxlength: 32, autocomplete: 'off', placeholder: 'Apelido no quarto', 'aria-label': 'Apelido da pessoa a convidar' });
      conviteCampo.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); enviarConvite(); } });
      convitePainel = el('div', { class: 'vl-tv-convite-host', hidden: true }, [
        el('span', { texto: 'Convidar Vagalume' }), conviteCampo,
        el('button', { type: 'button', class: 'vl-botao', texto: 'Enviar convite', onclick: enviarConvite }),
      ]);
      conviteTexto = el('span');
      conviteRecebido = el('div', { class: 'vl-tv-convite-recebido', hidden: true }, [
        conviteTexto,
        el('button', { type: 'button', class: 'vl-botao primario', texto: 'Aceitar', onclick() {
          const convite = convitePendente;
          if (!convite || !canal()) return;
          conviteRecebido.hidden = true; convitePendente = null;
          modo = 'joining'; privada = true; sessao = convite.s; anfitriao = convite.nome; inicioBusca = Date.now(); limparChat(); atualizarSala();
          enviar({ t: 'yt:entrar', s: sessao }, anfitriao);
        } }),
        el('button', { type: 'button', class: 'vl-botao', texto: 'Recusar', onclick() { convitePendente = null; conviteRecebido.hidden = true; } }),
      ]);
      botaoSair = el('button', { type: 'button', class: 'vl-botao', texto: 'Sair da sessão', onclick: sair });
      botaoPausa = el('button', { type: 'button', class: 'vl-botao', texto: 'Pausar', disabled: true, onclick() {
        if (!atual || modo === 'viewer' || modo === 'joining') return;
        const tocar = playerEstado !== 1;
        playerTempo = tempoAtual(); playerQuando = Date.now();
        enviarComando(tocar ? 'playVideo' : 'pauseVideo');
        playerEstado = tocar ? 1 : 2; botaoPausa.textContent = tocar ? 'Pausar' : 'Reproduzir'; publicar(true);
      } });
      botaoAnterior = el('button', { type: 'button', class: 'vl-botao', texto: '←', title: 'Vídeo anterior', onclick() {
        const i = fila.findIndex((v) => atual && v.id === atual.id); if (i > 0) tocar(fila[i - 1], 0, true);
      } });
      botaoProximo = el('button', { type: 'button', class: 'vl-botao', texto: '→', title: 'Próximo vídeo', onclick() {
        const i = fila.findIndex((v) => atual && v.id === atual.id); if (i >= 0 && i + 1 < fila.length) tocar(fila[i + 1], 0, true);
      } });
      botaoFavorito = el('button', { type: 'button', class: 'vl-botao', texto: '☆', title: 'Favoritar vídeo', onclick() {
        if (!atual) return;
        favoritos = favoritos.some((v) => v.id === atual.id) ? favoritos.filter((v) => v.id !== atual.id) : [atual, ...favoritos].slice(0, LIMITE);
        guardar(); desenharFila();
      } });
      botaoBuscar = el('button', { type: 'button', class: 'vl-botao', texto: 'Buscar', onclick: buscar });
      entrada.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); if (VL.youtube.idVideo(entrada.value)) adicionar(true); else buscar(); } });
      const cabecalho = el('div', { class: 'vl-tv-cabecalho' }, [
        el('span', { class: 'vl-tv-marca', texto: '▶' }), el('strong', { texto: 'YouTube • Vagalume' }),
        el('span', { class: 'vl-tv-cab-acoes' }),
        el('button', { type: 'button', class: 'vl-fechar vl-tv-minimizar', title: 'Minimizar', 'aria-label': 'Minimizar YouTube', texto: '−', onclick: alternarMinimizada }),
        el('button', { type: 'button', class: 'vl-fechar', title: 'Fechar', 'aria-label': 'Fechar YouTube', texto: '×', onclick: fechar }),
      ]);
      janela = el('div', { class: 'vl-tv-janela', role: 'dialog', 'aria-label': 'YouTube do Vagalume', tabindex: '0' }, [
        cabecalho,
        el('div', { class: 'vl-tv-corpo' }, [
          el('div', { class: 'vl-tv-busca' }, [entrada, nome, el('button', { type: 'button', class: 'vl-botao primario', texto: 'Assistir', onclick() { adicionar(true); } }), el('button', { type: 'button', class: 'vl-botao', texto: '+ Playlist', onclick() { adicionar(false); } }), botaoBuscar]),
          el('div', { class: 'vl-tv-sala' }, [estadoSala, botaoCriar, botaoEntrar, botaoCriarPrivado, botaoSair]),
          convitePainel, conviteRecebido,
          el('div', { class: 'vl-tv-layout' }, [
            el('section', { class: 'vl-tv-principal' }, [palco, tituloVideo, el('div', { class: 'vl-tv-controles' }, [botaoAnterior, botaoPausa, botaoProximo, botaoFavorito, el('button', { type: 'button', class: 'vl-botao', texto: 'Abrir no YouTube', onclick() { if (atual) window.open('https://www.youtube.com/watch?v=' + atual.id, '_blank', 'noopener,noreferrer'); } })]), aviso]),
            el('aside', { class: 'vl-tv-lateral' }, [
              playlistPainel,
              buscaPainel,
              el('div', { class: 'vl-tv-chat' }, [el('h3', { texto: 'Chat da sessão' }), chatLista, el('div', { class: 'vl-tv-chat-envio' }, [chatEntrada, chatEnviar])]),
            ]),
          ]),
          el('div', { class: 'vl-tv-rodape' }, [el('strong', { texto: 'Vagalumes assistindo' }), assistindo]),
        ]),
      ]);
      janela.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); fechar(); } });
      cabecalho.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0 || ev.target.closest('button')) return;
        const rect = janela.getBoundingClientRect();
        const inicioX = ev.clientX, inicioY = ev.clientY;
        const origemX = rect.left, origemY = rect.top;
        cabecalho.setPointerCapture(ev.pointerId);
        function mover(e) {
          if (e.pointerId !== ev.pointerId || !janela) return;
          janela.style.transform = 'none';
          janela.style.left = Math.max(0, Math.min(window.innerWidth - janela.offsetWidth, origemX + e.clientX - inicioX)) + 'px';
          janela.style.top = Math.max(0, Math.min(window.innerHeight - 42, origemY + e.clientY - inicioY)) + 'px';
        }
        function terminar(e) {
          if (e.pointerId !== ev.pointerId) return;
          cabecalho.removeEventListener('pointermove', mover);
          cabecalho.removeEventListener('pointerup', terminar);
          cabecalho.removeEventListener('pointercancel', terminar);
          if (cabecalho.hasPointerCapture(ev.pointerId)) cabecalho.releasePointerCapture(ev.pointerId);
        }
        cabecalho.addEventListener('pointermove', mover);
        cabecalho.addEventListener('pointerup', terminar);
        cabecalho.addEventListener('pointercancel', terminar);
      });
      VL.camada.area().appendChild(janela);
      const estaJanela = janela;
      janela.focus();
      window.addEventListener('message', aoPlayer);
      relogio = setInterval(function () {
        if (quarto !== quartoAtual()) { sair(); quarto = quartoAtual(); }
        if (modo === 'host') publicar(true);
        if (modo === 'viewer' && Date.now() - ultimoPing > 20000) { ultimoPing = Date.now(); enviar({ t: 'yt:entrar', s: sessao }, privada ? anfitriao : ''); }
        if (modo === 'viewer' && Date.now() - ultimoEstadoHost > 25000) { sair(); aviso.textContent = 'A sessão deixou de responder neste quarto.'; }
        if (modo === 'joining' && Date.now() - inicioBusca > 12000) { modo = 'solo'; aviso.textContent = 'Nenhuma sessão encontrada neste quarto. Você pode criar uma.'; atualizarSala(); }
        for (const [n, quando] of participantes) if (Date.now() - quando > 45000) participantes.delete(n);
        desenharAssistindo();
      }, 7000);
      atualizarSala(); desenharFila();
      chrome.storage.local.get(CHAVE).then(function (r) {
        if (janela !== estaJanela || editado) return;
        const salvo = r && r[CHAVE] || {};
        fila = Array.isArray(salvo.fila) ? salvo.fila.map(itemValido).filter(Boolean).slice(0, LIMITE) : [];
        favoritos = Array.isArray(salvo.favoritos) ? salvo.favoritos.map(itemValido).filter(Boolean).slice(0, LIMITE) : [];
        desenharFila();
      }).catch(function () { if (aviso) aviso.textContent = 'Não foi possível carregar a playlist local.'; });
    }
    function alternarMinimizada() {
      if (!janela) return;
      minimizada = !minimizada;
      janela.classList.toggle('minimizada', minimizada);
      const botao = janela.querySelector('.vl-tv-minimizar');
      botao.textContent = minimizada ? '□' : '−';
      botao.title = minimizada ? 'Restaurar' : 'Minimizar';
      botao.setAttribute('aria-label', (minimizada ? 'Restaurar' : 'Minimizar') + ' YouTube');
    }
    ctx.escutar(document, 'click', function (ev) {
      const alvo = ev.target && ev.target.closest && ev.target.closest('.icon-youtube-display, [title="YouTube TV"], [aria-label="YouTube TV"]');
      if (!alvo) return;
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
      abrir();
    }, true);
    if (VL.comunidade && VL.comunidade.aoAcao) ouvindoAcao = VL.comunidade.aoAcao(aoAcao);
    ctx.aoParar(function () { fechar(); if (ouvindoAcao) ouvindoAcao(); delete VL.youtubeTV.abrir; delete VL.youtubeTV.fechar; });
    VL.youtubeTV.abrir = abrir;
    VL.youtubeTV.fechar = fechar;
  }
  VL.youtubeTV = { iniciar, itemValido, tempoRede };
  if (typeof module !== 'undefined' && module.exports) module.exports = VL.youtubeTV;
})(typeof globalThis !== 'undefined' ? globalThis : this);
