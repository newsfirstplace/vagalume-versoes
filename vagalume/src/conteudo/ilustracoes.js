// Vagalume — ilustrações do painel (2026-11-20, pedido do usuário: painel mais ilustrativo, com
// imagens do Habbo para cada função). Nada é guardado na extensão: as imagens vêm do próprio jogo,
// na hora — os ícones da interface do Habblet (classes .icon.icon-*, lidas do estilo calculado de
// um elemento escondido na página) e os ícones de mobis do servidor de imagens do hotel. Se uma
// imagem não estiver disponível, quem chama recebe null e usa o ícone desenhado de sempre.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.camada) return;
  const el = VL.camada.el;
  const MOBIS = 'https://images.habblet.city/library/hof_furni/icons/';

  // jogo: nome do ícone da interface; mobi: classe do mobi; digitando: estilo do balão do Vagalume.
  const MAPA = {
    // abas do painel
    'aba:casa': { jogo: 'house' },
    'aba:inicio': { jogo: 'me-settings' },
    'aba:efeitos-itens': { mobi: 'olympus_r25_lightninginabottle' },
    'aba:conexoes': { mobi: 'bonusrare26_1*3' },
    'aba:quarto': { jogo: 'rooms' },
    'aba:historico': { jogo: 'chat-history' },
    'aba:mencoes': { jogo: 'sign-exclamation' },
    'aba:comandos': { jogo: 'staffchat' }, // comandos são digitados no chat
    'aba:macros': { mobi: 'habblet_boxrobo_cosmic' },
    'aba:grupos-voz': { mobi: 'Hellsinore_RealLifeRPG_33' },
    'aba:captura': { jogo: 'camera' },
    'aba:construcao': { mobi: 'caixa_ferramentas_80s_sky' },
    'aba:inventario': { jogo: 'inventory' },
    'aba:wired': { mobi: 'wf_trg_player_clicked' },
    // assuntos de Ajustes
    'assunto:conversa': { jogo: 'message' },
    'assunto:pessoas': { jogo: 'friendall' },
    'assunto:quarto': { jogo: 'me-profile' },
    'assunto:construcao': { mobi: 'caixa_ferramentas_80s_sky' },
    'assunto:loja': { jogo: 'catalog' },
    'assunto:aparencia': { jogo: 'me-clothing' },
    'assunto:desempenho': { jogo: 'game' },
    'assunto:sistema': { jogo: 'camera' },
    // funções (módulos)
    'modulo:mencoes': { jogo: 'sign-exclamation' },
    'modulo:historico': { jogo: 'chat-history' },
    'modulo:apelidos': { jogo: 'me-profile' },
    'modulo:digitando': { digitando: 'limao' },
    'modulo:chat': { jogo: 'message' },
    'modulo:silenciar': { jogo: 'sign-red' },
    'modulo:notificacoes': { jogo: 'tickets' },
    'modulo:agrupar': { jogo: 'friend-chat' },
    'modulo:comandos': { jogo: 'staffchat' },
    'modulo:macros': { mobi: 'habblet_boxrobo_cosmic' },
    'modulo:painel': { jogo: 'habbo' },
    'modulo:janelas': { jogo: 'navigator-info' },
    'modulo:interface': { jogo: 'me-settings' },
    'modulo:estilo': { jogo: 'group-decorate' },
    'modulo:zoom': { jogo: 'zoom-more' },
    'modulo:captura': { jogo: 'camera' },
    'modulo:contador': { jogo: 'game' },
    'modulo:fluido': { mobi: 'Raio_Nattura' },
    'modulo:fps': { mobi: 'Raio_Nattura' },
    'modulo:anuncios': { jogo: 'sign-skull' },
    'modulo:medicao': { jogo: 'sign-skull' },
    'modulo:conexao': { mobi: 'bonusrare26_1*3' },
    'modulo:construcao': { mobi: 'caixa_ferramentas_80s_sky' },
    'modulo:musica': { mobi: 'nft_h26_alarmboombox' },
    'modulo:midia': { mobi: 'pixel_tv_rylai' },
    'modulo:comunidade': { jogo: 'group-favorite' },
    'modulo:amigos': { jogo: 'friendall' },
    'modulo:loja': { jogo: 'catalog' },
    'modulo:visual': { jogo: 'me-clothing' },
    'modulo:wired': { mobi: 'wf_trg_player_clicked' },
    // atalhos da página de Início
    'atalho:youtube': { mobi: 'pixel_tv_rylai' },
  };

  // Ícones da interface do jogo: o estilo calculado de um <i class="icon icon-nome"> traz a imagem
  // (um endereço data:) e o tamanho. Fica guardado na memória da página.
  const doJogo = new Map();
  let caixa = null;
  function iconeDoJogo(nome) {
    if (doJogo.has(nome)) return doJogo.get(nome);
    let r = null;
    try {
      if (!caixa) {
        caixa = document.createElement('div');
        caixa.setAttribute('aria-hidden', 'true');
        caixa.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden;pointer-events:none;';
        (document.body || document.documentElement).appendChild(caixa);
      }
      const i = document.createElement('i');
      i.className = 'icon icon-' + nome;
      caixa.appendChild(i);
      const e = getComputedStyle(i);
      const m = /^url\("?(data:image\/[^")]+)"?\)$/.exec(String(e.backgroundImage || '').trim());
      const w = parseFloat(e.width), h = parseFloat(e.height);
      if (m && w > 0 && h > 0) r = { url: m[1], w, h };
      i.remove();
    } catch (erro) { r = null; }
    // Sem a folha do jogo (tela de carregamento), tenta de novo da próxima vez.
    if (r) doJogo.set(nome, r);
    return r;
  }
  const deDigitando = new Map();
  function balaoDigitando(id) {
    if (deDigitando.has(id)) return deDigitando.get(id);
    let r = null;
    try {
      const D = VL.digitando;
      const p = D && D.pixels(id);
      if (p) {
        const tela = document.createElement('canvas');
        tela.width = D.LARGURA; tela.height = D.ALTURA;
        tela.getContext('2d').putImageData(new ImageData(p, D.LARGURA, D.ALTURA), 0, 0);
        r = { url: tela.toDataURL('image/png'), w: D.LARGURA, h: D.ALTURA };
      }
    } catch (erro) { r = null; }
    deDigitando.set(id, r);
    return r;
  }
  function fonte(chave) {
    const d = MAPA[chave];
    if (!d) return null;
    if (d.jogo) return iconeDoJogo(d.jogo);
    if (d.digitando) return balaoDigitando(d.digitando);
    if (d.mobi) return { url: MOBIS + d.mobi.replace('*', '_') + '_icon.png', w: 0, h: 0, mobi: true };
    return null;
  }
  // Elemento com a ilustração, ou `reserva` (o ícone desenhado de sempre) quando não há imagem ou
  // ela não carrega. `tamanho` é o lado da caixa (a imagem cabe dentro).
  // Imagens pequenas (pixel art) crescem em múltiplos inteiros, sem borrar.
  function elemento(chave, classe, tamanho, reserva) {
    const f = fonte(chave);
    if (!f) return reserva || null;
    const img = el('img', { alt: '', src: f.url, draggable: 'false', decoding: 'async' });
    const caixaImg = el('span', { class: 'vl-ilus' + (classe ? ' ' + classe : ''), 'aria-hidden': 'true' }, [img]);
    function ajustar(w, h) {
      if (!(w > 0 && h > 0) || !tamanho) return;
      const escala = Math.min(tamanho / w, tamanho / h);
      const inteira = escala >= 2 ? Math.floor(escala) : escala >= 1 ? 1 : escala;
      img.style.width = Math.round(w * inteira) + 'px';
      img.style.height = Math.round(h * inteira) + 'px';
      if (inteira >= 1) img.classList.add('pixel');
    }
    if (f.w && f.h) ajustar(f.w, f.h);
    else img.addEventListener('load', function () { ajustar(img.naturalWidth, img.naturalHeight); });
    // Mobi que não existe mais no hotel: some e a caixa fica com o ícone de reserva, se houver.
    img.addEventListener('error', function () {
      if (reserva && caixaImg.isConnected) caixaImg.replaceWith(reserva);
      else caixaImg.classList.add('falhou');
    });
    return caixaImg;
  }

  VL.ilustracoes = { MAPA, fonte, elemento, iconeDoJogo };
})(typeof globalThis !== 'undefined' ? globalThis : this);
