// Vagalume — extrai vídeos dos dados públicos da página de pesquisa do YouTube.
(function (raiz) {
  'use strict';
  function termo(valor) { return String(valor || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 100); }
  function dadosIniciais(html) {
    if (typeof html !== 'string' || html.length > 6000000) return null;
    const marca = 'var ytInitialData = ';
    const pos = html.indexOf(marca);
    if (pos < 0) return null;
    const inicio = pos + marca.length;
    let nivel = 0, aspas = false, escape = false;
    for (let i = inicio; i < html.length; i++) {
      const c = html[i];
      if (aspas) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') aspas = false; }
      else if (c === '"') aspas = true;
      else if (c === '{') nivel++;
      else if (c === '}' && --nivel === 0) {
        try { return JSON.parse(html.slice(inicio, i + 1)); } catch (erro) { return null; }
      }
    }
    return null;
  }
  function resultados(html) {
    const dados = dadosIniciais(html);
    if (!dados) return null;
    const saida = [], vistos = new Set(), pilha = [dados.contents || dados];
    let visitados = 0;
    while (pilha.length && saida.length < 12 && visitados++ < 50000) {
      const no = pilha.pop();
      if (!no || typeof no !== 'object') continue;
      const video = no.videoRenderer;
      if (video && /^[A-Za-z0-9_-]{11}$/.test(String(video.videoId || '')) && !vistos.has(video.videoId)) {
        vistos.add(video.videoId);
        const nome = String(video.title && video.title.runs && video.title.runs[0] && video.title.runs[0].text || 'Vídeo').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 72);
        const canal = String(video.ownerText && video.ownerText.runs && video.ownerText.runs[0] && video.ownerText.runs[0].text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 48);
        saida.push({ id: video.videoId, nome, canal });
        continue;
      }
      const valores = Array.isArray(no) ? no : Object.values(no);
      for (let i = valores.length - 1; i >= 0; i--) if (valores[i] && typeof valores[i] === 'object') pilha.push(valores[i]);
    }
    return saida;
  }
  const api = { termo, resultados };
  raiz.VL = raiz.VL || {};
  raiz.VL.youtubeBusca = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
