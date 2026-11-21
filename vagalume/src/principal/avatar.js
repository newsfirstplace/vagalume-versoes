// Vagalume — mundo MAIN da página do hotel: desenha avatares com o próprio motor do jogo, no navegador,
// para a prévia do gerador de visual aparecer na hora (o servidor de imagens leva meio segundo ou mais
// para cada visual novo). Pedido do usuário em 2026-11-16.
//
// Como: o jogo desenha avatares com um componente React (o mesmo do avatar da barra de baixo,
// ".item-avatar .avatar-image"), que recebe o código do visual e devolve a imagem como fundo do
// elemento (data: URL feito no navegador). Este script acha esse componente pela árvore do React,
// pega o React e o ReactDOM do próprio cliente (pelo carregador de módulos dele) e monta o componente
// numa caixa escondida, fora da tela. Não mexe em nada do jogo: só desenha.
//
// Conversa com a extensão por eventos no document, com JSON no detalhe:
//   'vl:avatar:pedir'  { figura, genero, direcao }   (extensão -> página)
//   'vl:avatar:imagem' { figura, genero, direcao, url } (página -> extensão; pode vir mais de uma vez:
//                       primeiro um avatar provisório enquanto o jogo baixa as roupas, depois o certo)
//   'vl:avatar:falhou' { motivo }                     (sem motor: a extensão usa o servidor de imagens)
(function () {
  'use strict';
  if (window.__vlAvatar) return;
  Object.defineProperty(window, '__vlAvatar', { value: true });

  const FIGURA_VALIDA = /^[a-z]{2}-\d{1,6}(-\d{1,6}){0,3}(\.[a-z]{2}-\d{1,6}(-\d{1,6}){0,3}){0,20}$/;
  let motor = null; // { React, criarRaiz, componente }
  let falhou = '';

  function responder(tipo, dado) {
    document.dispatchEvent(new CustomEvent(tipo, { detail: JSON.stringify(dado) }));
  }

  // O carregador de módulos do cliente (webpack): um pacote falso com um módulo que só guarda o
  // "require" dele. Só depois que o jogo carregou (o push do array já é a função do carregador).
  function carregador() {
    const fila = window['webpackJsonpnitro-react'];
    if (!fila || fila.push === Array.prototype.push) return null;
    let req = null;
    const id = 'vl-avatar-' + Math.random().toString(36).slice(2);
    fila.push([[id], { [id]: function (modulo, exportados, requerer) { req = requerer; } }, [[id]]]);
    return req && req.c ? req : null;
  }

  function acharReact(req) {
    let React = null;
    let criarRaiz = null;
    for (const m of Object.values(req.c)) {
      const e = m && m.exports;
      if (!e || (typeof e !== 'object' && typeof e !== 'function')) continue;
      if (!React && typeof e.createElement === 'function' && typeof e.useState === 'function' && typeof e.useEffect === 'function') React = e;
      if (!criarRaiz && typeof e.createRoot === 'function' && typeof e.createPortal !== 'undefined') criarRaiz = e.createRoot;
      if (!criarRaiz && typeof e.createRoot === 'function' && typeof e.hydrateRoot === 'function') criarRaiz = e.createRoot;
      if (React && criarRaiz) break;
    }
    return React && criarRaiz ? { React, criarRaiz } : null;
  }

  // O componente que desenha avatares: sobe pela árvore do React a partir de um ".avatar-image".
  function ehComponenteDoAvatar(tipo) {
    if (typeof tipo !== 'function') return false;
    let fonte = '';
    try { fonte = Function.prototype.toString.call(tipo); } catch (e) { return false; }
    return fonte.includes('createAvatarImage') && fonte.includes('getCroppedImage');
  }
  function acharComponente() {
    const elementos = [...document.querySelectorAll('.item-avatar .avatar-image, .avatar-image')];
    for (const el of elementos) {
      const k = Object.keys(el).find((n) => n.startsWith('__reactFiber'));
      let f = k ? el[k] : null;
      for (let i = 0; f && i < 8; i += 1, f = f.return) {
        if (ehComponenteDoAvatar(f.type)) return f.type;
      }
    }
    return null;
  }

  function prepararMotor() {
    if (motor) return motor;
    const req = carregador();
    if (!req) { falhou = 'carregador'; return null; }
    const r = acharReact(req);
    if (!r) { falhou = 'react'; return null; }
    const componente = acharComponente();
    if (!componente) { falhou = 'componente'; return null; }
    motor = { React: r.React, criarRaiz: r.criarRaiz, componente };
    falhou = '';
    return motor;
  }

  // Uma caixa escondida (fora da tela) com uma raiz React própria; o mesmo elemento recebe as figuras
  // novas por propriedade, e o componente do jogo refaz a imagem.
  let caixa = null;
  let raiz = null;
  let atual = null; // { figura, genero, direcao }
  let pedido = 0; // chave do elemento: cada pedido monta um novo, e o anterior (desmontado) não responde mais
  let ultimaUrl = '';
  function lerUrl() {
    const no = caixa && caixa.firstElementChild;
    const fundo = no ? no.style.backgroundImage : '';
    const m = /url\(["']?(data:image\/[^"')]+)["']?\)/.exec(fundo || '');
    return m ? m[1] : '';
  }
  function avisarSeMudou() {
    const url = lerUrl();
    if (!url || url === ultimaUrl || !atual) return;
    ultimaUrl = url;
    responder('vl:avatar:imagem', Object.assign({ url }, atual));
  }
  function desenhar(figura, genero, direcao) {
    const m = prepararMotor();
    if (!m) { responder('vl:avatar:falhou', { motivo: falhou }); return; }
    if (!caixa) {
      caixa = document.createElement('div');
      caixa.setAttribute('aria-hidden', 'true');
      caixa.style.cssText = 'position:fixed;left:-10000px;top:0;width:200px;height:300px;overflow:hidden;pointer-events:none;opacity:0;';
      document.body.appendChild(caixa);
      new MutationObserver(avisarSeMudou).observe(caixa, { attributes: true, subtree: true, childList: true, attributeFilter: ['style'] });
      raiz = m.criarRaiz(caixa);
    }
    atual = { figura, genero, direcao };
    ultimaUrl = '';
    pedido += 1;
    raiz.render(m.React.createElement(m.componente, { key: 'vl' + pedido, figure: figura, gender: genero, direction: direcao, headOnly: false }));
    // Imagem já guardada pelo jogo: o componente a põe logo; confere também depois do próximo quadro.
    requestAnimationFrame(avisarSeMudou);
  }

  // ---------- miniaturas: várias de uma vez ----------
  // 'vl:avatar:lote' { itens: [{ chave, figura, genero, direcao, cabeca }] } -> 'vl:avatar:miniatura'
  // { chave, url } para cada uma (provisória e depois a certa). Os componentes ficam montados (até 160,
  // os mais antigos saem) para a imagem certa chegar mesmo depois que o jogo baixa as roupas.
  let caixaLote = null;
  let raizLote = null;
  const itensLote = [];
  const enviadas = new Map(); // chave -> última url mandada
  function lerLote() {
    if (!caixaLote) return;
    for (const no of caixaLote.children) {
      const chave = no.getAttribute('data-vl-chave');
      if (!chave) continue;
      const m = /url\(["']?(data:image\/[^"')]+)["']?\)/.exec(no.style.backgroundImage || '');
      if (!m || enviadas.get(chave) === m[1]) continue;
      enviadas.set(chave, m[1]);
      responder('vl:avatar:miniatura', { chave, url: m[1] });
    }
  }
  function desenharLote(itens) {
    const m = prepararMotor();
    if (!m) { responder('vl:avatar:falhou', { motivo: falhou }); return; }
    if (!caixaLote) {
      caixaLote = document.createElement('div');
      caixaLote.setAttribute('aria-hidden', 'true');
      caixaLote.style.cssText = 'position:fixed;left:-10000px;top:0;width:200px;height:300px;overflow:hidden;pointer-events:none;opacity:0;';
      document.body.appendChild(caixaLote);
      new MutationObserver(lerLote).observe(caixaLote, { attributes: true, subtree: true, childList: true, attributeFilter: ['style'] });
      raizLote = m.criarRaiz(caixaLote);
    }
    for (const it of itens) {
      const i = itensLote.findIndex((x) => x.chave === it.chave);
      if (i >= 0) itensLote.splice(i, 1);
      enviadas.delete(it.chave); // pedida de novo: manda a imagem outra vez
      itensLote.push(it);
    }
    while (itensLote.length > 160) enviadas.delete(itensLote.shift().chave);
    raizLote.render(m.React.createElement(m.React.Fragment, null, itensLote.map(function (it) {
      return m.React.createElement(m.componente, { key: it.chave, figure: it.figura, gender: it.genero, direction: it.direcao, headOnly: it.cabeca, 'data-vl-chave': it.chave });
    })));
    requestAnimationFrame(lerLote);
  }
  document.addEventListener('vl:avatar:lote', function (ev) {
    let p = null;
    try { p = JSON.parse(String(ev.detail || '')); } catch (e) { return; }
    if (!p || !Array.isArray(p.itens)) return;
    const itens = [];
    for (const it of p.itens.slice(0, 96)) {
      if (!it || typeof it.chave !== 'string' || !/^[\w-]{1,40}$/.test(it.chave) || typeof it.figura !== 'string' || !FIGURA_VALIDA.test(it.figura)) continue;
      itens.push({ chave: it.chave, figura: it.figura, genero: it.genero === 'F' ? 'F' : 'M', direcao: Number.isInteger(it.direcao) && it.direcao >= 0 && it.direcao <= 7 ? it.direcao : 2, cabeca: !!it.cabeca });
    }
    if (!itens.length) return;
    try { desenharLote(itens); } catch (e) { responder('vl:avatar:falhou', { motivo: 'erro' }); }
  });

  document.addEventListener('vl:avatar:pedir', function (ev) {
    let p = null;
    try { p = JSON.parse(String(ev.detail || '')); } catch (e) { return; }
    if (!p || typeof p.figura !== 'string' || !FIGURA_VALIDA.test(p.figura)) return;
    const genero = p.genero === 'F' ? 'F' : 'M';
    const direcao = Number.isInteger(p.direcao) && p.direcao >= 0 && p.direcao <= 7 ? p.direcao : 2;
    try { desenhar(p.figura, genero, direcao); } catch (e) { responder('vl:avatar:falhou', { motivo: 'erro' }); }
  });
})();
