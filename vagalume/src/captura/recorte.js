// Vagalume — contas do editor da captura: seleção, conversão de coordenadas e carimbo de data.
// Arquivo puro (sem DOM, sem chrome.*), testado em Node.
(function (raiz) {
  'use strict';

  const MINIMO = 4; // lado mínimo de um recorte, em pixels da imagem
  const CHAVE = 'vl.captura'; // onde a imagem espera o editor, em chrome.storage.session
  const MAX_DADOS = 9 * 1024 * 1024; // o armazenamento de sessão aceita até 10 MB no total

  function limitar(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  // Ponto da tela -> ponto da imagem. `caixa` é o getBoundingClientRect da imagem desenhada.
  function paraImagem(ponto, caixa, largura, altura) {
    if (!caixa || !(caixa.width > 0) || !(caixa.height > 0)) return { x: 0, y: 0 };
    return {
      x: limitar(((ponto.x - caixa.left) / caixa.width) * largura, 0, largura),
      y: limitar(((ponto.y - caixa.top) / caixa.height) * altura, 0, altura),
    };
  }

  // Retângulo entre dois pontos, dentro da imagem e em pixels inteiros. null se for pequeno demais.
  function retangulo(a, b, largura, altura) {
    const x1 = Math.round(limitar(Math.min(a.x, b.x), 0, largura));
    const y1 = Math.round(limitar(Math.min(a.y, b.y), 0, altura));
    const x2 = Math.round(limitar(Math.max(a.x, b.x), 0, largura));
    const y2 = Math.round(limitar(Math.max(a.y, b.y), 0, altura));
    const w = x2 - x1;
    const h = y2 - y1;
    return w >= MINIMO && h >= MINIMO ? { x: x1, y: y1, w, h } : null;
  }

  // Retângulo da imagem -> posição na tela, para desenhar o contorno da seleção.
  function naTela(ret, caixa, largura, altura) {
    const ex = caixa.width / largura;
    const ey = caixa.height / altura;
    return { left: ret.x * ex, top: ret.y * ey, width: ret.w * ex, height: ret.h * ey };
  }

  function p2(n) { return String(n).padStart(2, '0'); }

  // "13/11/2026 14:05"
  function textoCarimbo(data) {
    const d = data instanceof Date ? data : new Date(data);
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }

  // "vagalume-20261113-140503.png"
  function nomeArquivo(data) {
    const d = data instanceof Date ? data : new Date(data);
    return 'vagalume-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' +
      p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds()) + '.png';
  }

  // Só aceita a imagem PNG que o próprio navegador devolve na captura, e de um tamanho que caiba.
  function imagemValida(dataUrl) {
    return typeof dataUrl === 'string' && dataUrl.length <= MAX_DADOS && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(dataUrl);
  }

  const api = { paraImagem, retangulo, naTela, textoCarimbo, nomeArquivo, imagemValida, CHAVE, MAX_DADOS, MINIMO };
  raiz.VL = raiz.VL || {};
  raiz.VL.recorte = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
