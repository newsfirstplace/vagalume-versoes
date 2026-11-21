// Ponte do balão de "digitando" personalizado (mundo da página). Não envia pacotes.
// O jogo pega o desenho do balão com visualização.getAvatarRenderAsset("avatar_addition_user_typing")
// e, a cada quadro, chama animate(sprite) do balão (o original não anima e devolve false). Aqui:
// - getAvatarRenderAsset, na classe da visualização dos avatares, devolve o desenho escolhido para
//   aquele avatar (pelo índice dele no quarto); sem escolha, fica o do jogo;
// - animate, na classe do balão, troca a imagem pelo quadro da vez quando o desenho é animado e
//   devolve true, que faz o jogo redesenhar o avatar (é assim que o "zzz" de ausente se mexe).
// A extensão manda os quadros prontos (imagens) e o mapa índice → estilo.
(function () {
  'use strict';
  if (window.__vlDigitando) return;
  Object.defineProperty(window, '__vlDigitando', { value: true });
  const NOMES = { 'avatar_addition_user_typing': 'grande', 'avatar_addition_user_typing_small': 'pequeno' };
  let pixi = null;
  let motor = null;
  let sondando = false;
  let protoPatchado = null;
  let original = null;
  let balaoPatchado = null;
  const texturas = new Map(); // estilo → { grande: [quadros], pequeno: [quadros], passo }
  const animados = new Map(); // primeira textura do estilo → { lista de quadros, passo }
  // Tamanho de cada textura nossa. O jogo encaixa o canto de cima à esquerda do balão (22 × 18, ou a
  // metade no zoom longe) num ponto fixo; um balão de outro tamanho é recolocado para ficar
  // centralizado no mesmo lugar e apoiado na mesma linha de baixo.
  const medidas = new Map(); // textura → { w, h, f }
  function ajustar(sprite, textura) {
    const m = medidas.get(textura);
    if (!sprite || !m || sprite.__vlAjuste === textura) return;
    sprite.offsetX += Math.round((22 * m.f - m.w) / 2);
    sprite.offsetY += Math.round(18 * m.f - m.h);
    sprite.__vlAjuste = textura;
  }
  let porIndice = new Map(); // índice do avatar no quarto → estilo
  let paraTodos = '';
  let animar = true;
  // Zzz de ausente no tema do Vagalume (para todos os avatares, na tela de quem usa a extensão).
  const zzz = new Map(); // 'avatar_addition_user_idle_left_1' → textura
  let zzzLigado = true;

  function acharPixi() {
    if (pixi) return pixi;
    const fila = window['webpackJsonpnitro-react'];
    if (!fila || fila.push === Array.prototype.push) return null;
    let req;
    const id = 'vl-digitando-' + Math.random().toString(36).slice(2);
    try { fila.push([[id], { [id]: (m, e, r) => { req = r; } }, [[id]]]); } catch (e) { return null; }
    for (const m of Object.values(req && req.c || {})) {
      const e = m && m.exports;
      if (e && e.Ticker && e.Texture && e.Sprite) { pixi = e; break; }
    }
    return pixi;
  }
  // O motor do quarto é o contexto de um ouvinte do ticker (o mesmo caminho da ponte da construção).
  // A sonda só olha e sai: se outro código trocar o método depois, ela vira passagem.
  function acharMotor() {
    if (motor || sondando || !acharPixi()) return;
    sondando = true;
    const proto = pixi.Ticker.prototype;
    const anterior = proto.update;
    let ligada = true;
    const sonda = function () {
      if (ligada) {
        try {
          let no = this._head;
          for (let i = 0; no && i < 500; i++, no = no.next) {
            const c = no.context;
            if (c && typeof c.getRoomObjects === 'function' && typeof c.getActiveRoomInstanceRenderingCanvas === 'function') { motor = c; desligar(); break; }
          }
        } catch (e) { /* estrutura do cliente mudou */ }
      }
      return anterior.apply(this, arguments);
    };
    const tempo = setTimeout(desligar, 3000);
    function desligar() {
      ligada = false;
      clearTimeout(tempo);
      if (proto.update === sonda) proto.update = anterior;
      sondando = false;
      if (motor) patchar();
    }
    proto.update = sonda;
  }
  // Quadro da vez de um desenho animado (pelo relógio, igual para todos os avatares).
  function quadroDaVez(anim) {
    const n = anim.lista.length;
    return anim.lista[Math.floor(performance.now() / anim.passo) % n] || anim.lista[0];
  }
  // Na primeira vez que um balão pede o desenho, troca o animate na classe dele (vale para todos).
  function patcharBalao(visualizacao) {
    if (balaoPatchado || !visualizacao || !visualizacao._additions || typeof visualizacao._additions.values !== 'function') return;
    for (const adicao of visualizacao._additions.values()) {
      let p = adicao && Object.getPrototypeOf(adicao);
      if (!p || typeof p.animate !== 'function' || typeof p.update !== 'function') continue;
      if (!String(p.update).includes('user_typing')) continue;
      const animateOriginal = p.animate;
      const updateOriginal = p.update;
      // update põe a posição de novo a cada vez: depois dele, recoloca o balão maior.
      p.update = function (sprite) {
        if (sprite) sprite.__vlAjuste = null;
        const r = updateOriginal.apply(this, arguments);
        try { if (sprite && this._asset) ajustar(sprite, this._asset); } catch (e) { /* segue */ }
        return r;
      };
      p.animate = function (sprite) {
        // O primeiro update deste balão rodou antes da troca: recoloca uma vez aqui.
        try { if (sprite && this._asset && sprite.__vlAjuste !== this._asset) ajustar(sprite, this._asset); } catch (e) { /* segue */ }
        const anim = animar && this._asset && animados.get(this._asset);
        if (anim && sprite) {
          const t = quadroDaVez(anim);
          if (sprite.texture !== t) { sprite.texture = t; return true; }
          return false;
        }
        return animateOriginal.call(this, sprite);
      };
      balaoPatchado = p;
      document.documentElement.setAttribute('data-vl-digitando-animado', 'pronto');
      return;
    }
  }
  // Troca o método na classe da visualização dos avatares (uma vez; vale para todos os quartos).
  function patchar() {
    if (protoPatchado || !motor) return;
    let lista = null;
    try { lista = motor.getRoomObjects(motor.activeRoomId, 100); } catch (e) { lista = null; }
    for (const obj of lista || []) {
      let p = obj && obj.visualization;
      while (p && !Object.prototype.hasOwnProperty.call(p, 'getAvatarRenderAsset')) p = Object.getPrototypeOf(p);
      if (!p || typeof p.getAvatarRenderAsset !== 'function') continue;
      original = p.getAvatarRenderAsset;
      p.getAvatarRenderAsset = function (nome) {
        if (zzzLigado && zzz.has(nome)) return zzz.get(nome);
        const tamanho = NOMES[nome];
        if (tamanho) {
          const id = this.object && this.object.id;
          const estilo = porIndice.get(Number(id)) || paraTodos;
          const t = estilo && texturas.get(estilo);
          const quadros = t && t[tamanho];
          if (quadros && quadros[0]) {
            if (!balaoPatchado) { try { patcharBalao(this); } catch (e) { /* segue sem animar */ } }
            return quadros[0];
          }
        }
        return original.call(this, nome);
      };
      protoPatchado = p;
      document.documentElement.setAttribute('data-vl-digitando', 'pronto');
      return;
    }
  }
  function carregarImagem(url, f) {
    return new Promise(function (resolver) {
      const img = new Image();
      img.onload = function () {
        try {
          const t = pixi.Texture.from(img);
          if (f) medidas.set(t, { w: img.naturalWidth, h: img.naturalHeight, f });
          if (t.baseTexture && pixi.SCALE_MODES) t.baseTexture.scaleMode = pixi.SCALE_MODES.NEAREST;
          resolver(t);
        } catch (e) { resolver(null); }
      };
      img.onerror = function () { resolver(null); };
      img.src = url;
    });
  }
  async function carregarEstilo(estilo, d) {
    if (!acharPixi() || texturas.has(estilo)) return;
    const pronto = { grande: null, pequeno: null };
    texturas.set(estilo, pronto);
    const passo = Number(d.passo) > 30 ? Number(d.passo) : 110;
    for (const tamanho of ['grande', 'pequeno']) {
      const f = tamanho === 'grande' ? 1 : 0.5;
      const lista = (await Promise.all(d[tamanho].map((u) => carregarImagem(u, f)))).filter(Boolean);
      if (!lista.length) continue;
      pronto[tamanho] = lista;
      // A primeira imagem é a que o jogo guarda no balão; por ela o animate acha os outros quadros.
      if (lista.length > 1) animados.set(lista[0], { lista, passo });
    }
  }
  const PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
  document.addEventListener('vl:digitando:extensao', function (ev) {
    let m;
    try { m = JSON.parse(ev.detail); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.tipo === 'desenhos' && m.desenhos && typeof m.desenhos === 'object') {
      if (!acharPixi()) { if ((m.tentativa || 0) < 30) setTimeout(function () { document.dispatchEvent(new CustomEvent('vl:digitando:extensao', { detail: JSON.stringify(Object.assign({}, m, { tentativa: (m.tentativa || 0) + 1 })) })); }, 2000); return; }
      for (const [estilo, d] of Object.entries(m.desenhos)) {
        if (!/^[a-z0-9-]{1,30}$/.test(estilo) || !d) continue;
        const ok = (l) => Array.isArray(l) && l.length >= 1 && l.length <= 24 && l.every((u) => typeof u === 'string' && PNG.test(u));
        if (ok(d.grande) && ok(d.pequeno)) carregarEstilo(estilo, d);
      }
    } else if (m.tipo === 'zzz' && m.imagens && typeof m.imagens === 'object') {
      zzzLigado = m.ligado !== false;
      // O Pixi do jogo pode ainda não estar pronto: tenta de novo por até 1 minuto.
      if (!acharPixi()) { if ((m.tentativa || 0) < 30) setTimeout(function () { document.dispatchEvent(new CustomEvent('vl:digitando:extensao', { detail: JSON.stringify(Object.assign({}, m, { tentativa: (m.tentativa || 0) + 1 })) })); }, 2000); return; }
      for (const [nome, url] of Object.entries(m.imagens)) {
        if (!/^(left|right)_[12]$/.test(nome) || typeof url !== 'string' || !PNG.test(url)) continue;
        const chave = 'avatar_addition_user_idle_' + nome;
        if (!zzz.has(chave)) carregarImagem(url).then(function (t) { if (t) zzz.set(chave, t); });
      }
      if (!protoPatchado) { if (motor) patchar(); else acharMotor(); }
    } else if (m.tipo === 'mapa' && m.mapa && typeof m.mapa === 'object') {
      const novo = new Map();
      for (const [indice, estilo] of Object.entries(m.mapa)) if (/^\d{1,9}$/.test(indice) && typeof estilo === 'string') novo.set(Number(indice), estilo);
      porIndice = novo;
      paraTodos = typeof m.todos === 'string' ? m.todos : '';
      animar = m.animar !== false;
      if (!protoPatchado) { if (motor) patchar(); else acharMotor(); }
    }
  });
  // Tenta de novo de vez em quando até achar o motor e um avatar no quarto.
  const insistir = setInterval(function () {
    if (protoPatchado) { clearInterval(insistir); return; }
    if (motor) patchar(); else acharMotor();
  }, 4000);
})();
