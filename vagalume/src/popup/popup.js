// Vagalume — popup: estado da aba, captura de tela e chaves dos módulos.
// O popup captura por conta própria: o fundo só atende pedidos de captura vindos de uma aba.
(function () {
  'use strict';

  const { CATALOGO, GRUPOS } = VL.padroes;
  const armazem = VL.config.criarArmazem(chrome.storage);
  const HOTEL = /^https?:\/\/([a-z0-9-]+\.)*habblet\.city\/hotel/i;
  const ERROS = {
    permissao: 'O navegador não liberou a captura desta aba. Feche o popup, clique de novo no ícone e tente outra vez.',
    limite: 'Muitas capturas seguidas. Espere um instante e tente de novo.',
    falha: 'Não foi possível capturar a aba.',
  };
  const el = (id) => document.getElementById(id);
  const espera = (ms) => new Promise((ok) => setTimeout(ok, ms, null));

  let cfg = null; // configuração lida do armazenamento
  let aba = null; // aba do hotel em primeiro plano, quando houver
  let ocupado = false;
  let fila = Promise.resolve(); // gravações dos módulos, uma de cada vez
  const pedemRecarga = new Set(); // módulos trocados que só valem depois de recarregar o hotel

  function avisar(texto, tipo) {
    const alvo = el('status');
    alvo.textContent = texto || '';
    if (tipo) alvo.dataset.tipo = tipo;
    else delete alvo.dataset.tipo;
  }

  function criar(tag, classe, texto) {
    const no = document.createElement(tag);
    if (classe) no.className = classe;
    if (texto) no.textContent = texto;
    return no;
  }

  // ---------- captura ----------

  function atualizarCaptura() {
    const ligada = !!cfg && cfg.modulos.captura === true;
    const bloqueado = !(aba && ligada && !ocupado);
    el('salvar').disabled = bloqueado;
    el('copiar').disabled = bloqueado;
    el('editar').disabled = bloqueado;
    let texto = 'A captura funciona com o hotel aberto na aba atual.';
    if (aba) texto = ligada || !cfg ? 'Hotel aberto nesta aba.' : 'Hotel aberto nesta aba. O módulo Captura de tela está desligado.';
    el('aba').textContent = texto;
  }

  // Fala com o script da aba. Sem resposta (script ausente ou módulo parado), devolve null.
  async function pedir(tipo) {
    try {
      return await Promise.race([chrome.tabs.sendMessage(aba.id, { tipo }), espera(800)]);
    } catch (erro) {
      return null;
    }
  }

  function paraBlob(dataUrl) {
    const binario = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  }

  function carimbo() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function baixar(nome, blob) {
    const url = URL.createObjectURL(blob);
    const link = criar('a');
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // A imagem espera o editor no armazenamento de sessão, que some quando o navegador fecha.
  async function abrirEditor(dataUrl) {
    if (!VL.recorte.imagemValida(dataUrl)) {
      avisar('A imagem é grande demais para o editor. Use Salvar imagem.', 'erro');
      return;
    }
    await chrome.storage.session.set({ [VL.recorte.CHAVE]: dataUrl });
    await chrome.tabs.create({ url: chrome.runtime.getURL('src/captura/captura.html'), index: aba.index + 1, openerTabId: aba.id });
  }

  // modo: 'salvar', 'copiar' ou 'editar'.
  async function capturar(modo) {
    if (ocupado || !aba) return;
    ocupado = true;
    atualizarCaptura();
    avisar('Capturando…');
    let dataUrl = '';
    let motivo = 'falha';
    try {
      await pedir('captura:ocultar'); // tira a camada do Vagalume da imagem
      dataUrl = await chrome.tabs.captureVisibleTab(aba.windowId, { format: 'png' });
    } catch (erro) {
      const detalhe = String((erro && erro.message) || erro);
      if (/activeTab|all_urls|permission/i.test(detalhe)) motivo = 'permissao';
      else if (/MAX_CAPTURE|quota/i.test(detalhe)) motivo = 'limite';
    }
    pedir('captura:mostrar');
    try {
      if (!dataUrl) {
        avisar(ERROS[motivo], 'erro');
        return;
      }
      if (modo === 'editar') {
        await abrirEditor(dataUrl);
        return;
      }
      const blob = paraBlob(dataUrl);
      const nome = 'vagalume-' + carimbo() + '.png';
      if (modo === 'copiar') {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          avisar('Imagem copiada.', 'ok');
          return;
        } catch (erro) {
          // Sem acesso à área de transferência: a imagem vai para os downloads.
        }
        baixar(nome, blob);
        avisar('Não foi possível copiar. A imagem foi enviada aos downloads como ' + nome + '.');
        return;
      }
      baixar(nome, blob);
      avisar('Imagem enviada aos downloads como ' + nome + '.', 'ok');
    } catch (erro) {
      avisar(ERROS.falha, 'erro');
    } finally {
      ocupado = false;
      atualizarCaptura();
    }
  }

  // ---------- módulos ----------

  function chaves() {
    return Array.from(document.querySelectorAll('input[data-modulo]'));
  }

  function pintarModulos() {
    for (const chave of chaves()) chave.checked = cfg.modulos[chave.dataset.modulo] === true;
  }

  async function alternar(modulo, chave) {
    const ligado = chave.checked;
    // Em fila: cada gravação parte do valor deixado pela anterior, então duas trocas seguidas não se atropelam.
    const vez = fila.then(async () => {
      cfg.modulos = await armazem.gravar('modulos', Object.assign({}, cfg.modulos, { [modulo.id]: ligado }));
    });
    fila = vez.catch(() => {});
    try {
      await vez;
      if (modulo.recarregar) pedemRecarga.add(modulo.id);
      // O pedido de recarga continua no aviso mesmo depois de trocar outra chave.
      avisar(modulo.nome + (ligado ? ': ligado.' : ': desligado.') + (pedemRecarga.size ? ' Recarregue o hotel para valer.' : ''), 'ok');
    } catch (erro) {
      pintarModulos(); // as chaves voltam a mostrar o que está gravado
      avisar('Não foi possível gravar a configuração.', 'erro');
    }
    atualizarCaptura();
  }

  function montarModulos() {
    const raiz = el('modulos');
    for (const grupo of GRUPOS) {
      const itens = CATALOGO.filter((modulo) => modulo.grupo === grupo.id);
      if (!itens.length) continue;
      const secao = criar('section', 'grupo');
      secao.appendChild(criar('h2', '', grupo.nome));
      for (const modulo of itens) {
        const linha = criar('label', 'modulo');
        linha.title = modulo.resumo;
        const nome = criar('span', 'nome', modulo.nome);
        if (modulo.recarregar) nome.appendChild(criar('small', '', 'vale após recarregar o hotel'));
        const chave = criar('input', 'chave');
        chave.type = 'checkbox';
        chave.setAttribute('role', 'switch');
        chave.dataset.modulo = modulo.id;
        chave.disabled = true; // liberada quando a configuração chegar
        chave.addEventListener('change', () => alternar(modulo, chave));
        linha.append(nome, chave);
        secao.appendChild(linha);
      }
      raiz.appendChild(secao);
    }
  }

  // ---------- início ----------

  async function iniciar() {
    el('versao').textContent = 'v' + chrome.runtime.getManifest().version;
    montarModulos();
    el('salvar').addEventListener('click', () => capturar('salvar'));
    el('copiar').addEventListener('click', () => capturar('copiar'));
    el('editar').addEventListener('click', () => capturar('editar'));

    try {
      const abas = await chrome.tabs.query({ active: true, currentWindow: true });
      aba = abas[0] && HOTEL.test(String(abas[0].url || '')) ? abas[0] : null;
    } catch (erro) {
      aba = null;
    }

    try {
      cfg = await armazem.ler();
    } catch (erro) {
      atualizarCaptura();
      avisar('Não foi possível ler as configurações.', 'erro');
      return;
    }
    for (const chave of chaves()) chave.disabled = false;
    pintarModulos();
    atualizarCaptura();

    // Mudanças feitas na página de opções ou no painel do jogo aparecem aqui na hora.
    armazem.aoMudar((secao, valor) => {
      cfg[secao] = valor;
      if (secao === 'modulos') {
        pintarModulos();
        atualizarCaptura();
      }
    });
  }

  iniciar();
})();
