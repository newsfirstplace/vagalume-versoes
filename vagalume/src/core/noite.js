// Vagalume — repinta uma imagem (pixels RGBA) como se fosse noite de lua: cores escurecidas e puxadas
// para o azul, com uma luz limão nas bordas de cima (onde bateria a luz da lua e dos vagalumes).
// Função pura, sem DOM: o módulo Interface lê a imagem da vista do hotel num canvas, chama esta
// função e devolve o resultado como imagem. Também roda em Node (testes).
(function (raiz) {
  const VL = (raiz.VL = raiz.VL || {});

  const LIMAO = [214, 242, 74];

  // dados: Uint8ClampedArray (ou array) RGBA de largura x altura; é alterado no lugar e devolvido.
  // opcoes.luz: força da luz limão nas bordas (0 a 1); opcoes.escuro: quanto escurece (0 a 1).
  function pintar(dados, largura, altura, opcoes) {
    const o = opcoes || {};
    const luz = o.luz == null ? 0.6 : o.luz;
    const escuro = o.escuro == null ? 0.5 : o.escuro;
    const alfa = (x, y) => (x < 0 || y < 0 || x >= largura || y >= altura ? 0 : dados[(y * largura + x) * 4 + 3]);
    // Distância (0 a 3) até o transparente mais próximo acima ou ao lado, calculada antes de pintar.
    const borda = new Uint8Array(largura * altura);
    for (let y = 0; y < altura; y++) {
      for (let x = 0; x < largura; x++) {
        if (alfa(x, y) < 40) continue;
        let d = 0;
        for (let k = 1; k <= 3; k++) {
          if (alfa(x, y - k) < 40) { d = 4 - k; break; }
          if (k <= 2 && (alfa(x - k, y) < 40 || alfa(x + k, y) < 40)) { d = Math.max(d, 2 - k); }
        }
        borda[y * largura + x] = d;
      }
    }
    const fr = 1 - escuro * 1.2;
    const fg = 1 - escuro * 1.04;
    const fb = 1 - escuro * 0.76;
    for (let i = 0, p = 0; i < dados.length; i += 4, p++) {
      if (!dados[i + 3]) continue;
      const r = dados[i];
      const g = dados[i + 1];
      const b = dados[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      let nr = r * fr + lum * 0.06;
      let ng = g * fg + lum * 0.09;
      let nb = b * fb + lum * 0.2 + 12;
      const d = borda[p];
      if (d) {
        const t = luz * (d / 3) * (0.55 + 0.45 * (lum / 255));
        nr += (LIMAO[0] - nr) * t;
        ng += (LIMAO[1] - ng) * t;
        nb += (LIMAO[2] - nb) * t;
      }
      dados[i] = nr < 0 ? 0 : nr > 255 ? 255 : nr;
      dados[i + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng;
      dados[i + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb;
    }
    return dados;
  }

  VL.noite = { pintar, LIMAO };
  if (typeof module !== 'undefined' && module.exports) module.exports = VL.noite;
})(typeof globalThis !== 'undefined' ? globalThis : this);
