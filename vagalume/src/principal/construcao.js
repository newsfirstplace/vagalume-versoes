// Ponte visual da construção. Usa o motor já carregado pelo hotel; não envia pacotes.
// A seleção nativa fornece os pisos exatos. A prévia usa imagens dos mobis, sem mudar
// a posição dos objetos reais nem antecipar alterações no servidor.
(function () {
  'use strict';
  if (window.__vlConstrucao) return;
  Object.defineProperty(window, '__vlConstrucao', { value: true });
  if (document.documentElement) document.documentElement.setAttribute('data-vl-motor-construcao', 'aguardando');
  else document.addEventListener('DOMContentLoaded', () => {
    if (!document.documentElement.hasAttribute('data-vl-motor-construcao')) document.documentElement.setAttribute('data-vl-motor-construcao', 'aguardando');
  }, { once: true });
  let pixi = null;
  let motor = null;
  let ativo = false;
  let quadro = 0;
  let desfazerSonda = null;
  let selecao = null;
  let previa = null;
  let quarto = null;
  let ultimaGeometria = '';
  let ultimaSonda = 0;
  const responder = (dado) => document.dispatchEvent(new CustomEvent('vl:construcao:pagina', { detail: JSON.stringify(dado) }));

  function preparar() {
    if (motor || desfazerSonda) return;
    ultimaSonda = Date.now();
    const fila = window['webpackJsonpnitro-react'];
    if (!fila || fila.push === Array.prototype.push) return;
    let req;
    const id = 'vl-construcao-' + Math.random().toString(36).slice(2);
    fila.push([[id], { [id]: (m, e, r) => { req = r; } }, [[id]]]);
    for (const m of Object.values(req && req.c || {})) {
      const e = m && m.exports;
      if (e && e.Ticker && e.Container && e.Sprite) { pixi = e; break; }
    }
    if (!pixi) return;
    document.documentElement.setAttribute('data-vl-motor-construcao', 'procurando');
    // O motor é contexto de um ouvinte do ticker. A sonda dura no máximo 2 s e
    // restaura o método original assim que acha o motor, inclusive após falhas.
    const proto = pixi.Ticker.prototype;
    const original = proto.update;
    const sonda = function () {
      try {
        let no = this._head;
        for (let i = 0; no && i < 500; i++, no = no.next) {
          const c = no.context;
          if (c && typeof c.getActiveRoomInstanceRenderingCanvas === 'function' && typeof c.getRoomObjects === 'function') {
            motor = c;
            desfazerSonda();
            document.documentElement.setAttribute('data-vl-motor-construcao', 'pronto');
            break;
          }
        }
      } catch (e) { /* o cliente pode ter atualizado sua estrutura */ }
      return original.apply(this, arguments);
    };
    const timer = setTimeout(() => { if (desfazerSonda) desfazerSonda(); }, 2000);
    desfazerSonda = function () {
      if (proto.update === sonda) proto.update = original;
      clearTimeout(timer);
      desfazerSonda = null;
    };
    proto.update = sonda;
  }

  function cena() { return motor && motor.getActiveRoomInstanceRenderingCanvas(); }
  function projetar(c, x, y, z) {
    const p = c.geometry.getScreenPoint({ x, y, z });
    return p && { x: p.x * c.scale + c.width / 2 + c.screenOffsetX, y: p.y * c.scale + c.height / 2 + c.screenOffsetY };
  }
  function informarMapa() {
    const c = cena();
    if (!c || !c.geometry) return;
    // No motor, (x,y) já é o centro do piso. Os limites ficam em ±0,5;
    // somar meio piso aqui deslocava todo o contorno para baixo.
    const o = projetar(c, 0, 0, 0);
    if (!o) return;
    const eixo = (x, y, z) => { const p = projetar(c, x, y, z); return { x: p.x - o.x, y: p.y - o.y }; };
    const mapa = { tipo: 'mapa', quarto: motor.activeRoomId, origem: o, x: eixo(1, 0, 0), y: eixo(0, 1, 0), z: eixo(0, 0, 1) };
    const json = JSON.stringify(mapa);
    if (json !== ultimaGeometria) { ultimaGeometria = json; responder(mapa); }
  }

  function pararSelecao() {
    if (!selecao) return;
    const s = selecao;
    selecao = null;
    s.gerente.deactivate();
    if (s.gerente.setHighlight === s.realcar) s.gerente.setHighlight = s.original;
    motor.setMoveBlocked(s.bloqueado);
  }
  function selecionar() {
    pararPrevia();
    pararSelecao();
    const gerente = motor && motor.areaSelectionManager();
    if (!gerente || gerente.areaSelectionState !== 0) return false;
    const original = gerente.setHighlight;
    const realcar = function (x, y, w, h) {
      original.call(this, x, y, w, h);
      this.clearHighlightSilent(); // só a área limão da extensão fica visível
      responder({ tipo: 'area', area: { x1: x, y1: y, x2: x + w - 1, y2: y + h - 1 } });
    };
    selecao = { gerente, original, realcar, bloqueado: motor.isMoveBlocked() };
    gerente.setHighlight = realcar;
    gerente.activate((x, y, w, h) => {
      if (!selecao || w < 1 || h < 1) return;
      pararSelecao();
      responder({ tipo: 'selecionada', area: { x1: x, y1: y, x2: x + w - 1, y2: y + h - 1 } });
    });
    gerente.startSelecting();
    informarMapa();
    return true;
  }

  function pararPrevia() {
    if (!previa) return;
    const p = previa;
    previa = null;
    for (const it of p.itens) {
      const atual = motor.getRoomObject(p.quarto, it.id, 10);
      if (atual === it.objeto && p.mover) motor.objectEventHandler.setFurnitureAlphaMultiplier(atual, it.alpha);
    }
    if (p.camada.parent) p.camada.parent.removeChild(p.camada);
    p.camada.destroy({ children: true, texture: false, baseTexture: false });
  }
  function prepararPrevia(ids, mover) {
    pararSelecao();
    pararPrevia();
    const c = cena();
    if (!c || !pixi || !Array.isArray(ids)) return false;
    const camada = new pixi.Container();
    camada.interactiveChildren = false;
    camada.alpha = .65;
    const itens = [];
    for (const id of [...new Set(ids)].slice(0, 500)) {
      if (!Number.isInteger(id) || id <= 0) continue;
      const objeto = motor.getRoomObject(motor.activeRoomId, id, 10);
      const v = objeto && objeto.visualization;
      if (!v) continue;
      const textura = v.getImage(0, id);
      const caixa = v.getBoundingRectangle();
      if (!textura || !caixa) continue;
      const pos = objeto.getLocation();
      const sprite = new pixi.Sprite(textura);
      const alpha = objeto.model.getValue('furniture_alpha_multiplier');
      itens.push({ id, objeto, sprite, x: pos.x, y: pos.y, z: pos.z, caixa: { x: caixa.x, y: caixa.y }, alpha: Number.isFinite(alpha) ? alpha : 1 });
    }
    if (!itens.length) { camada.destroy(); return false; }
    itens.sort((a, b) => a.x + a.y - b.x - b.y || a.z - b.z);
    for (const it of itens) {
      camada.addChild(it.sprite);
      if (mover) motor.objectEventHandler.setFurnitureAlphaMultiplier(it.objeto, .25);
    }
    c.master.addChild(camada);
    previa = { quarto: motor.activeRoomId, camada, itens, mover, dx: 0, dy: 0 };
    desenharPrevia();
    return true;
  }
  function desenharPrevia() {
    const c = cena();
    if (!previa || !c) return;
    for (const it of previa.itens) {
      const p = projetar(c, it.x + previa.dx, it.y + previa.dy, it.z);
      if (!p) continue;
      it.sprite.position.set(p.x + it.caixa.x * c.scale, p.y + it.caixa.y * c.scale);
      it.sprite.scale.set(c.scale);
    }
  }
  function ciclo() {
    quadro = 0;
    if (!ativo) return;
    // O renderer pode terminar de carregar depois do document_idle da extensão.
    if (!motor && !desfazerSonda && Date.now() - ultimaSonda > 2500) preparar();
    if (motor && motor.activeRoomId !== quarto) {
      pararSelecao(); pararPrevia();
      quarto = motor.activeRoomId; ultimaGeometria = '';
      responder({ tipo: 'quarto', quarto });
    }
    try { informarMapa(); desenharPrevia(); } catch (e) { pararSelecao(); pararPrevia(); }
    quadro = requestAnimationFrame(ciclo);
  }

  document.addEventListener('vl:construcao:extensao', (ev) => {
    let d;
    try { d = JSON.parse(ev.detail); } catch (e) { return; }
    if (!d || typeof d !== 'object') return;
    let ok = true;
    try {
      switch (d.acao) {
        case 'ativar': ativo = true; preparar(); if (!quadro) quadro = requestAnimationFrame(ciclo); break;
        case 'selecionar': ok = selecionar(); break;
        case 'previa': ok = prepararPrevia(d.ids, d.modo === 'mover'); break;
        case 'destino':
          ok = !!previa && Number.isInteger(d.dx) && Number.isInteger(d.dy) && Math.abs(d.dx) <= 200 && Math.abs(d.dy) <= 200;
          if (ok) { previa.dx = d.dx; previa.dy = d.dy; desenharPrevia(); }
          break;
        case 'cancelar': pararSelecao(); pararPrevia(); break;
        case 'desativar':
          ativo = false; pararSelecao(); pararPrevia();
          if (desfazerSonda) desfazerSonda();
          cancelAnimationFrame(quadro); quadro = 0; ultimaGeometria = '';
          document.documentElement.removeAttribute('data-vl-motor-construcao');
          break;
        default: return;
      }
    } catch (e) { ok = false; pararSelecao(); pararPrevia(); }
    responder({ tipo: 'resposta', id: d.id, ok });
  });
})();
