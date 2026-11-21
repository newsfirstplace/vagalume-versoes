// Vagalume — música pelo Last.fm (pedido do usuário em 2026-11-14): o que a pessoa está ouvindo
// agora ou ouviu por último, sem o ponto em que a música está, no quadro de informações.
// Como um Vagalume sabe o Last.fm de outra pessoa: pergunta por um sussurro técnico, que nenhuma das
// duas mostra na tela ("[vl:fm?]"); o Vagalume da outra pessoa responde do mesmo jeito
// ("[vl:fm=apelido]", ou "[vl:fm=]" se ela não quiser mostrar). Nada vai para a missão.
// Este arquivo só tem contas e leituras, sem rede; é usado pelo fundo e pelo módulo "musica".
(function (raiz) {
  'use strict';

  // Chave de API do Last.fm do Vagalume (gratuita, criada em last.fm/api/account/create).
  // Vazia: a função avisa que falta a chave; a opção musica.chave, nos ajustes, serve para testar.
  const CHAVE_PADRAO = 'a9261db298309b386f92b2a14c650d6a';
  const ENDERECO_API = 'https://ws.audioscrobbler.com/2.0/';

  // Apelidos do Last.fm: 2 a 15 caracteres, começando por letra; letras, números, _ e -.
  const USUARIO = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;
  function usuarioValido(u) { return USUARIO.test(String(u || '').trim()); }

  // Recados técnicos trocados por sussurro entre Vagalumes.
  const PEDIDO = '[vl:fm?]';
  function resposta(usuario) { return '[vl:fm=' + (usuarioValido(usuario) ? String(usuario).trim() : '') + ']'; }
  // Texto de um sussurro -> { tipo: 'pedido' } | { tipo: 'resposta', usuario } | null (sussurro comum).
  function lerRecado(texto) {
    const s = String(texto || '').trim();
    if (s === PEDIDO) return { tipo: 'pedido' };
    const m = /^\[vl:fm=([A-Za-z][A-Za-z0-9_-]{1,14})?\]$/.exec(s);
    return m ? { tipo: 'resposta', usuario: m[1] || '' } : null;
  }

  // Confirmação de dono (pedido do usuário em 2026-11-14: impedir que alguém use o Last.fm de outra
  // pessoa). O Vagalume mostra um código; a pessoa põe o código no "Nome de exibição" do perfil do
  // Last.fm (o campo realname da API), o Vagalume confere uma vez e a pessoa pode tirar o código depois.
  function codigoConfirmacao(aleatorio) {
    const n = Math.floor((typeof aleatorio === 'number' ? aleatorio : Math.random()) * 9000) + 1000;
    return 'vagalume-' + n;
  }
  function confere(info, codigo) {
    const nome = info && info.user ? String(info.user.realname || '') : '';
    return !!codigo && nome.toLowerCase().includes(String(codigo).toLowerCase());
  }
  function enderecoInfo(usuario, chave) {
    const p = new URLSearchParams({ method: 'user.getinfo', user: String(usuario), api_key: String(chave), format: 'json' });
    return ENDERECO_API + '?' + p.toString();
  }

  function endereco(usuario, chave) {
    const p = new URLSearchParams({ method: 'user.getrecenttracks', user: String(usuario), api_key: String(chave), format: 'json', limit: '1' });
    return ENDERECO_API + '?' + p.toString();
  }

  // Resposta de user.getrecenttracks -> { nome, artista, album, agora, quando, url, capa } ou null.
  // Erros do Last.fm ({ error, message }) viram { erro, mensagem }.
  function lerFaixa(json) {
    if (!json || typeof json !== 'object') return null;
    if (json.error) return { erro: Number(json.error), mensagem: String(json.message || '') };
    const lista = json.recenttracks && json.recenttracks.track;
    const t = Array.isArray(lista) ? lista[0] : lista;
    if (!t || typeof t !== 'object') return null;
    const texto = (v) => (v && typeof v === 'object' ? String(v['#text'] || v.name || '') : String(v || ''));
    const imagens = Array.isArray(t.image) ? t.image : [];
    const ordem = ['extralarge', 'large', 'medium', 'small'];
    let capa = '';
    for (const tamanho of ordem) {
      const img = imagens.find((i) => i && i.size === tamanho && i['#text']);
      if (img) { capa = String(img['#text']); break; }
    }
    if (capa && !/^https:\/\/(lastfm|lastfm-img)\.freetls\.fastly\.net\//.test(capa)) capa = '';
    // Estrela cinza que o Last.fm manda quando não tem a capa (vista ao vivo em 2026-11-14): vira o ♪ do Vagalume.
    if (/2a96cbd8b46e442fc41c2b86b821562f/.test(capa)) capa = '';
    const agora = !!(t['@attr'] && String(t['@attr'].nowplaying) === 'true');
    const uts = t.date && Number(t.date.uts);
    return {
      nome: texto(t.name).slice(0, 200),
      artista: texto(t.artist).slice(0, 200),
      album: texto(t.album).slice(0, 200),
      agora,
      quando: agora || !uts ? null : uts * 1000,
      url: /^https:\/\/www\.last\.fm\//.test(String(t.url || '')) ? String(t.url) : '',
      capa,
    };
  }

  function tempoAtras(quando, agora) {
    if (!quando) return '';
    const s = Math.max(0, Math.round(((agora || Date.now()) - quando) / 1000));
    if (s < 60) return 'agora há pouco';
    const m = Math.round(s / 60);
    if (m < 60) return 'há ' + m + ' min';
    const h = Math.round(m / 60);
    if (h < 24) return 'há ' + h + ' h';
    const d = Math.round(h / 24);
    return 'há ' + d + (d === 1 ? ' dia' : ' dias');
  }

  const api = { CHAVE_PADRAO, ENDERECO_API, PEDIDO, usuarioValido, resposta, lerRecado, codigoConfirmacao, confere, enderecoInfo, endereco, lerFaixa, tempoAtras };
  raiz.VL = raiz.VL || {};
  raiz.VL.lastfm = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
