// Vagalume — service worker. Mantém as regras de bloqueio e o limitador de quadros de acordo com a
// configuração, captura a tela a pedido da aba do hotel e abre a página de opções.
// Não guarda estado próprio: tudo é relido do armazenamento, porque o navegador encerra este
// script quando ele fica ocioso.
'use strict';

importScripts('core/padroes.js', 'core/atalhos.js', 'core/texto.js', 'core/config.js', 'core/lastfm.js', 'core/conexoes-perfil.js', 'core/youtube-busca.js', 'core/historico-local.js', 'core/avatar-miniatura.js', 'captura/recorte.js');

const armazem = self.VL.config.criarArmazem(chrome.storage);
const REGRAS = ['anuncios', 'medicao']; // ids dos conjuntos declarados no manifesto
// Scripts do mundo da página, instalados só quando o módulo correspondente está ligado.
// O mundo MAIN é necessário para alcançar o requestAnimationFrame e o WebSocket do jogo.
const SCRIPTS_PAGINA = [
  { id: 'vl-limite-fps', modulo: 'fps', js: ['src/principal/limite-fps.js'] },
  { id: 'vl-conexao', modulo: 'conexao', js: ['src/core/protocolo.js', 'src/principal/conexao.js', 'src/principal/ids-quartos.js', 'src/principal/avatar.js'] },
];
const PAGINAS_HOTEL = ['*://*.habblet.city/hotel*'];
const TITULO_PADRAO = (chrome.runtime.getManifest().action || {}).default_title || 'Vagalume';

function ehHotel(url) {
  return /^https?:\/\/([a-z0-9-]+\.)*habblet\.city\/hotel/i.test(String(url || ''));
}

// ---------- configuração -> regras de bloqueio e limitador de quadros ----------

async function aplicarConfig() {
  const cfg = await armazem.ler();

  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: REGRAS.filter((id) => cfg.modulos[id] === true),
      disableRulesetIds: REGRAS.filter((id) => cfg.modulos[id] !== true),
    });
  } catch (erro) {
    console.warn('[Vagalume] Não foi possível atualizar as regras de bloqueio:', erro);
  }

  try {
    const lidos = await chrome.scripting.getRegisteredContentScripts();
    const registrados = new Set(lidos.map((s) => s.id));
    const arquivosDe = new Map(lidos.map((s) => [s.id, (s.js || []).join('|')]));
    for (const script of SCRIPTS_PAGINA) {
      const quer = cfg.modulos[script.modulo] === true;
      try {
        if (quer && !registrados.has(script.id)) {
          await chrome.scripting.registerContentScripts([{
            id: script.id,
            js: script.js,
            matches: PAGINAS_HOTEL,
            world: 'MAIN',
            runAt: 'document_start',
            allFrames: false,
            persistAcrossSessions: true,
          }]);
        } else if (quer && arquivosDe.get(script.id) !== script.js.join('|')) {
          // Uma versão nova da extensão mudou a lista de arquivos do script: atualiza o registro.
          await chrome.scripting.updateContentScripts([{ id: script.id, js: script.js }]);
        } else if (!quer && registrados.has(script.id)) {
          await chrome.scripting.unregisterContentScripts({ ids: [script.id] });
        }
      } catch (erro) {
        console.warn('[Vagalume] Não foi possível atualizar o script ' + script.id + ':', erro);
      }
    }
  } catch (erro) {
    console.warn('[Vagalume] Não foi possível ler os scripts registrados:', erro);
  }
}

// Uma sincronização por vez: mudanças seguidas não se atropelam.
let fila = Promise.resolve();
function sincronizar() {
  fila = fila.then(aplicarConfig).catch(function (erro) {
    console.warn('[Vagalume] Falha ao sincronizar a configuração:', erro);
  });
  return fila;
}

chrome.runtime.onInstalled.addListener(function () { sincronizar(); });
chrome.runtime.onStartup.addListener(function () { sincronizar(); });
chrome.storage.onChanged.addListener(function (mudancas, area) {
  if (area === 'sync' && Object.prototype.hasOwnProperty.call(mudancas, 'vl.modulos')) sincronizar();
});

