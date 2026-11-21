// Vagalume — página de opções: módulos, ajustes de cada um, cópia das configurações e redefinição.
// Quase tudo é gravado na hora; o estilo personalizado e as macros têm botão de gravar.
(function () {
  'use strict';

  const { CATALOGO, GRUPOS } = VL.padroes;
  const { FAIXAS, LIMITES } = VL.config;
  const armazem = VL.config.criarArmazem(chrome.storage);
  const el = (id) => document.getElementById(id);

  // Ajustes de cada módulo, na ordem em que aparecem. A seção da configuração leva o nome do módulo.
  const AJUSTES = VL.campos.AJUSTES;

  let cfg = null; // configuração gravada, já validada
  let atalhoCaptura = ''; // atalho da captura, como o navegador informa
  let comboCaptura = ''; // o mesmo atalho na forma usada pelo Vagalume, para achar conflitos
  let serie = 0;
  let relogioAviso = 0;
  let fila = Promise.resolve();
  const pintores = {}; // seção -> funções que levam o valor gravado para a tela
  const pendencias = []; // funções que dizem se há algo escrito e ainda não gravado

  // ---------- utilidades ----------

  function avisar(texto, tipo) {
    const alvo = el('status');
    clearTimeout(relogioAviso);
    alvo.textContent = texto || '';
    if (tipo) alvo.dataset.tipo = tipo;
    else delete alvo.dataset.tipo;
    // Confirmações somem sozinhas; erros e instruções ficam até o próximo aviso.
    if (tipo === 'ok') relogioAviso = setTimeout(() => { alvo.textContent = ''; }, 6000);
  }

  function criar(tag, classe, texto) {
    const no = document.createElement(tag);
    if (classe) no.className = classe;
    if (texto) no.textContent = texto;
    return no;
  }

  function novoId(prefixo) {
    serie += 1;
    return prefixo + '-' + serie;
  }

  function contar(n, um, varios) {
    return n + ' ' + (n === 1 ? um : varios);
  }

  function invalido(campo, texto) {
    campo.setAttribute('aria-invalid', 'true');
    campo.focus();
    avisar(texto, 'erro');
  }

  // Junta mudanças seguidas (setas do teclado, botões do campo numérico) em uma gravação só:
  // o armazenamento sincronizado do navegador limita as gravações por minuto.
  function comPausa(fn, ms) {
    let relogio = 0;
    const disparar = () => { clearTimeout(relogio); relogio = 0; return fn(); };
    const agendar = () => { clearTimeout(relogio); relogio = setTimeout(disparar, ms); };
    agendar.agora = () => (relogio ? disparar() : undefined);
    return agendar;
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

  // Pergunta antes de apagar ou substituir. Só devolve true se a pessoa escolher a ação;
  // "Cancelar" e Esc devolvem false.
  function confirmar(pedido) {
    const caixa = el('confirma');
    el('confirma-titulo').textContent = pedido.titulo;
    el('confirma-texto').textContent = pedido.texto;
    el('confirma-sim').textContent = pedido.acao;
    caixa.returnValue = 'nao';
    return new Promise((responder) => {
      caixa.addEventListener('close', () => responder(caixa.returnValue === 'sim'), { once: true });
      caixa.showModal();
    });
  }

  // ---------- leitura e gravação ----------

  function aoPintar(secao, fn) {
    (pintores[secao] = pintores[secao] || []).push(fn);
  }

  // `forcar` passa por cima do que está em edição: vale para a primeira pintura, importar e redefinir.
  function pintar(secao, forcar) {
    for (const fn of pintores[secao] || []) fn(forcar === true);
  }

  function pintarTudo() {
    for (const secao of Object.keys(pintores)) pintar(secao, true);
  }

  // Gravações em fila: cada uma parte do valor deixado pela anterior, então duas mudanças
  // seguidas na mesma seção não se atropelam.
  function naFila(tarefa) {
    const vez = fila.then(tarefa);
    fila = vez.catch(() => {});
    return vez;
  }

  // `mudar` recebe a seção como está gravada e devolve como ela deve ficar.
  function alterar(secao, mudar) {
    return naFila(async () => {
      cfg[secao] = await armazem.gravar(secao, mudar(cfg[secao]));
      pintar(secao);
      return cfg[secao];
    });
  }

  // Grava uma chave e devolve o valor que ficou depois da validação.
  function gravarChave(secao, chave, valor) {
    return alterar(secao, (atual) => Object.assign({}, atual, { [chave]: valor })).then((salva) => salva[chave]);
  }

  function falhou(secao) {
    avisar('Não foi possível gravar a configuração.', 'erro');
    pintar(secao);
  }

  // Diz por que `combo` não pode ser usado, ou devolve ''.
  // `dono` é quem está pedindo: { painel: true } ou { macro: id }, com id null para macro nova.
  function conflito(combo, dono) {
    if (comboCaptura && combo === comboCaptura) return combo + ' já é o atalho da captura de tela.';
    if (!dono.painel && combo === cfg.painel.atalho) return combo + ' já é o atalho do painel.';
    const outra = cfg.macros.lista.find((m) => m.atalho === combo && m.id !== dono.macro);
    return outra ? combo + ' já é o atalho da macro "' + outra.nome + '".' : '';
  }

  // ---------- campos ----------

  // Linha de ajuste: rótulo de um lado, controle do outro e, se houver, uma nota embaixo.
  function ajuste(def, controle, extras) {
    const bloco = criar('div', def.empilhado ? 'ajuste empilhado' : 'ajuste');
    const linha = criar('div', 'linha');
    const rotulo = criar('label', 'rotulo', def.rotulo);
    if (!controle.id) controle.id = novoId('campo');
    rotulo.id = novoId('rotulo');
    rotulo.htmlFor = controle.id;
    // O nome de um botão vem do texto dele; juntar o rótulo diz para que ele serve.
    if (controle.tagName === 'BUTTON') controle.setAttribute('aria-labelledby', rotulo.id + ' ' + controle.id);
    const valor = criar('span', 'valor');
    valor.appendChild(controle);
    for (const extra of extras || []) valor.appendChild(extra);
    linha.append(rotulo, valor);
    bloco.appendChild(linha);
    if (def.nota) {
      const nota = criar('p', 'nota', def.nota);
      nota.id = novoId('nota');
      controle.setAttribute('aria-describedby', nota.id);
      bloco.appendChild(nota);
    }
    return bloco;
  }

  function campoChave(secao, def) {
    const chave = criar('input', 'chave');
    chave.type = 'checkbox';
    chave.setAttribute('role', 'switch');
    chave.addEventListener('change', async () => {
      try {
        await gravarChave(secao, def.chave, chave.checked);
        avisar('Gravado.', 'ok');
      } catch (erro) {
        falhou(secao);
      }
    });
    aoPintar(secao, () => { chave.checked = cfg[secao][def.chave] === true; });
    return ajuste(def, chave);
  }

  // Campo numérico (tipo 'numero') ou controle deslizante (tipo 'faixa'). A faixa vem de FAIXAS.
  function campoNumero(secao, def) {
    const [minimo, maximo] = FAIXAS[secao + '.' + def.chave];
    const deslizante = def.tipo === 'faixa';
    const campo = criar('input', deslizante ? 'faixa' : 'campo curto');
    campo.type = deslizante ? 'range' : 'number';
    campo.min = String(minimo);
    campo.max = String(maximo);
    campo.step = String(def.passo || 1);
    const sufixo = criar('span', 'suave', deslizante ? '' : def.unidade);
    if (deslizante) sufixo.setAttribute('aria-hidden', 'true'); // o leitor de tela já lê o valor no próprio controle

    function mostrar() {
      if (!deslizante) return;
      sufixo.textContent = campo.value + def.unidade;
      campo.setAttribute('aria-valuetext', campo.value + def.unidade);
    }
    function repor() {
      campo.value = String(cfg[secao][def.chave]);
      mostrar();
    }

    const gravar = comPausa(async () => {
      const n = Number(campo.value);
      if (String(campo.value).trim() === '' || !Number.isFinite(n)) {
        repor();
        avisar('Digite um número de ' + minimo + ' a ' + maximo + '.', 'erro');
        return;
      }
      try {
        const salvo = await gravarChave(secao, def.chave, n);
        if (Number(campo.value) === n) repor(); // se a pessoa já mexeu de novo, a próxima gravação cuida disso
        if (salvo === n) avisar('Gravado.', 'ok');
        else avisar('O valor precisa ser um número inteiro de ' + minimo + ' a ' + maximo + '. Ficou em ' + salvo + '.');
      } catch (erro) {
        falhou(secao);
        repor();
      }
    }, 350);

    campo.addEventListener('input', mostrar);
    campo.addEventListener('change', gravar);
    campo.addEventListener('blur', gravar.agora);
    aoPintar(secao, (forcar) => {
      if (forcar || document.activeElement !== campo) repor();
      if (def.depende) campo.disabled = cfg[secao][def.depende] !== true;
    });

    const faixa = 'Aceita de ' + minimo + ' a ' + maximo + '.';
    const nota = deslizante ? def.nota : (def.nota ? def.nota + ' ' : '') + faixa;
    return ajuste(Object.assign({}, def, { nota }), campo, deslizante || def.unidade ? [sufixo] : []);
  }

  function campoEscolha(secao, def) {
    const campo = criar('select', 'campo medio');
    for (const o of def.opcoes) {
      const opcao = criar('option', '', o.rotulo);
      opcao.value = o.valor;
      campo.appendChild(opcao);
    }
    campo.addEventListener('change', async () => {
      try {
        await gravarChave(secao, def.chave, campo.value);
        avisar('Gravado.', 'ok');
      } catch (erro) {
        falhou(secao);
      }
    });
    aoPintar(secao, () => { campo.value = cfg[secao][def.chave]; });
    return ajuste(def, campo);
  }

  function campoTexto(secao, def) {
    const campo = criar('input', 'campo medio');
    campo.type = 'text';
    campo.maxLength = LIMITES.texto;
    campo.autocomplete = 'off';
    campo.spellcheck = false;
    const repor = () => { campo.value = cfg[secao][def.chave]; };
    campo.addEventListener('change', async () => {
      try {
        await gravarChave(secao, def.chave, campo.value);
        repor();
        avisar('Gravado.', 'ok');
      } catch (erro) {
        falhou(secao);
        repor();
      }
    });
    aoPintar(secao, (forcar) => { if (forcar || document.activeElement !== campo) repor(); });
    return ajuste(def, campo);
  }

  function campoPrefixo(secao, def) {
    const campo = criar('input', 'campo curto');
    campo.type = 'text';
    campo.maxLength = 12;
    campo.autocomplete = 'off';
    campo.spellcheck = false;
    campo.setAttribute('autocapitalize', 'off');
    const exemplo = criar('span', 'suave');
    const mostrar = () => { exemplo.textContent = 'Exemplo: :' + (VL.config.limparPrefixo(campo.value) || '…') + ' ajuda'; };
    const repor = () => { campo.value = cfg[secao][def.chave]; mostrar(); };
    campo.addEventListener('input', mostrar);
    campo.addEventListener('change', async () => {
      const prefixo = VL.config.limparPrefixo(campo.value);
      if (!prefixo) {
        repor();
        avisar('Use / ou uma palavra que comece por letra, com até 12 letras ou números, sem acento e sem espaço.', 'erro');
        return;
      }
      try {
        await gravarChave(secao, def.chave, prefixo);
        repor();
        avisar('Gravado. Os comandos começam com ' + (prefixo === '/' ? '/' : ':' + prefixo + ' ') + '.', 'ok');
      } catch (erro) {
        falhou(secao);
        repor();
      }
    });
    aoPintar(secao, (forcar) => { if (forcar || document.activeElement !== campo) repor(); });
    return ajuste(def, campo, [exemplo]);
  }

  // Botão que lê uma combinação de teclas. Só entra em modo de leitura depois de um clique,
  // e Tab sempre sai dele: o teclado nunca fica preso no campo.
  function capturadorAtalho(aoEscolher) {
    const botao = criar('button', 'botao tecla');
    botao.type = 'button';
    let valor = '';
    let lendo = false;

    function mostrar() {
      botao.textContent = lendo ? 'Pressione as teclas…' : valor || 'Definir atalho';
    }
    function parar() {
      lendo = false;
      mostrar();
    }

    botao.addEventListener('click', () => {
      lendo = !lendo;
      mostrar();
      avisar(lendo ? 'Pressione a combinação de teclas. Esc cancela.' : '');
    });
    botao.addEventListener('blur', () => { if (lendo) parar(); });
    botao.addEventListener('keydown', (ev) => {
      if (!lendo) return;
      if (ev.key === 'Tab') { parar(); return; }
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.key === 'Escape') { parar(); avisar(''); return; }
      const combo = VL.atalhos.deEvento(ev);
      if (!combo) return; // por enquanto só Ctrl, Alt ou Shift, ou uma tecla que o Vagalume não usa
      const r = VL.atalhos.validar(combo);
      if (!r.ok) { avisar(combo + ': ' + r.motivo, 'erro'); return; }
      parar();
      aoEscolher(r.combo);
    });
    // Sem isto, soltar a barra de espaço "clicaria" no botão e encerraria a leitura.
    botao.addEventListener('keyup', (ev) => { if (lendo) ev.preventDefault(); });

    mostrar();
    return {
      no: botao,
      definir(combo) { valor = combo || ''; mostrar(); },
    };
  }

  function campoAtalho(secao, def) {
    const cap = capturadorAtalho(async (combo) => {
      const motivo = conflito(combo, { painel: true });
      if (motivo) { avisar(motivo, 'erro'); return; }
      try {
        await gravarChave(secao, def.chave, combo);
        avisar('Atalho gravado: ' + combo + '.', 'ok');
      } catch (erro) {
        falhou(secao);
      }
    });
    aoPintar(secao, () => cap.definir(cfg[secao][def.chave]));
    return ajuste(def, cap.no);
  }

  function campoTermos(secao, def) {
    const campo = criar('textarea', 'campo');
    campo.rows = 4;
    campo.spellcheck = false;
    let sujo = false;
    pendencias.push(() => sujo);

    function repor() {
      campo.value = cfg[secao][def.chave].join('\n');
      campo.removeAttribute('aria-invalid');
      sujo = false;
    }

    campo.addEventListener('input', () => { sujo = true; campo.removeAttribute('aria-invalid'); });
    const maximo = def.maximo || LIMITES.termos;
    const [um, varios] = def.contagem || ['termo', 'termos'];
    campo.addEventListener('change', async () => {
      const termos = campo.value.split('\n').map((t) => t.trim()).filter(Boolean);
      const longo = termos.find((t) => t.length > LIMITES.texto);
      const distintos = new Set(termos.map((t) => t.toLowerCase())).size;
      let motivo = '';
      if (longo) motivo = '"' + longo.slice(0, 20) + '…" passa de ' + LIMITES.texto + ' caracteres.';
      else if (distintos > maximo) motivo = 'São ' + distintos + ' ' + varios + '; o máximo é ' + maximo + '.';
      if (motivo) {
        campo.setAttribute('aria-invalid', 'true');
        avisar(motivo + ' Nada foi gravado.', 'erro');
        return;
      }
      try {
        const salvos = await gravarChave(secao, def.chave, termos);
        repor();
        avisar('Gravado: ' + contar(salvos.length, um, varios) + '.', 'ok');
      } catch (erro) {
        avisar('Não foi possível gravar a lista.', 'erro');
      }
    });
    aoPintar(secao, (forcar) => { if (forcar || (!sujo && document.activeElement !== campo)) repor(); });
    return ajuste(def, campo);
  }

  function campoCss(secao, def) {
    const campo = criar('textarea', 'campo');
    campo.rows = 12;
    campo.maxLength = LIMITES.css;
    campo.spellcheck = false;
    const tamanho = criar('span', 'suave');
    const gravar = criar('button', 'botao principal', 'Gravar estilo');
    const descartar = criar('button', 'botao', 'Descartar mudanças');
    gravar.type = 'button';
    descartar.type = 'button';
    let sujo = false;
    pendencias.push(() => sujo);

    function marcar(valor) {
      sujo = valor;
      gravar.disabled = !valor;
      descartar.disabled = !valor;
      tamanho.textContent = campo.value.length + ' de ' + LIMITES.css + ' caracteres';
    }
    function repor() {
      campo.value = cfg[secao][def.chave];
      marcar(false);
    }

    campo.addEventListener('input', () => marcar(true));
    gravar.addEventListener('click', async () => {
      const escrito = campo.value;
      try {
        const salvo = await gravarChave(secao, def.chave, escrito);
        repor();
        if (salvo === escrito) avisar('Estilo gravado.', 'ok');
        else avisar('Estilo gravado sem os trechos que o Vagalume não aceita: @import, image-set() e url() de fora.');
        campo.focus(); // o botão acabou de ser desligado; o foco volta para o texto
      } catch (erro) {
        avisar('Não foi possível gravar o estilo.', 'erro');
      }
    });
    descartar.addEventListener('click', () => {
      repor();
      avisar('Mudanças descartadas.');
      campo.focus();
    });
    aoPintar(secao, (forcar) => { if (forcar || !sujo) repor(); });

    const bloco = ajuste(def, campo);
    const acoes = criar('div', 'acoes');
    acoes.append(gravar, descartar, tamanho);
    bloco.appendChild(acoes);
    return bloco;
  }

  function notaCaptura() {
    const nota = criar('p', 'nota');
    aoPintar('comandos', () => {
      nota.textContent = 'Capture pelo popup da extensão, pelo comando ' + (cfg.comandos.prefixo === '/' ? '/' : ':' + cfg.comandos.prefixo + ' ') + 'captura ou '
        + (atalhoCaptura ? 'pelo atalho ' + atalhoCaptura : 'por um atalho de teclado, que ainda não está definido')
        + '. O atalho é escolhido no navegador, em chrome://extensions/shortcuts.';
    });
    return nota;
  }

  // Identificador da macro, usado no comando ":vl macro <id>": minúsculas, números e hífens tirados do nome.
  function idDeMacro(nome, usados) {
    const base = VL.texto.semAcento(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20).replace(/-+$/, '') || 'macro';
    let id = base;
    for (let n = 2; usados.has(id); n += 1) id = base + '-' + n;
    return id;
  }

  // Lista das macros e editor de uma macro por vez.
  function campoMacros(secao) {
    const bloco = criar('div', 'macros');
    const cabeca = criar('div', 'linha');
    const titulo = criar('h4', 'rotulo', 'Suas macros');
    titulo.tabIndex = -1;
    const total = criar('span', 'suave');
    const nova = criar('button', 'botao', 'Nova macro');
    nova.type = 'button';
    cabeca.append(titulo, total, nova);
    const vazio = criar('p', 'nota', 'Nenhuma macro ainda.');
    const lista = criar('ul', 'lista-macros');

    const editor = criar('form', 'editor');
    editor.hidden = true;
    editor.noValidate = true;
    const tituloEditor = criar('h4');
    tituloEditor.id = novoId('titulo');
    editor.setAttribute('aria-labelledby', tituloEditor.id);
    const nome = criar('input', 'campo medio');
    nome.type = 'text';
    nome.maxLength = LIMITES.texto;
    nome.autocomplete = 'off';
    const falas = criar('textarea', 'campo');
    falas.rows = 6;
    const contagem = criar('span', 'suave');
    const tirar = criar('button', 'botao', 'Tirar atalho');
    tirar.type = 'button';
    const gravar = criar('button', 'botao principal', 'Gravar macro');
    gravar.type = 'submit';
    const cancelar = criar('button', 'botao', 'Cancelar');
    cancelar.type = 'button';

    let edicao = null; // { id, atalho } enquanto o editor está aberto; id null = macro nova
    let alterado = false;
    pendencias.push(() => !!edicao && alterado);

    const cap = capturadorAtalho((combo) => {
      const motivo = conflito(combo, { macro: edicao.id });
      if (motivo) { avisar(motivo, 'erro'); return; }
      edicao.atalho = combo;
      alterado = true;
      mostrarAtalho();
      avisar('Atalho escolhido: ' + combo + '. Ele passa a valer quando você gravar a macro.');
    });

    function mostrarAtalho() {
      cap.definir(edicao ? edicao.atalho : '');
      tirar.disabled = !(edicao && edicao.atalho);
    }
    function contarFalas() {
      const n = falas.value.split('\n').filter((l) => l.trim()).length;
      contagem.textContent = n + ' de ' + LIMITES.linhas + ' falas';
    }
    function abrir(macro) {
      edicao = { id: macro ? macro.id : null, atalho: macro ? macro.atalho : '' };
      alterado = false;
      tituloEditor.textContent = macro ? 'Editar a macro ' + macro.nome : 'Nova macro';
      nome.value = macro ? macro.nome : '';
      falas.value = macro ? macro.linhas.join('\n') : '';
      nome.removeAttribute('aria-invalid');
      falas.removeAttribute('aria-invalid');
      mostrarAtalho();
      contarFalas();
      editor.hidden = false;
      nome.focus();
    }
    function fechar() {
      edicao = null;
      alterado = false;
      editor.hidden = true;
    }
    function sairDoEditor() {
      fechar();
      (nova.disabled ? titulo : nova).focus();
    }
    async function pedirAbertura(macro) {
      const descartar = !(edicao && alterado) || await confirmar({
        titulo: 'Descartar as mudanças?',
        texto: 'A macro que está aberta tem mudanças que ainda não foram gravadas.',
        acao: 'Descartar',
      });
      if (descartar) abrir(macro);
    }

    async function excluir(macro) {
      const sim = await confirmar({
        titulo: 'Excluir a macro?',
        texto: 'A macro "' + macro.nome + '" será apagada. Não há como desfazer.',
        acao: 'Excluir',
      });
      if (!sim) return;
      try {
        await alterar(secao, (atual) => Object.assign({}, atual, { lista: atual.lista.filter((m) => m.id !== macro.id) }));
        if (edicao && edicao.id === macro.id) fechar();
        avisar('Macro "' + macro.nome + '" excluída.', 'ok');
        (nova.disabled ? titulo : nova).focus();
      } catch (erro) {
        avisar('Não foi possível excluir a macro.', 'erro');
      }
    }

    function pintarLista() {
      const macros = cfg[secao].lista;
      lista.replaceChildren();
      for (const m of macros) {
        const item = criar('li', 'macro');
        const texto = criar('div', 'texto');
        texto.appendChild(criar('strong', '', m.nome));
        texto.appendChild(criar('span', 'nota', (m.atalho || 'sem atalho') + ' · ' + contar(m.linhas.length, 'fala', 'falas')
          + ' · ' + (cfg.comandos.prefixo === '/' ? '/' : ':' + cfg.comandos.prefixo + ' ') + 'macro ' + m.id));
        const editar = criar('button', 'botao', 'Editar');
        editar.type = 'button';
        editar.setAttribute('aria-label', 'Editar a macro ' + m.nome);
        editar.addEventListener('click', () => pedirAbertura(m));
        const apagar = criar('button', 'botao perigo', 'Excluir');
        apagar.type = 'button';
        apagar.setAttribute('aria-label', 'Excluir a macro ' + m.nome);
        apagar.addEventListener('click', () => excluir(m));
        item.append(texto, editar, apagar);
        lista.appendChild(item);
      }
      lista.hidden = macros.length === 0;
      vazio.hidden = macros.length > 0;
      total.textContent = macros.length + ' de ' + LIMITES.macros;
      nova.disabled = macros.length >= LIMITES.macros;
    }

    nova.addEventListener('click', () => pedirAbertura(null));
    cancelar.addEventListener('click', sairDoEditor);
    tirar.addEventListener('click', () => {
      edicao.atalho = '';
      alterado = true;
      mostrarAtalho();
      cap.no.focus(); // "Tirar atalho" acabou de ser desligado
    });
    nome.addEventListener('input', () => { alterado = true; nome.removeAttribute('aria-invalid'); });
    falas.addEventListener('input', () => { alterado = true; falas.removeAttribute('aria-invalid'); contarFalas(); });

    editor.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!edicao) return;
      const nomeLimpo = nome.value.trim();
      const linhas = falas.value.split('\n').map((l) => l.trim()).filter(Boolean);
      const longa = linhas.findIndex((l) => l.length > LIMITES.linha);
      if (!nomeLimpo) { invalido(nome, 'Dê um nome à macro.'); return; }
      if (!linhas.length) { invalido(falas, 'Escreva pelo menos uma fala.'); return; }
      if (linhas.length > LIMITES.linhas) { invalido(falas, 'São ' + linhas.length + ' falas; o máximo é ' + LIMITES.linhas + '.'); return; }
      if (longa >= 0) { invalido(falas, 'A fala ' + (longa + 1) + ' tem ' + linhas[longa].length + ' caracteres; o máximo é ' + LIMITES.linha + '.'); return; }
      const { id, atalho } = edicao;
      const motivo = atalho ? conflito(atalho, { macro: id }) : '';
      if (motivo) { avisar(motivo, 'erro'); return; }
      const existe = cfg[secao].lista.some((m) => m.id === id);
      if (!existe && cfg[secao].lista.length >= LIMITES.macros) {
        avisar('Já existem ' + LIMITES.macros + ' macros, o máximo.', 'erro');
        return;
      }
      try {
        await alterar(secao, (atual) => {
          // Se a macro sumiu enquanto era editada (apagada em outra janela), ela volta como nova.
          const fica = atual.lista.some((m) => m.id === id);
          const feita = { id: fica ? id : idDeMacro(nomeLimpo, new Set(atual.lista.map((m) => m.id))), nome: nomeLimpo, atalho, linhas };
          const lista = fica ? atual.lista.map((m) => (m.id === id ? feita : m)) : atual.lista.concat(feita);
          return Object.assign({}, atual, { lista });
        });
        sairDoEditor();
        avisar('Macro "' + nomeLimpo + '" gravada.', 'ok');
      } catch (erro) {
        avisar('Não foi possível gravar a macro.', 'erro');
      }
    });

    const acoes = criar('div', 'acoes');
    acoes.append(gravar, cancelar);
    editor.append(
      tituloEditor,
      ajuste({ rotulo: 'Nome' }, nome),
      ajuste({ rotulo: 'Atalho', nota: 'Opcional. Sem atalho, a macro roda só pelo comando.' }, cap.no, [tirar]),
      ajuste({ rotulo: 'Falas, uma por linha', empilhado: true, nota: 'Até ' + LIMITES.linhas + ' falas de até ' + LIMITES.linha + ' caracteres cada.' }, falas, [contagem]),
      acoes
    );

    aoPintar(secao, (forcar) => {
      if (forcar) fechar();
      pintarLista();
    });
    aoPintar('comandos', pintarLista); // o comando mostrado em cada macro usa o prefixo atual

    bloco.append(cabeca, vazio, lista, editor);
    return bloco;
  }

  const CAMPOS = {
    chave: campoChave,
    numero: campoNumero,
    faixa: campoNumero,
    texto: campoTexto,
    escolha: campoEscolha,
    'escolha-imagem': campoEscolha, // na página de opções, a lista simples
    prefixo: campoPrefixo,
    atalho: campoAtalho,
    termos: campoTermos,
    css: campoCss,
    captura: notaCaptura,
    lastfm: campoTexto, // o guia e a confirmação ficam no painel do jogo (Alt+V)
    macros: campoMacros,
  };

  // ---------- módulos ----------

  async function alternar(modulo, chave) {
    const ligado = chave.checked;
    try {
      await gravarChave('modulos', modulo.id, ligado);
      avisar(modulo.nome + (ligado ? ': ligado.' : ': desligado.') + (modulo.recarregar ? ' Recarregue o hotel para valer.' : ''), 'ok');
    } catch (erro) {
      falhou('modulos');
    }
  }

  function montarModulo(modulo) {
    const cartao = criar('section', 'cartao');
    cartao.id = 'modulo-' + modulo.id;
    const cabeca = criar('div', 'cabeca');
    const texto = criar('div', 'texto');
    const titulo = criar('h3', '', modulo.nome);
    titulo.id = cartao.id + '-titulo';
    const resumo = criar('p', 'suave', modulo.resumo);
    resumo.id = cartao.id + '-resumo';
    texto.append(titulo, resumo);
    if (modulo.recarregar) texto.appendChild(criar('p', 'recarga', 'Ligar ou desligar só vale depois de recarregar o hotel.'));

    const chave = criar('input', 'chave');
    chave.type = 'checkbox';
    chave.setAttribute('role', 'switch');
    chave.dataset.modulo = modulo.id;
    chave.setAttribute('aria-labelledby', titulo.id);
    chave.setAttribute('aria-describedby', resumo.id);
    chave.addEventListener('change', () => alternar(modulo, chave));
    cabeca.append(texto, chave);
    cartao.setAttribute('aria-labelledby', titulo.id);
    cartao.appendChild(cabeca);

    const defs = AJUSTES[modulo.id] || [];
    if (defs.length) {
      const corpo = criar('div', 'ajustes');
      for (const def of defs) corpo.appendChild(CAMPOS[def.tipo](modulo.id, def));
      cartao.appendChild(corpo);
    }
    aoPintar('modulos', () => { chave.checked = cfg.modulos[modulo.id] === true; });
    return cartao;
  }

  function elo(destino, texto) {
    const a = criar('a', '', texto);
    a.href = destino;
    return a;
  }

  function montarGrupos() {
    const raiz = el('grupos');
    const nav = el('nav');
    for (const grupo of GRUPOS) {
      const modulos = CATALOGO.filter((modulo) => modulo.grupo === grupo.id);
      if (!modulos.length) continue;
      const secao = criar('section', 'grupo');
      secao.id = 'grupo-' + grupo.id;
      const titulo = criar('h2', '', grupo.nome);
      titulo.id = secao.id + '-titulo';
      secao.setAttribute('aria-labelledby', titulo.id);
      secao.appendChild(titulo);
      for (const modulo of modulos) secao.appendChild(montarModulo(modulo));
      raiz.appendChild(secao);
      nav.appendChild(elo('#' + secao.id, grupo.nome));
    }
    nav.appendChild(elo('#grupo-copia', 'Cópia e redefinição'));
  }

  // ---------- cópia e redefinição ----------

  function exportar() {
    const nome = 'vagalume-config-' + carimbo() + '.json';
    baixar(nome, new Blob([VL.config.exportar(cfg)], { type: 'application/json' }));
    avisar('Cópia enviada aos downloads como ' + nome + '.', 'ok');
  }

  async function importar(arquivo) {
    if (arquivo.size > 1024 * 1024) {
      avisar('O arquivo é grande demais para ser uma cópia de configurações do Vagalume.', 'erro');
      return;
    }
    let texto;
    try {
      texto = await arquivo.text();
    } catch (erro) {
      avisar('Não foi possível ler o arquivo.', 'erro');
      return;
    }
    let nova;
    try {
      nova = VL.config.importar(texto);
    } catch (erro) {
      avisar(String((erro && erro.message) || 'O arquivo não pôde ser importado.'), 'erro');
      return;
    }
    const ligados = CATALOGO.filter((modulo) => nova.modulos[modulo.id] === true).length;
    const sim = await confirmar({
      titulo: 'Importar estas configurações?',
      texto: 'O arquivo ' + arquivo.name + ' traz ' + contar(ligados, 'módulo ligado', 'módulos ligados') + ', '
        + contar(nova.macros.lista.length, 'macro', 'macros') + ' e ' + contar(nova.mencoes.termos.length, 'termo', 'termos')
        + '. Tudo o que está configurado agora será substituído.',
      acao: 'Importar e substituir',
    });
    if (!sim) {
      avisar('Importação cancelada. Nada mudou.');
      return;
    }
    try {
      await naFila(async () => { cfg = await armazem.gravarTudo(nova); });
      pintarTudo();
      avisar('Configurações importadas. Recarregue o hotel para tudo valer.', 'ok');
    } catch (erro) {
      // A gravação é feita seção por seção; se parou no meio, a tela volta a mostrar o que ficou gravado.
      try { cfg = await armazem.ler(); pintarTudo(); } catch (outro) { /* a tela fica como estava */ }
      avisar('A importação parou no meio. Confira as opções e tente de novo.', 'erro');
    }
  }

  async function redefinir() {
    const sim = await confirmar({
      titulo: 'Redefinir tudo?',
      texto: 'Todas as configurações do Vagalume voltam ao padrão. Macros, termos e estilo personalizado são apagados e não há como desfazer. Para guardar o que existe hoje, exporte uma cópia antes.',
      acao: 'Apagar e redefinir',
    });
    if (!sim) return;
    try {
      await naFila(async () => {
        await armazem.redefinir();
        cfg = await armazem.ler();
      });
      pintarTudo();
      avisar('Configurações redefinidas. Recarregue o hotel para tudo valer.', 'ok');
    } catch (erro) {
      avisar('Não foi possível redefinir as configurações.', 'erro');
    }
  }

  // ---------- início ----------

  async function lerAtalhoCaptura() {
    try {
      const comandos = await chrome.commands.getAll();
      const captura = comandos.find((c) => c.name === 'capturar-tela');
      atalhoCaptura = (captura && captura.shortcut) || '';
      comboCaptura = VL.atalhos.normalizar(atalhoCaptura);
    } catch (erro) {
      atalhoCaptura = '';
      comboCaptura = '';
    }
  }

  async function iniciar() {
    el('versao').textContent = 'v' + chrome.runtime.getManifest().version;
    try {
      cfg = await armazem.ler();
    } catch (erro) {
      avisar('Não foi possível ler as configurações. Recarregue esta página.', 'erro');
      return;
    }
    await lerAtalhoCaptura();
    montarGrupos();
    pintarTudo();

    el('exportar').addEventListener('click', exportar);
    el('importar').addEventListener('click', () => el('arquivo').click());
    el('arquivo').addEventListener('change', async () => {
      const campo = el('arquivo');
      const arquivo = campo.files && campo.files[0];
      campo.value = ''; // permite escolher o mesmo arquivo de novo
      if (arquivo) await importar(arquivo);
    });
    el('redefinir').addEventListener('click', redefinir);
    for (const id of ['exportar', 'importar', 'redefinir']) el(id).disabled = false;

    // Mudanças feitas no popup, no painel do jogo ou em outra aba de opções aparecem aqui na hora.
    armazem.aoMudar((secao, valor) => {
      cfg[secao] = valor;
      pintar(secao);
    });

    window.addEventListener('beforeunload', (ev) => {
      if (!pendencias.some((tem) => tem())) return;
      ev.preventDefault();
      ev.returnValue = '';
    });
  }

  iniciar();
})();
