// Vagalume — sala (página escondida da extensão). Recebe pedidos do fundo ({ alvo: 'sala', tipo }) e
// avisa o que acontece ({ de: 'sala', tipo }), que o fundo repassa à aba do hotel.
// - Mídia: envia ao servidor e baixa (como data: URL, que a página do Habblet aceita em imagens).
// - Áudio: grava até 60 s (MediaRecorder) e toca os áudios recebidos.
// - Voz: entra na sala do quarto no servidor (WebSocket), que só repassa os sinais; o som vai direto
//   entre as pessoas (WebRTC). Nada é gravado.
(function () {
  'use strict';
  const S = window.VL && window.VL.servidor;
  const LIMITE_AUDIO = 60000;
  const G = window.VL && window.VL.grupos;

  // Credenciais dos grupos ficam na extensão, separadas pela conta do jogo (não no site).
  let filaGrupos = Promise.resolve();
  // Documentos offscreen só têm chrome.runtime. O fundo faz o acesso ao armazenamento.
  async function armazenamentoGrupo(acao, chave, valor) {
    const r = await chrome.runtime.sendMessage({ tipo: 'grupos:armazenamento', acao, chave, valor });
    if (!r || r.erro) throw new Error(r && r.erro || 'sem-resposta');
    return r.valor;
  }
  async function lerGrupos(id) {
    if (!G.usuarioValido(id)) throw new Error('pedido');
    const chave = 'vl.grupos.' + id;
    return G.limparLista(await armazenamentoGrupo('ler', chave));
  }
  async function guardarGrupo(id, grupo, excluir) {
    const lista = (await lerGrupos(id)).filter((g) => g.grupo !== grupo.grupo);
    if (!excluir) {
      if (lista.length >= 50) throw new Error('grupo-limite');
      lista.push(grupo);
    }
    await armazenamentoGrupo('gravar', 'vl.grupos.' + id, G.limparLista(lista));
  }
  async function registroGrupo(id, grupo) {
    if (!G.codigoValido(grupo)) throw new Error('pedido');
    const g = (await lerGrupos(id)).find((x) => x.grupo === grupo);
    if (!g) throw new Error('grupo-nao-salvo');
    return g;
  }
  async function convitesGrupo(id) {
    const k = 'vl.gruposConvites.' + id;
    const d = await armazenamentoGrupo('ler', k);
    return (Array.isArray(d) ? d : []).filter((c) => c && G.codigoValido(c.grupo) && (!c.chave || G.codigoValido(c.chave)) && G.usuarioValido(c.de)).slice(-50);
  }
  async function dispensarConvite(id, grupo) {
    const lista = (await convitesGrupo(id)).filter((c) => c.grupo !== grupo);
    await armazenamentoGrupo('gravar', 'vl.gruposConvites.' + id, lista);
  }
  async function pedidoGrupo(m) {
    const id = String(m.id || '');
    const lista = await lerGrupos(id);
    if (m.tipo === 'grupo:listar') return { grupos: lista.map((g) => ({ grupo: g.grupo, nome: g.nome })), convites: await convitesGrupo(id) };
    if (m.tipo === 'grupo:exportar') return { tipo: 'vagalume-grupos', versao: 1, conta: id, grupos: lista, convites: await convitesGrupo(id) };
    if (m.tipo === 'grupo:restaurar') {
      const b = m.backup;
      if (!b || b.tipo !== 'vagalume-grupos' || b.versao !== 1 || b.conta !== id || !Array.isArray(b.grupos) || !Array.isArray(b.convites) || b.grupos.length > 50 || b.convites.length > 50) throw new Error('grupo-backup');
      const importados = G.limparLista(b.grupos);
      if (importados.length !== b.grupos.length || b.convites.some((c) => !c || !G.codigoValido(c.grupo) || (c.chave !== null && !G.codigoValido(c.chave)) || !G.usuarioValido(c.de))) throw new Error('grupo-backup');
      const grupos = new Map(lista.map((g) => [g.grupo, g]));
      for (const g of importados) if (!grupos.has(g.grupo)) grupos.set(g.grupo, g);
      if (grupos.size > 50) throw new Error('grupo-limite');
      const convites = new Map((await convitesGrupo(id)).map((c) => [c.grupo, c]));
      for (const c of b.convites) if (!convites.has(c.grupo)) convites.set(c.grupo, { grupo: c.grupo, chave: c.chave, de: String(c.de), autor: G.nome(c.autor) });
      if (convites.size > 50) throw new Error('grupo-limite');
      await armazenamentoGrupo('gravar', 'vl.grupos.' + id, [...grupos.values()]);
      await armazenamentoGrupo('gravar', 'vl.gruposConvites.' + id, [...convites.values()]);
      return { grupos: grupos.size, adicionados: grupos.size - lista.length };
    }
    if (m.tipo === 'grupo:receber') {
      if (!G.codigoValido(m.grupo) || (m.convite && !G.codigoValido(m.convite)) || !G.usuarioValido(m.de)) throw new Error('pedido');
      const pendentes = (await convitesGrupo(id)).filter((c) => c.grupo !== m.grupo);
      pendentes.push({ grupo: m.grupo, chave: m.convite || null, de: String(m.de), autor: G.nome(m.autor) });
      await armazenamentoGrupo('gravar', 'vl.gruposConvites.' + id, pendentes.slice(-50));
      return { ok: true };
    }
    if (m.tipo === 'grupo:criar') {
      if (lista.length >= 50) throw new Error('grupo-limite');
      const d = await (await rede('/grupos?id=' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: G.nome(m.nome), apelido: G.nome(m.apelido) }) })).json();
      await guardarGrupo(id, d);
      return { grupo: d.grupo, nome: d.nome };
    }
    if (!G.codigoValido(m.grupo)) throw new Error('pedido');
    if (m.tipo === 'grupo:mensagens' || m.tipo === 'grupo:mensagem') {
      const salvo = await registroGrupo(id, m.grupo);
      const opcoes = { headers: { Authorization: 'Bearer ' + salvo.chave } };
      if (m.tipo === 'grupo:mensagem') {
        opcoes.method = 'POST';
        opcoes.headers['Content-Type'] = 'application/json';
        opcoes.body = JSON.stringify({ texto: m.texto, codigo: m.codigo });
      }
      return (await rede('/grupo/' + m.grupo + '/mensagens?id=' + id, opcoes)).json();
    }
    if (m.tipo === 'grupo:dispensar') { await dispensarConvite(id, m.grupo); return { ok: true }; }
    if (m.tipo === 'grupo:esquecer') { await guardarGrupo(id, { grupo: m.grupo }, true); return { ok: true }; }
    const acoes = { 'grupo:ver': '', 'grupo:perfil': 'perfil', 'grupo:aceitar': 'aceitar', 'grupo:convidar': 'convidar', 'grupo:renomear': 'renomear', 'grupo:remover': 'remover', 'grupo:sair': 'sair', 'grupo:excluir': 'excluir' };
    if (!(m.tipo in acoes)) throw new Error('pedido');
    const salvo = lista.find((g) => g.grupo === m.grupo);
    const chave = ((m.tipo === 'grupo:ver' || m.tipo === 'grupo:aceitar') && G.codigoValido(m.convite)) ? m.convite : salvo && salvo.chave;
    if (!chave) throw new Error('grupo-nao-salvo');
    if (m.tipo === 'grupo:aceitar' && !salvo && lista.length >= 50) throw new Error('grupo-limite');
    const acao = acoes[m.tipo];
    const opcoes = { headers: { Authorization: 'Bearer ' + chave } };
    if (acao) {
      opcoes.method = 'POST';
      opcoes.headers['Content-Type'] = 'application/json';
      opcoes.body = JSON.stringify({ id: m.amigo, nome: G.nome(m.nome), renovar: m.renovar === true, visual: m.visual });
    }
    const d = await (await rede('/grupo/' + m.grupo + (acao ? '/' + acao : '') + '?id=' + id, opcoes)).json();
    if (m.tipo === 'grupo:aceitar' || (m.tipo === 'grupo:ver' && salvo) || m.tipo === 'grupo:renomear') {
      await guardarGrupo(id, { grupo: m.grupo, chave, nome: d.nome });
    }
    if (m.tipo === 'grupo:aceitar') await dispensarConvite(id, m.grupo);
    if (m.tipo === 'grupo:sair' || m.tipo === 'grupo:excluir') {
      await guardarGrupo(id, { grupo: m.grupo }, true);
      if (voz && voz.grupo === m.grupo) sairDaVoz();
    }
    return d;
  }

  function endereco(caminho) { return S.ENDERECO.replace(/\/+$/, '') + caminho; }
  function enderecoWs(caminho) { return endereco(caminho).replace(/^https:/, 'wss:'); }
  function avisar(tipo, dado) { chrome.runtime.sendMessage(Object.assign({}, dado || {}, { de: 'sala', tipo })).catch(function () {}); }

  // Única porta de rede desta página (além do WebSocket da voz): sempre o servidor do Vagalume.
  async function rede(caminho, opcoes) {
    if (!S || !S.configurado()) throw new Error('sem-servidor');
    const r = await fetch(endereco(caminho), Object.assign({}, opcoes, { credentials: 'omit', cache: 'no-store' }));
    if (!r.ok) {
      let codigo = 'http-' + r.status;
      try { const d = await r.json(); if (d && d.erro) codigo = d.erro; } catch (e) { /* sem corpo */ }
      throw new Error(codigo);
    }
    return r;
  }

  function deBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function paraDataUrl(blob) {
    return new Promise(function (resolver, rejeitar) {
      const leitor = new FileReader();
      leitor.onload = function () { resolver(leitor.result); };
      leitor.onerror = function () { rejeitar(new Error('leitura')); };
      leitor.readAsDataURL(blob);
    });
  }

  // ---------- mídia ----------
  const cache = new Map(); // id -> Promise<{ dataUrl, tipo }>
  function baixar(id) {
    if (!S.idValido(id)) return Promise.reject(new Error('codigo'));
    if (!cache.has(id)) {
      const p = rede('/midia/' + id).then(async function (r) {
        const blob = await r.blob();
        return { dataUrl: await paraDataUrl(blob), tipo: blob.type };
      });
      p.catch(function () { cache.delete(id); });
      cache.set(id, p);
      if (cache.size > 120) cache.delete(cache.keys().next().value);
    }
    return cache.get(id);
  }
  // Com miniatura (filtro de imagens do servidor), ela vai na frente da imagem e o cabeçalho diz o tamanho dela.
  async function enviar(bytes, tipo, autor, miniatura) {
    const headers = { 'Content-Type': tipo, 'X-Vagalume-Autor': String(autor || '') };
    let corpo = bytes;
    if (miniatura && miniatura.length) {
      corpo = new Uint8Array(miniatura.length + bytes.length);
      corpo.set(miniatura, 0);
      corpo.set(bytes, miniatura.length);
      headers['X-Vagalume-Miniatura'] = String(miniatura.length);
    }
    const r = await rede('/midia', { method: 'POST', headers, body: corpo });
    return r.json();
  }

  // ---------- áudio: gravar e tocar ----------
  let gravacao = null;
  async function gravar() {
    if (gravacao) return { erro: 'gravando' };
    let fluxo;
    try {
      fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { return { erro: 'microfone' }; }
    const tipo = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const rec = new MediaRecorder(fluxo, { mimeType: tipo, audioBitsPerSecond: 32000 });
    const pedacos = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) pedacos.push(e.data); };
    rec.start(250);
    gravacao = { rec, fluxo, pedacos, inicio: Date.now(), limite: setTimeout(function () { avisar('audio:limite'); }, LIMITE_AUDIO) };
    return { ok: true };
  }
  async function pararGravacao(mandar, autor) {
    const g = gravacao;
    if (!g) return { erro: 'parado' };
    gravacao = null;
    clearTimeout(g.limite);
    await new Promise(function (resolver) { g.rec.onstop = resolver; try { g.rec.stop(); } catch (e) { resolver(); } });
    g.fluxo.getTracks().forEach((t) => t.stop());
    if (!mandar) return { ok: true };
    const segundos = Math.min(60, Math.round((Date.now() - g.inicio) / 1000));
    const blob = new Blob(g.pedacos, { type: 'audio/webm' });
    if (segundos < 1 || blob.size < 800) return { erro: 'curto' };
    const r = await enviar(new Uint8Array(await blob.arrayBuffer()), 'audio/webm', autor);
    return { id: r.id, segundos };
  }
  // Um áudio por vez. Enquanto toca (ou pausado), avisa a posição para o balão mostrar a barra.
  let tocando = null; // { id, a, relogio }
  function progresso(t) {
    const d = isFinite(t.a.duration) ? t.a.duration : 0;
    avisar('audio:progresso', { id: t.id, t: t.a.currentTime || 0, d, tocando: !t.a.paused });
  }
  async function tocar(id, volume, inicio) {
    if (tocando && tocando.id === id) {
      if (typeof inicio === 'number') tocando.a.currentTime = Math.max(0, inicio);
      await tocando.a.play();
      progresso(tocando);
      return { ok: true };
    }
    pararDeTocar();
    const m = await baixar(id);
    const a = new Audio(m.dataUrl);
    a.volume = Math.max(0, Math.min(1, volume == null ? 1 : volume));
    const t = { id, a, relogio: null };
    tocando = t;
    a.onended = function () { if (tocando === t) { clearInterval(t.relogio); tocando = null; avisar('audio:fim', { id }); } };
    a.onpause = function () { if (tocando === t) progresso(t); };
    a.onloadedmetadata = function () { if (tocando === t) progresso(t); };
    if (typeof inicio === 'number') a.currentTime = Math.max(0, inicio);
    t.relogio = setInterval(function () { if (tocando === t && !a.paused) progresso(t); }, 250);
    await a.play();
    progresso(t);
    return { ok: true };
  }
  function pausar(id) { if (tocando && tocando.id === id) tocando.a.pause(); }
  function irPara(id, segundos, volume) {
    if (tocando && tocando.id === id) { tocando.a.currentTime = Math.max(0, segundos); progresso(tocando); return Promise.resolve({ ok: true }); }
    return tocar(id, volume, segundos);
  }
  function pararDeTocar() {
    if (!tocando) return;
    const t = tocando;
    tocando = null;
    clearInterval(t.relogio);
    t.a.pause();
    avisar('audio:fim', { id: t.id });
  }

  // Única porta de WebSocket desta página: sempre o servidor do Vagalume (voz e presença).
  function abrirSocket(caminho) {
    if (!S || !S.configurado()) throw new Error('sem-servidor');
    return new WebSocket(enderecoWs(caminho));
  }

  // ---------- presença: quem usa o Vagalume no quarto e ações entre Vagalumes ----------
  let presenca = null; // { quarto, id, nome, ws, pessoas: Map id -> nome, fechado, espera }
  function listaPresenca(p) { avisar('presenca:lista', { quarto: p.quarto, nomes: [...p.pessoas.values()] }); }
  function conectarPresenca(p) {
    let ws;
    try { ws = abrirSocket('/presenca/' + encodeURIComponent(p.quarto) + '?id=' + encodeURIComponent(p.id) + '&nome=' + encodeURIComponent(p.nome)); } catch (e) { return; }
    p.ws = ws;
    ws.onopen = function () { p.espera = 2000; };
    ws.onmessage = function (e) {
      if (presenca !== p) return;
      let m;
      try { m = JSON.parse(e.data); } catch (erro) { return; }
      if (m.t === 'ola') { p.pessoas = new Map((m.pessoas || []).map((x) => [String(x.id), String(x.nome || '')])); p.pessoas.set(p.id, p.nome); listaPresenca(p); }
      else if (m.t === 'entrou') { p.pessoas.set(String(m.id), String(m.nome || '')); listaPresenca(p); }
      else if (m.t === 'saiu') { p.pessoas.delete(String(m.id)); listaPresenca(p); }
      else if (m.t === 'acao') avisar('presenca:acao', { autorId: String(m.de), nome: String(m.nome || ''), dado: m.dado });
      else if (m.t === 'sinal' && m.dado && m.dado.t === 'vl:direto') {
        const autorId = String(m.de || '');
        const nome = p.pessoas.get(autorId);
        if (nome && m.dado.d && typeof m.dado.d === 'object') avisar('presenca:direto', { autorId, nome, dado: m.dado.d });
      }
    };
    ws.onclose = function () {
      if (presenca !== p || p.fechado) return;
      // Caiu: tenta de novo com espera crescente (até 1 min).
      p.espera = Math.min(60000, (p.espera || 2000) * 2);
      setTimeout(function () { if (presenca === p && !p.fechado) conectarPresenca(p); }, p.espera);
    };
  }
  function entrarPresenca(quarto, id, nome) {
    if (presenca && presenca.quarto === quarto && presenca.id === id) { listaPresenca(presenca); return { ok: true }; }
    sairPresenca();
    const p = { quarto, id, nome, ws: null, pessoas: new Map([[id, nome]]), fechado: false, espera: 2000 };
    presenca = p;
    conectarPresenca(p);
    return { ok: true };
  }
  function sairPresenca() {
    const p = presenca;
    if (!p) return { ok: true };
    presenca = null;
    p.fechado = true;
    try { if (p.ws) p.ws.close(1000, 'tchau'); } catch (e) { /* já fechado */ }
    return { ok: true };
  }

  // ---------- jogos entre quartos (pedido do usuário em 2026-11-22) ----------
  // Uma sala só da partida, no mesmo serviço da presença ("9" + 11 dígitos: não bate com id de quarto). As
  // jogadas vão como sinal direto para o id do adversário; quem entra e sai da sala vira aviso para a aba.
  let jogo = null; // { canal, id, nome, ws, pessoas: Map id -> nome, fechado, espera }
  function pessoasDoJogo(j) { avisar('jogo:pessoas', { canal: j.canal, ids: [...j.pessoas.keys()].filter((x) => x !== j.id) }); }
  function conectarJogo(j) {
    let ws;
    try { ws = abrirSocket('/presenca/' + encodeURIComponent(j.canal) + '?id=' + encodeURIComponent(j.id) + '&nome=' + encodeURIComponent(j.nome)); } catch (e) { return; }
    j.ws = ws;
    ws.onopen = function () { j.espera = 1000; };
    ws.onmessage = function (e) {
      if (jogo !== j) return;
      let m;
      try { m = JSON.parse(e.data); } catch (erro) { return; }
      if (m.t === 'ola') { j.pessoas = new Map((m.pessoas || []).map((x) => [String(x.id), String(x.nome || '')])); j.pessoas.set(j.id, j.nome); pessoasDoJogo(j); }
      else if (m.t === 'entrou') { j.pessoas.set(String(m.id), String(m.nome || '')); pessoasDoJogo(j); }
      else if (m.t === 'saiu') { j.pessoas.delete(String(m.id)); pessoasDoJogo(j); }
      else if (m.t === 'sinal' && m.dado && m.dado.t === 'vl:jogo' && m.dado.d && typeof m.dado.d === 'object') {
        const autorId = String(m.de || '');
        avisar('jogo:direto', { canal: j.canal, autorId, nome: j.pessoas.get(autorId) || '', dado: m.dado.d });
      }
    };
    ws.onclose = function () {
      if (jogo !== j || j.fechado) return;
      j.espera = Math.min(30000, (j.espera || 1000) * 2);
      setTimeout(function () { if (jogo === j && !j.fechado) conectarJogo(j); }, j.espera);
    };
  }
  function entrarJogo(canal, id, nome) {
    if (!/^9\d{11}$/.test(canal) || !id) return { erro: 'pedido' };
    if (jogo && jogo.canal === canal && jogo.id === id) { pessoasDoJogo(jogo); return { ok: true }; }
    sairJogo();
    jogo = { canal, id, nome, ws: null, pessoas: new Map([[id, nome]]), fechado: false, espera: 1000 };
    conectarJogo(jogo);
    return { ok: true };
  }
  function sairJogo() {
    const j = jogo;
    if (!j) return { ok: true };
    jogo = null;
    j.fechado = true;
    try { if (j.ws) j.ws.close(1000, 'tchau'); } catch (e) { /* já fechado */ }
    return { ok: true };
  }

  // ---------- voz ----------
  let voz = null;
  async function entrarNaVoz(quarto, id, nome, opcoes) {
    let grupo = null;
    if (opcoes && opcoes.grupo) {
      grupo = await registroGrupo(String(id), opcoes.grupo);
      // Confere a participação antes de interromper a chamada atual ou abrir o microfone.
      await pedidoGrupo({ tipo: 'grupo:ver', id, grupo: grupo.grupo });
    }
    if (voz) sairDaVoz();
    let microfone;
    try {
      microfone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { return { erro: 'microfone' }; }
    let ice = [{ urls: 'stun:stun.cloudflare.com:3478' }];
    try { const r = await rede('/turn'); const d = await r.json(); if (Array.isArray(d.iceServers) && d.iceServers.length) ice = d.iceServers; } catch (e) { /* fica o STUN */ }
    const contexto = new AudioContext();
    const v = {
      quarto, grupo: grupo && grupo.grupo, privado: !!(opcoes && opcoes.privado), id: String(id), nome, ice, microfone, contexto,
      pares: new Map(), // id -> { pc, nome, audio, analisador, volume, calado, falando, mudo, pendentes }
      mudo: false, apertar: !!(opcoes && opcoes.apertarParaFalar), apertando: false, falando: false,
      ws: null, relogio: null, fechado: false,
    };
    voz = v;
    v.analisadorEu = analisar(contexto, microfone);
    atualizarMicrofone();
    const caminho = grupo ? '/grupo/' + grupo.grupo : (opcoes && opcoes.privado ? '/privado/' : '/sala/') + encodeURIComponent(quarto);
    const ws = abrirSocket(caminho + '?id=' + encodeURIComponent(v.id) + '&nome=' + encodeURIComponent(nome) + (grupo ? '&chave=' + grupo.chave : ''));
    v.ws = ws;
    ws.onmessage = function (e) { aoMensagem(v, e.data); };
    ws.onclose = function (e) {
      if (voz !== v || v.fechado) return;
      sairDaVoz();
      avisar('voz:caiu', { motivo: e.code === 4000 ? 'substituido' : e.reason || 'conexao' });
    };
    v.relogio = setInterval(function () { medir(v); }, 150);
    return await new Promise(function (resolver) {
      const fim = setTimeout(function () { resolver({ erro: 'conexao' }); }, 8000);
      ws.onopen = function () { clearTimeout(fim); resolver({ ok: true }); };
      ws.onerror = function () { clearTimeout(fim); resolver({ erro: 'conexao' }); };
    });
  }
  function analisar(contexto, fluxo) {
    try {
      const fonte = contexto.createMediaStreamSource(fluxo);
      const a = contexto.createAnalyser();
      a.fftSize = 512;
      fonte.connect(a);
      return { a, dados: new Uint8Array(a.fftSize) };
    } catch (e) { return null; }
  }
  function nivel(an) {
    if (!an) return 0;
    an.a.getByteTimeDomainData(an.dados);
    let soma = 0;
    for (const x of an.dados) { const d = (x - 128) / 128; soma += d * d; }
    return Math.sqrt(soma / an.dados.length);
  }
  function atualizarMicrofone() {
    if (!voz) return;
    const ligado = !voz.mudo && (!voz.apertar || voz.apertando);
    voz.microfone.getAudioTracks().forEach((t) => { t.enabled = ligado; });
    if (voz.ws && voz.ws.readyState === 1) voz.ws.send(JSON.stringify({ t: 'estado', mudo: !ligado }));
  }
  function sinal(v, para, dado) { if (v.ws && v.ws.readyState === 1) v.ws.send(JSON.stringify({ t: 'sinal', para, dado })); }
  function criarPar(v, id, nome, iniciar) {
    const pc = new RTCPeerConnection({ iceServers: v.ice });
    const par = { pc, nome: nome || '?', audio: null, analisador: null, volume: 1, calado: false, falando: false, mudo: false, pendentes: [], pronto: false };
    v.pares.set(id, par);
    v.microfone.getTracks().forEach((t) => pc.addTrack(t, v.microfone));
    pc.onicecandidate = function (e) { if (e.candidate) sinal(v, id, { c: e.candidate.toJSON() }); };
    pc.ontrack = function (e) {
      const fluxo = e.streams[0];
      if (!fluxo || par.audio) return;
      par.audio = new Audio();
      par.audio.srcObject = fluxo;
      par.audio.volume = par.volume;
      par.audio.muted = par.calado;
      par.audio.play().catch(function () {});
      par.analisador = analisar(v.contexto, fluxo);
      estado(v);
    };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === 'failed') { fecharPar(v, id); estado(v); }
    };
    if (iniciar) {
      pc.createOffer().then((o) => pc.setLocalDescription(o)).then(function () { sinal(v, id, { d: pc.localDescription.toJSON() }); }).catch(function () {});
    }
    return par;
  }
  function fecharPar(v, id) {
    const p = v.pares.get(id);
    if (!p) return;
    v.pares.delete(id);
    try { p.pc.close(); } catch (e) { /* já fechado */ }
    if (p.audio) { p.audio.pause(); p.audio.srcObject = null; }
  }
  async function aoSinal(v, de, dado) {
    if (!dado || typeof dado !== 'object') return;
    let p = v.pares.get(de);
    if (!p) p = criarPar(v, de, (v.nomes && v.nomes.get(de)) || '?', false);
    try {
      if (dado.d && (dado.d.type === 'offer' || dado.d.type === 'answer')) {
        await p.pc.setRemoteDescription(dado.d);
        p.pronto = true;
        for (const c of p.pendentes.splice(0)) await p.pc.addIceCandidate(c).catch(function () {});
        if (dado.d.type === 'offer') {
          await p.pc.setLocalDescription(await p.pc.createAnswer());
          sinal(v, de, { d: p.pc.localDescription.toJSON() });
        }
      } else if (dado.c) {
        if (p.pronto) await p.pc.addIceCandidate(dado.c).catch(function () {});
        else p.pendentes.push(dado.c);
      }
    } catch (e) { /* sinal fora de ordem: a conexão tenta de novo pelo ICE */ }
  }
  function aoMensagem(v, bruto) {
    if (voz !== v) return;
    let m;
    try { m = JSON.parse(bruto); } catch (e) { return; }
    v.nomes = v.nomes || new Map();
    if (m.t === 'ola') {
      for (const p of m.pessoas || []) { v.nomes.set(String(p.id), p.nome); criarPar(v, String(p.id), p.nome, true); }
      atualizarMicrofone();
    } else if (m.t === 'entrou') {
      v.nomes.set(String(m.id), m.nome);
      if (v.pares.has(String(m.id))) fecharPar(v, String(m.id));
      avisar('voz:entrou', { id: String(m.id), nome: m.nome });
    } else if (m.t === 'saiu') {
      const p = v.pares.get(String(m.id));
      fecharPar(v, String(m.id));
      if (p) avisar('voz:saiu', { id: String(m.id), nome: p.nome });
      avisar('tela:saiu', { id: String(m.id) });
    } else if (m.t === 'sinal' && m.dado && m.dado.tela && typeof m.dado.tela === 'object') {
      // Tela compartilhada (src/tela): o vídeo vai direto entre as páginas da tela; a sala só repassa os sinais.
      avisar('tela:sinal', { autorId: String(m.de), nome: v.nomes.get(String(m.de)) || '', dado: m.dado.tela });
    } else if (m.t === 'sinal') {
      aoSinal(v, String(m.de), m.dado);
    } else if (m.t === 'recusou') {
      avisar('voz:recusou', { id: String(m.id || '') });
    } else if (m.t === 'grupo:nome') {
      avisar('voz:grupo-nome', { grupo: v.grupo, nome: String(m.nome || '') });
    } else if (m.t === 'estado') {
      const p = v.pares.get(String(m.id));
      if (p) p.mudo = !!m.mudo;
    }
    estado(v);
  }
  let ultimoEstado = '';
  function estado(v) {
    if (voz !== v) return;
    const pessoas = [...v.pares].map(([id, p]) => ({ id, nome: p.nome, falando: p.falando, mudo: p.mudo, volume: p.volume, calado: p.calado, conectado: !!p.audio }));
    const dado = { quarto: v.quarto, grupo: v.grupo, eu: { falando: v.falando, mudo: v.mudo, apertar: v.apertar, apertando: v.apertando }, pessoas };
    const s = JSON.stringify(dado);
    if (s === ultimoEstado) return;
    ultimoEstado = s;
    avisar('voz:estado', dado);
  }
  function medir(v) {
    if (voz !== v) return;
    const ligado = !v.mudo && (!v.apertar || v.apertando);
    v.falando = ligado && nivel(v.analisadorEu) > 0.04;
    for (const p of v.pares.values()) p.falando = !p.calado && nivel(p.analisador) > 0.035;
    estado(v);
  }
  function sairDaVoz() {
    const v = voz;
    if (!v) return { ok: true };
    voz = null;
    v.fechado = true;
    clearInterval(v.relogio);
    for (const id of [...v.pares.keys()]) fecharPar(v, id);
    try { v.ws.close(1000, 'tchau'); } catch (e) { /* já fechado */ }
    v.microfone.getTracks().forEach((t) => t.stop());
    v.contexto.close().catch(function () {});
    ultimoEstado = '';
    avisar('voz:estado', { quarto: null, pessoas: [] });
    return { ok: true };
  }

  // ---------- pedidos do fundo ----------
  async function atender(m) {
    if (m.tipo.startsWith('grupo:')) {
      const p = filaGrupos.then(() => pedidoGrupo(m));
      filaGrupos = p.catch(function () {});
      return p;
    }
    switch (m.tipo) {
      case 'midia:enviar': return enviar(deBase64(m.base64), m.mime, m.autor, m.miniatura ? deBase64(m.miniatura) : null);
      case 'midia:baixar': return baixar(m.id);
      case 'midia:denunciar': return (await rede('/denunciar/' + m.id, { method: 'POST' })).json();
      case 'gifs:buscar': {
        const r = await (await rede('/gifs?q=' + encodeURIComponent(m.q || '') + (m.pos ? '&pos=' + encodeURIComponent(m.pos) : ''))).json();
        // As prévias também passam por aqui (a página do Habblet não carrega imagens de outros sites).
        const lista = await Promise.all((r.lista || []).map(async function (g) {
          try { const b = await (await rede('/gifs/previa?u=' + encodeURIComponent(g.previa))).blob(); return Object.assign({}, g, { previa: await paraDataUrl(b) }); } catch (e) { return null; }
        }));
        return { lista: lista.filter(Boolean), proximo: r.proximo || '', fonte: r.fonte || '' };
      }
      case 'gifs:salvar': return (await rede('/gifs/salvar', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vagalume-Autor': String(m.autor || '') }, body: JSON.stringify({ id: m.id }) })).json();
      case 'servidor:info': return (await rede('/')).json();
      case 'audio:gravar': return gravar();
      case 'audio:parar': return pararGravacao(!!m.enviar, m.autor);
      case 'audio:tocar': return tocar(m.id, m.volume);
      case 'audio:pausar': pausar(m.id); return { ok: true };
      case 'audio:ir': return irPara(m.id, Number(m.t) || 0, m.volume);
      case 'audio:pararTocar': pararDeTocar(); return { ok: true };
      // Recusar uma chamada privada: a sala dos dois avisa quem ligou.
      case 'voz:recusar': {
        const sala = String(m.sala || '');
        if (!/^\d{1,12}-\d{1,12}$/.test(sala)) return { erro: 'pedido' };
        return (await rede('/privado/' + sala + '/recusar?id=' + encodeURIComponent(String(m.id).replace(/\D/g, '')), { method: 'POST' })).json();
      }
      case 'voz:quem': return (await rede('/sala/' + String(m.quarto).replace(/\D/g, '') + '/pessoas')).json();
      case 'presenca:entrar': return entrarPresenca(String(m.quarto).replace(/\D/g, ''), String(m.id).replace(/\D/g, ''), String(m.nome || '').slice(0, 32));
      case 'presenca:sair': return sairPresenca();
      case 'jogo:entrar': return entrarJogo(String(m.canal || ''), String(m.id || '').replace(/\D/g, ''), String(m.nome || '').slice(0, 32));
      case 'jogo:sair': return sairJogo();
      case 'jogo:enviar': {
        if (!jogo || !jogo.ws || jogo.ws.readyState !== 1) return { erro: 'conexao' };
        const para = String(m.para || '').replace(/\D/g, '');
        if (!para || !m.dado || typeof m.dado !== 'object') return { erro: 'pedido' };
        const dado = JSON.stringify({ t: 'vl:jogo', d: m.dado });
        if (dado.length > 900) return { erro: 'tamanho' };
        jogo.ws.send(JSON.stringify({ t: 'sinal', para, dado: JSON.parse(dado) }));
        return { ok: true };
      }
      case 'presenca:acao':
        if (!presenca || !presenca.ws || presenca.ws.readyState !== 1) return { erro: 'conexao' };
        presenca.ws.send(JSON.stringify({ t: 'acao', dado: m.dado }));
        return { ok: true };
      case 'presenca:fala': {
        if (!presenca || !presenca.ws || presenca.ws.readyState !== 1) return { erro: 'conexao' };
        if (!m.dado || m.dado.t !== 'chat:fala' || !Array.isArray(m.dado.a)) return { erro: 'pedido' };
        const dado = { t: 'vl:direto', d: m.dado };
        if (JSON.stringify(dado).length > 600) return { erro: 'tamanho' };
        for (const id of presenca.pessoas.keys()) {
          if (id !== presenca.id) presenca.ws.send(JSON.stringify({ t: 'sinal', para: id, dado }));
        }
        return { ok: true };
      }
      case 'presenca:direto': {
        if (!presenca || !presenca.ws || presenca.ws.readyState !== 1) return { erro: 'conexao' };
        const nome = String(m.para || '').trim().toLowerCase();
        const alvo = [...presenca.pessoas].find(([id, n]) => id !== presenca.id && String(n).trim().toLowerCase() === nome);
        if (!alvo || !m.dado || typeof m.dado !== 'object') return { erro: 'pessoa' };
        const dado = JSON.stringify({ t: 'vl:direto', d: m.dado });
        if (dado.length > 600) return { erro: 'tamanho' };
        presenca.ws.send(JSON.stringify({ t: 'sinal', para: alvo[0], dado: JSON.parse(dado) }));
        return { ok: true };
      }
      case 'voz:entrar': return entrarNaVoz(String(m.quarto), m.id, m.nome, m);
      case 'voz:sair': return sairDaVoz();
      // Tela compartilhada: só na chamada privada e nos grupos (pedido do usuário em 2026-11-19).
      case 'tela:info': {
        if (!voz) return { erro: 'sem-chamada' };
        if (!voz.privado && !voz.grupo) return { erro: 'so-privado' };
        return { ok: true, id: voz.id, nome: voz.nome, ice: voz.ice, pessoas: [...voz.pares].map(([id, p]) => ({ id, nome: p.nome })) };
      }
      case 'tela:sinal':
      case 'tela:todos': {
        if (!voz || (!voz.privado && !voz.grupo)) return { erro: 'sem-chamada' };
        if (!m.dado || typeof m.dado !== 'object' || JSON.stringify(m.dado).length > 18000) return { erro: 'pedido' };
        const ids = m.tipo === 'tela:todos' ? [...voz.pares.keys()] : [String(m.para || '')].filter((x) => voz.pares.has(x) || (voz.nomes && voz.nomes.has(x)));
        for (const id of ids) sinal(voz, id, { tela: m.dado });
        return { ok: true, enviados: ids.length };
      }
      case 'voz:mudo': if (voz) { voz.mudo = !!m.mudo; atualizarMicrofone(); estado(voz); } return { ok: true };
      case 'voz:apertar': if (voz) { voz.apertar = !!m.ativo; atualizarMicrofone(); estado(voz); } return { ok: true };
      case 'voz:falar': if (voz) { voz.apertando = !!m.ativo; atualizarMicrofone(); estado(voz); } return { ok: true };
      case 'voz:volume': {
        const p = voz && voz.pares.get(String(m.id));
        if (p) {
          if (typeof m.volume === 'number') p.volume = Math.max(0, Math.min(1, m.volume));
          if (typeof m.calado === 'boolean') p.calado = m.calado;
          if (p.audio) { p.audio.volume = p.volume; p.audio.muted = p.calado; }
          estado(voz);
        }
        return { ok: true };
      }
      case 'voz:estado': if (voz) { ultimoEstado = ''; estado(voz); } return { ok: true, ativo: !!voz };
      default: return { erro: 'pedido' };
    }
  }
  chrome.runtime.onMessage.addListener(function (m, remetente, responder) {
    if (!m || m.alvo !== 'sala' || remetente.id !== chrome.runtime.id) return undefined;
    atender(m).then(responder, function (e) { responder({ erro: String(e && e.message || e) }); });
    return true;
  });
})();
