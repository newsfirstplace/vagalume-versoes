// Vagalume — enquadra a cabeça inteira, usando os pixels visíveis em vez de um recorte fixo.
// O fundo baixa a imagem e usa este helper com OffscreenCanvas, sem depender do CSS do hotel.
(function (raiz) {
  'use strict';
  const VL = (raiz.VL = raiz.VL || {});
  const LARGURA = 22;
  const ALTURA = 24;
  const MARGEM = 1;
  const MAX_BYTES = 2 * 1024 * 1024;
  const MAX_LADO = 1024;
  // Mesma gramática aceita pelo protocolo do hotel (VL.codigos.visualValido).
  const FIGURA = /^[a-z]{2}-\d+(-\d+)*(\.[a-z]{2}-\d+(-\d+)*)*$/;

  function figuraValida(figura) {
    return typeof figura === 'string' && figura.length <= 300 && FIGURA.test(figura);
  }

  function dimensoesValidas(largura, altura) {
    return Number.isInteger(largura) && Number.isInteger(altura)
      && largura > 0 && altura > 0 && largura <= MAX_LADO && altura <= MAX_LADO;
  }

  function recorte(dados, largura, altura) {
    if (!dimensoesValidas(largura, altura) || !dados || dados.length !== largura * altura * 4) return null;
    let esquerda = largura;
    let topo = altura;
    let direita = -1;
    let baixo = -1;
    for (let y = 0; y < altura; y++) {
      for (let x = 0; x < largura; x++) {
        if (!(dados[(y * largura + x) * 4 + 3] > 0)) continue;
        esquerda = Math.min(esquerda, x);
        direita = Math.max(direita, x);
        topo = Math.min(topo, y);
        baixo = Math.max(baixo, y);
      }
    }
    return direita < 0 ? null : { x: esquerda, y: topo, largura: direita - esquerda + 1, altura: baixo - topo + 1 };
  }

  function enquadrar(caixa) {
    if (!caixa || !dimensoesValidas(caixa.largura, caixa.altura)) return null;
    // Uma cabeça pequena não precisa ser ampliada. Cabelo e acessórios entram na mesma proporção.
    const escala = Math.min(1, (LARGURA - MARGEM * 2) / caixa.largura, (ALTURA - MARGEM * 2) / caixa.altura);
    const largura = caixa.largura * escala;
    const altura = caixa.altura * escala;
    return { x: (LARGURA - largura) / 2, y: (ALTURA - altura) / 2, largura, altura };
  }

  async function criar(blob) {
    if (!blob || !Number.isFinite(blob.size) || blob.size <= 0 || blob.size > MAX_BYTES) {
      throw new Error('Imagem de avatar fora do limite permitido.');
    }
    let bitmap = null;
    try {
      bitmap = await raiz.createImageBitmap(blob);
      if (!dimensoesValidas(bitmap.width, bitmap.height)) throw new Error('Dimensões de avatar fora do limite permitido.');
      const fonte = new raiz.OffscreenCanvas(bitmap.width, bitmap.height);
      const leitura = fonte.getContext('2d', { willReadFrequently: true });
      if (!leitura) throw new Error('Não foi possível ler o avatar.');
      leitura.drawImage(bitmap, 0, 0);
      const caixa = recorte(leitura.getImageData(0, 0, bitmap.width, bitmap.height).data, bitmap.width, bitmap.height);
      if (!caixa) throw new Error('A imagem do avatar está vazia.');
      const destino = enquadrar(caixa);
      const miniatura = new raiz.OffscreenCanvas(LARGURA, ALTURA);
      const desenho = miniatura.getContext('2d');
      if (!desenho) throw new Error('Não foi possível desenhar o avatar.');
      desenho.imageSmoothingEnabled = true;
      desenho.imageSmoothingQuality = 'low';
      desenho.drawImage(bitmap, caixa.x, caixa.y, caixa.largura, caixa.altura,
        destino.x, destino.y, destino.largura, destino.altura);
      const png = await miniatura.convertToBlob({ type: 'image/png' });
      const bytes = new Uint8Array(await png.arrayBuffer());
      let binario = '';
      for (let i = 0; i < bytes.length; i += 8192) binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return 'data:image/png;base64,' + raiz.btoa(binario);
    } finally {
      if (bitmap) bitmap.close();
    }
  }

  VL.avatarMiniatura = { figuraValida, recorte, enquadrar, criar, LARGURA, ALTURA };
  if (typeof module !== 'undefined' && module.exports) module.exports = VL.avatarMiniatura;
})(typeof globalThis !== 'undefined' ? globalThis : this);
