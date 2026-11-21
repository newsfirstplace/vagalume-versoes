// Tela compartilhada da chamada (pedido do usuário em 2026-11-19). Esta página da extensão vive num
// quadro dentro da janela do Vagalume, por cima do hotel (src/conteudo/tela-janela.js).
//
// Dois jeitos, pelo endereço:
//   ?modo=enviar             quem compartilha: escolhe a tela no seletor do Chrome e manda o vídeo
//                             a cada pessoa da chamada que pedir;
//   ?modo=ver&de=ID&nome=X   quem assiste: pede o vídeo a quem está compartilhando.
//
// O vídeo vai direto entre as páginas (WebRTC). A sala (src/sala) só repassa os sinais pela mesma
// conexão da voz, e só na chamada privada e nos grupos. Nada é gravado.
(function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const MODO = q.get('modo') === 'enviar' ? 'enviar' : 'ver';
  const DE = String(q.get('de') || '').replace(/\D/g, '');
  const NOME_DE = String(q.get('nome') || '').slice(0, 40);
  const $ = (id) => document.getElementById(id);
  const video = $('video');
  const aviso = $('aviso');
  const texto = $('texto');
  const detalhe = $('detalhe');
  const escolher = $('escolher');
  const barra = $('barra');
  const estadoEl = $('estado');
  const som = $('som');
  const volume = $('volume');
  const ajuste = $('ajuste');
  const pip = $('pip');
  const parar = $('parar');
  const opcoes = $('opcoes');
  const resolucao = $('resolucao');
  const quadros = $('quadros');
  const prioridade = $('prioridade');
  const comSom = $('comSom');

  // Qualidade escolhida por quem compartilha (pedido do usuário em 2026-11-20), guardada nesta página.
  const PADRAO = { resolucao: '1080', quadros: '30', prioridade: 'nitidez', som: true };
  let escolha = Object.assign({}, PADRAO);
  try { escolha = Object.assign(escolha, JSON.parse(localStorage.getItem('vl.telaQualidade') || '{}')); } catch (e) { /* sem armazenamento */ }
  resolucao.value = escolha.resolucao; quadros.value = escolha.quadros; prioridade.value = escolha.prioridade; comSom.checked = escolha.som !== false;
  if (!resolucao.value) resolucao.value = PADRAO.resolucao;
  if (!quadros.value) quadros.value = PADRAO.quadros;
  if (!prioridade.value) prioridade.value = PADRAO.prioridade;
  function lerEscolha() {
    escolha = { resolucao: resolucao.value, quadros: quadros.value, prioridade: prioridade.value, som: comSom.checked };
    try { localStorage.setItem('vl.telaQualidade', JSON.stringify(escolha)); } catch (e) { /* sem armazenamento */ }
    return escolha;
  }
  // Limites de vídeo para o navegador (altura 0 = a resolução da própria tela).
  function restricoesVideo(e) {
    const alt = Number(e.resolucao);
    const fps = Number(e.quadros) || 30;
    const v = { frameRate: { ideal: fps, max: fps } };
    if (alt) { v.height = { ideal: alt, max: alt }; v.width = { ideal: Math.round(alt * 16 / 9), max: Math.round(alt * 16 / 9) }; }
    return v;
  }
  // Taxa total pensada para uma pessoa assistindo; com mais gente, dividida (mínimo de 1 Mbps cada).
  function taxaBase(e) {
    const alt = Number(e.resolucao) || 1440;
    const fps = Number(e.quadros) || 30;
    const porPixel = alt <= 720 ? 2500000 : alt <= 1080 ? 4500000 : 7000000; // a 30 FPS
    return Math.round(porPixel * Math.max(0.6, fps / 30));
  }

  // Só conversa com o hotel que abriu o quadro.
  const PAI = (location.ancestorOrigins && location.ancestorOrigins[0]) || '';
  const paiValido = /^https:\/\/([a-z0-9-]+\.)*habblet\.city$/.test(PAI);
  function avisarPai(t, dado) { if (paiValido) window.parent.postMessage(Object.assign({ vagalume: 'tela', t }, dado || {}), PAI); }

  function mostrar(msg, sub, comBotao) {
    aviso.hidden = false;
    texto.textContent = msg;
    detalhe.textContent = sub || '';
    escolher.hidden = !comBotao;
  }
  function esconderAviso() { aviso.hidden = true; }

  function sala(tipo, dado) {
    return chrome.runtime.sendMessage(Object.assign({}, dado || {}, { alvo: 'sala', tipo })).then(function (r) {
      if (!r || r.erro) throw new Error((r && r.erro) || 'sem-resposta');
      return r;
    });
  }
  const mandar = (para, dado) => sala('tela:sinal', { para, dado: Object.assign({ papel: MODO }, dado) }).catch(function () {});
  const mandarTodos = (dado) => sala('tela:todos', { dado: Object.assign({ papel: MODO }, dado) }).catch(function () {});

  let info = null; // { id, nome, ice, pessoas }
  const pares = new Map(); // id -> { pc, pendentes: [], remoto: false }

  function fecharPar(id) {
    const p = pares.get(id);
    if (!p) return;
    pares.delete(id);
    try { p.pc.close(); } catch (e) { /* já fechado */ }
  }
  async function aplicarSdp(p, d) {
    await p.pc.setRemoteDescription(d);
    p.remoto = true;
    for (const c of p.pendentes.splice(0)) await p.pc.addIceCandidate(c).catch(function () {});
  }
  function novoPar(id) {
    fecharPar(id);
    const pc = new RTCPeerConnection({ iceServers: (info && info.ice) || [{ urls: 'stun:stun.cloudflare.com:3478' }] });
    const p = { pc, pendentes: [], remoto: false };
    pares.set(id, p);
    pc.onicecandidate = function (e) { if (e.candidate) mandar(id, { t: 'ice', c: e.candidate.toJSON() }); };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === 'failed') {
        fecharPar(id);
        if (MODO === 'ver') mostrar('Não deu para receber a tela.', 'A ligação direta foi bloqueada pela rede. Feche e tente assistir de novo.');
      }
      if (MODO === 'enviar') contar();
    };
    return p;
  }

  // ---------- quem compartilha ----------
  let fluxo = null;
  let encerrado = false;
  function contar() {
    if (MODO !== 'enviar' || !fluxo) return;
    const n = [...pares.values()].filter((p) => p.pc.connectionState === 'connected').length;
    estadoEl.textContent = n ? 'Ao vivo para ' + n + (n === 1 ? ' pessoa' : ' pessoas') : 'Ao vivo · esperando quem vai assistir';
    estadoEl.classList.add('ao-vivo');
    ajustarQualidade();
  }
  // Nitidez: mantém a resolução e baixa os quadros quando a rede aperta; fluidez: o contrário.
  function ajustarQualidade() {
    const n = Math.max(1, pares.size);
    const teto = Math.max(1000000, Math.round(taxaBase(escolha) / n));
    for (const p of pares.values()) {
      for (const s of p.pc.getSenders()) {
        if (!s.track || s.track.kind !== 'video') continue;
        const par = s.getParameters();
        if (!par.encodings || !par.encodings.length) par.encodings = [{}];
        par.encodings[0].maxBitrate = teto;
        par.encodings[0].maxFramerate = Number(escolha.quadros) || 30;
        par.degradationPreference = escolha.prioridade === 'fluidez' ? 'maintain-framerate' : 'maintain-resolution';
        s.setParameters(par).catch(function () {});
      }
    }
  }
  async function oferecer(id) {
    if (!fluxo) return;
    const p = novoPar(id);
    fluxo.getTracks().forEach((t) => p.pc.addTrack(t, fluxo));
    const oferta = await p.pc.createOffer();
    await p.pc.setLocalDescription(oferta);
    mandar(id, { t: 'sdp', d: p.pc.localDescription.toJSON() });
  }
  async function comecar() {
    escolher.disabled = true;
    try {
      const e = lerEscolha();
      // Som sem os filtros de voz (estragam música e jogo); systemAudio: o som do computador na tela inteira.
      fluxo = await navigator.mediaDevices.getDisplayMedia({
        video: restricoesVideo(e),
        audio: e.som ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : false,
        systemAudio: e.som ? 'include' : 'exclude',
        selfBrowserSurface: 'exclude',
      });
    } catch (e) {
      escolher.disabled = false;
      mostrar('Nada foi compartilhado.', e && e.name === 'NotAllowedError' ? 'Você cancelou a escolha ou o navegador recusou. Tente de novo quando quiser.' : 'O navegador não deixou capturar a tela.', true);
      return;
    }
    escolher.disabled = false;
    const faixaVideo = fluxo.getVideoTracks()[0];
    if (faixaVideo) {
      try { faixaVideo.contentHint = escolha.prioridade === 'fluidez' ? 'motion' : 'detail'; } catch (e) { /* sem dica */ }
      // "Parar de compartilhar" do próprio Chrome.
      faixaVideo.addEventListener('ended', function () { terminar('Você parou de compartilhar.'); });
    }
    const faixaSom = fluxo.getAudioTracks()[0];
    if (faixaSom) try { faixaSom.contentHint = 'music'; } catch (e) { /* sem dica */ }
    video.srcObject = fluxo;
    video.muted = true; // a prévia não toca o som de volta
    video.hidden = false;
    video.play().catch(function () {});
    esconderAviso();
    barra.hidden = false;
    parar.hidden = false;
    // As opções vão para a barra e continuam valendo durante a transmissão.
    opcoes.hidden = false;
    barra.insertBefore(opcoes, parar);
    avisarSemSom();
    contar();
    avisarPai('ao-vivo');
    mandarTodos({ t: 'inicio' });
  }
  function terminar(msg) {
    if (encerrado) return;
    encerrado = true;
    mandarTodos({ t: 'fim' });
    for (const id of [...pares.keys()]) fecharPar(id);
    if (fluxo) fluxo.getTracks().forEach((t) => t.stop());
    fluxo = null;
    video.srcObject = null;
    video.hidden = true;
    barra.hidden = true;
    mostrar(msg || 'Compartilhamento encerrado.', 'Ninguém mais vê a sua tela.');
    avisarPai('fim');
  }

  // Sem faixa de som: o Chrome só manda o som de uma aba (com "Compartilhar áudio da aba") ou da tela
  // inteira no Windows (com "Compartilhar áudio do sistema"); janela sozinha não tem som.
  function avisarSemSom() {
    const antigo = document.querySelector('.aviso-som');
    if (antigo) antigo.remove();
    if (!fluxo || !escolha.som || fluxo.getAudioTracks().length) return;
    const a = document.createElement('span');
    a.className = 'aviso-som';
    a.textContent = 'Sem som: escolha uma aba com "Compartilhar áudio da aba" ou a tela inteira com "Compartilhar áudio do sistema".';
    barra.insertBefore(a, opcoes);
  }
  // Mudanças durante a transmissão valem na hora (o som só muda ao escolher de novo o que compartilhar).
  function mudouOpcao() {
    lerEscolha();
    if (!fluxo) return;
    const faixa = fluxo.getVideoTracks()[0];
    if (faixa) {
      faixa.applyConstraints(restricoesVideo(escolha)).catch(function () {});
      try { faixa.contentHint = escolha.prioridade === 'fluidez' ? 'motion' : 'detail'; } catch (e) { /* sem dica */ }
    }
    for (const t of fluxo.getAudioTracks()) t.enabled = escolha.som;
    ajustarQualidade();
  }
  [resolucao, quadros, prioridade, comSom].forEach((c) => c.addEventListener('change', mudouOpcao));

  // ---------- quem assiste ----------
  let pedidos = 0;
  let relogioPedido = 0;
  function pedir() {
    clearTimeout(relogioPedido);
    if (pares.get(DE) && pares.get(DE).remoto) return;
    if (++pedidos > 4) { mostrar('Não chegou a tela de ' + (NOME_DE || 'quem está compartilhando') + '.', 'Pode ser que o compartilhamento já tenha acabado.'); return; }
    mandar(DE, { t: 'pedir' });
    relogioPedido = setTimeout(pedir, 6000);
  }
  function aoVideo(e) {
    const f = e.streams && e.streams[0];
    if (!f) return;
    if (video.srcObject !== f) video.srcObject = f;
    video.hidden = false;
    video.muted = false;
    video.volume = Number(volume.value) / 100;
    video.play().catch(function () { video.muted = true; video.play().catch(function () {}); som.textContent = '🔇'; });
    esconderAviso();
    barra.hidden = false;
    const temSom = f.getAudioTracks().length > 0;
    som.hidden = !temSom;
    volume.hidden = !temSom;
    estadoEl.textContent = 'Tela de ' + (NOME_DE || 'quem está compartilhando');
    estadoEl.classList.add('ao-vivo');
    f.onaddtrack = function () { const s = f.getAudioTracks().length > 0; som.hidden = !s; volume.hidden = !s; };
  }

  // ---------- sinais vindos da sala ----------
  chrome.runtime.onMessage.addListener(function (m, remetente) {
    if (!m || m.de !== 'sala' || remetente.id !== chrome.runtime.id) return;
    if (m.tipo === 'voz:estado' && !m.quarto) {
      // A chamada acabou: a tela acaba junto.
      if (MODO === 'enviar') terminar('A chamada acabou, e o compartilhamento também.');
      else { for (const id of [...pares.keys()]) fecharPar(id); video.hidden = true; barra.hidden = true; mostrar('A chamada acabou.'); avisarPai('fim'); }
      return;
    }
    if (m.tipo === 'voz:entrou' && MODO === 'enviar' && fluxo && m.id) { mandar(String(m.id), { t: 'inicio' }); return; }
    if (m.tipo === 'tela:saiu') {
      const id = String(m.id || '');
      fecharPar(id);
      if (MODO === 'enviar') contar();
      else if (id === DE) { video.hidden = true; barra.hidden = true; mostrar((NOME_DE || 'A pessoa') + ' saiu da chamada.'); avisarPai('fim'); }
      return;
    }
    if (m.tipo !== 'tela:sinal' || !m.dado) return;
    const de = String(m.autorId || '');
    const d = m.dado;
    if (MODO === 'enviar') {
      if (d.papel !== 'ver' || !fluxo) return;
      if (d.t === 'pedir') oferecer(de).catch(function () {});
      else if (d.t === 'sair') { fecharPar(de); contar(); }
      else if (d.t === 'sdp' && d.d && d.d.type === 'answer') { const p = pares.get(de); if (p) aplicarSdp(p, d.d).catch(function () {}); }
      else if (d.t === 'ice' && d.c) { const p = pares.get(de); if (p) { if (p.remoto) p.pc.addIceCandidate(d.c).catch(function () {}); else p.pendentes.push(d.c); } }
      return;
    }
    // Assistindo: só o que vem de quem compartilha.
    if (de !== DE || d.papel !== 'enviar') return;
    if (d.t === 'fim') {
      clearTimeout(relogioPedido);
      fecharPar(DE);
      video.srcObject = null;
      video.hidden = true;
      barra.hidden = true;
      mostrar((NOME_DE || 'A pessoa') + ' parou de compartilhar a tela.');
      avisarPai('fim');
    } else if (d.t === 'inicio') {
      pedidos = 0;
      if (!(pares.get(DE) && pares.get(DE).remoto)) pedir();
    } else if (d.t === 'sdp' && d.d && d.d.type === 'offer') {
      clearTimeout(relogioPedido);
      const p = novoPar(DE);
      p.pc.ontrack = aoVideo;
      aplicarSdp(p, d.d)
        .then(() => p.pc.createAnswer())
        .then((r) => p.pc.setLocalDescription(r))
        .then(() => mandar(DE, { t: 'sdp', d: p.pc.localDescription.toJSON() }))
        .catch(function () { mostrar('Não deu para receber a tela.', 'Feche e tente assistir de novo.'); });
    } else if (d.t === 'ice' && d.c) {
      const p = pares.get(DE);
      if (p) { if (p.remoto) p.pc.addIceCandidate(d.c).catch(function () {}); else p.pendentes.push(d.c); }
    }
  });

  // ---------- controles ----------
  ajuste.addEventListener('click', function () {
    const cheio = video.classList.toggle('preencher');
    ajuste.textContent = cheio ? 'Mostrar inteira' : 'Preencher';
  });
  if (!document.pictureInPictureEnabled) pip.hidden = true;
  pip.addEventListener('click', async function () {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch (e) { estadoEl.textContent = 'O navegador não abriu o picture-in-picture.'; }
  });
  video.addEventListener('enterpictureinpicture', function () { pip.textContent = 'Voltar à janela'; avisarPai('pip', { ligado: true }); });
  video.addEventListener('leavepictureinpicture', function () { pip.textContent = 'Picture-in-picture'; avisarPai('pip', { ligado: false }); });
  volume.addEventListener('input', function () { video.volume = Number(volume.value) / 100; if (video.muted && Number(volume.value) > 0) { video.muted = false; som.textContent = '🔊'; } });
  som.addEventListener('click', function () { video.muted = !video.muted; som.textContent = video.muted ? '🔇' : '🔊'; });
  parar.addEventListener('click', function () { terminar(); });
  escolher.addEventListener('click', comecar);
  // A janela de fora pede para parar (fechar a janela, sair da chamada).
  window.addEventListener('message', function (ev) {
    if (ev.source !== window.parent || ev.origin !== PAI || !paiValido || !ev.data || ev.data.vagalume !== 'tela-janela') return;
    if (ev.data.t === 'parar') { if (MODO === 'enviar') terminar(); else { mandar(DE, { t: 'sair' }); for (const id of [...pares.keys()]) fecharPar(id); } }
  });

  // ---------- início ----------
  sala('tela:info').then(function (r) {
    info = r;
    if (MODO === 'enviar') {
      mostrar('Compartilhar a sua tela na chamada', 'O Chrome vai perguntar o que mostrar: uma aba, uma janela ou a tela inteira. Só quem está nesta chamada vê. Para mandar o som, escolha uma aba e marque "Compartilhar áudio da aba", ou a tela inteira e marque "Compartilhar áudio do sistema" (janela sozinha não tem som).', true);
      opcoes.hidden = false;
      escolher.focus();
    } else {
      mostrar('Conectando à tela de ' + (NOME_DE || 'quem está compartilhando') + '…');
      pedir();
    }
  }, function (e) {
    const motivo = String(e && e.message);
    mostrar(motivo === 'so-privado' ? 'A tela só pode ser compartilhada na chamada privada e nos grupos.' : 'Entre numa chamada privada ou de grupo para usar a tela compartilhada.');
  });
})();
