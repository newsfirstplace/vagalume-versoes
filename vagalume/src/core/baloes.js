// V1–V9: desenhos pixelados próprios (ferramentas/gerar-novos-baloes.js), no molde dos balões enfeitados do jogo.
// Os IDs V1–V9 são visuais da extensão; o Habblet recebe a fala normalmente.
(function (raiz) {
  'use strict';
  // Mesmo molde dos balões enfeitados do jogo (39–41): enfeite nas 8 linhas de cima, corpo de 24 linhas.
  const GEOMETRIA = Object.freeze({
    enfeite: { fatia: '23 6 7 31', largura: '22px 6px 7px 32px', sobra: '8px 0 0 2px', margem: 27, direita: 6, ponta: '9px 6px -5px' },
  });
  const ESTILOS = Object.freeze([
    { id: 'v1', nome: 'Lume', descricao: 'Verde-limão com um vagalume aceso', texto: '#1c260a', lateral: '#7c9a12', base: 'enfeite' },
    { id: 'v2', nome: 'Noite', descricao: 'Azul da noite com lua e estrelas', texto: '#f2f8df', lateral: '#1d2a42', base: 'enfeite' },
    { id: 'v3', nome: 'Folha', descricao: 'Verde de folha com um broto', texto: '#18300c', lateral: '#45702a', base: 'enfeite' },
    { id: 'v4', nome: 'Aurora', descricao: 'Verde-água com brilhos', texto: '#12382a', lateral: '#3f8f6c', base: 'enfeite' },
    { id: 'v5', nome: 'Cyber', descricao: 'Azul elétrico com um raio', texto: '#06263d', lateral: '#14527f', base: 'enfeite' },
    { id: 'v6', nome: 'Gótico', descricao: 'Vinho escuro com um morcego', texto: '#ffeaf0', lateral: '#3d0d1c', base: 'enfeite' },
    { id: 'v7', nome: 'Dragão', descricao: 'Laranja de brasa com uma chama', texto: '#3d1809', lateral: '#a33d0f', base: 'enfeite' },
    { id: 'v8', nome: 'Cósmico', descricao: 'Violeta com um planeta', texto: '#ffffff', lateral: '#33215f', base: 'enfeite' },
    { id: 'v9', nome: 'Aquático', descricao: 'Água clara com um peixinho', texto: '#053042', lateral: '#0f6a85', base: 'enfeite' },
    { id: 'v10', nome: 'Laço', descricao: 'Rosa com um laço de fita', texto: '#4a0f26', lateral: '#d9568a', base: 'enfeite' },
    { id: 'v11', nome: 'Caveira', descricao: 'Cinza com uma caveira', texto: '#14161c', lateral: '#4a4f5c', base: 'enfeite' },
    { id: 'v12', nome: 'Bomba', descricao: 'Amarelo com uma bomba de pavio aceso', texto: '#3a2c00', lateral: '#c99a00', base: 'enfeite' },
    { id: 'v13', nome: 'Realeza', descricao: 'Lilás com uma coroa de ouro', texto: '#24093f', lateral: '#5a2a8a', base: 'enfeite' },
    { id: 'v14', nome: 'Cogumelo', descricao: 'Vermelho com um cogumelo de bolinhas', texto: '#3a0808', lateral: '#a8201f', base: 'enfeite' },
    { id: 'v15', nome: 'Neve', descricao: 'Azul-gelo com um floco de neve', texto: '#123554', lateral: '#3f7fb5', base: 'enfeite' },
  ]);
  const valido = (id) => ESTILOS.some((e) => e.id === id);
  const recurso = (id, parte) => {
    const caminho = 'icones/baloes/' + id + '-' + parte + '.png';
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL(caminho) : caminho;
  };
  const temas = (seletor) => ESTILOS.map((e) => {
    const g = GEOMETRIA[e.base];
    return `${seletor}[data-vl-bolha="${e.id}"]{--vl-bolha-texto:${e.texto};border-image-source:url("${recurso(e.id, 'corpo')}")!important;border-image-slice:${g.fatia} fill!important;border-image-width:${g.largura}!important;border-image-outset:${g.sobra}!important}`
      + `${seletor}[data-vl-bolha="${e.id}"] .chat-content{margin-left:${g.margem}px!important;padding-right:${g.direita}px!important}`;
  }).join('');
  const cssPagina = '.nitro-chat-widget .chat-bubble[data-vl-bolha]{border-image-repeat:repeat repeat!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;color:var(--vl-bolha-texto)!important;}'
    + temas('.nitro-chat-widget .chat-bubble')
    + ESTILOS.map((e) => { const [w, h, baixo] = GEOMETRIA[e.base].ponta.split(' '); return `.nitro-chat-widget .chat-bubble[data-vl-bolha="${e.id}"] .pointer{background:url("${recurso(e.id, 'ponta')}") center no-repeat!important;width:${w}!important;height:${h}!important;bottom:${baixo}!important;border:0!important;transform:translateX(-50%)!important}`; }).join('')
    + '.nitro-chat-widget .chat-bubble[data-vl-bolha] .chat-content,.nitro-chat-widget .chat-bubble[data-vl-bolha] .message,.nitro-chat-widget .chat-bubble[data-vl-bolha] .username{color:var(--vl-bolha-texto)!important;text-shadow:none!important;}'
    // O lado do avatar já vem pintado no desenho; o quadrado do jogo ficaria por cima do enfeite.
    + '.nitro-chat-widget .bubble-container:has(.chat-bubble[data-vl-bolha]) .user-container-bg{background:transparent!important}'
    + 'html body .nitro-chat-style-selector-container .bubble-parent-container.vl-bolha-picker{display:grid!important;place-items:center!important;width:64px!important;height:36px!important;padding:3px!important;border:1px solid #3a475b!important;border-radius:6px!important;background:#1b2431!important;cursor:pointer!important}'
    + 'html body .nitro-chat-style-selector-container .bubble-parent-container.vl-bolha-picker:hover,html body .nitro-chat-style-selector-container .bubble-parent-container.vl-bolha-picker.ativa{border-color:#d6f24a!important;box-shadow:0 0 0 1px #d6f24a88!important}'
    + '.vl-bolha-picker img{max-width:60px;max-height:28px;width:auto;height:auto;object-fit:contain;image-rendering:pixelated}';
  function assinatura(texto) {
    const s = String(texto || '').replace(/\s+/g, ' ').trim().toLowerCase();
    let hash = 2166136261;
    for (let i = 0; i < s.length; i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619);
    return s.length.toString(36) + ':' + (hash >>> 0).toString(36);
  }
  const api = { ESTILOS, GEOMETRIA, valido, recurso, assinatura, cssPagina };
  raiz.VL = raiz.VL || {};
  raiz.VL.baloes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
