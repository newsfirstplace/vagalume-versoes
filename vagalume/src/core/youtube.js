// Vagalume — lê apenas IDs de vídeo de links conhecidos do YouTube.
(function (raiz) {
  'use strict';
  function idVideo(entrada) {
    const texto = String(entrada || '').trim();
    const valido = (id) => /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : '';
    if (valido(texto)) return texto;
    let url;
    try { url = new URL(texto); } catch (erro) { return ''; }
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase();
    if (host === 'youtu.be' || host === 'www.youtu.be') return valido(url.pathname.split('/')[1]);
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) return '';
    if (url.pathname === '/watch') return valido(url.searchParams.get('v'));
    const partes = url.pathname.split('/').filter(Boolean);
    return ['shorts', 'live', 'embed'].includes(partes[0]) ? valido(partes[1]) : '';
  }
  const api = { idVideo };
  raiz.VL = raiz.VL || {};
  raiz.VL.youtube = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
