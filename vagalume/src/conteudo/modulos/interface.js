// Vagalume — módulo "interface": ajusta a tela do hotel com uma folha de estilo.
// Nada é removido da página: ao desligar o módulo, tudo volta a aparecer.
// Classes conferidas ao vivo em 2026-11-13: cada botão da barra de baixo é
// `.nitro-toolbar .navigation-item.icon.icon-<nome>`; o jogo trava a seleção de texto no <body>.
(function (raiz) {
  'use strict';
  const VL = raiz.VL;
  if (!VL || !VL.nucleo || !VL.camada || !VL.jogo) return;
  const { nucleo, camada, jogo } = VL;

  // Opção -> classe do ícone na barra de baixo.
  const ICONES = {
    ocultarHotel: 'icon-habbo',
    ocultarNavegador: 'icon-rooms',
    ocultarMissoes: 'icon-quests',
    ocultarCatalogo: 'icon-catalog',
    ocultarInventario: 'icon-inventory',
    ocultarCamera: 'icon-camera',
    ocultarAmigos: 'icon-friendall',
    ocultarBuscaAmigos: 'icon-friendsearch',
  };

  // Filtro aplicado só ao desenho do quarto, não às janelas.
  const FILTROS = {
    nenhum: '',
    cinza: 'grayscale(1)',
    sepia: 'sepia(.8)',
    inverter: 'invert(1) hue-rotate(180deg)',
    contraste: 'contrast(1.35)',
    vivo: 'saturate(1.6)',
    suave: 'saturate(.6) brightness(1.05)',
    escuro: 'brightness(.75)',
  };

  // Tema das janelas do jogo. Estrutura conferida ao vivo: `.nitro-card` > `.nitro-card-header`
  // (com `.nitro-card-header-text`), `.menu` (abas) e `.content-area`. Com a BANANA ligada, as cores
  // dela também se aplicam às mesmas classes; por isso o seletor começa em `html body` e usa !important.
  const P = 'html body .nitro-card';
  const H = 'html body ';
  const LOGO_CARGA = VL.logoImagem ? 'url("' + VL.logoImagem.url + '")' : (VL.marca ? 'url("' + VL.marca.dataUrl(VL.marca.logo('pote')) + '")' : 'none');
  // Cores do tema (as mesmas do ícone e do painel do Vagalume).
  const CORES = ':root { --vl-f0: #0e1219; --vl-f1: #151a24; --vl-f2: #1d2431; --vl-f3: #263042; --vl-borda: #2c3445; --vl-texto: #e6eaf1; --vl-suave: #9aa4b5; --vl-acento: #d6f24a; --vl-acento-txt: #12161f; }';
  // Base escura do tema Vagalume (já foi um tema próprio, o "escuro"): janelas e o miolo delas. As partes que ficavam claras foram achadas ao vivo, varrendo
  // o fundo e a cor do texto de loja, navegador, inventário, amigos, chat e quadro de informações.
  const ESCURO = [
    CORES,
    P + ' { background-color: var(--vl-f1) !important; color: var(--vl-texto) !important; border-color: var(--vl-borda) !important; }',
    P + ' .nitro-card-header { background-color: var(--vl-f2) !important; border-bottom: 1px solid var(--vl-borda) !important; }',
    // o jogo põe uma borda azul de 2 px em cima de todo título de janela
    P + ' .nitro-card-header { border-top: 0 !important; border-left: 0 !important; border-right: 0 !important; }',
    P + ' .nitro-card-header-text { color: var(--vl-texto) !important; text-shadow: none !important; }',
    P + ' .menu { background-color: #1a202c !important; border-color: var(--vl-borda) !important; }',
    P + ' .content-area { background-color: var(--vl-f1) !important; color: var(--vl-texto) !important; }',
    P + ' input, ' + P + ' select, ' + P + ' textarea { background-color: var(--vl-f0) !important; color: var(--vl-texto) !important; border-color: var(--vl-borda) !important; }',
    P + ' input::placeholder { color: var(--vl-suave) !important; }',
    P + ' .btn-primary, ' + P + ' .active:not(.layout-grid-item):not(.nitro-card-accordion-set) { background-color: var(--vl-acento) !important; color: var(--vl-acento-txt) !important; border-color: var(--vl-acento) !important; }',
    P + ' .btn-secondary, ' + P + ' .btn-white, ' + P + ' .btn-light { background-color: var(--vl-f3) !important; background-image: none !important; color: var(--vl-texto) !important; border-color: var(--vl-borda) !important; }',
    P + ' a { color: var(--vl-acento) !important; }',
    // miolo: grades, listas, etiquetas e fundos claros do Bootstrap
    P + ' .layout-grid-item:not([style*="background-color"]) { background-color: var(--vl-f2) !important; border-color: var(--vl-borda) !important; }',
    P + ' .layout-grid-item.active, ' + P + ' .layout-grid-item:hover { border-color: var(--vl-acento) !important; }',
    P + ' .layout-grid-item.active:not([style*="background-color"]) { background-color: var(--vl-f3) !important; }',
    P + ' .badge.gray, ' + P + ' .badge.bg-secondary { background-color: var(--vl-f3) !important; color: var(--vl-texto) !important; }',
    P + ' .navigator-item, ' + P + ' .bg-light, ' + P + ' .bg-white { background-color: var(--vl-f2) !important; color: var(--vl-texto) !important; }',
    P + ' .navigator-item:hover { background-color: var(--vl-f3) !important; }',
    P + ' .text-black, ' + P + ' .text-dark { color: var(--vl-texto) !important; }',
    P + ' .btn-settings { background-color: var(--vl-f3) !important; color: var(--vl-texto) !important; }',
    // amigos (sanfona)
    H + '.nitro-card-accordion-set, ' + H + '.nitro-card-accordion-set-content, ' + H + '.nitro-card-accordion-set .wrapper { background-color: var(--vl-f1) !important; color: var(--vl-texto) !important; }',
    H + '.nitro-card-accordion-set-header { background-image: none !important; background-color: var(--vl-f2) !important; color: var(--vl-texto) !important; border-color: var(--vl-borda) !important; }',
    H + '.nitro-card-accordion-set .friend-row { background-color: var(--vl-f1) !important; color: var(--vl-texto) !important; border-color: var(--vl-borda) !important; }',
    H + '.nitro-card-accordion-set .friend-row:hover { background-color: var(--vl-f2) !important; }',
    // Amigo selecionado: o jogo põe .bg-primary.text-white na linha (lido no cliente); no tema, limão.
    H + '.nitro-card-accordion-set .friend-row.bg-primary { background-color: rgba(214, 242, 74, .18) !important; box-shadow: inset 3px 0 0 var(--vl-acento), inset 0 0 0 1px rgba(214, 242, 74, .45) !important; color: var(--vl-acento) !important; }',
    H + '.nitro-card-accordion-set .text-black { color: var(--vl-texto) !important; }',
    // botões com texto: sem imagem de fundo nem de borda clara (os só de ícone ficam, para não perder o desenho)
    P + ' .btn:not(:empty):not(.active):not(.btn-primary):not(.btn-success):not(.btn-danger):not(.btn-warning):not(.btn-info), ' + H + '.nitro-card-accordion-set .btn-search { background-image: none !important; border-image: none !important; background-color: var(--vl-f3) !important; color: var(--vl-texto) !important; border: 1px solid var(--vl-borda) !important; }',
    // rolagem: o jogo usa scrollbar-color, que no Chrome atual vale mais que ::-webkit-scrollbar
    P + ', ' + P + ' * { scrollbar-color: #3a4456 var(--vl-f0) !important; }',
    // bate-papo: linha do título e botõezinhos desenhados em branco
    H + '.nitro-friends-messenger .messenger-line { background: linear-gradient(var(--vl-borda), var(--vl-borda)) center / 100% 1px no-repeat !important; }',
    H + '.nitro-friends-messenger button.follow, ' + H + '.nitro-friends-messenger button.profile, ' + H + '.nitro-friends-messenger button.clear { filter: invert(.88) hue-rotate(180deg) !important; }',
    // seletor de estilo do balão: um balãozinho desenhado aqui, no lugar da caixa cinza do jogo
    H + '.nitro-room-chatinput-component .chatstyles-selector { background-image: none !important; position: relative !important; min-width: 40px !important; border: 1px solid var(--vl-borda) !important; }',
    H + '.nitro-room-chatinput-component .chatstyles-selector::before { content: ""; position: absolute; left: 50%; top: 50%; width: 18px; height: 12px; transform: translate(-50%, -70%); border-radius: 4px; background: var(--vl-texto); }',
    H + '.nitro-room-chatinput-component .chatstyles-selector::after { content: ""; position: absolute; left: 50%; top: 50%; transform: translate(-7px, 2px); border-left: 6px solid transparent; border-top: 6px solid var(--vl-texto); }',
    // marcas postas pela varredura (varrerClaros): o que o jogo desenha claro e não tem regra própria
    H + '.vl-fundo-claro { background-color: var(--vl-f3) !important; background-image: none !important; border-image: none !important; color: var(--vl-texto) !important; border-color: var(--vl-borda) !important; }',
    H + '.vl-texto-escuro { color: var(--vl-texto) !important; }',
    // missão (motto) no quadro do usuário
    H + '.nitro-infostand .motto-container { background-color: var(--vl-f2) !important; border: 1px solid var(--vl-borda) !important; }',
    // Info do Quarto: ícone azul do link e texto do link
    H + '.link-container .link-icon { display: none !important; }',
    H + '.link-container p { color: var(--vl-acento) !important; }',
    // abas e botões secundários ao passar o mouse (loja)
    P + ' .btn-secondary:hover { background-color: var(--vl-f2) !important; color: var(--vl-acento) !important; }',
    // bate-papo (console): botões e campo usam uma imagem de borda branca, não fundo
    H + '.nitro-friends-messenger .messenger-button, ' + H + '.nitro-friends-messenger .chat-input-form { border-image: none !important; border: 1px solid var(--vl-borda) !important; border-radius: 6px !important; background-color: var(--vl-f3) !important; color: var(--vl-texto) !important; }',
    H + '.nitro-friends-messenger .chat-input-form { background-color: var(--vl-f0) !important; }',
    H + '.nitro-friends-messenger .messenger-button:hover { background-color: var(--vl-acento) !important; color: var(--vl-acento-txt) !important; }',
    H + '.nitro-friends-messenger .layout-grid-item-messenger { border-image: none !important; border-radius: 8px !important; }',
    H + '.nitro-messenger-header-text { background-color: var(--vl-f2) !important; color: var(--vl-texto) !important; }',
    // botões largos dos painéis da coluna da direita (ex.: Juntar-se ao Grupo): imagem de fundo clara
    H + '.nitro-right-side .purse-collapse .w-100.justify-content-center { background-image: none !important; background-color: var(--vl-f3) !important; color: var(--vl-texto) !important; border: 1px solid var(--vl-borda) !important; border-radius: 6px !important; }',
    // perfil: faixa do emblema, caixas e detalhes do grupo
    P + ' .header, ' + P + ' .content-box, ' + P + ' .group-details, ' + P + ' .badge-rounding { background-color: var(--vl-f2) !important; color: var(--vl-texto) !important; border-color: var(--vl-borda) !important; }',
    P + ' .profile-cover { background-color: var(--vl-f2) !important; }',
    P + ' .badge-image.group-badge { background-color: var(--vl-f3) !important; }',
    // campo de chat, quadro de informações e balões da coluna da direita
    H + '.nitro-room-chatinput-component .chatinput-container { background-color: var(--vl-f1) !important; border-color: var(--vl-borda) !important; }',
    H + '.nitro-room-chatinput-component .chatinput-container::before { background-color: rgba(255, 255, 255, .06) !important; }',
    H + '.nitro-room-chatinput-component .chatinput-container input { color: var(--vl-texto) !important; }',
    H + '.nitro-room-chatinput-component .chatinput-container input::placeholder { color: var(--vl-suave) !important; }',
    H + '.nitro-room-chatinput-component .chatstyles-selector { background-color: var(--vl-f2) !important; }',
    H + '.nitro-room-chatinput-component .text-black { color: var(--vl-texto) !important; }',
    H + '.nitro-infostand .btn-white, ' + H + '.nitro-infostand .btn-light { background-color: var(--vl-f3) !important; color: var(--vl-texto) !important; border-color: var(--vl-borda) !important; }',
    H + '.nitro-notification-bubble { background-color: rgba(21, 26, 36, .94) !important; color: var(--vl-texto) !important; }',
    // Ferramenta de construção do jogo (classes lidas no código do cliente em 2026-11-15): títulos de seção
    // em limão, chaves no jeito das do painel (no lugar das vermelhas), campos e botões escuros.
    H + '.nitro-room-construction-tool .content { background-color: var(--vl-f1) !important; color: var(--vl-texto) !important; }',
    H + '.nitro-room-construction-tool .line { border-color: transparent !important; background: none !important; display: flex; align-items: center; gap: 8px; margin: 10px 0 6px; }',
    H + '.nitro-room-construction-tool .line::before, ' + H + '.nitro-room-construction-tool .line::after { content: ""; flex: 1; height: 1px; background: var(--vl-borda) !important; }',
    H + '.nitro-room-construction-tool .line .header-text { color: var(--vl-acento) !important; text-shadow: none !important; background: none !important; font-size: 11.5px !important; letter-spacing: .06em; text-transform: uppercase; margin: 0 !important; padding: 0 !important; white-space: nowrap; }',
    H + '.nitro-room-construction-tool .option-name { color: var(--vl-texto) !important; text-shadow: none !important; }',
    H + '.nitro-room-construction-tool .switch .slider { background-color: var(--vl-f3) !important; background-image: none !important; border: 1px solid var(--vl-borda) !important; border-radius: 999px !important; box-shadow: none !important; }',
    H + '.nitro-room-construction-tool .switch .slider::before { background-color: var(--vl-suave) !important; border-radius: 50% !important; box-shadow: none !important; }',
    H + '.nitro-room-construction-tool .switch input:checked + .slider { background-color: var(--vl-acento) !important; border-color: var(--vl-acento) !important; }',
    H + '.nitro-room-construction-tool .switch input:checked + .slider::before { background-color: #12161f !important; }',
    H + '.nitro-room-construction-tool .reset { filter: grayscale(1) brightness(1.6); opacity: .7; }',
    H + '.nitro-room-construction-tool .reset:hover { filter: none; opacity: 1; }',
    H + '.nitro-room-construction-tool input[type="number"], ' + H + '.nitro-room-construction-tool input[type="text"] { background-color: var(--vl-f0) !important; color: var(--vl-texto) !important; border: 1px solid var(--vl-borda) !important; border-radius: 6px !important; }',
    H + '.nitro-room-construction-tool .btn-secondary { background-color: var(--vl-f3) !important; background-image: none !important; border: 1px solid var(--vl-borda) !important; color: var(--vl-texto) !important; border-radius: 8px !important; text-shadow: none !important; box-shadow: none !important; }',
    H + '.nitro-room-construction-tool .btn-secondary:hover:not(:disabled) { border-color: var(--vl-acento) !important; color: var(--vl-acento) !important; }',
    H + '.nitro-room-construction-tool .btn-secondary:disabled { opacity: .45 !important; }',
    H + '.nitro-room-construction-tool .tile-button-enabled { background-color: var(--vl-acento) !important; color: #12161f !important; border-color: var(--vl-acento) !important; }',
    // Listas dos comandos :chooser e :furnichooser (print do usuário em 2026-11-15: fundo branco com o
    // texto já clareado pelo tema). Classes lidas no código do cliente.
    H + '[class*="-chooser-widget"] .content { background-color: var(--vl-f0) !important; color: var(--vl-texto) !important; border-color: var(--vl-borda) !important; }',
    H + '[class*="-chooser-widget"] .content div { background-color: transparent !important; color: inherit; border-color: var(--vl-borda) !important; }',
    H + '[class*="-chooser-widget"] .border-bottom { border-color: var(--vl-acento) !important; color: var(--vl-acento) !important; background-color: var(--vl-f1) !important; }',
    H + '[class*="-chooser-widget"] .user-row, ' + H + '[class*="-chooser-widget"] .furni-row { background-color: transparent !important; color: var(--vl-texto) !important; border-radius: 4px; }',
    H + '[class*="-chooser-widget"] .user-row:nth-child(even), ' + H + '[class*="-chooser-widget"] .furni-row:nth-child(even) { background-color: rgba(255, 255, 255, .04) !important; }',
    H + '[class*="-chooser-widget"] .user-row:hover, ' + H + '[class*="-chooser-widget"] .furni-row:hover { background-color: rgba(214, 242, 74, .12) !important; }',
    H + '[class*="-chooser-widget"] .user-row.selected, ' + H + '[class*="-chooser-widget"] .furni-row.selected, ' + H + '[class*="-chooser-widget"] .user-row.active, ' + H + '[class*="-chooser-widget"] .furni-row.active { background-color: rgba(214, 242, 74, .22) !important; color: var(--vl-acento) !important; }',
    H + '[class*="-chooser-widget"] .row-text, ' + H + '[class*="-chooser-widget"] .column-text { color: inherit !important; }',
    H + '[class*="-chooser-widget"] .users-count-text, ' + H + '[class*="-chooser-widget"] .items-count-text { color: var(--vl-suave) !important; }',
  ];
  // Vista do hotel (fora dos quartos), pedido do usuário em 2026-11-15. Estrutura lida no código do
  // cliente: .nitro-hotel-view (cor de fundo no estilo) > .landing-widgets, .background, .sun, .drape,
  // .left (casa), .right-repeat, .right (estátua), .avatar-image. O céu claro vira noite com vagalumes;
  // a casa e a estátua ficam, só recoloridas para a noite, com um contorno de luz limão.
  function pontos(n, semente, raio, cor, borda) {
    let s = semente;
    const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const lista = [];
    for (let i = 0; i < n; i++) {
      const x = (r() * 100).toFixed(1);
      const y = (r() * 72 + 4).toFixed(1);
      const t = (raio * (0.6 + r() * 0.8)).toFixed(1);
      lista.push('radial-gradient(circle ' + (t * 2.6).toFixed(1) + 'px at ' + x + '% ' + y + '%, ' + cor + ' 0, ' + borda + ' ' + t + 'px, transparent ' + (t * 2.6).toFixed(1) + 'px)');
    }
    return lista.join(', ');
  }
  const VISTA = H + '.nitro-hotel-view';
  const VISTA_HOTEL = [
    VISTA + ' { background: radial-gradient(ellipse 70% 55% at 50% 112%, rgba(120, 160, 30, .28) 0%, rgba(60, 90, 20, .12) 45%, transparent 75%),'
      + ' radial-gradient(circle 70px at 82% 16%, rgba(233, 255, 122, .55) 0, rgba(214, 242, 74, .16) 45px, transparent 70px),'
      + ' linear-gradient(180deg, #060910 0%, #0b1220 35%, #101a26 68%, #16200f 100%) !important; }',
    VISTA + ' > .background, ' + VISTA + ' > .sun { display: none !important; }',
    VISTA + ' > .drape:not([data-vl-noite]) { filter: brightness(.7) saturate(.8) !important; }',
    // Enquanto a imagem repintada (vistaNoturna) não fica pronta, ou se ela falhar, um filtro parecido.
    VISTA + ' > :is(.left, .right, .right-repeat):not([data-vl-noite]) { filter: brightness(.5) saturate(.7) hue-rotate(-8deg) contrast(1.05) !important; }',
    VISTA + ' > :is(.left, .right, .right-repeat)[data-vl-noite] { filter: drop-shadow(0 0 14px rgba(214, 242, 74, .12)) !important; }',
    // Lua limão no lugar do sol, estrelas paradas que piscam (::before) e vagalumes que sobem (::after).
    VISTA + '::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: '
      + 'radial-gradient(circle 34px at 82% 16%, #f3ffb8 0, #d6f24a 26px, rgba(214, 242, 74, 0) 34px), '
      + pontos(46, 7, 1.1, 'rgba(235, 242, 255, .9)', 'rgba(235, 242, 255, .35)') + '; animation: vl-hv-estrelas 5s ease-in-out infinite alternate; }',
    VISTA + '::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 1; background: '
      + pontos(22, 31, 2.2, 'rgba(243, 255, 170, 1)', 'rgba(214, 242, 74, .55)') + '; animation: vl-hv-subir 14s ease-in-out infinite alternate, vl-hv-piscar 2.6s ease-in-out infinite alternate; }',
    '@keyframes vl-hv-estrelas { from { opacity: .55; } to { opacity: 1; } }',
    '@keyframes vl-hv-subir { from { transform: translate(0, 10px); } to { transform: translate(-14px, -22px); } }',
    '@keyframes vl-hv-piscar { 0% { opacity: .35; } 60% { opacity: .95; } 100% { opacity: .6; } }',
    // Textos e botões das novidades no tema.
    VISTA + ' .landing-widgets { position: relative; z-index: 2; }',
    VISTA + ' .landing-widgets .btn, ' + VISTA + ' .landing-widgets button { background: rgba(18, 22, 31, .85) !important; background-image: none !important; border: 1px solid #d6f24a !important; border-image: none !important; color: #d6f24a !important; border-radius: 8px !important; text-shadow: none !important; box-shadow: 0 0 10px rgba(214, 242, 74, .18) !important; }',
    VISTA + ' .landing-widgets .btn:hover, ' + VISTA + ' .landing-widgets button:hover { background: #d6f24a !important; color: #12161f !important; }',
    '@media (prefers-reduced-motion: reduce) { ' + VISTA + '::before, ' + VISTA + '::after { animation: none !important; } }',
  ];
  // Vagalume: o escuro e mais a cara da extensão — limão como acento, brilho, cantos arredondados.
  // Loja, conquistas, tarefas e bate-papo (pedido do usuário em 2026-11-16, com prints). Classes lidas
  // no código do cliente; não vistas ao vivo depois da mudança.
  const LOJA_E_OUTROS = [
    // Loja: caixas da lista de categorias e da página (desenhadas claras pelo jogo) e a faixa do topo.
    H + '.nitro-catalog [class*="grid-container"] { background-color: var(--vl-f1) !important; background-image: none !important; border-image: none !important; border: 1px solid var(--vl-borda) !important; border-radius: 8px !important; }',
    H + '.nitro-catalog .catalog-teaser-image, ' + H + '.nitro-catalog .catalog-page-info, ' + H + '.nitro-catalog [class*="nitro-catalog-layout"] { background-color: transparent !important; color: var(--vl-texto) !important; }',
    // Bordas brancas que sobravam em volta da lista, da grade e da barra "Escolha um item" (print de 2026-11-16).
    H + '.nitro-catalog .nitro-card-content *:not(.layout-grid-item):not(.layout-grid-item *) { border-color: var(--vl-borda) !important; }',
    H + '.nitro-catalog .nitro-card-content *:not(.layout-grid-item):not(.layout-grid-item *):not(img):not(.icon) { border-image: none !important; }',
    // O branco em volta da lista, da grade e do "Escolha um item!" vem de box-shadow (print do usuário
    // com as classes): sem sombra clara, com um contorno limão discreto.
    H + '.nitro-catalog .nitro-card-content *:not(.layout-grid-item):not(.layout-grid-item *):not(.nitro-catalog-navigation-grid-container):not(.furni-btn):not(.h-100.px-1.py-2.overflow-hidden) { box-shadow: none !important; }',
    H + '.nitro-catalog .nitro-catalog-navigation-grid-container, ' + H + '.nitro-catalog .h-100.px-1.py-2.overflow-hidden, ' + H + '.nitro-catalog .furni-btn { box-shadow: 0 0 0 1px rgba(214, 242, 74, .35) !important; border-radius: 8px !important; background-color: var(--vl-f1) !important; background-image: none !important; }',
    H + '.nitro-catalog .furni-btn { color: var(--vl-acento) !important; text-shadow: none !important; }',
    H + '.vl-fundo-claro { box-shadow: 0 0 0 1px var(--vl-borda) !important; }',
    H + '.nitro-catalog .catalog-header { background: linear-gradient(90deg, #1c2614, #12161f) !important; border-bottom: 1px solid rgba(214, 242, 74, .35) !important; }',
    H + '.nitro-catalog .catalog-header .ctlg-header img { filter: grayscale(1) sepia(1) hue-rotate(28deg) saturate(2.4) brightness(.5) !important; }',
    H + '.nitro-catalog .ctlg-title { color: var(--vl-acento) !important; text-shadow: none !important; }',
    H + '.nitro-catalog .ctlg-description, ' + H + '.nitro-catalog .catalog-teaser-text { color: var(--vl-texto) !important; text-shadow: none !important; }',
    // Conquistas: cabeçalho da categoria e quadro do emblema escolhido.
    H + '.nitro-achievements .nitro-card-content > *:not(.layout-grid-item) { background-color: var(--vl-f1) !important; background-image: none !important; border-image: none !important; color: var(--vl-texto) !important; }',
    H + '.nitro-achievements .nitro-achievements-back-arrow { filter: invert(1) brightness(1.4); }',
    H + '.nitro-achievements .bg-white, ' + H + '.nitro-achievements .bg-light, ' + H + '.nitro-achievements [class*="badge-info"] { background-color: var(--vl-f2) !important; color: var(--vl-texto) !important; border-color: var(--vl-borda) !important; }',
    // Tarefas: o amarelo forte da tarefa ativa deixava o texto ilegível.
    H + '.nitro-quests .quest-campaign, ' + H + '.nitro-quests .quest-box { background-color: var(--vl-f2) !important; background-image: none !important; border-image: none !important; border: 1px solid var(--vl-borda) !important; color: var(--vl-texto) !important; }',
    H + '.nitro-quests .quest-campaign.success, ' + H + '.nitro-quests .quest-box.success { background-color: #1f2a16 !important; border-color: var(--vl-acento) !important; }',
    H + '.nitro-quests .quest-campaign-header { background-color: var(--vl-f3) !important; background-image: none !important; border-color: var(--vl-borda) !important; }',
    H + '.nitro-quests .quest-campaign-header.success { background-color: var(--vl-acento) !important; }',
    H + '.nitro-quests .quest-campaign-header.success, ' + H + '.nitro-quests .quest-campaign-header.success * { color: #12161f !important; text-shadow: none !important; }',
    H + '.nitro-quests .quest-campaign *:not(.btn):not(.badge):not(.quest-campaign-header *) { color: var(--vl-texto) !important; text-shadow: none !important; }',
    H + '.nitro-quests .quest-box *:not(.badge) { color: var(--vl-texto) !important; text-shadow: none !important; }',
    // Bate-papo privado: textos sem a sombra que os deixava grossos.
    H + '.nitro-friends-messenger, ' + H + '.nitro-friends-messenger * { text-shadow: none !important; -webkit-text-stroke: 0 !important; }',
    H + '.nitro-friends-messenger .nitro-messenger-header-text, ' + H + '.nitro-friends-messenger .messenger-button { font-weight: 600 !important; }',
    // Botão de minimizar das janelas (era um quadrado branco): limão, com o traço desenhado.
    H + '.nitro-card-header-minimize { background-image: none !important; background-color: var(--vl-acento) !important; border-radius: 5px !important; display: grid !important; place-items: center; }',
    H + '.nitro-card-header-minimize::after { content: ""; width: 55%; height: 2px; border-radius: 1px; background: #12161f; }',
  ];
  const VAGALUME = ESCURO.concat(VISTA_HOTEL, LOJA_E_OUTROS, [
    // Tela de carregamento do jogo (conferida ao vivo em 2026-11-14): fundo, barra e porcentagem no tema.
    H + 'div:has(> .loading):has(.nitro-loading-bar) { background: radial-gradient(ellipse at 50% 38%, #1c2a12 0%, #12161f 55%, #0a0d13 100%) !important; }',
    // No lugar das fotos do centro, a logo do Vagalume (arte do usuário, em core/logo-imagem.js; pedido de 2026-11-15).
    // Estrutura lida no código do cliente: .nitro-loading > .loading > .photo + .overlay(-leet|-hidden).
    // Logo na tela de carregamento, com uma animação leve (pedido do usuário em 2026-11-16): flutua, o
    // brilho limão pulsa e um reflexo de luz passa pelas letras (a própria logo serve de máscara).
    H + '.nitro-loading .loading { position: relative !important; width: 520px !important; height: 154px !important; max-width: 90vw; margin-bottom: 18px; filter: drop-shadow(0 0 18px rgba(214, 242, 74, .18)); animation: vl-logo-flutua 3.6s ease-in-out infinite; background: ' + LOGO_CARGA + ' center / contain no-repeat !important; }',
    H + '.nitro-loading .loading::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(105deg, transparent 38%, rgba(255, 255, 240, .75) 50%, transparent 62%) no-repeat; background-size: 260% 100%; -webkit-mask: ' + LOGO_CARGA + ' center / contain no-repeat; mask: ' + LOGO_CARGA + ' center / contain no-repeat; animation: vl-logo-reflexo 3.6s ease-in-out infinite; }',
    '@keyframes vl-logo-flutua { 0%, 100% { transform: translateY(0); filter: drop-shadow(0 0 14px rgba(214, 242, 74, .14)); } 50% { transform: translateY(-6px); filter: drop-shadow(0 0 26px rgba(214, 242, 74, .38)); } }',
    '@keyframes vl-logo-reflexo { 0%, 45% { background-position: 130% 0; } 75%, 100% { background-position: -30% 0; } }',
    '@media (prefers-reduced-motion: reduce) { ' + H + '.nitro-loading .loading, ' + H + '.nitro-loading .loading::after { animation: none !important; } }',
    H + '.nitro-loading .loading > * { display: none !important; }',
    H + '.nitro-loading-bar { border: 1px solid #5d7222 !important; border-radius: 999px !important; overflow: hidden; background: #12161f !important; box-shadow: 0 0 14px rgba(214, 242, 74, .22); }',
    H + '.nitro-loading-bar-inner { background: linear-gradient(90deg, #7f9f18, #d6f24a) !important; border-radius: 999px; box-shadow: 0 0 10px rgba(214, 242, 74, .8); }',
    H + '.loading-ellipsis { color: #d6f24a !important; letter-spacing: .06em; }',
    P + ' { border: 1px solid rgba(214, 242, 74, .28) !important; border-radius: 10px !important; box-shadow: 0 12px 32px rgba(0, 0, 0, .55), 0 0 0 1px rgba(0, 0, 0, .4) !important; overflow: hidden; }',
    P + ' .nitro-card-header { background: linear-gradient(90deg, #1d2431, #1f2a1c) !important; border-bottom: 2px solid var(--vl-acento) !important; }',
    P + ' .nitro-card-header-text { color: var(--vl-acento) !important; letter-spacing: .04em; }',
    P + ' .nitro-card-header-text::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 7px; vertical-align: middle; border-radius: 50%; background-color: var(--vl-acento); box-shadow: 0 0 8px var(--vl-acento); }',
    P + ' .menu > *, ' + P + ' .navigator-tab { color: var(--vl-suave) !important; }',
    P + ' .menu > .active, ' + P + ' .navigator-tab.active { background-color: transparent !important; color: var(--vl-acento) !important; box-shadow: inset 0 -2px 0 var(--vl-acento) !important; }',
    P + ' .layout-grid-item { border-radius: 8px !important; }',
    P + ' .layout-grid-item.active { box-shadow: 0 0 0 1px var(--vl-acento), 0 0 10px rgba(214, 242, 74, .35) !important; }',
    P + ' .btn { border-radius: 8px !important; }',
    P + ' .btn-success { background-color: var(--vl-acento) !important; color: var(--vl-acento-txt) !important; border-color: var(--vl-acento) !important; font-weight: 700; }',
    P + ' *::-webkit-scrollbar { width: 8px; height: 8px; } ' + P + ' *::-webkit-scrollbar-track { background-color: var(--vl-f0); } ' + P + ' *::-webkit-scrollbar-thumb { background-color: #4a5a1f; border-radius: 8px; } ' + P + ' *::-webkit-scrollbar-thumb:hover { background-color: var(--vl-acento); }',
    H + '.nitro-toolbar { background-color: rgba(14, 18, 25, .94) !important; box-shadow: 0 -1px 0 var(--vl-acento), 0 -8px 22px rgba(214, 242, 74, .12) !important; }',
    H + '.nitro-room-chatinput-component .chatinput-container { border-radius: 6px !important; border: 1px solid rgba(214, 242, 74, .35) !important; box-shadow: 0 4px 16px rgba(0, 0, 0, .45) !important; }',
    H + '.nitro-room-chatinput-component .chatinput-container::before { display: none !important; }',
    // Botões da mídia no campo de chat: escuros no campo branco do jogo, limão no campo escuro do tema.
    H + '.vl-chat-botoes button:not(.ativo):not(.gravando) { color: #d6f24a; } ' + H + '.vl-chat-botoes button:not(.ativo):not(.gravando):hover { background: rgba(214, 242, 74, .16); }',
    H + '.nitro-room-chatinput-component .chatstyles-selector { border-radius: 6px !important; border-color: rgba(214, 242, 74, .35) !important; }',
    H + '.nitro-room-chatinput-component .chatinput-container:focus-within { border-color: var(--vl-acento) !important; box-shadow: 0 0 0 2px rgba(214, 242, 74, .25), 0 4px 16px rgba(0, 0, 0, .45) !important; }',
    H + '.nitro-purse-container, ' + H + '.nitro-purse { background-color: rgba(21, 26, 36, .94) !important; border: 1px solid rgba(214, 242, 74, .28) !important; border-radius: 10px !important; }',
    H + '.nitro-infostand { background-color: rgba(21, 26, 36, .95) !important; border: 1px solid rgba(214, 242, 74, .28) !important; border-left: 3px solid var(--vl-acento) !important; border-radius: 10px !important; }',
    H + '[class*=nitro-infostand] .btn-dark { background-color: var(--vl-f2) !important; color: var(--vl-texto) !important; border: 1px solid rgba(214, 242, 74, .35) !important; border-radius: 6px !important; }',
    H + '[class*=nitro-infostand] .btn-dark:hover { background-color: var(--vl-acento) !important; color: var(--vl-acento-txt) !important; }',
    H + '.nitro-context-menu { background-color: rgba(21, 26, 36, .96) !important; border: 1px solid rgba(214, 242, 74, .35) !important; border-radius: 10px !important; }',
    H + '.nitro-context-menu .menu-header { background-color: transparent !important; color: var(--vl-acento) !important; border-bottom: 1px solid rgba(214, 242, 74, .35) !important; }',
    H + '.nitro-context-menu > div:hover { color: var(--vl-acento) !important; }',
    H + '.nitro-notification-bubble { border: 1px solid rgba(214, 242, 74, .25) !important; border-radius: 10px !important; }',
    P + ', ' + P + ' * { scrollbar-color: #6b8424 var(--vl-f0) !important; }',
    H + '.nitro-infostand .motto-container { background-color: rgba(214, 242, 74, .08) !important; border: 1px solid rgba(214, 242, 74, .4) !important; border-radius: 8px !important; }',
    H + '.nitro-infostand .motto-container .motto-content, ' + H + '.nitro-infostand .motto-container .motto-content * { color: #eef7c4 !important; }',
    H + '.nitro-friends-messenger .messenger-line { background: linear-gradient(var(--vl-acento), var(--vl-acento)) center / 100% 1px no-repeat !important; }',
    // Balões do bate-papo: o jogo desenha o fundo branco com border-image (".message-bubble") e a
    // pontinha com uma imagem no ::before do grupo. "messages-group-left" é a própria fala (o jogo
    // põe o próprio avatar ao lado); "right" é a do outro. Cores sólidas, para a pontinha casar.
    H + '.nitro-friends-messenger .message-bubble { border-image: none !important; border: 1px solid #36425a !important; border-radius: 8px !important; background-color: #232c3c !important; color: var(--vl-texto) !important; box-shadow: 0 2px 6px rgba(0, 0, 0, .35) !important; line-height: 1.35 !important; }',
    H + '.nitro-friends-messenger .message-bubble .text-break { color: var(--vl-texto) !important; }',
    H + '.nitro-friends-messenger .messages-group-left .message-bubble { background-color: #2b3520 !important; border-color: #5d7222 !important; }',
    H + '.nitro-friends-messenger .messages-group-left .message-bubble .text-break { color: #f1f8d2 !important; }',
    H + '.nitro-friends-messenger .messages-group-left::before, ' + H + '.nitro-friends-messenger .messages-group-right::before { background-image: none !important; width: 0 !important; height: 0 !important; border-top: 5px solid transparent !important; border-bottom: 5px solid transparent !important; }',
    H + '.nitro-friends-messenger .messages-group-left::before { border-right: 6px solid #5d7222 !important; left: -6px !important; }',
    H + '.nitro-friends-messenger .messages-group-right::before { border-left: 6px solid #36425a !important; right: -6px !important; left: auto !important; }',
    H + '.nitro-friends-messenger .message-bubble .username { color: var(--vl-suave) !important; }',
    H + '.nitro-friends-messenger .messages-group-left .message-bubble .username { color: var(--vl-acento) !important; }',
    H + '.nitro-friends-messenger .message-bubble-time { color: var(--vl-suave) !important; font-size: 10px !important; }',
    H + '.nitro-room-chatinput-component .chatstyles-selector { border-color: rgba(214, 242, 74, .35) !important; }',
    H + '.nitro-room-chatinput-component .chatstyles-selector::before { background: var(--vl-acento); box-shadow: 0 0 8px rgba(214, 242, 74, .5); }',
    H + '.nitro-room-chatinput-component .chatstyles-selector::after { border-top-color: var(--vl-acento); }',
    // Lista de estilos de balão (popover do jogo, lido no código do cliente):
    // .popover.nitro-chat-style-selector-container > .bg-transparent > grade > .bubble-parent-container > .bubble-container > .chat-bubble.bubble-N
    H + '.nitro-chat-style-selector-container { background-color: rgba(21, 26, 36, .97) !important; background-image: none !important; border-image: none !important; border: 1px solid rgba(214, 242, 74, .4) !important; border-radius: 10px !important; padding: 6px !important; box-shadow: 0 12px 28px rgba(0, 0, 0, .55), 0 0 16px rgba(214, 242, 74, .14) !important; }',
    H + '.nitro-chat-style-selector-container > *, ' + H + '.nitro-chat-style-selector-container .bg-transparent { background-color: transparent !important; }',
    // Todos os balões à vista, sem rolagem: a janela cresce e a grade vira 6 colunas.
    H + '.nitro-chat-style-selector-container { width: auto !important; max-width: none !important; height: auto !important; max-height: none !important; }',
    H + '.nitro-chat-style-selector-container > *:not(.popover-arrow):not(.arrow), ' + H + '.nitro-chat-style-selector-container .bg-transparent, ' + H + '.nitro-chat-style-selector-container .bg-transparent > * { width: auto !important; height: auto !important; max-height: none !important; overflow: visible !important; }',
    H + '.nitro-chat-style-selector-container .bg-transparent > * { display: grid !important; grid-template-columns: repeat(6, 64px) !important; grid-auto-rows: 36px !important; gap: 4px !important; }',
    H + '.nitro-chat-style-selector-container .bubble-parent-container { box-sizing: border-box !important; width: 64px !important; height: 36px !important; min-height: 0 !important; overflow: hidden !important; }',
    H + '.nitro-chat-style-selector-container .bubble-parent-container { border-radius: 8px !important; padding: 4px 2px !important; background-color: rgba(255, 255, 255, .035) !important; border: 1px solid rgba(255, 255, 255, .06) !important; transition: background-color .12s ease, border-color .12s ease, box-shadow .12s ease; }',
    H + '.nitro-chat-style-selector-container .bubble-parent-container:hover { background-color: rgba(214, 242, 74, .13) !important; border-color: rgba(214, 242, 74, .6) !important; box-shadow: 0 0 10px rgba(214, 242, 74, .25) !important; }',
    H + '.nitro-chat-style-selector-container, ' + H + '.nitro-chat-style-selector-container * { scrollbar-color: #6b8424 var(--vl-f0) !important; }',
    H + '.nitro-chat-style-selector-container *::-webkit-scrollbar { width: 8px; } ' + H + '.nitro-chat-style-selector-container *::-webkit-scrollbar-track { background-color: var(--vl-f0); border-radius: 8px; } ' + H + '.nitro-chat-style-selector-container *::-webkit-scrollbar-thumb { background-color: #6b8424; border-radius: 8px; }',
    H + '.nitro-chat-style-selector-container .popover-arrow::before, ' + H + '.nitro-chat-style-selector-container .arrow::before { border-top-color: rgba(214, 242, 74, .55) !important; }',
    H + '.nitro-chat-style-selector-container .popover-arrow::after, ' + H + '.nitro-chat-style-selector-container .arrow::after { border-top-color: rgb(21, 26, 36) !important; }',
    // Caixas recolhíveis da coluna da direita (Quartel do Grupo e afins; 2026-11-20, pedido do usuário).
    // Classes lidas no cliente: .purse-collapse.content.(down|left) > .header (.icon, .header-text,
    // .collapse-button) + .m-2 (.group-badge, nome, botão .btn-secondary). O fundo era border-image.
    H + '.nitro-right-side .purse-collapse { border-image: none !important; background: rgba(21, 26, 36, .94) !important; border: 1px solid rgba(214, 242, 74, .26) !important; border-radius: 12px !important; box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08), 0 6px 18px rgba(0, 0, 0, .32) !important; overflow: hidden; }',
    H + '.nitro-right-side .purse-collapse .header { height: 30px !important; padding: 0 9px !important; }',
    H + '.nitro-right-side .purse-collapse.down .header { border-bottom: 1px solid rgba(214, 242, 74, .18); background: linear-gradient(90deg, rgba(214, 242, 74, .10), transparent 70%); }',
    H + '.nitro-right-side .purse-collapse .header .header-text { color: #d6f24a !important; letter-spacing: .2px; text-shadow: 0 0 8px rgba(214, 242, 74, .35); }',
    H + '.nitro-right-side .purse-collapse .header .collapse-button { background-image: none !important; width: 18px !important; height: 18px !important; border-radius: 6px; border: 1px solid rgba(214, 242, 74, .35); display: flex; align-items: center; justify-content: center; transition: background-color .15s ease; }',
    H + '.nitro-right-side .purse-collapse .header .collapse-button::before { content: ""; width: 5px; height: 5px; border-right: 2px solid #d6f24a; border-bottom: 2px solid #d6f24a; transform: translateY(-1px) rotate(45deg); transition: transform .2s ease; }',
    H + '.nitro-right-side .purse-collapse .header .collapse-button.left::before { transform: translateX(1px) rotate(135deg); }',
    H + '.nitro-right-side .purse-collapse .header:hover .collapse-button { background-color: rgba(214, 242, 74, .16); }',
    H + '.nitro-right-side .purse-collapse .m-2 { margin: 9px !important; gap: 9px !important; }',
    H + '.nitro-right-side .purse-collapse .group-badge { border-radius: 50%; background-color: rgba(255, 255, 255, .06) !important; box-shadow: 0 0 0 2px rgba(214, 242, 74, .55), 0 0 14px rgba(214, 242, 74, .25); flex: 0 0 auto; }',
    H + '.nitro-right-side .purse-collapse .m-2 > .cursor-pointer { padding: 4px; border-radius: 10px; transition: background-color .15s ease; }',
    H + '.nitro-right-side .purse-collapse .m-2 > .cursor-pointer:hover { background-color: rgba(214, 242, 74, .08); }',
    H + '.nitro-right-side .purse-collapse .m-2 > .cursor-pointer:hover .text-white { color: #d6f24a !important; }',
    H + '.nitro-right-side .purse-collapse .m-2 .btn-secondary, ' + H + '.nitro-right-side .purse-collapse .m-2 .btn-secondary.w-100 { outline: none !important; background-image: none !important; border-image: none !important; background-color: rgba(214, 242, 74, .08) !important; color: #e9f5c0 !important; border: 1px solid rgba(214, 242, 74, .45) !important; border-radius: 9px !important; padding: 5px 8px !important; transition: background-color .15s ease, color .15s ease; }',
    H + '.nitro-right-side .purse-collapse .m-2 .btn-secondary.w-100:hover:not(:disabled), ' + H + '.nitro-right-side .purse-collapse .m-2 .btn-secondary:hover:not(:disabled) { background-color: #d6f24a !important; color: #12161f !important; }',
    H + '.nitro-right-side .purse-collapse .btn-secondary:disabled { opacity: .55; }',
  ]);
  // Coluna da direita em vidro (2026-11-20, pedido do usuário): carteira, moedas da temporada e balões
  // (rádio, avisos) translúcidos, com desfoque do quarto atrás e filete limão. Classes do cliente:
  // .nitro-purse-container > .nitro-purse e .nitro-purse-seasonal-currency; .nitro-notification-bubble.
  // Vem depois do tema e vence as cores sólidas dele (inclusive as caixas marcadas pela varredura).
  const RS = 'html body .nitro-right-side ';
  const VIDRO = [
    RS + '.nitro-purse-container { background: transparent !important; border: 0 !important; box-shadow: none !important; }',
    RS + '.nitro-purse, ' + RS + '.nitro-purse-seasonal-currency, ' + RS + '.nitro-notification-bubble {'
      + ' background: linear-gradient(160deg, rgba(38, 48, 66, .62), rgba(14, 18, 25, .48)) !important;'
      + ' -webkit-backdrop-filter: blur(9px) saturate(1.35); backdrop-filter: blur(9px) saturate(1.35);'
      + ' border: 1px solid rgba(214, 242, 74, .26) !important; border-radius: 12px !important;'
      + ' box-shadow: inset 0 1px 0 rgba(255, 255, 255, .10), 0 6px 18px rgba(0, 0, 0, .32) !important; }',
    RS + '.nitro-purse { margin-top: 4px !important; }',
    RS + '.purse-collapse { background: linear-gradient(160deg, rgba(38, 48, 66, .62), rgba(14, 18, 25, .48)) !important; -webkit-backdrop-filter: blur(9px) saturate(1.35); backdrop-filter: blur(9px) saturate(1.35); }',
    RS + '.nitro-purse-seasonal-currency { height: auto !important; min-height: 30px; padding: 3px 4px 3px 0 !important; }',
    RS + '.nitro-purse-seasonal-currency .currency-icon { border-radius: 9px !important; border-color: rgba(214, 242, 74, .35) !important; top: 0 !important; height: 26px !important; }',
    RS + '.nitro-purse-seasonal-currency .text-white:not(.currency-amount) { color: #d6f24a !important; }',
    RS + '.nitro-purse .nitro-purse-button:hover, ' + RS + '.nitro-purse .nitro-purse-subscription { background-color: rgba(214, 242, 74, .10) !important; }',
    RS + '.nitro-purse .nitro-purse-button { border-radius: 8px !important; }',
    RS + '.vl-fundo-claro, ' + RS + '.purse-collapse .w-100.justify-content-center { background-color: rgba(255, 255, 255, .07) !important; border: 1px solid rgba(214, 242, 74, .30) !important; border-radius: 9px !important; }',
    RS + '.vl-fundo-claro:hover, ' + RS + '.purse-collapse .w-100.justify-content-center:hover { background-color: rgba(214, 242, 74, .16) !important; }',
    RS + 'input[type=range] { accent-color: #d6f24a; }',
  ].join(' ');
  const TEMAS = {
    nenhum: '',
    vagalume: VAGALUME.join('\n'),
  };

  function montarRegras(opcoes) {
    const regras = [];
    if (opcoes.ocultarCarteira) regras.push(jogo.seletor('carteira') + ' { display: none !important; }');
    if (opcoes.ocultarCursor) regras.push(jogo.seletor('quarto') + ' { cursor: none !important; }');
    if (opcoes.textoSelecionavel) {
      regras.push('.chat-content, .chat-content *, .nitro-card .content-area, .nitro-card .content-area *, .nitro-infostand, .nitro-infostand * { user-select: text !important; -webkit-user-select: text !important; }');
    }
    if (opcoes.toolbarTranslucido) {
      regras.push('.nitro-toolbar { opacity: .5 !important; transition: opacity .15s ease; } .nitro-toolbar:hover, .nitro-toolbar:focus-within { opacity: 1 !important; }');
    }
    if (opcoes.menusTranslucidos) {
      regras.push('.nitro-widget-high-score, .nitro-context-menu { opacity: .6 !important; } .nitro-widget-high-score:hover, .nitro-context-menu:hover { opacity: 1 !important; }');
    }
    const ocultos = Object.keys(ICONES).filter((chave) => opcoes[chave]).map((chave) => '.nitro-toolbar .' + ICONES[chave]);
    if (ocultos.length) regras.push(ocultos.join(', ') + ' { display: none !important; }');
    const filtro = FILTROS[opcoes.filtro] || '';
    if (filtro) regras.push(jogo.seletor('quarto') + ' { filter: ' + filtro + ' !important; }');
    if (TEMAS[opcoes.tema]) regras.push(TEMAS[opcoes.tema]);
    if (opcoes.tema === 'vagalume' && opcoes.colunaVidro) regras.push(VIDRO);
    // Conferidos ao vivo: o infostand é `.nitro-infostand-container > … > .nitro-infostand`, a prévia do
    // mobi nele é `.furni-image`, e na loja o "Presentear" é o botão que vem logo antes do "Comprar".
    if (opcoes.ocultarInfostands) regras.push('.nitro-infostand-container { display: none !important; }');
    else if (opcoes.minificarInfostand) regras.push('.nitro-infostand .furni-image { display: none !important; }');
    // Setas das pontas da barra de baixo (conferidas ao vivo): recolher a barra e a barra de amigos.
    if (opcoes.ocultarSetaEsquerda) regras.push('.toolbar-home-bar-button { display: none !important; }');
    if (opcoes.ocultarSetaDireita) regras.push('.toolbar-friend-bar-button { display: none !important; }');
    // Animação dos ícones ao passar o mouse: a folha do jogo não pôde ser lida; a regra desliga transições e transformações dos botões.
    if (opcoes.semAnimacaoBarra) regras.push('.nitro-toolbar .navigation-item, .nitro-toolbar .navigation-item:hover { transition: none !important; transform: none !important; animation: none !important; }');
    // A rádio do Habblet é um balão da coluna da direita com .radio-item e um <audio> (conferido ao vivo).
    if (opcoes.botaoLateral) regras.push('.nitro-right-side { transition: transform .2s ease !important; } html[data-vl-lateral-recolhida] .nitro-right-side { transform: translateX(calc(100% + 12px)) !important; }');
    if (opcoes.ocultarRadio) regras.push('.nitro-notification-bubble:has(.radio-item) { display: none !important; }');
    if (opcoes.missaoClicavel) regras.push('html body .nitro-infostand .motto-container [data-vl-link], html body .nitro-infostand [data-vl-link], html body .profile-bar > [data-vl-link] { color: #d6f24a !important; text-decoration: underline !important; cursor: pointer !important; }');
    if (opcoes.ocultarRodapeAmigos) regras.push('.nitro-friends > .footer { display: none !important; }');
    if (opcoes.atalhosNoQuadro) regras.push('.vl-atalhos-quadro { display: flex; flex-wrap: wrap; gap: 3px; padding: 4px 6px 6px; } .vl-atalhos-quadro:empty { display: none; } .vl-atalhos-quadro > button { flex: 1 1 auto; font: 600 10px/1.2 inherit; padding: 3px 6px; border-radius: 5px; border: 1px solid #5d7222; background: #1b2330; color: #e9f5c0; cursor: pointer; } .vl-atalhos-quadro > button:hover { background: #2b3520; border-color: #d6f24a; color: #d6f24a; }'
      + ' .vl-acoes-quadro { display: flex; flex-wrap: nowrap; justify-content: flex-end; gap: 5px; pointer-events: auto; }'
      + ' .vl-acoes-quadro > button { flex: none; white-space: nowrap; font: 700 12px/1.2 inherit; padding: 5px 10px; border-radius: 7px; border: 1.5px solid #d6f24a; background: #12161f; color: #e9f5c0; cursor: pointer; box-shadow: 0 2px 6px rgba(0, 0, 0, .5); }'
      + ' .vl-acoes-quadro > button:hover { background: #d6f24a; color: #12161f; }'
      + ' .vl-bussola { position: absolute; right: calc(100% + 6px); bottom: 0; display: grid; grid-template-columns: repeat(3, 24px); grid-auto-rows: 24px; gap: 2px; padding: 4px; border-radius: 9px; border: 1px solid #5d7222; background: linear-gradient(180deg, rgba(27, 35, 48, .96), rgba(14, 18, 26, .96)); box-shadow: 0 4px 14px rgba(0, 0, 0, .45), 0 0 10px rgba(214, 242, 74, .12); pointer-events: auto; }'
      + ' .vl-bussola > button { padding: 0; border-radius: 6px; border: 1px solid #3a4658; background: #1b2330; color: #d6f24a; font: 700 13px/1 system-ui, sans-serif; cursor: pointer; }'
      + ' .vl-bussola > button:hover { background: #2b3520; border-color: #d6f24a; }'
      + ' .vl-bussola > span { display: grid; place-items: center; color: #d6f24a; filter: drop-shadow(0 0 4px rgba(214, 242, 74, .55)); }');
    if (opcoes.removerPresentear) regras.push('.nitro-catalog .content > .btn-secondary.flex-fill:has(+ .btn-success) { display: none !important; }');
    return regras;
  }

  // Pausa a rádio do Habblet quando ela aparece. Escondida, fica pausada (se voltar a tocar, pausa de novo).
  function cuidarDaRadio(ctx, sempre) {
    const vistos = new WeakSet();
    function olhar() {
      document.querySelectorAll('.nitro-notification-bubble audio').forEach(function (audio) {
        if (!audio.closest('.nitro-notification-bubble').querySelector('.radio-item')) return;
        if (!vistos.has(audio)) {
          vistos.add(audio);
          try { audio.pause(); } catch (erro) { /* nada */ }
          if (sempre) ctx.escutar(audio, 'play', function () { try { audio.pause(); } catch (erro) { /* nada */ } });
        }
      });
    }
    olhar();
    const observador = new MutationObserver(olhar);
    observador.observe(document.body, { childList: true, subtree: true });
    ctx.aoParar(function () { observador.disconnect(); });
  }
  // Varredura dos temas escuros: nas janelas do jogo, marca o que ainda tem fundo claro (vl-fundo-claro)
  // e o texto escuro sobre fundo escuro (vl-texto-escuro). Pega as partes que o jogo desenha e que
  // não têm regra própria. Deixa de fora destaques coloridos de propósito (amarelo, rosa, verde, limão).
  const AREAS_DO_TEMA = '.nitro-card, .nitro-notification-bubble, .nitro-infostand, .nitro-context-menu, .nitro-right-side';
  function cor(c) {
    const m = String(c).match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    const a = m.length > 3 ? Number(m[3]) : 1;
    return { r: +m[0], g: +m[1], b: +m[2], a };
  }
  function luz(c) { return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255; }
  function cinzento(c) { return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 28; } // branco ou cinza, não colorido
  function temTexto(el) { for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true; return false; }
  function fundoEfetivo(el) {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const c = cor(getComputedStyle(p).backgroundColor);
      if (c && c.a >= 0.5) return c;
    }
    return null;
  }
  function varrerClaros(ctx) {
    let relogio = null;
    function varrer() {
      relogio = null;
      for (const area of document.querySelectorAll(AREAS_DO_TEMA)) {
        for (const el of area.querySelectorAll('*')) {
          if (el.classList.contains('vl-fundo-claro')) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 6 || r.height < 6) continue;
          const s = getComputedStyle(el);
          const fundo = cor(s.backgroundColor);
          const texto = temTexto(el);
          const claro = fundo && fundo.a >= 0.5 && cinzento(fundo) && luz(fundo) > 0.78;
          const desenhado = texto && r.width > 30 && r.height <= 44 && (/url\(/.test(s.backgroundImage) || s.borderImageSource !== 'none');
          if ((claro && (texto || r.width > 24)) || desenhado) { el.classList.add('vl-fundo-claro'); continue; }
          if (texto && !el.classList.contains('vl-texto-escuro')) {
            const c = cor(s.color);
            const atras = fundoEfetivo(el);
            if (c && luz(c) < 0.3 && atras && luz(atras) < 0.35) el.classList.add('vl-texto-escuro');
          }
        }
      }
    }
    const observador = new MutationObserver(function () { if (!relogio) relogio = setTimeout(varrer, 350); });
    observador.observe(document.body, { childList: true, subtree: true });
    relogio = setTimeout(varrer, 350);
    ctx.aoParar(function () {
      observador.disconnect();
      clearTimeout(relogio);
      document.querySelectorAll('.vl-fundo-claro, .vl-texto-escuro').forEach((e) => e.classList.remove('vl-fundo-claro', 'vl-texto-escuro'));
    });
  }
  // Vista do hotel à noite: as imagens do jogo (casa, estátua, faixa do logo) são lidas num canvas
  // (o servidor de imagens do Habblet permite: Access-Control-Allow-Origin *), repintadas por
  // VL.noite.pintar e postas de volta por uma regra de estilo. Funciona com qualquer imagem da época.
  const PARTES_VISTA = { left: { luz: 0.9, escuro: 0.42 }, right: { luz: 0.9, escuro: 0.42 }, 'right-repeat': { luz: 0.9, escuro: 0.42 }, drape: { luz: 0.5, escuro: 0.4 } };
  function vistaNoturna(ctx) {
    if (!VL.noite) return;
    const prontas = new Map(); // url original -> Promise<data URL>
    const regras = new Map(); // classe -> data URL
    let removerEstilo = null;
    let relogio = null;
    let parado = false;
    function enderecoDe(el) {
      const m = /url\(["']?(.*?)["']?\)/.exec(el.style.backgroundImage || '');
      return m && /^https:\/\//.test(m[1]) ? m[1] : '';
    }
    function repintar(url, opcoes) {
      if (!prontas.has(url)) {
        prontas.set(url, new Promise(function (resolver, rejeitar) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = function () {
            try {
              const c = document.createElement('canvas');
              c.width = img.naturalWidth;
              c.height = img.naturalHeight;
              const g = c.getContext('2d');
              g.drawImage(img, 0, 0);
              const d = g.getImageData(0, 0, c.width, c.height);
              VL.noite.pintar(d.data, c.width, c.height, opcoes);
              g.putImageData(d, 0, 0);
              resolver(c.toDataURL('image/png'));
            } catch (erro) { rejeitar(erro); }
          };
          img.onerror = function () { rejeitar(new Error('imagem')); };
          img.src = url;
        }));
      }
      return prontas.get(url);
    }
    function aplicar() {
      const css = [...regras].map(([classe, dado]) => VISTA + ' > .' + classe + '[data-vl-noite] { background-image: url("' + dado + '") !important; }').join('\n');
      if (!removerEstilo) removerEstilo = camada.estiloPagina('interface-vista', css);
      else camada.estiloPagina('interface-vista', css);
    }
    function olhar() {
      relogio = null;
      for (const classe of Object.keys(PARTES_VISTA)) {
        const el = document.querySelector('.nitro-hotel-view > .' + classe);
        if (!el) continue;
        const url = enderecoDe(el);
        if (!url) { el.removeAttribute('data-vl-noite'); continue; }
        if (el.getAttribute('data-vl-noite-de') === url) continue;
        el.setAttribute('data-vl-noite-de', url);
        el.removeAttribute('data-vl-noite');
        repintar(url, PARTES_VISTA[classe]).then(function (dado) {
          if (parado || el.getAttribute('data-vl-noite-de') !== url) return;
          regras.set(classe, dado);
          aplicar();
          el.setAttribute('data-vl-noite', '');
        }, function () { /* fica o filtro de reserva */ });
      }
    }
    const observador = new MutationObserver(function () { if (!relogio) relogio = setTimeout(olhar, 250); });
    observador.observe(document.body, { childList: true, subtree: true });
    olhar();
    ctx.aoParar(function () {
      parado = true;
      observador.disconnect();
      clearTimeout(relogio);
      if (removerEstilo) removerEstilo();
      document.querySelectorAll('[data-vl-noite-de]').forEach((e) => { e.removeAttribute('data-vl-noite'); e.removeAttribute('data-vl-noite-de'); });
    });
  }
  // Endereço na missão de alguém: marca o texto (data-vl-link) e abre numa aba nova ao clicar.
  // Não muda o texto que o jogo desenhou. A própria missão fica de fora: clicar nela é editar.
  const ENDERECO = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i;
  function enderecoDaMissao(texto) {
    const m = ENDERECO.exec(String(texto || ''));
    if (!m) return null;
    let url = m[0].replace(/[),.;!?]+$/, '');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      const u = new URL(url);
      return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
    } catch (erro) { return null; }
  }
  // Abre numa aba nova ou numa janela pop-up do navegador, centralizada sobre o Habblet.
  function abrirLink(url, modo) {
    if (modo === 'janela') {
      // deitada (retangular), sem passar do tamanho da tela
      const l = Math.min(960, Math.max(480, (screen.availWidth || 1280) - 80));
      const a = Math.min(600, Math.max(400, (screen.availHeight || 800) - 80));
      const x = Math.round((window.screenX || 0) + ((window.outerWidth || l) - l) / 2);
      const y = Math.round((window.screenY || 0) + ((window.outerHeight || a) - a) / 2);
      window.open(url, 'vl-missao', 'popup=yes,noopener,noreferrer,width=' + l + ',height=' + a + ',left=' + x + ',top=' + y);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  // Visor: página da extensão (src/visor) por cima do Habblet, com o site dentro. Fecha com Esc,
  // clicando fora ou pelo botão do visor (mensagem visor:fechar).
  let visorAberto = null;
  function abrirNoVisor(ctx, url) {
    if (visorAberto) visorAberto();
    const el = camada.el;
    const quadro = el('iframe', { class: 'vl-visor', title: 'Visor do Vagalume', allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write', src: chrome.runtime.getURL('src/visor/visor.html') + '?u=' + encodeURIComponent(url) });
    const veu = el('div', { class: 'vl-veu' }, [quadro]);
    function aoMensagem(ev) { if (ev.source === quadro.contentWindow && ev.data && ev.data.vagalume === 'visor:fechar') fechar(); }
    function aoTeclar(ev) { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); fechar(); } }
    function fechar() {
      window.removeEventListener('message', aoMensagem);
      window.removeEventListener('keydown', aoTeclar, true);
      try { quadro.src = 'about:blank'; } catch (erro) { /* nada */ }
      veu.remove();
      visorAberto = null;
    }
    veu.addEventListener('mousedown', function (ev) { if (ev.target === veu) fechar(); });
    window.addEventListener('message', aoMensagem);
    window.addEventListener('keydown', aoTeclar, true);
    camada.area().appendChild(veu);
    visorAberto = fechar;
    ctx.aoParar(function () { if (visorAberto) visorAberto(); });
  }
  function missaoClicavel(ctx) {
    function nomeDoQuadro(quadro) {
      const n = quadro.querySelector('.fw-bold');
      return n ? n.textContent.trim() : '';
    }
    function marcar() {
      const eu = VL.pessoas && VL.pessoas.eu ? VL.pessoas.eu() : null;
      document.querySelectorAll('.nitro-infostand .motto-content > *').forEach(function (el) {
        const quadro = el.closest('.nitro-infostand');
        const url = eu && nomeDoQuadro(quadro) === eu ? null : enderecoDaMissao(el.textContent);
        if (url) { if (el.dataset.vlLink !== url) el.dataset.vlLink = url; } else if (el.dataset.vlLink) delete el.dataset.vlLink;
      });
      // Missão no perfil (pedido do usuário em 2026-11-15). Estrutura lida no código do cliente:
      // .profile-bar > .text-row.w-50.text-truncate com a missão. Ali clicar não edita, então vale
      // também para o próprio perfil.
      document.querySelectorAll('.profile-bar > .text-truncate').forEach(function (el) {
        const url = enderecoDaMissao(el.textContent);
        if (url) { if (el.dataset.vlLink !== url) el.dataset.vlLink = url; } else if (el.dataset.vlLink) delete el.dataset.vlLink;
      });
    }
    const observador = new MutationObserver(marcar);
    observador.observe(document.body, { childList: true, subtree: true, characterData: true });
    marcar();
    ctx.escutar(document, 'click', function (ev) {
      const el = ev.target && ev.target.closest ? ev.target.closest('[data-vl-link]') : null;
      if (!el || !ev.isTrusted) return;
      ev.preventDefault();
      ev.stopPropagation();
      abrirNoVisor(ctx, el.dataset.vlLink); // só o visor do Vagalume (pedido do usuário em 2026-11-15)
    }, true);
    ctx.aoParar(function () {
      observador.disconnect();
      document.querySelectorAll('[data-vl-link]').forEach((e) => { delete e.dataset.vlLink; });
    });
  }
  // Botão para recolher a coluna da direita do jogo (carteira, moedas especiais, rádio). O estado
  // fica neste navegador (localStorage 'vl.lateralRecolhida'), só por conveniência.
  // Atalhos no quadro de informações de uma pessoa (o quadro do canto que abre ao clicar no avatar).
  // Estrutura conferida ao vivo em 2026-11-14: `.nitro-infostand` com `.body-image .avatar-image` e o
  // apelido em `.goldfish.fw-bold` (o quadro de mobi tem `.furni-image`). Os botões chamam comandos da
  // próprio Vagalume; os que dependem de módulo desligado não aparecem.
  function atalhosNoQuadro(ctx) {
    const comandos = nucleo.comandos;
    if (!comandos || !comandos.achar) return;
    function prefixo() { return VL.comandos ? VL.comandos.inicioDigitado(ctx.secao('comandos').prefixo) : '/'; }
    function rodar(nome, args) {
      const c = comandos.achar(nome);
      if (c) c.executar({ nome, args, resto: args.join(' ') });
    }
    function escrever(texto) {
      const campo = jogo.entradaChat();
      if (!campo) { camada.aviso('Entre num quarto para usar o chat.', { tipo: 'erro' }); return; }
      jogo.definirValor(campo, texto);
      campo.focus();
    }
    function silenciado(nome) {
      const lista = (ctx.config().silenciar || {}).apelidos || [];
      return lista.some((n) => String(n).toLowerCase() === nome.toLowerCase());
    }
    function botoes(nome) {
      const eu = VL.pessoas && VL.pessoas.eu ? VL.pessoas.eu() : null;
      const souEu = !!eu && String(eu).toLowerCase() === nome.toLowerCase();
      // Pedido do usuário (2026-11-14): sem o botão de copiar apelido; Visual veste o visual da pessoa
      // pelo Vagalume (comando copiarvisual, mensagem de vestir do jogo), não pelo :copy do Habblet.
      const lista = [];
      if (!souEu) {
        if (comandos.achar('copiarvisual')) lista.push({ rotulo: 'Copiar Visual', dica: 'Vestir o visual desta pessoa (pelo Vagalume)', fazer() { rodar('copiarvisual', [nome]); } });
        // "Acompanhar" liga e desliga (pedido do usuário em 2026-11-16).
        if (comandos.achar('acompanhar')) {
          const seguindo = VL.pessoas && VL.pessoas.acompanhando && String(VL.pessoas.acompanhando() || '').toLowerCase() === nome.toLowerCase();
          lista.push({ rotulo: seguindo ? 'Parar' : 'Acompanhar', dica: seguindo ? 'Parar de andar atrás desta pessoa' : 'Andar atrás desta pessoa (clique de novo para parar)', fazer() { rodar('acompanhar', seguindo ? [] : [nome]); setTimeout(cuidar, 300); } });
        }
        // Sussurrar saiu (2026-11-20, pedido do usuário): o próprio menu do jogo já tem.
        if (comandos.achar('msg') && VL.amigos && VL.amigos.eAmigo && VL.amigos.eAmigo(nome)) lista.push({ rotulo: 'Mensagem', dica: 'Mensagem privada pelo console', fazer() { escrever(prefixo() + 'msg ' + nome + ' '); } });
        if (comandos.achar('silenciar')) {
          const sil = silenciado(nome);
          lista.push({ rotulo: sil ? 'Liberar' : 'Silenciar', dica: sil ? 'Voltar a mostrar as falas' : 'Esconder as falas só na sua tela', fazer() { rodar(sil ? 'liberar' : 'silenciar', [nome]); setTimeout(cuidar, 400); } });
        }
      }
      return lista;
    }
    // Ações do Habblet com a pessoa (o servidor faz e todos veem): comandos do Vagalume no módulo Comandos.
    const ACOES = [['empurrar', 'Empurrar'], ['puxar', 'Puxar'], ['abracar', 'Abraçar'], ['beijar', 'Beijar'], ['socar', 'Socar']];
    function acoes(nome) {
      const tipo = VL.pessoas && VL.pessoas.tipoDe ? VL.pessoas.tipoDe(nome) : null;
      if (tipo != null && tipo !== 1) return []; // bots e pets: sem ações
      return ACOES.filter((a) => comandos.achar(a[0])).map((a) => ({ rotulo: a[1], dica: a[1] + ' ' + nome, fazer() { rodar(a[0], [nome]); } }));
    }
    // A fileira de ações fica fora do quadro, logo abaixo dele: é o último item da coluna do jogo
    // (.nitro-infostand-container, flex em coluna presa ao canto de baixo), então o quadro sobe.
    function filaDeAcoes(quadro, nome, lista) {
      const coluna = quadro.parentElement;
      let fila = coluna ? coluna.querySelector(':scope > .vl-acoes-quadro') : null;
      const chave = nome + '|' + lista.length;
      if (!lista.length || !coluna) { if (fila) fila.remove(); return; }
      if (!fila || fila.dataset.chave !== chave) {
        if (fila) fila.remove();
        fila = document.createElement('div');
        fila.className = 'vl-acoes-quadro';
        fila.dataset.chave = chave;
        for (const b of lista) {
          const botao = document.createElement('button');
          botao.type = 'button';
          botao.textContent = b.rotulo;
          botao.title = b.dica + ' (comando do Habblet, pelo Vagalume)';
          botao.addEventListener('click', function (ev) { ev.stopPropagation(); b.fazer(); });
          fila.appendChild(botao);
        }
      }
      if (coluna.lastElementChild !== fila) coluna.appendChild(fila);
    }
    // Setas para virar o próprio avatar (no lugar do Shift+setas).
    const LADOS = [['no', '↖'], ['cima', '↑'], ['ne', '↗'], ['esquerda', '←'], null, ['direita', '→'], ['so', '↙'], ['baixo', '↓'], ['se', '↘']];
    // Ícone do meio da bússola: um olho (é para onde o avatar olha), no lugar da palavra "olhar".
    function olho() {
      const NS = 'http://www.w3.org/2000/svg';
      const meio = document.createElement('span');
      meio.className = 'vl-bussola-olho';
      meio.title = 'Para onde o seu avatar olha';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '18');
      svg.setAttribute('height', '18');
      svg.setAttribute('aria-hidden', 'true');
      const parte = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); svg.appendChild(e); return e; };
      parte('path', { d: 'M2 12 C 5.5 6.5, 18.5 6.5, 22 12 C 18.5 17.5, 5.5 17.5, 2 12 Z', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linejoin': 'round' });
      parte('circle', { cx: '12', cy: '12', r: '3.6', fill: 'currentColor' });
      parte('circle', { cx: '13.2', cy: '10.8', r: '1.1', fill: '#12161f' });
      meio.appendChild(svg);
      return meio;
    }
    function bussola() {
      const caixa = document.createElement('div');
      caixa.className = 'vl-bussola';
      caixa.title = 'Virar o seu avatar (Vagalume)';
      for (const lado of LADOS) {
        if (!lado) { caixa.appendChild(olho()); continue; }
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = lado[1];
        b.title = 'Olhar para ' + lado[0];
        b.addEventListener('click', function (ev) { ev.stopPropagation(); rodar('olhar', [lado[0]]); });
        caixa.appendChild(b);
      }
      return caixa;
    }
    // ---------- Menu do avatar das outras pessoas (2026-11-20, pedido do usuário) ----------
    // Item "Vagalume ›" na página inicial do menu, como "Ações ›": abre uma página com as mesmas
    // funções do quadro (Visual, Acompanhar, Mensagem, Silenciar) e "Voltar". As páginas internas
    // do jogo (Dançar, Ações, Moderar…) sempre têm um item com a seta para a esquerda; é assim que a
    // página inicial é reconhecida. A página do Vagalume esconde os itens do jogo (não os apaga).
    const MENU_AVATAR = '.nitro-context-menu.visible:not(.name-only):not(.nitro-widget-high-score)';
    function paginaInicial(menu) { return !menu.querySelector(':scope > .menu-item .left.fa-icon'); }
    function seta(menu, lado) {
      const modelo = menu.querySelector('.' + lado + '.fa-icon');
      if (modelo) return modelo.cloneNode(true);
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', lado + ' fa-icon');
      svg.setAttribute('viewBox', '0 0 320 512');
      svg.setAttribute('width', '1em'); svg.setAttribute('height', '1em');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', 'currentColor');
      p.setAttribute('d', lado === 'right' ? 'M285.5 273L91.1 467.3c-9.4 9.4-24.6 9.4-33.9 0l-22.7-22.7c-9.4-9.4-9.4-24.5 0-33.9L188.5 256 34.5 101.3c-9.3-9.4-9.3-24.5 0-33.9l22.7-22.7c9.4-9.4 24.6-9.4 33.9 0L285.5 239c9.4 9.4 9.4 24.6 0 34z' : 'M34.5 239L228.9 44.7c9.4-9.4 24.6-9.4 33.9 0l22.7 22.7c9.4 9.4 9.4 24.5 0 33.9L131.5 256l154 154.7c9.3 9.4 9.3 24.5 0 33.9l-22.7 22.7c-9.4 9.4-24.6 9.4-33.9 0L34.5 273c-9.3-9.4-9.3-24.6 0-34z');
      svg.appendChild(p);
      return svg;
    }
    function itemDoMenu(menu, texto, classe, fazer, lado) {
      const modelo = menu.querySelector(':scope > .menu-item.list-item');
      const item = document.createElement('div');
      const base = modelo ? modelo.className.split(/\s+/).filter((c) => c && !c.startsWith('vl-')).join(' ') : 'menu-item list-item';
      item.className = base + ' ' + classe;
      item.setAttribute('role', 'button');
      item.tabIndex = 0;
      if (lado === 'left') item.appendChild(seta(menu, 'left'));
      item.appendChild(document.createTextNode(texto));
      if (lado === 'right') item.appendChild(seta(menu, 'right'));
      const ir = function (ev) { ev.preventDefault(); ev.stopPropagation(); fazer(); };
      item.addEventListener('click', ir);
      item.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') ir(ev); });
      return item;
    }
    function lugarNoMenu(menu) { return menu.querySelector(':scope > .menu-footer'); }
    function voltarDoMenu(menu) {
      menu.querySelectorAll(':scope > .vl-menu-pagina').forEach((e) => e.remove());
      menu.querySelectorAll(':scope > .vl-menu-oculto').forEach((e) => e.classList.remove('vl-menu-oculto'));
      delete menu.dataset.vlPagina;
      cuidarDosMenus();
    }
    function abrirNoMenu(menu, nome) {
      const lista = botoes(nome);
      if (!lista.length) return;
      menu.dataset.vlPagina = nome;
      menu.querySelectorAll(':scope > .menu-item').forEach((e) => e.classList.add('vl-menu-oculto'));
      const antes = lugarNoMenu(menu);
      for (const b of lista) {
        const item = itemDoMenu(menu, b.rotulo, 'vl-menu-pagina', function () { b.fazer(); voltarDoMenu(menu); });
        item.title = b.dica + ' (Vagalume)';
        menu.insertBefore(item, antes);
      }
      menu.insertBefore(itemDoMenu(menu, 'Voltar', 'vl-menu-pagina', function () { voltarDoMenu(menu); }, 'left'), antes);
    }
    function cuidarDosMenus() {
      for (const menu of document.querySelectorAll(MENU_AVATAR)) {
        const cab = menu.querySelector(':scope > .menu-header');
        const nome = cab ? cab.textContent.trim() : '';
        const existente = menu.querySelector(':scope > .vl-menu-vagalume');
        if (menu.dataset.vlPagina) {
          // O jogo redesenhou os itens com a página do Vagalume aberta: esconde de novo os dele.
          if (menu.dataset.vlPagina !== nome) { voltarDoMenu(menu); continue; }
          menu.querySelectorAll(':scope > .menu-item:not(.vl-menu-pagina):not(.vl-menu-oculto)').forEach((e) => e.classList.add('vl-menu-oculto'));
          continue;
        }
        const tipo = nome && VL.pessoas && VL.pessoas.tipoDe ? VL.pessoas.tipoDe(nome) : null;
        const pode = !!nome && (tipo == null || tipo === 1) && paginaInicial(menu) && botoes(nome).length > 0;
        if (!pode) { if (existente) existente.remove(); continue; }
        if (existente && existente.dataset.pessoa === nome) continue;
        if (existente) existente.remove();
        const item = itemDoMenu(menu, 'Vagalume', 'vl-menu-vagalume', function () { abrirNoMenu(menu, nome); }, 'right');
        item.dataset.pessoa = nome;
        item.title = 'Funções do Vagalume para ' + nome;
        menu.insertBefore(item, lugarNoMenu(menu));
      }
    }
    ctx.aoParar(camada.estiloPagina('menu-vagalume', '.vl-menu-oculto { display: none !important; }'));
    function cuidar() {
      try { cuidarDosMenus(); } catch (erro) { console.warn('[Vagalume] Falha no menu do avatar:', erro); }
      // Fileira de ações sem quadro ao lado (o quadro fechou): sai.
      document.querySelectorAll('.vl-acoes-quadro').forEach(function (f) { if (!f.parentElement || !f.parentElement.querySelector(':scope > .nitro-infostand')) f.remove(); });
      // Cada quadro num try: um erro num quadro não pode levar junto os botões e a bússola dos outros.
      document.querySelectorAll('.nitro-infostand').forEach(function (quadro) {
        try { cuidarDoQuadro(quadro); } catch (erro) { console.warn('[Vagalume] Falha ao montar os botões do quadro:', erro); }
      });
    }
    function cuidarDoQuadro(quadro) {
      {
        if (!quadro.querySelector('.body-image .avatar-image')) return;
        const el = quadro.querySelector('.goldfish.fw-bold');
        const nome = el ? el.textContent.trim() : '';
        let linha = quadro.querySelector('.vl-atalhos-quadro');
        if (!nome) { if (linha) linha.remove(); filaDeAcoes(quadro, '', []); return; }
        const eu = VL.pessoas && VL.pessoas.eu ? VL.pessoas.eu() : null;
        const souEu = !!eu && String(eu).toLowerCase() === nome.toLowerCase();
        // Copiar Visual, Acompanhar, Mensagem e Silenciar saíram do quadro (2026-11-20, pedido do
        // usuário): ficam só no item "Vagalume" do menu do avatar.
        const lista = [];
        const listaAcoes = souEu ? [] : acoes(nome);
        const comBussola = souEu && !!comandos.achar('olhar');
        const chave = nome + '|' + lista.map((b) => b.rotulo).join(',') + '|' + comBussola;
        filaDeAcoes(quadro, nome, listaAcoes);
        if (linha && linha.dataset.chave === chave) return;
        if (!linha) { linha = document.createElement('div'); linha.className = 'vl-atalhos-quadro'; quadro.appendChild(linha); }
        linha.dataset.chave = chave;
        linha.textContent = '';
        for (const b of lista) {
          const botao = document.createElement('button');
          botao.type = 'button';
          botao.textContent = b.rotulo;
          botao.title = b.dica + ' (Vagalume)';
          botao.addEventListener('click', function (ev) { ev.stopPropagation(); b.fazer(); });
          linha.appendChild(botao);
        }
        const antiga = quadro.querySelector('.vl-bussola');
        if (antiga) antiga.remove();
        if (comBussola) {
          if (getComputedStyle(quadro).position === 'static') quadro.style.position = 'relative';
          quadro.appendChild(bussola());
        }
      }
    }
    let pendente = false;
    const observador = new MutationObserver(function () {
      if (pendente) return;
      pendente = true;
      setTimeout(function () { pendente = false; cuidar(); }, 150);
    });
    observador.observe(document.body, { childList: true, subtree: true });
    cuidar();
    ctx.aoParar(function () { observador.disconnect(); document.querySelectorAll('.vl-atalhos-quadro, .vl-bussola, .vl-acoes-quadro, .vl-menu-vagalume, .vl-menu-pagina').forEach((e) => e.remove()); document.querySelectorAll('.vl-menu-oculto').forEach((e) => e.classList.remove('vl-menu-oculto')); document.querySelectorAll('[data-vl-pagina]').forEach((e) => { delete e.dataset.vlPagina; }); });
  }

  // Relacionamentos primeiro na lista de amigos. Conferido ao vivo em 2026-11-14: cabeçalhos ("Online",
  // "Offline") e amigos são todos `.friend-row` irmãos em `.friends-container`; o relacionamento é o
  // ícone `icon-heart`, `icon-smile`, `icon-bobba` ou `icon-none`. Só a ordem visual muda (CSS order),
  // dentro de cada grupo; o jogo continua dono da lista.
  const ORDEM_RELACIONAMENTO = { heart: 1, smile: 2, bobba: 3 };
  function ordemDaLinha(linha) {
    const icone = linha.querySelector('[class*="icon-heart"], [class*="icon-smile"], [class*="icon-bobba"]');
    if (!icone) return 4;
    const m = /icon-(heart|smile|bobba)/.exec(String(icone.className.baseVal != null ? icone.className.baseVal : icone.className));
    return m ? ORDEM_RELACIONAMENTO[m[1]] : 4;
  }
  function relacionamentosPrimeiro(ctx) {
    function cuidar() {
      document.querySelectorAll('.nitro-friends .friends-container').forEach(function (caixa) {
        if (caixa.getAttribute('data-vl-relac') == null) caixa.setAttribute('data-vl-relac', '');
        let grupo = 0;
        for (const filho of caixa.children) {
          const amigo = !!filho.querySelector('.icon-profile-sm');
          if (!amigo) grupo++;
          const ordem = String(grupo * 10 + (amigo ? ordemDaLinha(filho) : 0));
          if (filho.style.order !== ordem) filho.style.order = ordem;
        }
      });
    }
    ctx.aoParar(camada.estiloPagina('interface-relac', '.nitro-friends .friends-container[data-vl-relac] { display: flex !important; flex-direction: column; }'));
    let pendente = false;
    const observador = new MutationObserver(function () {
      if (pendente) return;
      pendente = true;
      setTimeout(function () { pendente = false; cuidar(); }, 150);
    });
    observador.observe(document.body, { childList: true, subtree: true });
    cuidar();
    // O relacionamento pode mudar só na classe do ícone (o observador olha linhas novas): passada leve a cada 2 s.
    const relogio = setInterval(function () { if (document.querySelector('.nitro-friends')) cuidar(); }, 2000);
    ctx.aoParar(function () {
      clearInterval(relogio);
      observador.disconnect();
      document.querySelectorAll('.friends-container[data-vl-relac]').forEach(function (c) { c.removeAttribute('data-vl-relac'); for (const f of c.children) f.style.order = ''; });
    });
  }

  function recolherLateral(ctx) {
    const botao = camada.el('button', { class: 'vl-lateral', type: 'button', hidden: '' });
    camada.area().appendChild(botao);
    let recolhida = false;
    try { recolhida = localStorage.getItem('vl.lateralRecolhida') === '1'; } catch (erro) { /* sem armazenamento */ }
    function aplicar() {
      const html = document.documentElement;
      if (recolhida) html.setAttribute('data-vl-lateral-recolhida', ''); else html.removeAttribute('data-vl-lateral-recolhida');
      const coluna = document.querySelector('.nitro-right-side');
      if (!coluna) { botao.hidden = true; return; }
      botao.hidden = false;
      botao.textContent = recolhida ? '‹' : '›';
      botao.title = recolhida ? 'Mostrar a coluna da direita' : 'Recolher a coluna da direita';
      botao.setAttribute('aria-label', botao.title);
      const r = coluna.getBoundingClientRect();
      botao.style.top = Math.max(4, Math.round(r.top) + 6) + 'px';
      botao.style.right = recolhida ? '0px' : Math.max(0, Math.round(window.innerWidth - r.left)) + 'px';
    }
    botao.addEventListener('click', function () {
      recolhida = !recolhida;
      try { localStorage.setItem('vl.lateralRecolhida', recolhida ? '1' : '0'); } catch (erro) { /* sem armazenamento */ }
      aplicar();
    });
    aplicar();
    const relogio = setInterval(aplicar, 2000); // a coluna só aparece depois que o hotel carrega
    ctx.escutar(window, 'resize', aplicar);
    ctx.aoParar(function () { clearInterval(relogio); botao.remove(); document.documentElement.removeAttribute('data-vl-lateral-recolhida'); });
  }

  // Barra do chat solta: Alt+arrastar move a barra (o componente do jogo é fixo na tela; o Vagalume
  // só aplica 'translate'). Alt+duplo clique volta ao lugar. A posição fica neste navegador.
  function chatArrastavel(ctx) {
    const CHAVE = 'vl.chatPosicao';
    let pos = { x: 0, y: 0 };
    try { const g = JSON.parse(localStorage.getItem(CHAVE) || 'null'); if (g && Number.isFinite(g.x) && Number.isFinite(g.y)) pos = g; } catch (erro) { /* sem armazenamento */ }
    function barra() { return document.querySelector('.nitro-room-chatinput-component'); }
    function limitar(p) {
      const b = barra();
      const caixa = b && (b.querySelector('.chatinput-container') || b);
      if (!caixa) return p;
      const r = caixa.getBoundingClientRect();
      const baseX = r.left - (pos.x || 0);
      const baseY = r.top - (pos.y || 0);
      return {
        x: Math.round(Math.min(window.innerWidth - r.width - baseX, Math.max(-baseX, p.x))),
        y: Math.round(Math.min(window.innerHeight - r.height - baseY, Math.max(-baseY, p.y))),
      };
    }
    function aplicar() {
      const b = barra();
      if (!b) return;
      const valor = pos.x || pos.y ? pos.x + 'px ' + pos.y + 'px' : '';
      if (b.style.translate !== valor) b.style.translate = valor;
    }
    function guardar() { try { localStorage.setItem(CHAVE, JSON.stringify(pos)); } catch (erro) { /* sem armazenamento */ } }
    let arraste = null;
    ctx.escutar(window, 'mousedown', function (ev) {
      if (!ev.altKey || ev.button !== 0 || !ev.target || typeof ev.target.closest !== 'function' || !ev.target.closest('.nitro-room-chatinput-component')) return;
      ev.preventDefault();
      ev.stopPropagation();
      arraste = { x: ev.clientX, y: ev.clientY, inicio: { x: pos.x, y: pos.y } };
    }, true);
    ctx.escutar(window, 'mousemove', function (ev) {
      if (!arraste) return;
      pos = limitar({ x: arraste.inicio.x + ev.clientX - arraste.x, y: arraste.inicio.y + ev.clientY - arraste.y });
      aplicar();
    }, true);
    ctx.escutar(window, 'mouseup', function () { if (arraste) { arraste = null; guardar(); } }, true);
    ctx.escutar(window, 'dblclick', function (ev) {
      if (!ev.altKey || !ev.target || typeof ev.target.closest !== 'function' || !ev.target.closest('.nitro-room-chatinput-component')) return;
      pos = { x: 0, y: 0 };
      aplicar();
      guardar();
    }, true);
    // A barra é recriada ao mudar de quarto: reaplica de tempos em tempos.
    const relogio = setInterval(aplicar, 1500);
    aplicar();
    ctx.aoParar(function () { clearInterval(relogio); const b = barra(); if (b) b.style.translate = ''; });
  }

  nucleo.definirModulo({
    id: 'interface',
    // Sem aoConfig: o núcleo reinicia o módulo quando as opções dele mudam.
    iniciar(ctx) {
      if (ctx.secao().atalhosNoQuadro && document.body) atalhosNoQuadro(ctx);
      if (ctx.secao().relacionamentosPrimeiro && document.body) relacionamentosPrimeiro(ctx);
      if (ctx.secao().missaoClicavel && document.body) missaoClicavel(ctx);
      if ((ctx.secao().pausarRadio || ctx.secao().ocultarRadio) && document.body) cuidarDaRadio(ctx, ctx.secao().ocultarRadio);
      if (ctx.secao().tema === 'vagalume' && document.body) { varrerClaros(ctx); vistaNoturna(ctx); }
      if (ctx.secao().botaoLateral && document.body) recolherLateral(ctx);
      if (ctx.secao().chatArrastavel && document.body) chatArrastavel(ctx);
      const regras = montarRegras(ctx.secao());
      if (!regras.length) return undefined;
      return camada.estiloPagina('interface', regras.join('\n'));
    },
  });

  VL.interfaceTela = { enderecoDaMissao, ICONES, FILTROS, TEMAS, montarRegras };
})(typeof globalThis !== 'undefined' ? globalThis : this);
