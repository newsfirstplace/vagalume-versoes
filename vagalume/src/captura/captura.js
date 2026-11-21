// Vagalume — editor da captura: recortar, carimbar a data e copiar ou salvar a imagem.
// A imagem chega por chrome.storage.session (deixada pelo popup ou pelo service worker) e não sai
// deste computador.
(function () {
  'use strict';

  const R = VL.recorte;
  const el = (id) => document.getElementById(id);
  const tela = el('imagem');

  let original = null; // canvas com a captura inteira
  let atual = null;    // canvas com o que está sendo editado (inteira ou recortada)
  let selecao = null;  // { x, y, w, h } em pixels da imagem atual
  let inicio = null;   // ponto onde o arraste começou

  function avisar(texto, tipo) {
    const alvo = el('status');
    alvo.textContent = texto || '';
    if (tipo) alvo.dataset.tipo = tipo;
    else delete alvo.dataset.tipo;
  }

  function copiaDe(origem, ret) {
    const r = ret || { x: 0, y: 0, w: origem.width, h: origem.height };
    const c = document.createElement('canvas');
    c.width = r.w;
    c.height = r.h;
    c.getContext('2d').drawImage(origem, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    return c;
  }

  function desenhar() {
    tela.width = atual.width;
    tela.height = atual.height;
    tela.getContext('2d').drawImage(atual, 0, 0);
    el('tamanho').textContent = atual.width + ' × ' + atual.height + ' px';
    el('inteira').disabled = atual === original;
    mostrarSelecao();
  }

  function mostrarSelecao() {
    const caixa = el('selecao');
    el('recortar').disabled = !selecao;
    if (!selecao) { caixa.hidden = true; return; }
    const pos = R.naTela(selecao, tela.getBoundingClientRect(), atual.width, atual.height);
    caixa.style.left = pos.left + 'px';
    caixa.style.top = pos.top + 'px';
    caixa.style.width = pos.width + 'px';
    caixa.style.height = pos.height + 'px';
    caixa.hidden = false;
  }

  function ponto(ev) {
    return R.paraImagem({ x: ev.clientX, y: ev.clientY }, tela.getBoundingClientRect(), atual.width, atual.height);
  }

  // Imagem final: a atual, com o carimbo de data e hora no canto se a opção estiver ligada.
  function imagemFinal() {
    const c = copiaDe(atual);
    if (!el('carimbo').checked) return c;
    const ctx = c.getContext('2d');
    const texto = R.textoCarimbo(new Date());
    const tamanho = Math.max(12, Math.round(Math.min(c.width, c.height) / 28));
    ctx.font = '600 ' + tamanho + 'px system-ui, sans-serif';
    const largura = ctx.measureText(texto).width;
    const folga = Math.round(tamanho * 0.6);
    const x = c.width - largura - folga * 2;
    const y = c.height - tamanho - folga * 2;
    ctx.fillStyle = 'rgba(18, 22, 31, 0.78)';
    ctx.fillRect(x, y, largura + folga * 2, tamanho + folga * 2);
    ctx.fillStyle = '#e8ecf3';
    ctx.textBaseline = 'top';
    ctx.fillText(texto, x + folga, y + folga);
    return c;
  }

  function paraBlob(canvas) {
    return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('sem imagem'))), 'image/png'));
  }

  function baixar(nome, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function salvar() {
    try {
      const nome = R.nomeArquivo(new Date());
      baixar(nome, await paraBlob(imagemFinal()));
      avisar('Imagem enviada aos downloads como ' + nome + '.', 'ok');
    } catch (erro) {
      avisar('Não foi possível salvar a imagem.', 'erro');
    }
  }

  async function copiar() {
    try {
      const blob = await paraBlob(imagemFinal());
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      avisar('Imagem copiada.', 'ok');
    } catch (erro) {
      avisar('Não foi possível copiar. Use Salvar.', 'erro');
    }
  }

  function ligarEventos() {
    tela.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      tela.setPointerCapture(ev.pointerId);
      inicio = ponto(ev);
      selecao = null;
      mostrarSelecao();
    });
    tela.addEventListener('pointermove', (ev) => {
      if (!inicio) return;
      selecao = R.retangulo(inicio, ponto(ev), atual.width, atual.height);
      mostrarSelecao();
    });
    const soltar = (ev) => {
      if (!inicio) return;
      selecao = R.retangulo(inicio, ponto(ev), atual.width, atual.height);
      inicio = null;
      mostrarSelecao();
      if (selecao) avisar('Seleção de ' + selecao.w + ' × ' + selecao.h + ' px. Use "Recortar seleção".');
    };
    tela.addEventListener('pointerup', soltar);
    tela.addEventListener('pointercancel', () => { inicio = null; });
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && selecao) { selecao = null; mostrarSelecao(); avisar(''); }
    });
    window.addEventListener('resize', mostrarSelecao);

    el('recortar').addEventListener('click', () => {
      if (!selecao) return;
      atual = copiaDe(atual, selecao);
      selecao = null;
      desenhar();
      avisar('Recortado.', 'ok');
    });
    el('inteira').addEventListener('click', () => {
      atual = original;
      selecao = null;
      desenhar();
      avisar('De volta à imagem inteira.');
    });
    el('copiar').addEventListener('click', copiar);
    el('salvar').addEventListener('click', salvar);
  }

  function carregar(dataUrl) {
    return new Promise((ok, falha) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => falha(new Error('imagem inválida'));
      img.src = dataUrl;
    });
  }

  async function iniciar() {
    let dataUrl = '';
    try {
      const guardado = await chrome.storage.session.get(R.CHAVE);
      dataUrl = guardado[R.CHAVE];
    } catch (erro) {
      dataUrl = '';
    }
    if (!R.imagemValida(dataUrl)) {
      avisar('Nenhuma captura para editar. Capture a tela pelo popup do Vagalume ou pelo comando de captura no hotel.', 'erro');
      return;
    }
    try {
      const img = await carregar(dataUrl);
      original = copiaDe(img, { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight });
    } catch (erro) {
      avisar('Não foi possível abrir a imagem.', 'erro');
      return;
    }
    atual = original;
    el('moldura').hidden = false;
    desenhar();
    ligarEventos();
    for (const id of ['copiar', 'salvar', 'carimbo']) el(id).disabled = false;
  }

  iniciar();
})();
