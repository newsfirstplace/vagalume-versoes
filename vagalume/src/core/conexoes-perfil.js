// Vagalume — links informados pela pessoa para o miniperfil. Não são contas verificadas.
(function (raiz) {
  'use strict';
  const SERVICOS = [
    { id: 'discord', nome: 'Discord', curto: 'd' },
    { id: 'steam', nome: 'Steam', curto: 's' },
    { id: 'valorant', nome: 'Valorant', curto: 'v' },
    { id: 'lol', nome: 'League of Legends', curto: 'l' },
    { id: 'letterboxd', nome: 'Letterboxd', curto: 'b' },
  ];
  // Serviços que só entram no miniperfil depois de confirmados (2026-11-19): Steam, por um código
  // no resumo do perfil público; Discord, pelo login do próprio Discord. O Counter-Strike saiu: é o
  // mesmo perfil Steam.
  const CONFIRMAVEIS = ['steam', 'discord'];
  // Local: o id confirmado (SteamID64; id do Discord). Vindo de outro Vagalume: '1' (só a marca).
  const ID_CONFIRMADO = { steam: /^7656\d{13}$/, discord: /^\d{17,20}$/ };
  function limparConfirmados(dados) {
    const saida = {};
    for (const id of CONFIRMAVEIS) {
      const v = String((dados && dados[id]) || '');
      if (v === '1' || ID_CONFIRMADO[id].test(v)) saida[id] = v;
    }
    return saida;
  }
  function limpar(valor) { return String(valor || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 56); }
  function normalizar(dados) {
    const saida = { publicado: dados && dados.publicado === true };
    for (const s of SERVICOS) saida[s.id] = limpar(dados && dados[s.id]);
    const conf = limparConfirmados(dados && dados.confirmados);
    for (const id of Object.keys(conf)) if (!saida[id]) delete conf[id];
    saida.confirmados = conf;
    return saida;
  }
  function publicos(dados) {
    if (!dados || dados.publicado !== true) return [];
    return SERVICOS.filter((s) => !!dados[s.id] && (!CONFIRMAVEIS.includes(s.id) || !!(dados.confirmados && dados.confirmados[s.id])));
  }
  function compactar(dados) {
    const d = normalizar(dados), saida = {};
    let marcas = '';
    for (const s of publicos(d)) { saida[s.curto] = d[s.id]; if (d.confirmados[s.id]) marcas += s.curto; }
    if (marcas) saida.k = marcas;
    return saida;
  }
  function expandir(dados) {
    const valores = { publicado: true };
    for (const s of SERVICOS) valores[s.id] = dados && dados[s.curto];
    const marcas = typeof (dados && dados.k) === 'string' ? dados.k : '';
    valores.confirmados = {};
    for (const s of SERVICOS) if (marcas.includes(s.curto)) valores.confirmados[s.id] = '1';
    return normalizar(valores);
  }
  function urlConhecida(valor, hosts) {
    let url;
    try { url = new URL(valor); } catch (erro) { return ''; }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || !hosts.includes(url.hostname.toLowerCase())) return '';
    return 'https://' + url.hostname.toLowerCase() + url.pathname;
  }
  function destino(servico, valor) {
    const v = limpar(valor);
    if (!v) return '';
    if (servico === 'discord') return urlConhecida(v, ['discord.com', 'www.discord.com', 'discord.gg']);
    if (servico === 'steam') {
      if (/^[A-Za-z0-9_-]{2,32}$/.test(v)) return 'https://steamcommunity.com/id/' + encodeURIComponent(v) + '/';
      return urlConhecida(v, ['steamcommunity.com', 'www.steamcommunity.com']);
    }
    if (servico === 'letterboxd') {
      if (/^[A-Za-z0-9_-]{2,40}$/.test(v)) return 'https://letterboxd.com/' + encodeURIComponent(v) + '/';
      return urlConhecida(v, ['letterboxd.com', 'www.letterboxd.com']);
    }
    return ''; // Riot IDs podem ser copiados, sem inventar URL de perfil.
  }
  // Steam: 'id/<nome>' ou 'profiles/<SteamID64>' a partir do que a pessoa escreveu.
  function alvoSteam(valor) {
    const v = limpar(valor);
    if (/^7656\d{13}$/.test(v)) return 'profiles/' + v;
    if (/^[A-Za-z0-9_-]{2,32}$/.test(v)) return 'id/' + v;
    const url = urlConhecida(v, ['steamcommunity.com', 'www.steamcommunity.com']);
    const m = url && url.match(/^https:\/\/[^/]+\/(id\/[A-Za-z0-9_-]{2,32}|profiles\/7656\d{13})\/?$/);
    return m ? m[1] : '';
  }
  function enderecoSteam(valor) {
    const alvo = alvoSteam(valor);
    return alvo ? 'https://steamcommunity.com/' + alvo + '/?xml=1' : '';
  }
  function codigoValido(codigo) { return /^vagalume-\d{6}$/.test(String(codigo || '')); }
  function campoXml(texto, nome) {
    const m = String(texto || '').match(new RegExp('<' + nome + '>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</' + nome + '>'));
    return m ? (m[1] !== undefined ? m[1] : m[2] || '') : '';
  }
  // Lê o XML público do perfil Steam: SteamID64, nome, resumo e se o perfil é público.
  function lerSteamXml(texto) {
    const t = String(texto || '');
    if (/<response>\s*<error>/.test(t)) return { erro: 'nao-existe' };
    const id64 = campoXml(t, 'steamID64');
    if (!/^7656\d{13}$/.test(id64)) return { erro: 'resposta' };
    return { id64, nome: limpar(campoXml(t, 'steamID')), resumo: campoXml(t, 'summary'), publico: campoXml(t, 'privacyState') === 'public' };
  }
  function steamConfere(dadosXml, codigo) {
    return !!(dadosXml && !dadosXml.erro && codigoValido(codigo) && dadosXml.resumo.includes(codigo));
  }
  function linkSteam(id64) { return 'https://steamcommunity.com/profiles/' + id64 + '/'; }
  // Ícones no formato do app de cada serviço: fundo e cor do logo de cada marca. Usado no painel
  // (dentro da camada) e no miniperfil (na página); o tamanho vem de quem usa.
  const CSS_ICONE = [
    // O logo fica preso por margens iguais nos quatro lados (não pelo grid, que o CSS da página do jogo
    // pode trocar no miniperfil e deixava o logo puxado para a esquerda).
    '.vl-app-icone { position:relative !important; display:inline-block; flex:none; box-sizing:border-box; border-radius:24%; overflow:hidden; vertical-align:middle; }',
    '.vl-app-icone > img { position:absolute !important; left:9% !important; top:9% !important; width:82% !important; height:82% !important; max-width:none; margin:0 !important; display:block; object-fit:contain; object-position:center; }',
    '.vl-app-logo { position:absolute !important; inset:19% !important; width:auto !important; height:auto !important; margin:0 !important; padding:0 !important; display:block; background:#fff; -webkit-mask: center / contain no-repeat; mask: center / contain no-repeat; -webkit-mask-position:center; mask-position:center; }',
    '.vl-app-icone[data-servico=discord] { background:#5865F2; }',
    '.vl-app-icone[data-servico=steam] { background:linear-gradient(160deg, #111d2e 0%, #1a3b5c 60%, #1b5c8c 100%); }',
    '.vl-app-icone[data-servico=valorant] { background:#FF4655; }',
    '.vl-app-icone[data-servico=lol] { background:radial-gradient(circle at 50% 45%, #0a3346 0%, #091428 70%); }',
    '.vl-app-icone[data-servico=lol] > img { left:8% !important; top:8% !important; width:84% !important; height:84% !important; }',
    '.vl-app-icone[data-servico=letterboxd] { background:#14181c; }',
    '.vl-app-icone[data-servico=lastfm] { background:#D51007; }',
    '.vl-app-icone[data-servico=lastfm] .vl-app-logo { inset:14% !important; }',
  ].join('\n');
  const api = { SERVICOS, CONFIRMAVEIS, CSS_ICONE, normalizar, compactar, expandir, publicos, destino, alvoSteam, enderecoSteam, codigoValido, lerSteamXml, steamConfere, linkSteam };
  raiz.VL = raiz.VL || {};
  raiz.VL.conexoesPerfil = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
