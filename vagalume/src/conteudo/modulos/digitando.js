// Vagalume — módulo "digitando": balão de "digitando" com as cores do Vagalume (2026-11-20, pedido
// do usuário). O desenho é trocado no motor do jogo pela ponte principal/digitando.js. O seu balão
// aparece com o estilo escolhido na sua tela e na das outros Vagalumes do quarto (o estilo vai pelo
// servidor de presença); quem não usa a extensão continua vendo o balão do jogo.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.digitando) return;
  const D = VL.digitando;

  function imagem(pixels, largura, altura, escala) {
    const tela = document.createElement('canvas');
    tela.width = largura; tela.height = altura;
    tela.getContext('2d').putImageData(new ImageData(pixels, largura, altura), 0, 0);
    if (escala === 1) return tela.toDataURL('image/png');
    // Versão pequena (zoom longe do jogo): metade do tamanho.
    const menor = document.createElement('canvas');
    menor.width = Math.ceil(largura * escala); menor.height = Math.ceil(altura * escala);
    const g = menor.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(tela, 0, 0, menor.width, menor.height);
    return menor.toDataURL('image/png');
  }
  const desenhosProntos = {};
  // Balões temáticos (imagens prontas): a versão pequena (zoom longe do jogo) é a metade, feita aqui.
  function metade(url) {
    return new Promise(function (resolver) {
      const img = new Image();
      img.onload = function () {
        const t = document.createElement('canvas');
        t.width = Math.ceil(img.naturalWidth / 2); t.height = Math.ceil(img.naturalHeight / 2);
        const g = t.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.drawImage(img, 0, 0, t.width, t.height);
        resolver(t.toDataURL('image/png'));
      };
      img.onerror = function () { resolver(url); };
      img.src = url;
    });
  }
  async function desenhosDosTemas() {
    const saida = {};
    const T = VL.digitandoTemas || {};
    for (const [id, tema] of Object.entries(T)) {
      saida[id] = { grande: tema.quadros.slice(), pequeno: await Promise.all(tema.quadros.map(metade)), passo: D.PASSO_MS };
    }
    return saida;
  }
  function desenhos() {
    if (!Object.keys(desenhosProntos).length) {
      // Os quadros da animação de cada estilo (o primeiro é o desenho parado), inclusive o do jogo,
      // para o balão original também poder ter as bolinhas pulando.
      for (const e of D.ESTILOS) {
        const quadros = D.quadros(e.id);
        desenhosProntos[e.id] = {
          grande: quadros.map((p) => imagem(p, D.LARGURA, D.ALTURA, 1)),
          pequeno: quadros.map((p) => imagem(p, D.LARGURA, D.ALTURA, 0.5)),
          passo: D.PASSO_MS,
        };
      }
    }
    return desenhosProntos;
  }
  function paraPagina(dado) {
    document.dispatchEvent(new CustomEvent('vl:digitando:extensao', { detail: JSON.stringify(dado) }));
  }

  VL.nucleo.definirModulo({
    id: 'digitando',
    iniciar(ctx) {
      const estiloDe = new Map(); // apelido (minúsculo) → estilo de outro Vagalume
      let ultimoMapa = '';
      let enviadoEm = 0;
      const vistos = new Set();
      function meu() { const e = ctx.secao().estilo; return D.valido(e) ? e : 'jogo'; }
      // O balão do jogo só é trocado (pelo mesmo desenho, animado) quando a animação está ligada.
      function troca(estilo) { return D.valido(estilo) && (estilo !== 'jogo' || ctx.secao().animado !== false); }
      function mandarMapa() {
        const mapa = {};
        const P = VL.pessoas;
        const eu = P && P.meuIndice ? P.meuIndice() : null;
        if (eu != null && troca(meu())) mapa[eu] = meu();
        if (ctx.secao().verDosOutros && P && P.indiceDe) {
          for (const [nome, estilo] of estiloDe) {
            const i = P.indiceDe(nome);
            if (i != null && troca(estilo)) mapa[i] = estilo;
          }
        }
        const animar = ctx.secao().animado !== false;
        const todos = ctx.secao().paraTodos && troca(meu()) ? meu() : '';
        const json = JSON.stringify([mapa, todos, animar]);
        if (json === ultimoMapa) return;
        ultimoMapa = json;
        paraPagina({ tipo: 'mapa', mapa, todos, animar });
      }
      // Avisa os Vagalumes do quarto qual é o seu (no máximo a cada 10 s; o servidor aceita uma ação
      // a cada 1,5 s por pessoa).
      function anunciar(forcar) {
        if (!VL.comunidade || !VL.comunidade.acao) return;
        if (!forcar && Date.now() - enviadoEm < 10000) return;
        enviadoEm = Date.now();
        VL.comunidade.acao({ t: 'digitar', e: meu() });
      }
      function aoAcao(m) {
        const d = m && m.dado;
        if (!d || d.t !== 'digitar' || !m.nome) return;
        const nome = String(m.nome).toLowerCase();
        estiloDe.set(nome, D.valido(d.e) ? d.e : 'jogo');
        // Alguém novo no quarto: responde uma vez com o seu, para essa pessoa também ver.
        if (!vistos.has(nome)) { vistos.add(nome); anunciar(); }
        mandarMapa();
      }
      paraPagina({ tipo: 'desenhos', desenhos: desenhos() });
      desenhosDosTemas().then(function (d) { if (Object.keys(d).length) paraPagina({ tipo: 'desenhos', desenhos: d }); });
      // Zzz de ausente nas cores do balão Limão, para todos os avatares (sem escolha).
      const imagensZzz = {};
      for (const nome of Object.keys(D.ZZZ)) {
        const z = D.zzz(nome);
        imagensZzz[nome] = imagem(z.pixels, z.largura, z.altura, 1);
      }
      paraPagina({ tipo: 'zzz', imagens: imagensZzz, ligado: true });
      ctx.aoParar(function () { paraPagina({ tipo: 'zzz', imagens: {}, ligado: false }); });
      mandarMapa();
      function ligarAvisos() {
        if (VL.comunidade && VL.comunidade.aoAcao) { ctx.aoParar(VL.comunidade.aoAcao(aoAcao)); return true; }
        return false;
      }
      if (!ligarAvisos()) {
        const espera = setInterval(function () { if (ligarAvisos()) clearInterval(espera); }, 1000);
        ctx.aoParar(function () { clearInterval(espera); });
      }
      // Os índices mudam ao trocar de quarto e quando alguém entra: refaz o mapa de vez em quando.
      const relogio = setInterval(function () { mandarMapa(); }, 1500);
      ctx.aoParar(function () { clearInterval(relogio); });
      // Ao entrar num quarto, avisa o seu estilo.
      let quartoAnterior = null;
      const quartos = setInterval(function () {
        const q = VL.pessoas && VL.pessoas.meuIndice ? VL.pessoas.meuIndice() : null;
        if (q != null && q !== quartoAnterior) { quartoAnterior = q; vistos.clear(); estiloDe.clear(); setTimeout(function () { anunciar(true); }, 2500); }
      }, 2000);
      ctx.aoParar(function () { clearInterval(quartos); });
      ctx.aoConfig(function () { ultimoMapa = ''; mandarMapa(); anunciar(true); });
      ctx.aoParar(function () { paraPagina({ tipo: 'mapa', mapa: {}, todos: '' }); });
    },
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