// ---------- captura de tela ----------

// O navegador só permite capturar a aba depois de um gesto do usuário na extensão (atalho de
// teclado ou clique no ícone). Sem esse gesto, a chamada falha e a aba recebe o motivo.
async function atalhoDaCaptura() {
  try {
    const c = (await chrome.commands.getAll()).find((x) => x.name === 'capturar-tela');
    return c && c.shortcut ? c.shortcut : '';
  } catch (erro) { return ''; }
}

async function capturarPara(remetente) {
  const aba = remetente.tab;
  if (!aba || remetente.frameId !== 0 || !ehHotel(remetente.url || aba.url)) return { ok: false, erro: 'fora-do-hotel' };
  if (!aba.active) return { ok: false, erro: 'aba-inativa' };
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(aba.windowId, { format: 'png' });
    return { ok: true, dataUrl };
  } catch (erro) {
    const detalhe = String((erro && erro.message) || erro);
    let motivo = 'falha';
    if (/activeTab|all_urls|permission/i.test(detalhe)) motivo = 'permissao';
    else if (/MAX_CAPTURE|quota/i.test(detalhe)) motivo = 'limite';
    return { ok: false, erro: motivo, detalhe, atalho: motivo === 'permissao' ? await atalhoDaCaptura() : undefined };
  }
}

// Guarda a captura no armazenamento de sessão (some quando o navegador fecha) e abre o editor
// em uma aba ao lado da do hotel. Os scripts de conteúdo não alcançam esse armazenamento.
async function abrirEditor(remetente, dataUrl) {
  const aba = remetente.tab;
  if (!aba || remetente.frameId !== 0 || !ehHotel(remetente.url || aba.url)) return { ok: false, erro: 'fora-do-hotel' };
  if (!self.VL.recorte.imagemValida(dataUrl)) return { ok: false, erro: 'grande' };
  await chrome.storage.session.set({ [self.VL.recorte.CHAVE]: dataUrl });
  await chrome.tabs.create({ url: chrome.runtime.getURL('src/captura/captura.html'), index: aba.index + 1, openerTabId: aba.id });
  return { ok: true };
}

// ---------- música pelo Last.fm ----------
// Pergunta ao Last.fm o que um usuário está ouvindo (user.getrecenttracks, sem cookies) e traz a capa
// como data: (a página do Habblet não carrega imagens de outros sites). Uma resposta por usuário a cada
// 25 s, guardada na memória do fundo.
const musicaCache = new Map(); // usuário -> { quando, resposta }
function bytesParaBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
async function musicaAgora(usuario) {
  const L = self.VL.lastfm;
  if (!L.usuarioValido(usuario)) return { ok: false, erro: 'usuario' };
  const chaveUsuario = String(usuario).toLowerCase();
  const guardado = musicaCache.get(chaveUsuario);
  if (guardado && Date.now() - guardado.quando < 25000) return guardado.resposta;
  const cfg = await armazem.ler();
  const chave = (cfg.musica && cfg.musica.chave) || L.CHAVE_PADRAO;
  if (!chave) return { ok: false, erro: 'sem-chave' };
  const r = await fetch(L.endereco(usuario, chave), { credentials: 'omit', cache: 'no-store' });
  let json = null;
  try { json = await r.json(); } catch (erro) { json = null; }
  const faixa = L.lerFaixa(json);
  let resposta;
  if (!faixa) resposta = { ok: true, faixa: null };
  else if (faixa.erro) resposta = { ok: false, erro: faixa.erro === 6 ? 'nao-existe' : 'lastfm', detalhe: faixa.mensagem };
  else {
    if (faixa.capa) {
      try {
        const img = await fetch(faixa.capa, { credentials: 'omit' });
        const tipo = img.headers.get('content-type') || 'image/jpeg';
        const buf = await img.arrayBuffer();
        faixa.capa = /^image\//.test(tipo) && buf.byteLength < 400000 ? 'data:' + tipo + ';base64,' + bytesParaBase64(buf) : '';
      } catch (erro) { faixa.capa = ''; }
    }
    resposta = { ok: true, faixa };
  }
  if (musicaCache.size > 300) musicaCache.clear();
  musicaCache.set(chaveUsuario, { quando: Date.now(), resposta });
  return resposta;
}

