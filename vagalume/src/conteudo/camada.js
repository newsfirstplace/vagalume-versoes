// Vagalume — camada visual. Tudo o que a extensão desenha sobre o hotel (avisos, diálogos, painel)
// vive em um único elemento com Shadow DOM fechado: o CSS do jogo não entra aqui e o nosso não sai.
// É o único arquivo que cria elementos; os textos entram sempre por textContent, nunca como HTML.
(function (raiz) {
  'use strict';
  const VL = (raiz.VL = raiz.VL || {});
  if (VL.camada) return;

  const ID = 'vagalume-camada';
  const ESTILO_HOST = 'all: initial !important; position: fixed !important; inset: 0 !important; ' +
    'z-index: 2147483600 !important; pointer-events: none !important; display: block !important;';
  // Eventos nascidos dentro da camada param no hospedeiro: os ouvintes do jogo na fase de borbulha
  // não ficam sabendo das teclas e dos cliques feitos no painel.
  const EVENTOS_CONTIDOS = ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'click', 'dblclick',
    'contextmenu', 'wheel', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'input', 'change',
    'copy', 'cut', 'paste'];
  const MAX_AVISOS = 4;

  const CSS = `
.vl-raiz {
  --fundo: #12161f; --superficie: #1b2230; --superficie-2: #242d3d; --borda: #36435c;
  --texto: #e8edf5; --suave: #a9b4c7; --brilho: #d6f24a; --brilho-forte: #e9ff7a;
  --erro: #ffa0a0; --ok: #9be8ad;
  --mono: ui-monospace, "Cascadia Mono", Consolas, "Liberation Mono", monospace;
  position: absolute; inset: 0; overflow: hidden; pointer-events: none;
  font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  color: var(--texto); color-scheme: dark; text-align: left;
}
.vl-raiz *, .vl-raiz *::before, .vl-raiz *::after { box-sizing: border-box; }
.vl-raiz [hidden] { display: none !important; } /* o atributo hidden vence o display das regras abaixo */
.vl-raiz :focus-visible { outline: 2px solid var(--brilho); outline-offset: 2px; }

.vl-avisos { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 30;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  width: max-content; max-width: min(420px, calc(100vw - 24px)); }
.vl-aviso { pointer-events: auto; cursor: pointer; background: var(--superficie); color: var(--texto);
  border: 1px solid var(--borda); border-left: 4px solid var(--brilho); border-radius: 8px;
  padding: 9px 12px; box-shadow: 0 6px 20px rgba(0, 0, 0, .45); white-space: pre-line;
  overflow-wrap: anywhere; animation: vl-entrar .16s ease-out; }
.vl-aviso.erro { border-left-color: var(--erro); }
.vl-aviso.ok { border-left-color: var(--ok); }
@keyframes vl-entrar { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }

.vl-botao { font: inherit; color: var(--texto); background: var(--superficie-2); border: 1px solid var(--borda);
  border-radius: 6px; padding: 5px 12px; min-height: 30px; cursor: pointer; }
.vl-botao:hover { border-color: var(--brilho); }
.vl-botao.primario { background: var(--brilho); border-color: var(--brilho); color: #12161f; font-weight: 600; }
.vl-botao.primario:hover { background: var(--brilho-forte); }
.vl-botao.discreto { background: transparent; }
.vl-botao[disabled] { opacity: .5; cursor: not-allowed; border-color: var(--borda); }

.vl-veu { position: absolute; inset: 0; z-index: 20; pointer-events: auto; background: rgba(8, 10, 15, .62);
  display: flex; align-items: center; justify-content: center; padding: 16px; }
.vl-dialogo { width: min(440px, 100%); max-height: 100%; overflow: auto; background: var(--superficie);
  border: 1px solid var(--borda); border-radius: 12px; padding: 18px; box-shadow: 0 18px 48px rgba(0, 0, 0, .6); }
.vl-dialogo h2 { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
.vl-dialogo p { margin: 0 0 12px; color: var(--suave); }
.vl-detalhe { margin: 0 0 14px; padding: 8px 10px; background: var(--fundo); border: 1px solid var(--borda);
  border-radius: 6px; font: 12px/1.45 var(--mono); color: var(--texto); white-space: pre-wrap;
  overflow-wrap: anywhere; max-height: 180px; overflow: auto; }
.vl-acoes { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.vl-dialogo.largo { width: min(560px, 100%); }
/* Diálogo de lado: sem escurecer, preso à esquerda, o quarto continua à vista e clicável. */
.vl-veu.lateral { background: transparent; pointer-events: none; justify-content: flex-start; }
.vl-dialogo.lateral { pointer-events: auto; width: 268px; max-height: calc(100% - 32px); padding: 16px;
  background: linear-gradient(180deg, rgba(31, 38, 52, .97), rgba(18, 22, 31, .97)); border-color: rgba(214, 242, 74, .35);
  box-shadow: 0 0 0 1px rgba(214, 242, 74, .08), 0 18px 44px rgba(0, 0, 0, .55), 0 0 28px rgba(214, 242, 74, .08); }
.vl-dialogo.lateral h2 { color: var(--brilho); letter-spacing: .02em; }
.vl-dialogo.lateral > .vl-acoes { display: flex; flex-direction: column-reverse; gap: 8px; margin-top: 14px; }
.vl-dialogo.lateral > .vl-acoes > .vl-botao { width: 100%; padding: 9px 12px; border-radius: 9px; }
.vl-alt-mobi { display: flex; align-items: center; gap: 10px; padding: 10px; margin: 2px 0 12px; border-radius: 10px;
  background: rgba(255, 255, 255, .04); border: 1px solid var(--borda); }
.vl-alt-mobi img { width: 40px; height: 40px; object-fit: contain; image-rendering: pixelated; flex: none; }
.vl-alt-mobi b { display: block; font-size: 13px; color: var(--texto); }
.vl-alt-mobi span { display: block; font-size: 11.5px; color: var(--suave); margin-top: 2px; }
.vl-alt-mobi .vl-alt-qtd { color: var(--brilho); font-weight: 700; }
.vl-alt-aviso { font-size: 11.5px; color: #ffcf7a; margin: -4px 0 10px; }
.vl-alt-rotulo { font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--suave); margin: 0 0 6px; }
.vl-alt-opcoes { display: flex; flex-direction: column; gap: 6px; }
.vl-alt-opcao { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; font: inherit; color: var(--texto);
  background: rgba(255, 255, 255, .03); border: 1px solid var(--borda); border-radius: 10px; padding: 9px 10px; cursor: pointer;
  transition: border-color .15s, background .15s; }
.vl-alt-opcao:hover { border-color: rgba(214, 242, 74, .55); }
.vl-alt-opcao[aria-pressed="true"] { border-color: var(--brilho); background: rgba(214, 242, 74, .1); box-shadow: inset 3px 0 0 var(--brilho); }
.vl-alt-icone { flex: none; width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center;
  background: rgba(214, 242, 74, .12); color: var(--brilho); }
.vl-alt-opcao[aria-pressed="true"] .vl-alt-icone { background: var(--brilho); color: #12161f; }
.vl-alt-icone svg { width: 18px; height: 18px; }
.vl-alt-opcao b { display: block; font-size: 13px; }
.vl-alt-opcao small { display: block; font-size: 11px; color: var(--suave); margin-top: 1px; }
.vl-alt-valor { display: flex; flex-direction: column; gap: 8px; padding: 10px; margin-top: 2px; border-radius: 10px;
  background: rgba(214, 242, 74, .06); border: 1px dashed rgba(214, 242, 74, .35); }
.vl-alt-valor[hidden] { display: none; }
.vl-alt-passos { display: flex; align-items: center; gap: 6px; }
.vl-alt-passos .vl-botao { width: 34px; padding: 5px 0; font-weight: 700; }
.vl-alt-passos input { flex: 1; min-width: 0; text-align: center; font: 600 14px var(--mono, monospace); }
.vl-alt-num { flex: 1; text-align: center; font-weight: 600; font-size: 13px; color: var(--texto); }
.vl-alt-aviso[hidden] { display: none; }
.vl-alt-valor input[type="range"] { width: 100%; accent-color: var(--brilho); margin: 0; }
.vl-compra-lista { display: grid; gap: 8px; max-height: 250px; overflow: auto; margin: 0 0 14px; padding: 2px; }
.vl-compra-item { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 9px 11px;
  background: var(--fundo); border: 1px solid var(--borda); border-radius: 9px; }
.vl-compra-icone { display: grid; place-items: center; flex: none; width: 48px; height: 48px;
  border-radius: 8px; background: rgba(214, 242, 74, .08); }
.vl-compra-icone img { display: block; max-width: 42px; max-height: 42px; object-fit: contain; image-rendering: pixelated; }
.vl-compra-icone img[hidden], .vl-compra-icone span[hidden] { display: none; }
.vl-compra-icone span { font-size: 22px; color: var(--suave); }
.vl-compra-info { display: grid; gap: 3px; min-width: 0; flex: 1; }
.vl-compra-nome { overflow-wrap: anywhere; font-weight: 600; }
.vl-compra-preco { font-size: 12px; color: var(--suave); }
.vl-compra-quantidade { flex: none; padding: 4px 8px; border-radius: 6px; background: rgba(214, 242, 74, .15);
  color: var(--brilho); font-weight: 700; }
.vl-bv-veu { backdrop-filter: blur(3px); }
.vl-bv { position: relative; width: min(620px, 100%); max-height: 100%; overflow: auto; padding: 26px 28px 18px;
  background: radial-gradient(120% 70% at 0% 0%, rgba(214, 242, 74, .13), transparent 60%), linear-gradient(180deg, #1d2534, #141a25);
  border: 1px solid var(--borda); border-top: 2px solid var(--brilho); border-radius: 16px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, .7), 0 0 0 1px rgba(214, 242, 74, .08); animation: vl-bv-entrar .35s ease-out; }
@keyframes vl-bv-entrar { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
.vl-bv-topo { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.vl-bv-ponto { flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--brilho);
  box-shadow: 0 0 10px 3px rgba(214, 242, 74, .7), 0 0 34px 10px rgba(214, 242, 74, .25); animation: vl-bv-brilho 2.4s ease-in-out infinite; }
@keyframes vl-bv-brilho { 50% { box-shadow: 0 0 6px 1px rgba(214, 242, 74, .5), 0 0 20px 4px rgba(214, 242, 74, .12); } }
.vl-bv h2 { margin: 0; font-size: 22px; font-weight: 700; color: var(--texto); letter-spacing: .2px; }
.vl-bv-lema { margin: 2px 0 0; color: var(--brilho); font-size: 13px; }
.vl-bv-texto { margin: 0 0 16px; color: var(--suave); font-size: 13px; line-height: 1.55; }
.vl-bv-grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; margin-bottom: 16px; }
.vl-bv-cartao { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid var(--borda);
  border-radius: 10px; background: rgba(36, 45, 61, .6); transition: border-color .15s, transform .15s; }
.vl-bv-cartao:hover { border-color: var(--brilho); transform: translateY(-1px); }
.vl-bv-cartao strong { color: var(--brilho); font-size: 13px; }
.vl-bv-cartao span { color: var(--suave); font-size: 12px; line-height: 1.45; }
.vl-bv-sub { margin: 0 0 8px; font-size: 13px; font-weight: 600; color: var(--texto); text-transform: uppercase; letter-spacing: .6px; }
.vl-bv-dicas { margin: 0 0 14px; padding: 0; list-style: none; display: grid; gap: 6px; }
.vl-bv-dicas li { color: var(--suave); font-size: 12.5px; line-height: 1.5; padding-left: 14px; position: relative; }
.vl-bv-dicas li::before { content: ""; position: absolute; left: 0; top: .6em; width: 6px; height: 6px; border-radius: 50%; background: var(--brilho); }
.vl-bv kbd { font: 600 12px var(--mono); color: #12161f; background: var(--brilho); border-radius: 4px; padding: 1px 6px; }
.vl-bv-fim { margin: 0 0 14px; text-align: center; font-size: 15px; font-weight: 600; color: var(--brilho-forte); }
.vl-bv-acoes { display: flex; justify-content: center; gap: 10px; margin-bottom: 12px; }
.vl-bv-acoes .vl-botao { padding: 8px 18px; border-radius: 999px; }
.vl-bv-nota { margin: 0; text-align: center; color: var(--suave); font-size: 11px; opacity: .8; }
@media (prefers-reduced-motion: reduce) { .vl-bv, .vl-bv-ponto { animation: none; } }
.vl-inv-barra { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; }
.vl-inv-barra .vl-campo { flex: 1 1 160px; min-width: 0; }
.vl-inv-filtros { margin-bottom: 8px; }
.vl-botao.perigo { border-color: rgba(255, 120, 100, .6); color: #ffb3a6; }
.vl-inv-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 6px; }
.vl-inv { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 6px; font: inherit; color: var(--texto); text-align: center;
  background: var(--superficie-2); border: 1px solid var(--borda); border-radius: 10px; cursor: pointer; min-width: 0; }
.vl-inv:hover { border-color: #5d7222; }
.vl-inv.marcado { border-color: #ff8a73; background: rgba(255, 110, 90, .12); box-shadow: 0 0 0 1px rgba(255, 110, 90, .45); }
.vl-inv-foto { position: relative; display: grid; place-items: center; width: 54px; height: 46px; border-radius: 8px; background: radial-gradient(circle at 50% 40%, #2c3a52, #161c27); }
.vl-inv-img { max-width: 44px; max-height: 40px; image-rendering: pixelated; }
.vl-inv-qtd { position: absolute; right: -6px; bottom: -6px; padding: 1px 6px; border-radius: 999px; background: var(--brilho); color: #12161f; font: 800 10.5px var(--mono); }
.vl-inv-nome { font-size: 11.5px; line-height: 1.25; max-height: 2.5em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.vl-sel { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; background: var(--superficie-2); border: 1px solid var(--borda); min-height: 52px; }
.vl-sel-vazio { font-size: 12.5px; color: var(--suave); }
.vl-sel-foto { display: grid; place-items: center; flex: none; width: 52px; height: 48px; border-radius: 9px; background: radial-gradient(circle at 50% 40%, #2c3a52, #161c27); }
.vl-sel-img { max-width: 44px; max-height: 42px; image-rendering: pixelated; }
.vl-sel-texto { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.vl-sel-texto strong { font-size: 14px; color: var(--brilho); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vl-sel-dados { display: flex; flex-wrap: wrap; gap: 4px; }
.vl-sel-dados span.vl-pendente { border-color: var(--brilho); color: var(--brilho); }
.vl-sel-dados span { font: 600 11px var(--mono); padding: 1px 7px; border-radius: 999px; background: var(--superficie); border: 1px solid var(--borda); }
.vl-cons-colunas { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
.vl-cons-secao { display: flex; flex-direction: column; gap: 6px; }
.vl-cons-integrada { display: flex; flex-direction: column; gap: 10px; }
.vl-cons-integrada .vl-cons-secao { padding: 10px 12px; border: 1px solid var(--borda); border-radius: 9px; background: var(--superficie-2); }
.vl-cons-integrada .vl-acoes-titulo { margin: 2px 0 8px; }
.vl-cons-integrada .vl-linha { flex-wrap: wrap; }
.vl-cons-integrada .vl-ajuste.chave { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; }
.vl-cons-integrada .vl-numero { width: 68px; }
.vl-cons-subabas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.vl-cons-subaba { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 12px; font: inherit; text-align: left; cursor: pointer;
  color: var(--texto); background: var(--superficie-2); border: 1px solid var(--borda); border-radius: 10px; }
.vl-cons-subaba b { font-size: 14px; }
.vl-cons-subaba small { font-size: 11px; color: var(--suave); }
.vl-cons-subaba:hover { border-color: rgba(214, 242, 74, .55); }
.vl-cons-subaba[aria-selected="true"] { border-color: var(--brilho); background: rgba(214, 242, 74, .1); box-shadow: inset 0 -3px 0 var(--brilho); }
.vl-cons-subaba[aria-selected="true"] b { color: var(--brilho); }
.vl-cons-painel { display: flex; flex-direction: column; gap: 10px; }
.vl-cons-geral { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--borda); }
.vl-cons-painel > .vl-cons-secao, .vl-cons-painel > .vl-cons-colunas > .vl-cons-secao, .vl-cons-geral > .vl-cons-secao { padding: 10px 12px; border: 1px solid var(--borda); border-radius: 9px; background: var(--superficie-2); }
.vl-cons-avancadas { margin-top: 12px; border: 1px solid var(--borda); border-radius: 9px; padding: 10px 12px; }
.vl-cons-avancadas > summary { cursor: pointer; color: var(--brilho); font-weight: 600; }
.vl-cons-avancadas[open] > summary { margin-bottom: 12px; }
.vl-cruz { display: grid; grid-template-columns: 44px 44px; grid-auto-rows: 38px; gap: 6px; }
.vl-cruz .vl-botao { font-size: 18px; padding: 0; }
.vl-alturas .vl-botao { min-width: 38px; }
.vl-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.vl-form-campo { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--suave); }
.vl-form-campo .vl-campo { width: 100%; box-sizing: border-box; }
.vl-falas { min-height: 110px; resize: vertical; font: 13px/1.45 inherit; }
.vl-acoes-titulo { margin: 14px 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--brilho); }
.vl-acoes { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.vl-dialogo:has(> .vl-campo-apelido) > .vl-acoes { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; margin-top: 14px; }
.vl-dialogo:has(> .vl-campo-apelido) > .vl-acoes > button { padding-inline: 14px; }
.vl-acao { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 9px 10px; text-align: left; font: inherit; color: var(--texto);
  background: var(--superficie-2); border: 1px solid var(--borda); border-radius: 10px; cursor: pointer; min-width: 0; }
.vl-acao:hover, .vl-acao:focus-visible { border-color: var(--brilho); outline: none; background: #26301f; }
.vl-acao-topo { display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; }
.vl-acao-topo strong { font-size: 13px; }
.vl-acao-desc { font-size: 11.5px; color: var(--suave); line-height: 1.3; }
.vl-acao-estado { flex: none; font: 700 9.5px var(--mono); text-transform: uppercase; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--borda); color: var(--suave); }
.vl-acao.ligada { border-color: rgba(214, 242, 74, .6); }
.vl-acao.ligada .vl-acao-estado { background: var(--brilho); border-color: var(--brilho); color: #12161f; }
.vl-avisos-lista { display: flex; flex-direction: column; gap: 6px; max-height: min(380px, 55vh); overflow-y: auto; margin-bottom: 12px; }
.vl-aviso-item { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: start; padding: 8px 10px; border-radius: 9px; background: var(--superficie-2); border: 1px solid var(--borda); }
.vl-aviso-hora { font: 700 11px var(--mono); color: var(--brilho); padding-top: 1px; }
.vl-aviso-texto { font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
.vl-corpo:has(> .vl-efeitos-painel) { padding: 0; gap: 0; overflow: hidden; }
.vl-efeitos-painel { flex: 1; display: flex; flex-direction: column; min-height: 0; width: 100%; background: var(--superficie); color: var(--texto); font-size: 12px; }
.vl-efeitos-cabecalho { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px 12px; background: linear-gradient(120deg, var(--superficie-2), var(--superficie)); border-bottom: 1px solid var(--borda); }
.vl-efeitos-cabecalho > div { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.vl-efeitos-cabecalho strong { color: var(--texto); font-size: 16px; font-weight: 750; letter-spacing: -.02em; }
.vl-efeitos-ajuda { flex: none; width: 27px; height: 27px; padding: 0; border: 1px solid var(--borda); border-radius: 8px; background: var(--fundo); color: var(--suave); font: 800 13px/1 system-ui, sans-serif; cursor: pointer; }
.vl-efeitos-ajuda:hover { border-color: var(--brilho); }
.vl-efeitos-alerta { margin: 8px 12px 0; padding: 7px 9px; border: 1px solid var(--borda); border-radius: 7px; color: var(--suave); }
.vl-efeitos-topo { flex: none; display: flex; flex-direction: column; gap: 9px; padding: 12px 14px 6px; }
.vl-efeitos-abas { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 3px; border: 1px solid var(--borda); border-radius: 10px; background: var(--fundo); }
.vl-efeitos-aba { min-height: 33px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: var(--suave); font: 750 12px/1 system-ui, sans-serif; cursor: pointer; }
.vl-efeitos-aba:hover { color: var(--texto); background: var(--superficie-2); }
.vl-efeitos-aba.ativa { color: var(--fundo); background: var(--brilho); border-color: var(--brilho); }
.vl-efeitos-busca { display: flex; gap: 7px; min-width: 0; }
.vl-efeitos-topo .vl-amigos-busca { flex: 1; min-width: 0; min-height: 36px; border-color: var(--borda); border-radius: 8px; background: var(--fundo); color: var(--texto); }
.vl-efeitos-topo .vl-amigos-busca:focus { border-color: var(--brilho); }
.vl-efeitos-estado { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--suave); font-size: 11px; }
.vl-efeitos-opcoes { border: 1px solid var(--borda); border-radius: 8px; background: var(--fundo); }
.vl-efeitos-opcoes summary { padding: 7px 10px; color: var(--suave); font-size: 11px; font-weight: 700; cursor: pointer; list-style-position: inside; }
.vl-efeitos-opcoes[open] summary { color: var(--brilho); border-bottom: 1px solid var(--borda); }
.vl-efeitos-opcoes-corpo { padding: 1px 10px; }
.vl-efeitos-chave { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; padding: 5px 0; cursor: pointer; }
.vl-efeitos-chave + .vl-efeitos-chave { border-top: 1px solid var(--borda); }
.vl-efeitos-chave input { appearance: none; flex: none; width: 40px; height: 22px; margin: 0; border: 1px solid var(--borda); border-radius: 20px; background: var(--fundo); position: relative; cursor: pointer; }
.vl-efeitos-chave input::before { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--suave); transition: left .15s; }
.vl-efeitos-chave input:checked { background: var(--brilho); border-color: var(--brilho); }
.vl-efeitos-chave input:checked::before { left: 20px; background: var(--fundo); }
.vl-efeitos-faixa { flex: none; display: flex; align-items: center; padding: 7px 14px 8px; color: var(--suave); font-size: 11px; font-weight: 700; }
.vl-efeitos-filtro { flex: none; border: 1px solid var(--borda); border-radius: 8px; padding: 4px 9px; background: var(--superficie-2); color: var(--suave); font: 700 11px system-ui, sans-serif; cursor: pointer; }
.vl-efeitos-filtro.ativa, .vl-efeitos-filtro:hover { color: var(--brilho); border-color: var(--brilho); }
.vl-efeitos-lista { flex: 1; min-height: 0; overflow-y: auto; padding: 1px 14px 14px; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--borda) var(--fundo); }
.vl-efeitos-grade { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.vl-efeito { display: flex; flex-direction: column; min-width: 0; overflow: hidden; border-radius: 10px; background: var(--superficie-2); border: 1px solid var(--borda); cursor: pointer; transition: border-color .15s, transform .15s, box-shadow .15s; }
.vl-efeito:hover, .vl-efeito:focus-visible { border-color: var(--brilho); transform: translateY(-2px); outline: none; }
.vl-efeito.selecionado { border-color: var(--brilho); box-shadow: inset 0 0 0 1px var(--brilho), 0 0 12px rgba(214, 242, 74, .12); }
.vl-efeito-imagem { position: relative; display: grid; place-items: center; height: 138px; overflow: hidden; background: radial-gradient(circle at 50% 85%, rgba(214, 242, 74, .1), transparent 56%), var(--fundo); }
.vl-efeito-imagem img { position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%); width: auto; height: auto; max-width: 100%; max-height: 181px; object-fit: contain; image-rendering: pixelated; }
.vl-efeito-imagem img.vl-efeito-transparente { opacity: .4; filter: grayscale(1); }
.vl-efeito-info { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 38px; padding: 5px 8px; border-top: 1px solid var(--borda); text-align: center; }
.vl-efeito-nome { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--texto); font-size: 11px; font-weight: 700; }
.vl-efeito-num { position: absolute; top: 9px; left: 9px; padding: 3px 6px; border: 1px solid var(--borda); border-radius: 5px; background: var(--superficie); color: var(--suave); font: 700 10px/1 var(--mono); }
.vl-efeito-estrela { position: absolute; z-index: 1; top: 5px; right: 6px; width: 28px; height: 28px; border: 0; border-radius: 6px; background: var(--superficie); color: var(--suave); font-size: 19px; line-height: 1; cursor: pointer; }
.vl-efeito-estrela.ligada, .vl-efeito-estrela:hover { color: var(--brilho); }
.vl-efeitos-rodape { padding: 10px 0; text-align: center; color: var(--suave); font-size: 11px; }
@media (max-width: 520px) { .vl-efeitos-grade { grid-template-columns: 1fr; } }
.vl-amigos { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.vl-amigos-busca { width: 100%; box-sizing: border-box; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--borda); background: var(--superficie-2); color: inherit; font: inherit; }
.vl-amigos-busca:focus { outline: none; border-color: var(--brilho); }
.vl-amigos-lista { display: flex; flex-direction: column; gap: 4px; max-height: min(420px, 55vh); overflow-y: auto; padding-right: 2px; }
.vl-amigos-grupo { margin: 6px 0 2px; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--brilho); }
.vl-amigo { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 10px; background: var(--superficie-2); border: 1px solid transparent; }
.vl-amigo:hover { border-color: var(--borda); }
.vl-amigo:not(.online) { opacity: .62; }
.vl-amigo-foto { position: relative; flex: none; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: radial-gradient(circle at 50% 30%, #2c3a52, #161c27); border: 1px solid var(--borda); }
.vl-amigo-foto::before { content: attr(data-letra); position: absolute; inset: 0; display: grid; place-items: center; font: 700 16px/1 system-ui, sans-serif; color: var(--brilho); }
.vl-amigo-cabeca { position: absolute; left: -26px; top: -46px; width: 90px; height: 130px; max-width: none; }
.vl-amigo-ponto { position: absolute; right: 2px; bottom: 2px; width: 9px; height: 9px; border-radius: 50%; background: #6b7380; border: 2px solid var(--superficie-2); }
.vl-amigo.online .vl-amigo-ponto { background: #d6f24a; box-shadow: 0 0 6px rgba(214, 242, 74, .8); }
.vl-amigo-texto { flex: 1; min-width: 0; }
.vl-amigo-nome { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vl-amigo-relacao { color: #ff6b8a; font-weight: 400; }
.vl-amigo-missao { font-size: 12px; color: var(--suave); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vl-amigo-botoes { display: flex; gap: 4px; flex: none; }
.vl-amigo-botao { padding: 5px 9px; border-radius: 7px; border: 1px solid var(--borda); background: var(--superficie); color: inherit; font: 600 12px/1 system-ui, sans-serif; cursor: pointer; }
.vl-amigo-botao:hover:not(:disabled) { border-color: var(--brilho); color: var(--brilho); }
.vl-amigo-botao:disabled { opacity: .4; cursor: default; }
@media (max-width: 520px) { .vl-amigo { flex-wrap: wrap; } .vl-amigo-botoes { width: 100%; justify-content: flex-end; } }
.vl-visor { width: min(980px, 100%); height: min(640px, 100%); border: 1px solid rgba(214, 242, 74, .45); border-radius: 12px;
  background: #12161f; box-shadow: 0 18px 48px rgba(0, 0, 0, .6), 0 0 24px rgba(214, 242, 74, .12); }
.vl-janela { position: absolute; top: 72px; left: 72px; z-index: 10; pointer-events: auto;
  width: min(640px, calc(100vw - 16px)); height: min(620px, calc(100vh - 16px));
  display: flex; flex-direction: column; background: var(--superficie); border: 1px solid var(--borda);
  border-radius: 12px; box-shadow: 0 14px 40px rgba(0, 0, 0, .55); overflow: hidden; }
.vl-cabecalho { display: flex; align-items: center; gap: 8px; padding: 9px 8px 9px 14px;
  background: linear-gradient(90deg, #1d2431, #1f2a1c); border-bottom: 2px solid var(--brilho);
  cursor: move; touch-action: none; user-select: none; -webkit-user-select: none; }
.vl-marca { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--brilho);
  box-shadow: 0 0 8px 2px rgba(214, 242, 74, .55); }
.vl-titulo { margin: 0; font-size: 14px; font-weight: 700; letter-spacing: .04em; color: var(--brilho); }
.vl-versao { flex: 1; color: var(--suave); font: 11px var(--mono); }
.vl-miolo { flex: 1; min-height: 0; display: flex; }
.vl-fechar { font: inherit; font-size: 17px; line-height: 1; color: var(--suave); background: transparent;
  border: 0; border-radius: 6px; width: 28px; height: 28px; cursor: pointer; }
.vl-fechar:hover { color: var(--texto); background: var(--superficie-2); }
.vl-abas { flex: none; width: 170px; display: flex; flex-direction: column; gap: 3px; padding: 10px 6px;
  background: var(--fundo); border-right: 1px solid var(--borda); overflow-y: auto; scrollbar-width: thin; }
.vl-aba { display: flex; align-items: center; gap: 8px; min-height: 37px; font: inherit; text-align: left; color: var(--suave); background: transparent; border: 0;
  border-left: 3px solid transparent; border-radius: 0 7px 7px 0; padding: 5px 7px; cursor: pointer; }
.vl-aba-icone { flex: none; display: grid; place-items: center; width: 25px; height: 25px; color: var(--texto);
  background: var(--superficie-2); border: 1px solid var(--borda); border-radius: 7px; }
.vl-aba-icone svg { display: block; width: 16px; height: 16px; }
.vl-aba-texto { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vl-aba:hover { color: var(--texto); background: var(--superficie); }
.vl-aba[aria-selected="true"] { color: var(--brilho); background: var(--superficie-2); border-left-color: var(--brilho); font-weight: 600; }
.vl-aba[aria-selected="true"] .vl-aba-icone { color: var(--fundo); background: var(--brilho); border-color: var(--brilho); }
.vl-corpo { flex: 1; min-width: 0; min-height: 0; padding: 14px; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 12px;
  scrollbar-width: thin; scrollbar-color: #4a5a1f var(--fundo); }
.vl-corpo:not(:has(> .vl-efeitos-painel)) > * { flex-shrink: 0; }

.vl-busca-area { display: grid; gap: 6px; margin: -14px -14px 0;
  padding: 17px 14px 12px; background: var(--superficie); border-bottom: 1px solid var(--borda); }
.vl-busca-cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.vl-busca-rotulo { color: var(--suave); font-size: 11px; font-weight: 700; letter-spacing: .02em; }
.vl-visual-ajustes { flex: none; padding: 2px 8px; border: 1px solid var(--borda); border-radius: 999px;
  background: var(--superficie-2); color: var(--suave); font: inherit; font-size: 11px; cursor: pointer; }
.vl-visual-ajustes:hover, .vl-visual-ajustes:focus-visible { color: var(--brilho); border-color: var(--brilho); }
.vl-busca { width: 100%; box-sizing: border-box; }
.vl-modulos { display: flex; flex-direction: column; gap: 6px; }
.vl-vista { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.vl-dica-inicio { margin: 0; }
.vl-assuntos { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
.vl-assunto { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px; text-align: left; font: inherit; color: var(--texto);
  background: var(--superficie-2); border: 1px solid var(--borda); border-radius: 12px; cursor: pointer; }
.vl-assunto:hover, .vl-assunto:focus-visible { border-color: var(--brilho); outline: none; box-shadow: 0 0 0 1px rgba(214, 242, 74, .25); }
.vl-assunto strong { font-size: 14px; color: var(--brilho); }
.vl-assunto-desc { font-size: 12px; color: var(--suave); line-height: 1.35; }
.vl-assunto-conta { margin-top: 2px; font: 600 11px var(--mono); color: var(--texto); opacity: .8; }
.vl-inicio-titulo { display: grid; gap: 3px; padding: 1px 1px 5px; }
.vl-inicio-titulo strong { color: var(--brilho); font-size: 15px; }
.vl-inicio-titulo span { color: var(--suave); font-size: 12px; }
.vl-assuntos-lista { display: grid; gap: 7px; }
.vl-assunto-secao { overflow: hidden; border: 1px solid var(--borda); border-radius: 10px; background: var(--superficie-2); }
.vl-assunto-secao.aberto { border-color: rgba(214, 242, 74, .65); }
.vl-assunto-abertura { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 10px;
  width: 100%; padding: 11px 12px; border: 0; background: transparent; color: var(--texto); text-align: left; font: inherit; cursor: pointer; }
.vl-assunto-abertura:hover, .vl-assunto-abertura:focus-visible { background: rgba(214, 242, 74, .06); outline: none; }
.vl-assunto-icone { display: grid; place-items: center; width: 27px; height: 27px; border: 1px solid rgba(214, 242, 74, .4);
  border-radius: 8px; background: rgba(214, 242, 74, .08); color: var(--brilho); }
.vl-assunto-icone svg { display: block; width: 18px; height: 18px; }
.vl-assunto-secao.aberto .vl-assunto-icone { background: var(--brilho); border-color: var(--brilho); color: var(--fundo); }
.vl-assunto-info { display: grid; gap: 3px; min-width: 0; }
.vl-assunto-info strong { color: var(--brilho); font-size: 13px; }
.vl-assunto-info small { overflow: hidden; color: var(--suave); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.vl-assunto-lado { display: flex; align-items: center; gap: 7px; }
.vl-assunto-lado .vl-assunto-conta { margin: 0; white-space: nowrap; font-size: 10px; }
.vl-assunto-seta { color: var(--brilho); font-size: 20px; line-height: 1; }
.vl-assunto-funcoes { display: grid; gap: 9px; padding: 10px 11px 12px; border-top: 1px solid var(--borda); background: rgba(0, 0, 0, .14); }
.vl-assunto-funcoes > .vl-nota { margin: 0; }
.vl-assunto-funcoes .vl-modulo { background: var(--superficie); }
.vl-assunto-funcoes .vl-modulo-topo { padding: 9px 10px; }
.vl-assunto-funcoes .vl-modulo:not(.aberto) .vl-modulo-resumo { -webkit-line-clamp: 1; }
.vl-voltar { align-self: flex-start; font: inherit; font-size: 12.5px; font-weight: 700; color: var(--brilho); background: rgba(214, 242, 74, .08); border: 1px solid rgba(214, 242, 74, .45); border-radius: 999px; padding: 5px 12px 5px 10px; cursor: pointer; }
.vl-voltar:hover { background: var(--brilho); color: #12161f; border-color: var(--brilho); }
.vl-titulo-assunto { margin: 0; font-size: 16px; color: var(--brilho); }
.vl-modulo-nome { display: flex; align-items: center; gap: 8px; min-width: 0; }
.vl-modulo-texto { flex-direction: column; align-items: stretch !important; gap: 2px !important; }
.vl-modulo-resumo { font-size: 12px; color: var(--suave); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.vl-modulo.aberto .vl-modulo-resumo { -webkit-line-clamp: unset; display: block; }
.vl-dependencia { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 0 12px 10px; padding: 7px 10px; border-radius: 8px;
  font-size: 12px; color: #ffd27a; background: rgba(255, 196, 0, .08); border: 1px solid rgba(255, 196, 0, .35); }
.vl-resultado { display: flex; flex-direction: column; gap: 3px; }
.vl-resultado-onde { font: 600 10px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--suave); }
.vl-resultado-comando { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; background: var(--superficie-2); border: 1px dashed var(--borda); }
.vl-vazio { color: var(--suave); text-align: center; padding: 18px 8px; }
.vl-rodape-ajustes { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.vl-rodape-ajustes[hidden] { display: none; }
.vl-botao.pequeno { padding: 4px 9px; font-size: 12px; }
.vl-botao.destaque { background: var(--brilho); color: #12161f; border-color: var(--brilho); font-weight: 700; }
.vl-botao.destaque:disabled { opacity: .45; }
.vl-guia { padding-top: 6px; }
.vl-passos { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.vl-passo { display: grid; grid-template-columns: 26px 1fr; gap: 10px; align-items: start; }
.vl-passo-num { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--brilho); color: #12161f; font: 800 12px/1 system-ui, sans-serif; }
.vl-passo-corpo { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.vl-passo-corpo strong { font-size: 13px; }
.vl-passo-corpo .vl-campo { max-width: 200px; }
.vl-confirmacao { margin: 0; font-size: 12.5px; color: var(--texto); }
.vl-confirmacao.ok { color: var(--brilho); font-weight: 600; }
.vl-confirmacao.erro { color: #ff9a8a; }
.vl-codigo-grande { padding: 5px 10px; border-radius: 7px; background: #0d1118; border: 1px solid var(--brilho); color: var(--brilho); font: 700 14px var(--mono); letter-spacing: .04em; }
.vl-grupo { margin: 8px 0 0; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--brilho); }
.vl-modulo { background: var(--superficie-2); border: 1px solid var(--borda); border-radius: 10px; overflow: hidden; }
.vl-modulo:hover { border-color: #4a5a6f; }
.vl-modulo.aberto { border-color: rgba(214, 242, 74, .55); box-shadow: 0 0 0 1px rgba(214, 242, 74, .15); }
.vl-modulo-topo { display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
.vl-config-pagina { margin-bottom: 14px; }
.vl-ferramentas-pagina + .vl-config-pagina { margin-top: 14px; }
.vl-corpo > .vl-config-pagina { flex-shrink: 0; }
.vl-config-pagina > .vl-acoes-titulo { margin: 12px 12px 0; }
.vl-config-pagina .vl-modulo-texto { flex-direction: column; align-items: flex-start; gap: 2px; }
.vl-conexoes-abas { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 4px; padding: 3px; margin: 8px 0 12px; border: 1px solid var(--borda); border-radius: 10px; background: var(--fundo); }
.vl-conexoes-aba { min-height: 34px; border: 0; border-radius: 7px; background: transparent; color: var(--suave); font: 700 12px system-ui, sans-serif; cursor: pointer; }
.vl-conexoes-aba:hover { color: var(--texto); background: var(--superficie-2); }
.vl-conexoes-aba.ativa { color: var(--fundo); background: var(--brilho); }
.vl-conexoes-cartao { margin-bottom: 14px; }
.vl-conexoes-cartao .vl-modulo-texto { flex-direction: column; align-items: flex-start; gap: 3px; }
.vl-conexoes-estado { color: var(--suave); font-size: 11px; font-weight: 650; }
.vl-conexoes-estado.ativa { color: var(--brilho); }
.vl-conexoes-corpo { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 10px 12px 12px; border-top: 1px solid var(--borda); }
.vl-conexoes-atividade { display: flex; flex-direction: column; gap: 3px; width: 100%; max-height: 176px; overflow-y: auto; }
.vl-conexoes-evento { padding: 5px 7px; border-radius: 5px; background: var(--fundo); color: var(--suave); font: 11px var(--mono); }
.vl-conexoes-corpo > .vl-linha { width: 100%; }
.vl-conexoes-corpo .vl-campo { flex: 1; min-width: 0; }
.vl-conexoes-campos { display: grid; grid-template-columns: minmax(0,1fr); gap: 8px; width: 100%; }
.vl-conexoes-servico { padding:10px; border:1px solid var(--borda); border-radius:9px; background:var(--superficie-2); }
.vl-conexoes-servico-linha { display:flex; align-items:center; gap:10px; min-width:0; }
.vl-conexoes-servico-icone { display:grid; place-items:center; width:36px; height:36px; flex:none; }
.vl-conexoes-servico-icone .vl-app-icone { width:36px; height:36px; box-shadow:0 2px 6px rgba(0,0,0,.35); }
.vl-conexoes-servico-marca { display:grid; place-items:center; width:36px; height:36px; flex:none; border-radius:7px; background:#cf343b; color:#fff; font-size:20px; font-weight:800; }
.vl-conexoes-servico-info { display:flex; flex:1; flex-direction:column; gap:2px; min-width:0; }
.vl-conexoes-servico-info strong { color:var(--texto); font-size:12px; }
.vl-conexoes-servico-info small { color:var(--suave); font-size:10px; line-height:1.25; overflow-wrap:anywhere; }
.vl-conexoes-servico-info .vl-conexoes-servico-estado { color:var(--brilho); }
.vl-conexoes-servico-linha > .vl-botao { flex:none; }
.vl-conexoes-servico-editor { display:flex; gap:6px; padding-top:9px; margin-top:9px; border-top:1px solid var(--borda); }
.vl-conexoes-servico-editor[hidden] { display:none; }
.vl-conexoes-servico-editor .vl-campo { flex:1; min-width:0; }
.vl-conexoes-servico-editor .vl-botao { flex:none; }
.vl-conexoes-lastfm { display:block; }
.vl-conexoes-lastfm[hidden] { display:none; }
.vl-conexoes-lastfm > .vl-modulo { border:0; background:none; box-shadow:none; padding:0; margin:0; }
.vl-conexoes-confirmar { margin-top:9px; padding-top:9px; border-top:1px solid var(--borda); }
.vl-conexoes-confirmar[hidden] { display:none; }
.vl-conexoes-passos { margin:0 0 8px; padding-left:18px; display:grid; gap:5px; font-size:12px; line-height:1.45; }
.vl-conexoes-codigo { display:inline-block; margin-left:2px; padding:1px 7px; border-radius:6px; background:rgba(214,242,74,.12); border:1px solid rgba(214,242,74,.45); color:var(--brilho); font:700 12px/1.5 ui-monospace, Consolas, monospace; user-select:all; }
.vl-conexoes-confirmar-acoes { display:flex; flex-wrap:wrap; gap:6px; }
.vl-conexoes-confirmar .vl-nota:empty { display:none; }
.vl-conexoes-servico-estado.confirmado { color:var(--brilho); font-weight:700; }
.vl-conexoes-pagina .vl-conexoes-perfil-cartao[hidden] { display:none; }
.vl-conexoes-perfil-corpo { align-items:stretch; }
.vl-conexoes-perfil-corpo > .vl-conexoes-campos { align-content:start; }
.vl-conexoes-perfil-corpo > .vl-nota { flex:none; margin:0; }
@media (max-width: 600px) { .vl-conexoes-campos { grid-template-columns: 1fr; } .vl-conexoes-aba { font-size: 10px; } }
.vl-tv-janela { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 12; pointer-events: auto; display: flex; flex-direction: column; width: min(930px, calc(100vw - 28px)); height: min(650px, calc(100vh - 28px)); border: 1px solid #556939; border-radius: 13px; background: var(--superficie); color: var(--texto); box-shadow: 0 24px 70px rgba(0,0,0,.7), 0 0 20px rgba(214,242,74,.1); overflow: hidden; }
.vl-tv-janela.minimizada { width:min(330px,calc(100vw - 20px)); height:48px; }
.vl-tv-janela.minimizada .vl-tv-corpo { display:none; }
.vl-tv-cabecalho { display:flex; align-items:center; gap:9px; min-height:42px; padding:6px 12px; border-bottom:2px solid var(--brilho); background:linear-gradient(90deg,#202b25,#17202b); color:var(--brilho); }
.vl-tv-cabecalho { cursor:move; user-select:none; touch-action:none; }
.vl-tv-cabecalho button { cursor:pointer; }
.vl-tv-cabecalho strong { font-size:13px; letter-spacing:.02em; }
.vl-tv-cab-acoes { flex:1; }
.vl-tv-marca { display:grid; place-items:center; width:24px; height:24px; border-radius:7px; color:#12161f; background:var(--brilho); font-size:12px; }
.vl-tv-corpo { flex:1; min-height:0; display:flex; flex-direction:column; gap:9px; padding:11px; overflow:hidden; }
.vl-tv-busca { display:flex; flex-wrap:wrap; gap:6px; }
.vl-tv-busca .vl-campo:first-child { flex:2 1 250px; min-width:0; }
.vl-tv-busca .vl-campo:nth-child(2) { flex:1 1 150px; min-width:0; }
.vl-tv-sala { display:flex; align-items:center; flex-wrap:wrap; gap:6px; min-height:30px; }
.vl-tv-convite-host, .vl-tv-convite-recebido { display:flex; align-items:center; gap:7px; padding:7px 9px; border:1px solid var(--borda); border-radius:7px; background:var(--fundo); font-size:11px; }
.vl-tv-convite-host[hidden], .vl-tv-convite-recebido[hidden] { display:none; }
.vl-tv-convite-host > span, .vl-tv-convite-recebido > span { flex:none; color:var(--brilho); font-weight:700; }
.vl-tv-convite-host .vl-campo { flex:1; min-width:110px; }
.vl-tv-convite-recebido { border-color:var(--brilho); }
.vl-tv-convite-recebido > span { flex:1; color:var(--texto); }
.vl-tv-estado { flex:1; min-width:180px; color:var(--suave); font-size:11px; }
.vl-tv-estado::before { content:""; display:inline-block; width:6px; height:6px; margin-right:7px; vertical-align:middle; border-radius:50%; background:var(--brilho); box-shadow:0 0 7px var(--brilho); }
.vl-tv-layout { display:grid; grid-template-columns:minmax(0,1fr) 225px; grid-template-rows:minmax(0,1fr); gap:10px; flex:1; min-height:0; }
.vl-tv-principal, .vl-tv-lateral { min-width:0; min-height:0; padding:9px; border:1px solid var(--borda); border-radius:9px; background:var(--fundo); }
.vl-tv-principal { display:grid; grid-template-rows:minmax(0,1fr) auto auto auto; gap:7px; overflow:hidden; }
.vl-tv-palco { width:100%; height:100%; min-height:0; }
.vl-tv-palco iframe, .vl-tv-vazio { display:block; box-sizing:border-box; width:100%; height:100%; min-height:0; border:1px solid var(--borda); border-radius:7px; background:#0c1018; }
.vl-tv-vazio { display:grid; place-items:center; color:var(--suave); font-size:12px; background:radial-gradient(circle at center,#242d31,#0c1018 72%); }
.vl-tv-titulo-video { min-height:18px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; }
.vl-tv-controles { display:flex; flex-wrap:wrap; gap:5px; }
.vl-tv-aviso { margin:0; max-height:32px; overflow:auto; font-size:11px; }
.vl-tv-lateral { display:flex; flex-direction:column; gap:9px; overflow:hidden; }
.vl-tv-lateral h3 { margin:2px 0 9px; color:var(--brilho); font-size:12px; }
.vl-tv-playlist, .vl-tv-resultados { flex:1; min-height:0; overflow:auto; scrollbar-width:thin; }
.vl-tv-resultados-topo { display:flex; align-items:center; justify-content:space-between; gap:5px; }
.vl-tv-resultados-topo h3 { margin:0 0 5px; }
.vl-tv-resultados-topo .vl-botao { min-height:24px; padding:2px 5px; font-size:10px; }
.vl-tv-resultado-linha { display:flex; gap:3px; border:1px solid var(--borda); border-radius:6px; background:var(--superficie); }
.vl-tv-resultado { display:flex; align-items:center; gap:6px; flex:1; min-width:0; padding:4px; border:0; background:transparent; color:var(--texto); text-align:left; cursor:pointer; }
.vl-tv-resultado img { width:58px; height:33px; flex:none; border-radius:3px; object-fit:cover; }
.vl-tv-resultado-texto { display:flex; flex-direction:column; min-width:0; }
.vl-tv-resultado-texto strong, .vl-tv-resultado-texto small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.vl-tv-resultado-texto strong { font-size:10px; }
.vl-tv-resultado-texto small { color:var(--suave); font-size:9px; }
.vl-tv-resultado-add { flex:none; width:23px; border:0; background:transparent; color:var(--brilho); cursor:pointer; }
.vl-tv-resultado-linha:hover { border-color:var(--brilho); }
.vl-tv-chat { display:flex; flex-direction:column; flex:1; min-height:0; border-top:1px solid var(--borda); padding-top:7px; }
.vl-tv-chat-lista { flex:1; min-height:0; overflow:auto; scrollbar-width:thin; }
.vl-tv-chat-mensagem { display:flex; flex-direction:column; gap:2px; margin-bottom:7px; padding:6px 7px; border-radius:6px; background:var(--superficie); font-size:11px; overflow-wrap:anywhere; }
.vl-tv-chat-mensagem strong { color:var(--brilho); font-size:10px; }
.vl-tv-chat-envio { display:flex; flex:none; gap:4px; padding-top:6px; }
.vl-tv-chat-envio .vl-campo { width:0; min-width:0; flex:1; }
.vl-tv-chat-envio .vl-botao { flex:none; padding:5px 7px; }
.vl-tv-lista { display:flex; flex-direction:column; gap:5px; }
.vl-tv-item-linha { display:flex; min-width:0; border:1px solid var(--borda); border-radius:7px; background:var(--superficie); }
.vl-tv-item-linha:hover, .vl-tv-item-linha:has(.ativo) { border-color:var(--brilho); }
.vl-tv-item { display:flex; align-items:center; gap:7px; flex:1; min-width:0; padding:6px; border:0; background:transparent; color:var(--texto); text-align:left; cursor:pointer; }
.vl-tv-play { display:grid; place-items:center; flex:none; width:26px; height:23px; border-radius:5px; background:#334129; color:var(--brilho); font-size:10px; }
.vl-tv-item-texto { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; }
.vl-tv-remover { padding:0 8px; border:0; background:transparent; color:var(--suave); font-size:16px; cursor:pointer; }
.vl-tv-remover:hover { color:var(--brilho); }
.vl-tv-rodape { display:flex; flex:none; align-items:center; gap:10px; min-height:68px; padding:7px 9px; border:1px solid var(--borda); border-radius:9px; background:var(--fundo); }
.vl-tv-rodape > strong { flex:none; color:var(--brilho); font-size:11px; }
.vl-tv-assistindo { display:flex; flex-wrap:wrap; gap:6px; overflow:hidden; }
.vl-tv-pessoa { display:grid; place-items:center; width:52px; height:52px; border:1px solid #435738; border-radius:50%; background:#273331; overflow:hidden; }
.vl-tv-avatar { display:grid; place-items:center; width:48px; height:48px; border-radius:50%; color:#12161f; background:var(--brilho); font-weight:800; }
.vl-tv-avatar.com-foto { position:relative; overflow:hidden; background:radial-gradient(circle at 50% 35%, #3b4a2a, #1d2431); }
.vl-tv-avatar img { position:absolute; left:-40px; top:-63px; width:128px; height:185px; max-width:none; image-rendering:auto; }
@media (max-width:730px) { .vl-tv-janela { height:min(720px,calc(100vh - 16px)); } .vl-tv-corpo { overflow:auto; } .vl-tv-layout { grid-template-columns:1fr; grid-template-rows:auto auto; flex:none; } .vl-tv-principal { grid-template-rows:auto auto auto auto; } .vl-tv-palco { height:max(180px,min(50vw,360px)); } .vl-tv-lateral { min-height:280px; } .vl-tv-rodape { flex-wrap:wrap; } }
.vl-wireds-fantasmas { position: fixed; inset: 0; z-index: 2; pointer-events: none; }
.vl-wired-fantasma { position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; width: 38px; height: 42px; padding: 2px; transform: translate(-50%, -75%); border: 1px dashed var(--brilho); border-radius: 7px; background: rgba(18, 22, 31, .74); color: var(--brilho); opacity: .78; pointer-events: auto; cursor: pointer; }
.vl-wired-fantasma:hover, .vl-wired-fantasma:focus-visible { opacity: 1; border-style: solid; background: var(--superficie); }
.vl-wired-fantasma.lembrado { opacity: .55; border-style: dotted; }
.vl-wired-fantasma img { max-width: 28px; max-height: 27px; object-fit: contain; image-rendering: pixelated; }
.vl-wired-fantasma small { font: 700 8px/1 var(--mono); }
.vl-modulo-texto { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.vl-modulo-texto strong { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vl-selo { flex: none; font: 10px var(--mono); color: var(--suave); border: 1px solid var(--borda); border-radius: 999px; padding: 1px 6px; }
.vl-filtros { display: flex; flex-wrap: wrap; gap: 6px; }
.vl-filtros.apagado { opacity: .45; }
.vl-filtro { font: inherit; font-size: 12px; color: var(--suave); background: var(--superficie-2); border: 1px solid var(--borda);
  border-radius: 999px; padding: 4px 11px; cursor: pointer; }
.vl-filtro:hover { color: var(--texto); border-color: #4a5a6f; }
.vl-filtro[aria-selected="true"] { background: var(--brilho); border-color: var(--brilho); color: #12161f; font-weight: 600; }
.vl-resumo { margin: 8px 0 2px; color: var(--suave); font-size: 12px; }
.vl-rotulo-linha, .vl-ajuste-rotulo { display: flex; align-items: center; gap: 6px; }
.vl-info { flex: none; width: 17px; height: 17px; padding: 0; border-radius: 50%; border: 1px solid var(--borda); background: transparent;
  color: var(--suave); font: 600 10px/1 var(--mono); cursor: pointer; }
.vl-info:hover, .vl-info[aria-expanded="true"] { border-color: var(--brilho); color: var(--brilho); }
.vl-nota-campo { padding: 6px 8px; border-left: 2px solid var(--brilho); background: rgba(214, 242, 74, .05); border-radius: 0 6px 6px 0; }
.vl-sempre { flex: none; font: 10px var(--mono); color: var(--suave); border: 1px solid var(--borda); border-radius: 999px; padding: 2px 6px; margin-top: 1px; }
.vl-expandir { flex: none; min-width: 34px; font: inherit; font-size: 12px; color: var(--suave); background: transparent; border: 1px solid var(--borda);
  border-radius: 999px; padding: 3px 9px; cursor: pointer; white-space: nowrap; }
.vl-expandir:hover { color: var(--brilho); }
.vl-expandir:hover, .vl-expandir[aria-expanded="true"] { border-color: var(--brilho); background: rgba(214, 242, 74, .08); }
.vl-ajustes { display: flex; flex-direction: column; gap: 2px; padding: 4px 10px 10px; border-top: 1px dashed var(--borda); background: rgba(0, 0, 0, .12); }
.vl-ajuste { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 6px 12px; padding: 10px 2px; border-bottom: 1px solid rgba(54, 67, 92, .5); }
.vl-ajuste:last-child { border-bottom: 0; }
.vl-ajuste.empilhado { grid-template-columns: 1fr; }
.vl-ajuste.chave { grid-template-columns: auto 1fr; cursor: pointer; }
.vl-ajuste-texto { display: flex; flex-direction: column; gap: 2px; }
.vl-ajuste > .vl-nota, .vl-ajuste > .vl-gravado { grid-column: 1 / -1; }
.vl-ajuste-controle { display: flex; align-items: center; gap: 6px; justify-content: flex-end; }
.vl-ajuste.empilhado .vl-ajuste-controle { flex-direction: column; align-items: stretch; }
.vl-escolha-imagem { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; }
.vl-escolha-opcao { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 4px 7px; border: 1px solid var(--borda); border-radius: 9px; background: rgba(255, 255, 255, .03); color: var(--suave); font: 600 11px/1.2 system-ui, sans-serif; cursor: pointer; }
.vl-escolha-opcao img { width: 44px; height: 36px; padding: 5px 8px; box-sizing: content-box; border-radius: 6px; background: #8a96a6; image-rendering: pixelated; object-fit: contain; }
.vl-escolha-opcao:hover { border-color: rgba(214, 242, 74, .55); color: var(--texto); }
.vl-escolha-opcao.ativa { border-color: var(--brilho); background: rgba(214, 242, 74, .1); color: var(--brilho); box-shadow: 0 0 0 1px var(--brilho) inset; }
.vl-escolha-opcao:focus-visible { outline: 2px solid var(--brilho); outline-offset: 1px; }
.vl-ajuste-controle select.vl-campo { width: auto; max-width: 220px; }
.vl-numero { width: 90px; }
.vl-texto-longo { font: 12px var(--mono); resize: vertical; min-height: 70px; }
.vl-faixa { width: 140px; accent-color: var(--brilho); }
.vl-mostrador { min-width: 38px; text-align: right; }
.vl-gravado { font-size: 11px; color: var(--ok); min-height: 0; }
.vl-gravado:empty { display: none; }
.vl-gravado.erro { color: var(--erro); }
.vl-interruptor { appearance: none; -webkit-appearance: none; flex: none; position: relative; width: 34px; height: 19px; margin: 1px 0 0;
  border-radius: 999px; background: #3a4456; border: 1px solid var(--borda); cursor: pointer; transition: background .15s; }
.vl-interruptor::after { content: ""; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%;
  background: var(--texto); transition: transform .15s; }
.vl-interruptor:checked { background: var(--brilho); border-color: var(--brilho); }
.vl-interruptor:checked::after { transform: translateX(15px); background: #12161f; }
.vl-interruptor:disabled { opacity: .45; cursor: not-allowed; }
.vl-quadro { padding: 10px 12px; background: var(--superficie-2); border: 1px solid var(--borda); border-radius: 10px; }
.vl-detalhes summary { cursor: pointer; font-weight: 600; }
.vl-detalhes[open] { display: flex; flex-direction: column; gap: 8px; }
.vl-botao.perigo:hover { border-color: var(--erro); color: var(--erro); }

.vl-campo { font: inherit; color: var(--texto); background: var(--fundo); border: 1px solid var(--borda);
  border-radius: 6px; padding: 5px 8px; min-height: 30px; width: 100%; }
.vl-campo::placeholder { color: var(--suave); opacity: .85; }
.vl-linha { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.vl-linha > .vl-campo { flex: 1 1 120px; width: auto; }
.vl-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.vl-item { padding: 6px 8px; background: var(--superficie-2); border-radius: 6px; overflow-wrap: anywhere; }
.vl-item.linha { display: flex; align-items: center; gap: 8px; }
.vl-item .vl-cresce { flex: 1; min-width: 0; }
.vl-hora { color: var(--suave); font: 11px var(--mono); margin-right: 6px; }
.vl-autor { color: var(--brilho); font-weight: 600; margin-right: 6px; }
.vl-nota { margin: 0; color: var(--suave); font-size: 12px; }
.vl-visual-previa { display: flex; justify-content: center; margin: 4px 0 12px; padding: 8px; border-radius: 10px;
  background: radial-gradient(ellipse at 50% 80%, rgba(214, 242, 74, .16), transparent 70%), var(--fundo); border: 1px solid var(--borda); }
.vl-visual-estilo { margin: 0 0 10px; gap: 6px; }
.vl-visual-estilo select { flex: 1 1 auto; min-width: 0; }
.vl-visual-estilo input { flex: 1 1 120px; min-width: 0; }
.vl-visual-gerado { width: 180px; height: 260px; object-fit: contain; }
.vl-visual-gerado.vl-visual-local { image-rendering: pixelated; }
.vl-ferr { position: fixed; left: 16px; top: 80px; width: 300px; max-height: calc(100vh - 120px); display: flex; flex-direction: column; pointer-events: auto; z-index: 15;
  background: linear-gradient(180deg, #1d2534, #141a25); border: 1px solid var(--borda); border-top: 2px solid var(--brilho); border-radius: 12px; box-shadow: 0 18px 48px rgba(0, 0, 0, .6); }
.vl-ferr-cabeca { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 8px 12px; cursor: move; border-bottom: 1px solid var(--borda); }
.vl-ferr-titulo { font-weight: 700; color: var(--brilho); }
.vl-ferr-fechar { font: 700 16px/1 system-ui, sans-serif; color: var(--suave); background: none; border: 0; cursor: pointer; padding: 2px 6px; }
.vl-ferr-fechar:hover { color: var(--brilho); }
.vl-ferr-conteudo { overflow-y: auto; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; }
.vl-ferr-secao { border: 1px solid var(--borda); border-radius: 9px; background: rgba(36, 45, 61, .5); }
.vl-ferr-secao > summary { cursor: pointer; padding: 6px 10px; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--brilho); list-style: none; }
.vl-ferr-secao > summary::after { content: '▾'; float: right; color: var(--suave); }
.vl-ferr-secao:not([open]) > summary::after { content: '▸'; }
.vl-ferr-corpo { display: flex; flex-direction: column; gap: 6px; padding: 0 8px 8px; }
.vl-ferr-chave { display: flex; align-items: center; gap: 8px; font-size: 12.5px; cursor: pointer; }
.vl-ferr-chave input { accent-color: #d6f24a; width: 15px; height: 15px; }
.vl-ferr-num { width: 72px; flex: none; }
.vl-sel-menu { position: fixed; z-index: 14; pointer-events: auto; display: flex; flex-direction: column; gap: 4px; padding: 6px; min-width: 150px;
  background: rgba(20, 26, 37, .96); border: 1px solid var(--brilho); border-radius: 10px; box-shadow: 0 10px 28px rgba(0, 0, 0, .55), 0 0 10px rgba(214, 242, 74, .2); }
.vl-sel-menu-titulo { font-size: 12px; font-weight: 700; color: var(--brilho); text-align: center; padding: 2px 0 4px; border-bottom: 1px solid var(--borda); }
.vl-sel-menu > .vl-botao { border: 0; border-radius: 3px; padding: 5px 12px; background: transparent; font-size: 12px; }
.vl-sel-menu > .vl-botao:hover { background: var(--painel2); color: var(--brilho); }
.vl-sel-menu-linha { display: flex; gap: 4px; }
.vl-sel-menu-linha .vl-botao { flex: 1 1 auto; padding: 4px 6px; font-size: 12px; }
.vl-cuidado { margin: 0; padding: 6px 10px; border: 1px solid #e8b53a; border-radius: 6px; background: rgba(232, 181, 58, .1); color: #f3cf74; font-size: 12px; line-height: 1.4; }
.vl-vazio { margin: 0; padding: 14px 8px; text-align: center; color: var(--suave); list-style: none; }
.vl-codigo { font: 12px var(--mono); color: var(--brilho-forte); background: var(--fundo); border-radius: 4px;
  padding: 1px 5px; }
.vl-secao { display: flex; flex-direction: column; gap: 6px; }
.vl-secao h3 { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
  color: var(--suave); }
.vl-chave { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; background: var(--superficie-2);
  border-radius: 6px; cursor: pointer; }
.vl-chave input { flex: none; margin: 2px 0 0; width: 16px; height: 16px; accent-color: var(--brilho); }
.vl-chave strong { display: block; font-weight: 600; }
.vl-chave .vl-nota { display: block; }
.vl-estado { flex: none; display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  background: transparent; border: 1px solid var(--suave); }
.vl-estado.ok { background: var(--ok); border-color: var(--ok); }

.vl-flutuante { position: absolute; left: 8px; top: 38%; z-index: 5; pointer-events: auto; width: 30px;
  height: 30px; padding: 0; border-radius: 50%; border: 1px solid var(--borda); background: var(--fundo);
  cursor: pointer; display: grid; place-items: center; box-shadow: 0 4px 12px rgba(0, 0, 0, .45); opacity: .82; }
.vl-flutuante:hover, .vl-flutuante:focus-visible { opacity: 1; border-color: var(--brilho); }
.vl-flutuante::before { content: ""; width: 10px; height: 10px; border-radius: 50%; background: var(--brilho);
  box-shadow: 0 0 8px 2px rgba(214, 242, 74, .6); }

.vl-sugestoes { position: absolute; z-index: 8; pointer-events: auto; display: flex; flex-direction: column; gap: 4px;
  width: min(440px, calc(100vw - 16px)); padding: 6px; background: var(--superficie);
  border: 1px solid var(--borda); border-radius: 8px; box-shadow: 0 6px 20px rgba(0, 0, 0, .45); }
.vl-sugestoes-lista { display: flex; flex-direction: column; gap: 2px; max-height: min(300px, 45vh); overflow-y: auto; overscroll-behavior: contain; }
.vl-sugestao { padding: 4px 6px; border-radius: 4px; overflow-wrap: anywhere; cursor: pointer; }
.vl-sugestao.primeira { background: var(--superficie-2); box-shadow: inset 2px 0 0 var(--brilho); }
.vl-sugestao .vl-nota { margin-left: 6px; }

.vl-contador.sup-dir { top: 8px; right: 8px; } .vl-contador.sup-esq { top: 8px; left: 8px; }
.vl-contador.inf-esq { bottom: 56px; left: 8px; } .vl-contador.inf-dir { bottom: 56px; right: 8px; }
.vl-lateral { position: absolute; z-index: 4; width: 18px; height: 34px; padding: 0; border: 1px solid var(--borda); border-right: 0;
  border-radius: 8px 0 0 8px; background: rgba(18, 22, 31, .88); color: var(--brilho); font: 700 15px/1 system-ui, sans-serif; cursor: pointer; pointer-events: auto; }
.vl-lateral:hover, .vl-lateral:focus-visible { background: rgba(38, 48, 66, .95); outline: none; }
.vl-contador { position: absolute; z-index: 4; pointer-events: auto; cursor: default; display: flex; align-items: center; gap: 9px;
  padding: 4px 11px 4px 9px; border-radius: 999px; border: 1px solid rgba(214, 242, 74, .38);
  background: linear-gradient(135deg, rgba(31, 42, 28, .93), rgba(18, 22, 31, .93) 60%);
  box-shadow: 0 4px 14px rgba(0, 0, 0, .45), 0 0 12px rgba(214, 242, 74, .14), inset 0 1px 0 rgba(255, 255, 255, .05);
  font: 12px var(--mono); color: var(--texto); letter-spacing: .02em; }
.vl-cont-item { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; --q: var(--brilho); }
.vl-cont-item > b { font-weight: 700; color: var(--texto); min-width: 2ch; text-align: right; }
.vl-cont-unidade { color: var(--suave); font-size: 10px; text-transform: uppercase; }
.vl-cont-extra { color: var(--suave); font-size: 10px; }
.vl-cont-extra:empty { display: none; }
.vl-cont-divisor { width: 1px; height: 14px; background: linear-gradient(transparent, rgba(214, 242, 74, .45), transparent); }
.vl-cont-item[data-q="medio"] { --q: #ffd166; } .vl-cont-item[data-q="ruim"] { --q: #ff8a7a; } .vl-cont-item[data-q="sem"] { --q: var(--suave); }
.vl-cont-icone { width: 16px; height: 16px; flex: none; fill: none; stroke: var(--q); stroke-width: 2.2; stroke-linecap: round; filter: drop-shadow(0 0 3px color-mix(in srgb, var(--q) 55%, transparent)); }
.vl-cont-icone .marca { stroke-width: 1.6; opacity: .7; }
.vl-cont-icone .ponteiro { stroke: var(--texto); stroke-width: 2; transition: transform .6s ease; }
.vl-cont-icone .centro, .vl-cont-icone .ponto { fill: var(--q); stroke: none; }
.vl-cont-icone .barra { transition: opacity .3s; }
.vl-cont-item[data-q="medio"] .b3 { opacity: .22; }
.vl-cont-item[data-q="ruim"] .b3, .vl-cont-item[data-q="ruim"] .b2 { opacity: .22; }
.vl-cont-item[data-q="sem"] .barra { opacity: .22; }

@media (prefers-reduced-motion: reduce) {
  .vl-raiz *, .vl-raiz *::before, .vl-raiz *::after { animation: none !important; transition: none !important; }
}
/* Ilustrações do painel (imagens do Habbo, carregadas do próprio jogo) */
.vl-ilus { flex: none; display: grid; place-items: center; overflow: hidden; }
.vl-ilus img { display: block; max-width: none; image-rendering: auto; }
.vl-ilus img.pixel { image-rendering: pixelated; }
.vl-ilus.falhou img { display: none; }
.vl-aba-ilus { width: 30px; height: 30px; border-radius: 8px; background: var(--superficie-2); border: 1px solid var(--borda); }
.vl-aba[aria-selected="true"] .vl-aba-ilus { border-color: var(--brilho); background: rgba(214, 242, 74, .14); box-shadow: 0 0 8px rgba(214, 242, 74, .25); }
.vl-assunto-ilus { width: 36px; height: 36px; border-radius: 9px; background: rgba(214, 242, 74, .07); border: 1px solid rgba(214, 242, 74, .3); }
.vl-assunto-secao.aberto .vl-assunto-ilus { border-color: var(--brilho); background: rgba(214, 242, 74, .16); }
.vl-modulo-ilus { width: 34px; height: 34px; border-radius: 9px; background: var(--superficie-2); border: 1px solid var(--borda); }
/* Página de Início */
.vl-casa-topo { display: flex; align-items: center; gap: 14px; padding: 12px 14px; margin-bottom: 4px; border: 1px solid rgba(214, 242, 74, .3); border-radius: 12px;
  background: radial-gradient(circle at 15% 50%, rgba(214, 242, 74, .16), transparent 55%), linear-gradient(135deg, #1d2431, #172019); }
.vl-casa-foto { flex: none; width: 64px; height: 76px; border-radius: 10px; background: rgba(0, 0, 0, .25); overflow: hidden; display: grid; place-items: end center; }
.vl-casa-foto img { width: 64px; height: auto; margin-bottom: -6px; image-rendering: pixelated; }
.vl-casa-foto.sem-foto { place-items: center; }
.vl-casa-foto.sem-foto::after { content: ""; width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #f4ffc2, #d6f24a 45%, #8fb11a); box-shadow: 0 0 14px rgba(214, 242, 74, .7); }
.vl-casa-ola { display: grid; gap: 4px; min-width: 0; }
.vl-casa-ola strong { font-size: 16px; color: var(--brilho); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vl-casa-ola span { color: var(--suave); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vl-casa-ola .vl-casa-selo { justify-self: start; padding: 2px 8px; border-radius: 999px; background: rgba(214, 242, 74, .12); border: 1px solid rgba(214, 242, 74, .35); color: var(--brilho); font-size: 11px; font-weight: 700; }
.vl-casa-titulo { margin: 14px 2px 8px; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: var(--suave); }
.vl-casa-grade { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.vl-casa-cartao { display: flex; flex-direction: column; align-items: center; gap: 4px; min-height: 104px; padding: 12px 6px 10px; border: 1px solid var(--borda); border-radius: 11px;
  background: linear-gradient(180deg, var(--superficie-2), var(--superficie)); color: var(--texto); font: inherit; text-align: center; cursor: pointer; transition: border-color .12s, transform .12s, box-shadow .12s; }
.vl-casa-cartao:hover, .vl-casa-cartao:focus-visible { border-color: var(--brilho); transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0, 0, 0, .35), 0 0 0 1px rgba(214, 242, 74, .25); outline: none; }
.vl-casa-cartao strong { font-size: 12.5px; line-height: 1.2; }
.vl-casa-cartao span { color: var(--suave); font-size: 11px; line-height: 1.25; }
.vl-casa-ilus { width: 44px; height: 44px; margin-bottom: 2px; }
.vl-casa-ilus.pequena { width: 28px; height: 28px; margin: 0; }
.vl-casa-icone { display: grid; place-items: center; width: 44px; height: 44px; color: var(--brilho); }
.vl-casa-icone svg { width: 26px; height: 26px; }
.vl-casa-icone.pequena { width: 28px; height: 28px; }
.vl-casa-icone.pequena svg { width: 18px; height: 18px; }
.vl-casa-faixa { display: flex; align-items: center; gap: 12px; width: 100%; margin-top: 10px; padding: 10px 12px; border: 1px solid rgba(255, 70, 85, .35); border-radius: 11px;
  background: linear-gradient(90deg, rgba(255, 70, 85, .12), transparent 70%), var(--superficie); color: var(--texto); font: inherit; text-align: left; cursor: pointer; }
.vl-casa-faixa:hover, .vl-casa-faixa:focus-visible { border-color: #ff4655; outline: none; }
.vl-casa-faixa-texto { display: grid; gap: 2px; flex: 1; min-width: 0; }
.vl-casa-faixa-texto span { color: var(--suave); font-size: 11.5px; }
.vl-casa-seta { color: var(--suave); font-size: 20px; }
.vl-casa-lista { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.vl-casa-item { display: flex; align-items: center; gap: 9px; padding: 7px 9px; border: 1px solid var(--borda); border-radius: 9px; background: var(--superficie); color: var(--texto); font: inherit; text-align: left; cursor: pointer; }
.vl-casa-item:hover, .vl-casa-item:focus-visible { border-color: rgba(214, 242, 74, .6); outline: none; }
.vl-casa-dica { margin-top: 12px; }

`;

  let host = null;
  let sombra = null;
  let raizEl = null;
  let avisosEl = null;
  let relogioOculto = 0;
  let contador = 0;
  const dialogosAbertos = new Set(); // funções que fecham os diálogos em aberto

  // Cria um elemento. Textos entram por textContent; atributos desconhecidos viram setAttribute.
  function el(tag, props, filhos) {
    const no = document.createElement(tag);
    if (props) {
      for (const chave of Object.keys(props)) {
        const valor = props[chave];
        if (valor == null || valor === false) continue;
        if (chave === 'class') no.className = valor;
        else if (chave === 'texto') no.textContent = String(valor);
        else if (chave === 'style') no.style.cssText = valor;
        else if (chave === 'dataset') Object.assign(no.dataset, valor);
        else if (chave === 'value' || chave === 'checked' || chave === 'disabled') no[chave] = valor;
        else if (chave.slice(0, 2) === 'on' && typeof valor === 'function') no.addEventListener(chave.slice(2), valor);
        else no.setAttribute(chave, valor === true ? '' : String(valor));
      }
    }
    const lista = filhos == null ? [] : (Array.isArray(filhos) ? filhos : [filhos]);
    for (const filho of lista) {
      if (filho == null || filho === false) continue;
      no.appendChild(filho instanceof Node ? filho : document.createTextNode(String(filho)));
    }
    return no;
  }

  function conter(ev) {
    ev.stopPropagation();
  }

  function garantir() {
    if (!host) {
      const sobra = document.getElementById(ID);
      if (sobra) sobra.remove(); // resto de um script de conteúdo antigo (extensão recarregada)
      host = document.createElement('div');
      host.id = ID;
      host.style.cssText = ESTILO_HOST;
      sombra = host.attachShadow({ mode: 'closed' });
      const estilo = document.createElement('style');
      estilo.textContent = CSS + ((VL.conexoesPerfil && VL.conexoesPerfil.CSS_ICONE) || '');
      avisosEl = el('div', { class: 'vl-avisos', role: 'status', 'aria-live': 'polite' });
      raizEl = el('div', { class: 'vl-raiz' }, [avisosEl]);
      sombra.append(estilo, raizEl);
      for (const tipo of EVENTOS_CONTIDOS) host.addEventListener(tipo, conter, { passive: true });
    }
    if (!host.isConnected) document.documentElement.appendChild(host);
    return raizEl;
  }

  // Área onde os módulos penduram seus elementos (o painel, o botão flutuante).
  function area() {
    return garantir();
  }

  // Troca o conteúdo de um contêiner sem perder o foco do teclado: o elemento que estava focado é
  // reencontrado pelo atributo data-foco; se ele sumiu ou ficou desabilitado, vale o primeiro disponível.
  function trocar(alvo, filhos) {
    const focado = sombra ? sombra.activeElement : null;
    const tinhaFoco = !!(focado && alvo.contains(focado));
    const chave = tinhaFoco ? focado.getAttribute('data-foco') : null;
    alvo.replaceChildren(...(filhos || []).filter(Boolean));
    if (!tinhaFoco) return;
    const candidatos = Array.from(alvo.querySelectorAll('[data-foco]')).filter((no) => !no.disabled);
    const novo = candidatos.find((no) => no.getAttribute('data-foco') === chave) || candidatos[0];
    if (novo) novo.focus();
  }

  // Aviso curto no alto da tela. Devolve uma função que o dispensa.
  function aviso(texto, opcoes) {
    const o = opcoes || {};
    garantir();
    const tipo = o.tipo === 'erro' || o.tipo === 'ok' ? o.tipo : '';
    const duracao = typeof o.duracaoMs === 'number' ? o.duracaoMs : (tipo === 'erro' ? 7000 : 4500);
    const no = el('div', {
      class: 'vl-aviso' + (tipo ? ' ' + tipo : ''),
      role: tipo === 'erro' ? 'alert' : null,
      title: 'Clique para dispensar',
      texto: texto == null ? '' : texto,
    });
    let relogio = 0;
    function dispensar() {
      clearTimeout(relogio);
      no.remove();
    }
    no.addEventListener('click', dispensar);
    avisosEl.appendChild(no);
    while (avisosEl.children.length > MAX_AVISOS) avisosEl.firstElementChild.remove();
    if (duracao > 0) relogio = setTimeout(dispensar, duracao);
    return dispensar;
  }

  // Diálogo modal. Resolve com o valor do botão escolhido, ou null se a pessoa desistir (Esc, clique fora).
  function dialogo(opcoes) {
    const o = opcoes || {};
    garantir();
    return new Promise(function (resolver) {
      const focoFora = document.activeElement;
      const focoDentro = sombra.activeElement;
      const idTitulo = 'vl-dialogo-' + (++contador);
      const botoes = o.botoes && o.botoes.length ? o.botoes : [{ rotulo: 'Fechar', valor: null, foco: true }];
      const acoes = el('div', { class: 'vl-acoes' });
      const caixa = el('div', { class: 'vl-dialogo' + (o.largo ? ' largo' : '') + (o.lateral ? ' lateral' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': idTitulo }, [
        el('h2', { id: idTitulo, texto: o.titulo || 'Vagalume' }),
        o.texto ? el('p', { texto: o.texto }) : null,
        o.detalhe ? el('pre', { class: 'vl-detalhe', texto: o.detalhe }) : null,
        o.conteudo || null,
        acoes,
      ]);
      const veu = el('div', { class: 'vl-veu' + (o.lateral ? ' lateral' : '') }, [caixa]);
      let fechado = false;
      let inicial = null;

      function fechar(valor) {
        if (fechado) return;
        fechado = true;
        dialogosAbertos.delete(fechar);
        window.removeEventListener('keydown', aoTeclar, true);
        veu.remove();
        const volta = focoDentro && focoDentro.isConnected ? focoDentro : focoFora;
        try {
          if (volta && volta !== host && typeof volta.focus === 'function') volta.focus();
        } catch (erro) { /* não há para onde devolver o foco */ }
        resolver(valor === undefined ? null : valor);
      }

      function aoTeclar(ev) {
        if (Array.from(dialogosAbertos).at(-1) !== fechar) return;
        if (ev.key === 'Escape') {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          fechar(null);
          return;
        }
        if (ev.key !== 'Tab') return;
        const lista = Array.from(caixa.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')).filter((n) => !n.disabled && !n.hidden && n.getClientRects().length);
        if (!lista.length) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const atual = lista.indexOf(sombra.activeElement);
        const proximo = ev.shiftKey
          ? (atual <= 0 ? lista.length - 1 : atual - 1)
          : (atual === lista.length - 1 ? 0 : atual + 1);
        lista[proximo].focus();
      }

      botoes.forEach(function (b) {
        const botao = el('button', {
          type: 'button',
          class: 'vl-botao' + (b.destaque ? ' primario' : ''),
          texto: b.rotulo,
          onclick(ev) { if (ev.isTrusted) fechar(b.valor); },
        });
        if (b.foco && !inicial) inicial = botao;
        acoes.appendChild(botao);
      });
      veu.addEventListener('mousedown', function (ev) {
        if (ev.target === veu) fechar(null);
      });

      dialogosAbertos.add(fechar);
      window.addEventListener('keydown', aoTeclar, true);
      raizEl.appendChild(veu);
      (inicial || acoes.querySelector('button')).focus();
      if (typeof o.aoAbrir === 'function') o.aoAbrir({ fechar });
    });
  }

  // Lista visual de mobis, usada na sugestão e na confirmação de compra.
  function dialogoMobis(opcoes) {
    const o = opcoes || {};
    const itens = el('div', { class: 'vl-compra-lista' }, (o.itens || []).map(function (item) {
      const icone = el('img', { alt: '', loading: 'lazy' });
      const reserva = el('span', { texto: '▦' });
      if (item.icone) {
        icone.src = item.icone;
        reserva.hidden = true;
        icone.addEventListener('error', function () { icone.hidden = true; reserva.hidden = false; });
      } else icone.hidden = true;
      return el('div', { class: 'vl-compra-item' }, [
        el('div', { class: 'vl-compra-icone' }, [icone, reserva]),
        el('div', { class: 'vl-compra-info' }, [
          el('span', { class: 'vl-compra-nome', texto: item.nome || 'Mobi' }),
          item.preco == null ? null : el('span', { class: 'vl-compra-preco', texto: item.preco.toLocaleString('pt-BR') + ' moedas no total' }),
        ]),
        el('span', { class: 'vl-compra-quantidade', texto: '×' + item.quantidade }),
      ]);
    }));
    return dialogo({ titulo: o.titulo, texto: o.texto, conteudo: itens, botoes: o.botoes, largo: true });
  }

  // Pergunta de sim ou não. O foco começa em "Cancelar".
  function confirmar(texto, opcoes) {
    const o = opcoes || {};
    return dialogo({
      titulo: o.titulo || 'Confirmar',
      texto,
      detalhe: o.detalhe,
      botoes: [
        { rotulo: o.nao || 'Cancelar', valor: false, foco: true },
        { rotulo: o.sim || 'Confirmar', valor: true, destaque: true },
      ],
    }).then(function (valor) { return valor === true; });
  }

  // CSS aplicado à página do hotel (fora da camada). Devolve uma função que o retira.
  function estiloPagina(id, css) {
    const marca = 'vagalume-' + id;
    let no = Array.from(document.querySelectorAll('style[data-vagalume]'))
      .find((s) => s.getAttribute('data-vagalume') === marca) || null;
    if (!no) {
      no = document.createElement('style');
      no.setAttribute('data-vagalume', marca);
      (document.head || document.documentElement).appendChild(no);
    }
    no.textContent = String(css || '');
    return function () { no.remove(); };
  }

  // AAAA-MM-DD-HHMM (ou HHMMSS), para nomes de arquivo.
  function carimbo(comSegundos, quando) {
    const d = quando instanceof Date ? quando : new Date(quando == null ? Date.now() : quando);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' +
      p(d.getHours()) + p(d.getMinutes()) + (comSegundos ? p(d.getSeconds()) : '');
  }

  // Entrega um arquivo ao usuário pela pasta de downloads do navegador.
  function baixar(nome, conteudo, tipo) {
    const blob = conteudo instanceof Blob
      ? conteudo
      : new Blob([String(conteudo)], { type: tipo || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    link.rel = 'noopener';
    link.style.display = 'none';
    garantir().appendChild(link); // dentro da camada: o jogo não vê este clique
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    return true;
  }

  function copiar(texto) {
    const valor = String(texto == null ? '' : texto);
    function reserva() {
      try {
        const antes = sombra && sombra.activeElement ? sombra.activeElement : document.activeElement;
        const campo = el('textarea', { 'aria-hidden': 'true', tabindex: '-1', style: 'position: fixed; left: -9999px; top: 0; opacity: 0;' });
        campo.value = valor;
        garantir().appendChild(campo);
        campo.select();
        const ok = document.execCommand('copy');
        campo.remove();
        try { if (antes && antes !== host && antes.focus) antes.focus(); } catch (erro) { /* sem foco para devolver */ }
        return ok;
      } catch (erro) {
        return false;
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(valor).then(function () { return true; }, reserva);
    }
    return Promise.resolve(reserva());
  }

  // Espera a tela ser redesenhada (dois quadros, ou 250 ms se a aba não estiver desenhando).
  function quadros() {
    return new Promise(function (resolver) {
      let feito = false;
      function fim() {
        if (feito) return;
        feito = true;
        resolver();
      }
      setTimeout(fim, 250);
      requestAnimationFrame(function () { requestAnimationFrame(fim); });
    });
  }

  // Esconde a camada (para ela não sair na captura de tela). Volta sozinha depois de maxMs.
  function ocultar(maxMs) {
    if (!host) return;
    host.style.setProperty('display', 'none', 'important');
    clearTimeout(relogioOculto);
    relogioOculto = setTimeout(mostrar, Math.max(200, Number(maxMs) || 1500));
  }

  function mostrar() {
    clearTimeout(relogioOculto);
    relogioOculto = 0;
    if (host) host.style.cssText = ESTILO_HOST;
  }

  async function ocultarDurante(fn) {
    ocultar(8000);
    try {
      await quadros();
      return await fn();
    } finally {
      mostrar();
    }
  }

  function temDialogo() {
    return dialogosAbertos.size > 0;
  }

  function foco() {
    return sombra ? sombra.activeElement : null;
  }

  function temFoco() {
    return !!foco();
  }

  // O evento nasceu dentro da camada?
  function contem(ev) {
    if (!host || !ev) return false;
    if (ev.target === host) return true;
    const caminho = typeof ev.composedPath === 'function' ? ev.composedPath() : [];
    return caminho.indexOf(host) !== -1;
  }

  function remover() {
    for (const fechar of Array.from(dialogosAbertos)) fechar(null);
    clearTimeout(relogioOculto);
    relogioOculto = 0;
    if (host) host.remove();
    host = null;
    sombra = null;
    raizEl = null;
    avisosEl = null;
  }

  VL.camada = {
    el, area, trocar, aviso, dialogo, dialogoMobis, confirmar, estiloPagina, baixar, copiar, carimbo, quadros,
    ocultar, mostrar, ocultarDurante, temDialogo, temFoco, foco, contem, remover,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
