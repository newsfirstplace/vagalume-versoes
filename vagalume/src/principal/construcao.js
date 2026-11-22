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
  let requisitar = null;
  let classes = null;
  let colocacao = null; // mobis só de prévia, criados localmente no quarto (ids negativos)
  let proximoLocal = 0;
  const responder = (dado) => document.dispatchEvent(new CustomEvent('vl:construcao:pagina', { detail: JSON.stringify(dado) }));

  function preparar() {
    if (motor || desfazerSonda) return;
    ultimaSonda = Date.now();
    const fila = window['webpackJsonpnitro-react'];
    if (!fila || fila.push === Array.prototype.push) return;
    let req;
    const id = 'vl-construcao-' + Math.random().toString(36).slice(2);
    fila.push([[id], { [id]: (m, e, r) => { req = r; } }, [[id]]]);
    requisitar = req;
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
  // Vetor (posição/direção) e dados "legados" do mobi, achados entre os módulos do cliente pelas
  // marcas próprias de cada classe (os nomes vêm minificados).
  // Dados "legados" (texto vazio), no mesmo formato que o cliente grava no modelo do mobi.
  class DadosLocal {
    writeRoomObjectModel(m) { if (m) { m.setValue('furniture_data_format', 0); m.setValue('furniture_data', ''); } }
    getLegacyString() { return ''; }
    setString() {}
    compare() { return false; }
    get state() { return 0; }
    get flags() { return 0; }
    get uniqueNumber() { return 0; }
    get uniqueSeries() { return 0; }
    get rarityLevel() { return -1; }
    get isUnique() { return false; }
  }
  function acharClasses() {
    if (classes) return classes;
    let Vetor = null, Dados = null;
    // O cliente vem empacotado num módulo só (as classes nem sempre são exportadas): o vetor sai da
    // posição de um objeto do quarto (o próprio avatar sempre está lá).
    for (const categoria of [10, 100, 20]) {
      let lista = [];
      try { lista = motor.getRoomObjects(motor.activeRoomId, categoria) || []; } catch (e) { /* segue */ }
      const o = lista.find((x) => x && typeof x.getLocation === 'function' && x.getLocation());
      const C = o && o.getLocation().constructor;
      let teste = null;
      try { teste = C && new C(1, 2, 3); } catch (e) { /* não é o vetor */ }
      if (teste && teste.x === 1 && teste.y === 2 && teste.z === 3) { Vetor = C; break; }
    }
    for (const m of Object.values(requisitar && requisitar.c || {})) {
      const e = m && m.exports;
      if (!e || typeof e !== 'object') continue;
      for (const v of Object.values(e)) {
        if (typeof v !== 'function' || !v.prototype) continue;
        if (!Vetor && typeof v.dotProduct === 'function' && typeof v.sum === 'function' && typeof v.dif === 'function') Vetor = v;
        if (!Dados && 'FORMAT_KEY' in v && typeof v.prototype.getLegacyString === 'function' && typeof v.prototype.setString === 'function') Dados = v;
      }
      if (Vetor && Dados) break;
    }
    if (Vetor) classes = { Vetor, Dados: Dados || DadosLocal };
    return classes;
  }
  function pararColocacao() {
    if (!colocacao) return;
    const c = colocacao;
    colocacao = null;
    if (motor && motor.activeRoomId === c.quarto) for (const id of c.objetos.values()) { try { motor.removeRoomObjectFloor(c.quarto, id); } catch (e) { /* já saiu */ } }
  }
  // Mostra o mobi "tipo" em cada ponto {x,y,z}; os que já existem ficam, os que saíram são tirados.
  function mostrarColocacao(d) {
    const pontos = Array.isArray(d.pontos) ? d.pontos.slice(0, 400) : [];
    if (!pontos.length) { pararColocacao(); return true; }
    const k = acharClasses();
    if (!motor || !k || !Number.isInteger(d.tipo) || d.tipo <= 0) return false;
    if (colocacao && (colocacao.quarto !== motor.activeRoomId || colocacao.tipo !== d.tipo || colocacao.direcao !== d.direcao)) pararColocacao();
    if (!colocacao) colocacao = { quarto: motor.activeRoomId, tipo: d.tipo, direcao: d.direcao, objetos: new Map(), novos: [] };
    const querem = new Map();
    for (const p of pontos) if (Number.isInteger(p.x) && Number.isInteger(p.y) && Number.isFinite(p.z)) querem.set(p.x + ',' + p.y + ',' + p.z, p);
    for (const [chave, id] of colocacao.objetos) {
      if (querem.has(chave)) { querem.delete(chave); continue; }
      try { motor.removeRoomObjectFloor(colocacao.quarto, id); } catch (e) { /* já saiu */ }
      colocacao.objetos.delete(chave);
    }
    for (const [chave, p] of querem) {
      const id = -2000000 - (proximoLocal = (proximoLocal + 1) % 1000000);
      // sincronizado = falso: não entra no mapa de pisos (não bloqueia o andar); objeto não real.
      motor.addFurnitureFloor(colocacao.quarto, id, d.tipo, new k.Vetor(p.x, p.y, p.z), new k.Vetor((d.direcao || 0) * 45), 0, new k.Dados(), NaN, -1, 0, 0, '', false, false);
      colocacao.objetos.set(chave, id);
      colocacao.novos.push(id);
    }
    return true;
  }
  // Topo da pilha (onde o próximo mobi pousa, já com mobis de vários pisos) e altura do chão de cada piso,
  // pelos mapas do próprio jogo. null = piso fora do quarto ou sem dado.
  function alturasDosPisos(pontos) {
    if (!motor || !Array.isArray(pontos)) return null;
    const pilha = motor.getFurnitureStackingHeightMap && motor.getFurnitureStackingHeightMap(motor.activeRoomId);
    const chao = motor.getLegacyWallGeometry && motor.getLegacyWallGeometry(motor.activeRoomId);
    if (!pilha && !chao) return null;
    const ler = (mapa, x, y) => { try { const h = mapa ? Number(mapa.getTileHeight ? mapa.getTileHeight(x, y) : mapa.getHeight(x, y)) : NaN; return Number.isFinite(h) && h >= 0 ? Math.round(h * 100) / 100 : null; } catch (e) { return null; } };
    const lista = pontos.slice(0, 400).filter((p) => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]));
    return { topos: lista.map((p) => ler(pilha, p[0], p[1])), chaos: lista.map((p) => ler(chao, p[0], p[1])) };
  }
  // Os objetos entram no quarto no quadro seguinte: só então dá para deixá-los translúcidos.
  function clarearColocacao() {
    if (!colocacao || !colocacao.novos.length) return;
    colocacao.novos = colocacao.novos.filter(function (id) {
      const o = motor.getRoomObject(colocacao.quarto, id, 10);
      if (!o) return true;
      motor.objectEventHandler.setFurnitureAlphaMultiplier(o, .55);
      return false;
    });
  }
  function desenharPrevia() {
    const c = cena();
    if (!previa || !c) return;
    for (const it of previa.itens) {
      const destino = (it.x + previa.dx) + ',' + (it.y + previa.dy);
      const p = projetar(c, it.x + previa.dx, it.y + previa.dy, it.z + (previa.dz && Number(previa.dz[destino]) || 0));
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
      pararSelecao(); pararPrevia(); colocacao = null;
      quarto = motor.activeRoomId; ultimaGeometria = '';
      responder({ tipo: 'quarto', quarto });
    }
    try { informarMapa(); desenharPrevia(); clarearColocacao(); } catch (e) { pararSelecao(); pararPrevia(); }
    quadro = requestAnimationFrame(ciclo);
  }

  document.addEventListener('vl:construcao:extensao', (ev) => {
    let d;
    try { d = JSON.parse(ev.detail); } catch (e) { return; }
    if (!d || typeof d !== 'object') return;
    let ok = true;
    let extra = null;
    try {
      switch (d.acao) {
        case 'ativar': ativo = true; preparar(); if (!quadro) quadro = requestAnimationFrame(ciclo); break;
        case 'selecionar': ok = selecionar(); break;
        case 'previa': ok = prepararPrevia(d.ids, d.modo === 'mover'); break;
        case 'destino':
          ok = !!previa && Number.isInteger(d.dx) && Number.isInteger(d.dy) && Math.abs(d.dx) <= 200 && Math.abs(d.dy) <= 200;
          if (ok) { previa.dx = d.dx; previa.dy = d.dy; previa.dz = d.dz && typeof d.dz === 'object' ? d.dz : null; desenharPrevia(); }
          break;
        // Falha na prévia não pode derrubar a seleção de área em andamento.
        case 'colocacao': try { ok = mostrarColocacao(d); } catch (e) { ok = false; try { pararColocacao(); } catch (e2) { colocacao = null; } } break;
        case 'alturas': extra = alturasDosPisos(d.pontos); ok = !!extra; break;
        case 'cancelar': pararSelecao(); pararPrevia(); break;
        case 'desativar':
          ativo = false; pararSelecao(); pararPrevia(); pararColocacao();
          if (desfazerSonda) desfazerSonda();
          cancelAnimationFrame(quadro); quadro = 0; ultimaGeometria = '';
          document.documentElement.removeAttribute('data-vl-motor-construcao');
          break;
        default: return;
      }
    } catch (e) { ok = false; pararSelecao(); pararPrevia(); }
    responder(Object.assign({ tipo: 'resposta', id: d.id, ok }, extra));
  });
})();