// Confere se o código de confirmação está no "Nome de exibição" do Last.fm da pessoa.
async function musicaVerificar(usuario, codigo) {
  const L = self.VL.lastfm;
  if (!L.usuarioValido(usuario) || !/^vagalume-\d{4}$/.test(String(codigo || ''))) return { ok: false, erro: 'dados' };
  const cfg = await armazem.ler();
  const chave = (cfg.musica && cfg.musica.chave) || L.CHAVE_PADRAO;
  if (!chave) return { ok: false, erro: 'sem-chave' };
  const r = await fetch(L.enderecoInfo(usuario, chave), { credentials: 'omit', cache: 'no-store' });
  let json = null;
  try { json = await r.json(); } catch (erro) { json = null; }
  if (!json || json.error) return { ok: false, erro: json && json.error === 6 ? 'nao-existe' : 'lastfm' };
  return { ok: true, confere: L.confere(json, codigo), nome: String((json.user && json.user.name) || usuario) };
}

// Confirmação do perfil Steam (miniperfil): lê o XML público do perfil, sem cookies, e procura o
// código que a pessoa pôs no resumo. Só com a permissão de steamcommunity.com, pedida num clique.
const ORIGENS_STEAM = ['https://steamcommunity.com/*'];
async function steamVerificar(valor, codigo) {
  const P = self.VL.conexoesPerfil;
  const enderecoSteam = P.enderecoSteam(valor);
  if (!enderecoSteam || !P.codigoValido(codigo)) return { ok: false, erro: 'dados' };
  if (!(await chrome.permissions.contains({ origins: ORIGENS_STEAM }))) return { ok: false, erro: 'sem-permissao' };
  let texto;
  try {
    const r = await fetch(enderecoSteam, { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { ok: false, erro: 'steam' };
    texto = (await r.text()).slice(0, 200000);
  } catch (erro) { return { ok: false, erro: 'rede' }; }
  const d = P.lerSteamXml(texto);
  if (d.erro) return { ok: false, erro: d.erro };
  return { ok: true, id64: d.id64, nome: d.nome, publico: d.publico, confere: P.steamConfere(d, codigo) };
}

// Confirmação do Discord (miniperfil): login do próprio Discord numa janela do Chrome
// (chrome.identity), só com a permissão "identify" (nome e id; sem e-mail, servidores ou mensagens).
// O token vem no fim do endereço de retorno, é usado uma vez para ler o usuário e revogado em seguida;
// nada fica guardado. App do Discord criado pelo usuário em 2026-11-19 (o Client ID não é segredo).
const DISCORD_CLIENTE = '1573161288606027786';
const DISCORD_EU = 'https://discord.com/api/v10/users/@me';
const DISCORD_REVOGAR = 'https://discord.com/api/v10/oauth2/token/revoke';
async function discordEntrar() {
  if (!chrome.identity || !chrome.identity.launchWebAuthFlow) return { ok: false, erro: 'sem-identity' };
  const retorno = chrome.identity.getRedirectURL();
  const estado = crypto.randomUUID();
  const url = 'https://discord.com/oauth2/authorize?' + new URLSearchParams({
    client_id: DISCORD_CLIENTE, response_type: 'token', scope: 'identify', redirect_uri: retorno, state: estado, prompt: 'consent',
  });
  let volta;
  try { volta = await chrome.identity.launchWebAuthFlow({ url, interactive: true }); } catch (erro) {
    return { ok: false, erro: 'cancelado', retorno, detalhe: String((erro && erro.message) || erro) };
  }
  let campos;
  try { campos = new URLSearchParams(new URL(volta).hash.slice(1)); } catch (erro) { return { ok: false, erro: 'resposta', retorno }; }
  if (campos.get('error')) return { ok: false, erro: campos.get('error') === 'access_denied' ? 'recusado' : 'discord', retorno };
  if (campos.get('state') !== estado) return { ok: false, erro: 'estado', retorno };
  const token = campos.get('access_token');
  if (!token) return { ok: false, erro: 'resposta', retorno };
  try {
    const r = await fetch(DISCORD_EU, { credentials: 'omit', cache: 'no-store', headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { ok: false, erro: 'discord', retorno };
    const eu = await r.json();
    if (!eu || !/^\d{17,20}$/.test(String(eu.id || '')) || !eu.username) return { ok: false, erro: 'resposta', retorno };
    return { ok: true, id: String(eu.id), usuario: String(eu.username).slice(0, 40), nome: String(eu.global_name || '').slice(0, 40) };
  } catch (erro) {
    return { ok: false, erro: 'rede', retorno };
  } finally {
    fetch(DISCORD_REVOGAR, { credentials: 'omit', method: 'POST', body: new URLSearchParams({ token, client_id: DISCORD_CLIENTE }), signal: AbortSignal.timeout(10000) }).catch(function () {});
  }
}

// A busca por nome fica no painel; a extensão lê os dados públicos da pesquisa do YouTube sem cookies.
const YOUTUBE_BUSCA = 'https://www.youtube.com/results?search_query=';
async function youtubePesquisar(valor) {
  const B = self.VL.youtubeBusca;
  const termo = B.termo(valor);
  if (termo.length < 2) return { ok: false, erro: 'termo' };
  try {
    const r = await fetch(YOUTUBE_BUSCA + encodeURIComponent(termo), { credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!r.ok || Number(r.headers.get('content-length') || 0) > 6000000) return { ok: false, erro: 'indisponivel' };
    const itens = B.resultados(await r.text());
    return itens ? { ok: true, itens } : { ok: false, erro: 'resposta' };
  } catch (erro) { return { ok: false, erro: 'indisponivel' }; }
}

// ---------- sala (mídia e voz) ----------
// A página escondida src/sala/sala.html fala com o servidor da comunidade, grava e toca áudio e cuida
// da chamada de voz (na página do Habblet o microfone é bloqueado). O fundo cria a página quando
// alguém precisa dela, repassa os pedidos da aba e devolve à aba os avisos da sala.
const SALA = 'src/sala/sala.html';
let abaDaSala = null;
let criandoSala = null;
async function garantirSala() {
  const existentes = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL(SALA)] });
  if (existentes.length) return;
  if (!criandoSala) {
    criandoSala = chrome.offscreen.createDocument({
      url: SALA,
      // Sem AUDIO_PLAYBACK: com ele o Chrome fecha a página depois de 30 s sem som (e a presença cairia).
      reasons: ['USER_MEDIA', 'WEB_RTC'],
      justification: 'Gravar e tocar áudios do chat e manter a chamada de voz do quarto (o Habblet bloqueia o microfone na página).',
    }).finally(function () { criandoSala = null; });
  }
  await criandoSala;
}

// O imager entrega a cabeça em uma tela transparente. Normaliza na origem da extensão,
// que já tem acesso ao host, para medir os pixels sem depender de CORS na página do hotel.
const cacheCabecas = new Map();
async function miniaturaCabeca(figura) {
  if (!self.VL.avatarMiniatura.figuraValida(figura)) throw new Error('figura inválida');
  if (cacheCabecas.has(figura)) return cacheCabecas.get(figura);
  const pedido = (async function () {
    const urlAvatar = 'https://imaging.habblet.city/avatarimage?figure=' + encodeURIComponent(figura) + '&headonly=1&direction=2&head_direction=3';
    const r = await fetch(urlAvatar, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!r.ok || !/^image\/png\b/i.test(r.headers.get('Content-Type') || '')) throw new Error('imagem indisponível');
    const blob = await r.blob();
    return self.VL.avatarMiniatura.criar(blob);
  })();
  cacheCabecas.set(figura, pedido);
  while (cacheCabecas.size > 120) cacheCabecas.delete(cacheCabecas.keys().next().value);
  try { return await pedido; }
  catch (erro) { if (cacheCabecas.get(figura) === pedido) cacheCabecas.delete(figura); throw erro; }
}

// A API pública da Radio Habblet devolve GIFs com transparência. Se a política de imagens
// do hotel bloquear o endereço externo, a aba pede a mesma imagem ao fundo da extensão.
async function previaVisual(categoria, id, acao) {
  if (!['efeitos', 'itens'].includes(categoria) || !Number.isInteger(id) || id < 0 || id > 99999) throw new Error('prévia inválida');
  if (categoria === 'itens' && !['crr', 'drk'].includes(acao)) throw new Error('ação inválida');
  const figura = 'hd-180-1.ch-210-66.lg-270-82.sh-290-91.hr-100-40';
  const urlPrevia = 'https://api.habblet.radiohabblet.com.br/api/v1/avatar?figure=' + encodeURIComponent(figura)
    + '&direction=2&head_direction=2&img_format=gif'
    + (id ? categoria === 'efeitos' ? '&effect=' + id : '&action=' + encodeURIComponent(acao + '=' + id) : '');
  const r = await fetch(urlPrevia, { credentials: 'omit', redirect: 'error', cache: 'force-cache', signal: AbortSignal.timeout(12000) });
  if (!r.ok || !/^image\/gif\b/i.test(r.headers.get('Content-Type') || '')) throw new Error('GIF indisponível');
  const buf = await r.arrayBuffer();
  if (buf.byteLength < 6 || buf.byteLength > 2000000) throw new Error('GIF inválido');
  return 'data:image/gif;base64,' + bytesParaBase64(buf);
}

chrome.runtime.onMessage.addListener(function (mensagem, remetente, responder) {
  // Só conversa com as páginas e os scripts da própria extensão.
  if (!remetente || remetente.id !== chrome.runtime.id || !mensagem || typeof mensagem.tipo !== 'string') return undefined;

  if (mensagem.tipo === 'avatar:miniatura') {
    if (!remetente.tab || !/^https?:\/\/(?:[a-z\d-]+\.)*habblet\.city\/hotel(?:[/?#]|$)/i.test(remetente.url || '')) return undefined;
    miniaturaCabeca(mensagem.figura).then(
      (url) => responder({ ok: true, url }),
      () => responder({ ok: false })
    );
    return true;
  }

  if (mensagem.tipo === 'visual:previa') {
    if (!remetente.tab || !/^https?:\/\/(?:[a-z\d-]+\.)*habblet\.city\/hotel(?:[/?#]|$)/i.test(remetente.url || '')) return undefined;
    previaVisual(mensagem.categoria, mensagem.id, mensagem.acao).then(
      (url) => responder({ ok: true, url }),
      () => responder({ ok: false })
    );
    return true;
  }

  if (mensagem.tipo === 'historico:local') {
    if (!remetente.tab || !/^https?:\/\/(?:[a-z\d-]+\.)*habblet\.city\/hotel(?:[/?#]|$)/i.test(remetente.url || '')) return undefined;
    const arquivo = self.VL.historicoLocal;
    Promise.resolve().then(() => {
      if (mensagem.acao === 'adicionar') return arquivo.adicionar(mensagem.fala);
      if (mensagem.acao === 'pagina') return arquivo.pagina(mensagem);
      if (mensagem.acao === 'limpar') return arquivo.limpar();
      throw new Error('ação inválida');
    }).then((dados) => responder({ ok: true, dados }), () => responder({ ok: false }));
    return true;
  }

  // Só a sala offscreen pode pedir estas credenciais; a aba do hotel não recebe esta ponte.
  if (mensagem.tipo === 'grupos:armazenamento') {
    if (remetente.tab || remetente.url !== chrome.runtime.getURL(SALA)) {
      responder({ erro: 'grupo-acesso' });
      return undefined;
    }
    const chave = mensagem.chave;
    if (typeof chave !== 'string' || !/^vl\.(grupos|gruposConvites)\.[1-9][0-9]{0,11}$/.test(chave)) {
      responder({ erro: 'pedido' });
      return undefined;
    }
    let pedido;
    if (mensagem.acao === 'ler') {
      pedido = (async () => {
        const local = await chrome.storage.local.get(chave);
        const sincronizado = await chrome.storage.sync.get(chave).catch(() => ({}));
        if (Object.hasOwn(local, chave)) {
          // A cópia sincronizada permite recuperar a lista após limpeza dos dados locais.
          if (JSON.stringify(local[chave]) !== JSON.stringify(sincronizado[chave])) {
            await chrome.storage.sync.set({ [chave]: local[chave] }).catch(() => {});
          }
          return { valor: local[chave] };
        }
        if (Array.isArray(sincronizado[chave])) {
          await chrome.storage.local.set({ [chave]: sincronizado[chave] });
          return { valor: sincronizado[chave] };
        }
        return { valor: [] };
      })();
    } else if (mensagem.acao === 'gravar' && Array.isArray(mensagem.valor) && mensagem.valor.length <= 50) {
      pedido = chrome.storage.local.set({ [chave]: mensagem.valor }).then(async () => {
        await chrome.storage.sync.set({ [chave]: mensagem.valor }).catch(() => {});
        return { ok: true };
      });
    } else { responder({ erro: 'pedido' }); return undefined; }
    pedido.then(responder, () => responder({ erro: 'grupo-armazenamento' }));
    return true;
  }

  // Avisos da sala: vão para a aba que usou a sala por último.
  if (mensagem.de === 'sala') {
    if (abaDaSala != null) chrome.tabs.sendMessage(abaDaSala, mensagem).catch(function () {});
    return undefined;
  }
  if (mensagem.alvo === 'sala') return undefined; // pedido do próprio fundo para a sala
  if (mensagem.tipo.indexOf('sala:') === 0) {
    if (remetente.tab && remetente.tab.id != null) abaDaSala = remetente.tab.id;
    const pedido = Object.assign({}, mensagem, { alvo: 'sala', tipo: mensagem.tipo.slice(5) });
    garantirSala()
      .then(function () { return chrome.runtime.sendMessage(pedido); })
      .then(function (r) { responder(r || { erro: 'sem-resposta' }); }, function (erro) { responder({ erro: String((erro && erro.message) || erro) }); });
    return true;
  }
  if (mensagem.tipo === 'microfone:permitir') {
    chrome.windows.create({ url: chrome.runtime.getURL('src/permissao/permissao.html') + '?microfone=1', type: 'popup', width: 460, height: 330 })
      .then(function () { responder({ ok: true }); }, function () { responder({ ok: false }); });
    return true;
  }

  if (mensagem.tipo === 'musica:verificar') {
    musicaVerificar(String(mensagem.usuario || ''), String(mensagem.codigo || '')).then(responder, function (erro) {
      responder({ ok: false, erro: 'rede', detalhe: String((erro && erro.message) || erro) });
    });
    return true;
  }

  if (mensagem.tipo === 'steam:verificar') {
    steamVerificar(String(mensagem.valor || ''), String(mensagem.codigo || '')).then(responder, function () { responder({ ok: false, erro: 'rede' }); });
    return true;
  }
  if (mensagem.tipo === 'discord:entrar') {
    discordEntrar().then(responder, function () { responder({ ok: false, erro: 'rede' }); });
    return true;
  }
  if (mensagem.tipo === 'discord:retorno') {
    responder({ retorno: chrome.identity && chrome.identity.getRedirectURL ? chrome.identity.getRedirectURL() : '' });
    return undefined;
  }
  if (mensagem.tipo === 'steam:permitir') {
    chrome.windows.create({ url: chrome.runtime.getURL('src/permissao/permissao.html') + '?steam=1', type: 'popup', width: 460, height: 320 })
      .then(function () { responder({ ok: true }); }, function () { responder({ ok: false }); });
    return true;
  }

  if (mensagem.tipo === 'youtube:pesquisar') {
    if (!remetente.tab || !/^https?:\/\/(?:[a-z\d-]+\.)*habblet\.city\/hotel(?:[/?#]|$)/i.test(remetente.url || '')) return undefined;
    youtubePesquisar(mensagem.termo).then(responder, function () { responder({ ok: false, erro: 'indisponivel' }); });
    return true;
  }

  if (mensagem.tipo === 'musica:agora') {
    musicaAgora(String(mensagem.usuario || '')).then(responder, function (erro) {
      responder({ ok: false, erro: 'rede', detalhe: String((erro && erro.message) || erro) });
    });
    return true;
  }

  if (mensagem.tipo === 'capturar') {
    capturarPara(remetente).then(responder, function (erro) {
      responder({ ok: false, erro: 'falha', detalhe: String((erro && erro.message) || erro) });
    });
    return true; // a resposta vem depois
  }

  if (mensagem.tipo === 'captura:permitir') {
    chrome.windows.create({ url: chrome.runtime.getURL('src/permissao/permissao.html') + '?captura=1', type: 'popup', width: 480, height: 340 })
      .then(function () { responder({ ok: true }); }, function () { responder({ ok: false }); });
    return true;
  }

  if (mensagem.tipo === 'captura:qual-atalho') {
    atalhoDaCaptura().then(function (atalho) { responder({ ok: true, atalho }); });
    return true;
  }

  if (mensagem.tipo === 'captura:editar') {
    abrirEditor(remetente, mensagem.dataUrl).then(responder, function (erro) {
      responder({ ok: false, erro: 'falha', detalhe: String((erro && erro.message) || erro) });
    });
    return true;
  }

  // Recarrega a extensão relendo os arquivos da pasta. Só quando foi carregada sem compactação
  // (desenvolvimento e testes); instalada pela loja, recusa.
  if (mensagem.tipo === 'recarregar-extensao') {
    if ('update_url' in chrome.runtime.getManifest()) { responder({ ok: false, erro: 'loja' }); return undefined; }
    responder({ ok: true });
    setTimeout(function () { chrome.runtime.reload(); }, 150);
    return undefined;
  }

  // Visor (página do site dentro do Habblet): só para sites que o usuário permitiu.
  if (mensagem.tipo === 'visor:preparar') {
    prepararVisor(String(mensagem.url || '')).then(responder, function (erro) { responder({ ok: false, erro: 'falha', detalhe: String((erro && erro.message) || erro) }); });
    return true;
  }
  if (mensagem.tipo === 'link:permitir') {
    let dominio = '';
    try { dominio = dominioBase(new URL(String(mensagem.url)).hostname); } catch (erro) { /* inválido */ }
    if (!dominio) { responder({ ok: false }); return undefined; }
    chrome.windows.create({ url: chrome.runtime.getURL('src/permissao/permissao.html') + '?d=' + encodeURIComponent(dominio), type: 'popup', width: 460, height: 330 })
      .then(function () { responder({ ok: true }); }, function () { responder({ ok: false }); });
    return true;
  }

  if (mensagem.tipo === 'abrir-opcoes') {
    chrome.runtime.openOptionsPage().then(
      function () { responder({ ok: true }); },
      function () { responder({ ok: false }); }
    );
    return true;
  }

  return undefined;
});

// ---------- atalho de teclado ----------

let relogioSinal = 0;

function limparSinal() {
  chrome.action.setBadgeText({ text: '' });
  chrome.action.setTitle({ title: TITULO_PADRAO });
}

// Fora da aba do hotel não há onde mostrar um aviso: o recado vai para o ícone da extensão.
function sinalizar(texto) {
  chrome.action.setBadgeBackgroundColor({ color: '#b3261e' });
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setTitle({ title: 'Vagalume — ' + texto });
  clearTimeout(relogioSinal);
  relogioSinal = setTimeout(limparSinal, 6000);
}

async function capturarPorAtalho(aba) {
  if (!aba || !ehHotel(aba.url)) {
    sinalizar('A captura só funciona na aba do hotel.');
    return;
  }
  const cfg = await armazem.ler();
  if (cfg.modulos.captura !== true) {
    sinalizar('A captura de tela está desligada nas opções.');
    return;
  }
  try {
    const resposta = await chrome.tabs.sendMessage(aba.id, { tipo: 'captura:atalho' });
    if (!resposta || !resposta.ok) sinalizar('Não foi possível capturar a tela.');
  } catch (erro) {
    sinalizar('Recarregue a aba do hotel para usar a captura.');
  }
}

chrome.commands.onCommand.addListener(function (comando, aba) {
  if (comando === 'capturar-tela') capturarPorAtalho(aba);
});

// ---------- visor da página do site ----------
// Domínio "base" aproximado (zyo.se, loja.com.br): a permissão vale para ele e os subdomínios.
function dominioBase(host) {
  const p = String(host || '').toLowerCase().split('.').filter(Boolean);
  if (p.length <= 2) return p.join('.');
  const tld = p[p.length - 1];
  const sl = p[p.length - 2];
  if (tld.length === 2 && ['com', 'net', 'org', 'gov', 'edu', 'co', 'art', 'blog'].includes(sl)) return p.slice(-3).join('.');
  return p.slice(-2).join('.');
}
// Para o site aparecer no visor, tira os dois bloqueios de quadro (X-Frame-Options e a CSP inteira,
// porque o Chrome não deixa tirar só o frame-ancestors) — e só nas respostas de quadros que a
// página da extensão pede. O mesmo site numa aba normal não muda. Regra de sessão: some ao fechar o navegador.
async function prepararVisor(url) {
  let u;
  try { u = new URL(url); } catch (erro) { return { ok: false, erro: 'endereco' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, erro: 'endereco' };
  const dominio = dominioBase(u.hostname);
  const origens = ['https://' + dominio + '/*', 'https://*.' + dominio + '/*'];
  if (!(await chrome.permissions.contains({ origins: origens }))) return { ok: false, erro: 'sem-permissao', dominio };
  const regras = await chrome.declarativeNetRequest.getSessionRules();
  if (!regras.some((r) => r.condition && r.condition.requestDomains && r.condition.requestDomains[0] === dominio)) {
    const id = regras.reduce((maior, r) => Math.max(maior, r.id), 0) + 1;
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [{
        id,
        priority: 1,
        action: { type: 'modifyHeaders', responseHeaders: [{ header: 'x-frame-options', operation: 'remove' }, { header: 'content-security-policy', operation: 'remove' }] },
        condition: { requestDomains: [dominio], resourceTypes: ['sub_frame'], initiatorDomains: [chrome.runtime.id] },
      }],
    });
  }
  // Controle de volume do site no visor (o script só age dentro do visor; ver principal/volume.js).
  // Com a permissão de todos os sites (a que a captura usa), entra também nos players embutidos de
  // outros sites (YouTube, SoundCloud…), para o volume do visor mandar em tudo; fora do visor ele
  // não faz nada (sai na primeira linha).
  const todos = await chrome.permissions.contains({ origins: ['<all_urls>'] }).catch(() => false);
  const idVolume = todos ? 'vl-volume-todos' : 'vl-volume-' + dominio.replace(/[^a-z0-9]/g, '-');
  try {
    const ja = await chrome.scripting.getRegisteredContentScripts({ ids: [idVolume] });
    if (!ja.length) {
      await chrome.scripting.registerContentScripts([{
        id: idVolume, js: ['src/principal/volume.js'], matches: todos ? ['<all_urls>'] : origens,
        allFrames: true, runAt: 'document_start', world: 'MAIN', persistAcrossSessions: false,
      }]);
    }
  } catch (erro) { console.warn('[Vagalume] Sem controle de volume para ' + dominio + ':', erro); }
  return { ok: true, dominio };
}
