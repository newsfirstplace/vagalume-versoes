// Vagalume — núcleo do script de conteúdo. Liga e desliga os módulos conforme a configuração e dá
// a cada um um contexto com limpeza automática. Não toca no DOM, por isso pode ser testado no Node.
(function (raiz) {
  'use strict';
  const VL = (raiz.VL = raiz.VL || {});
  const noNode = typeof module !== 'undefined' && !!module.exports;
  const config = noNode ? require('../core/config.js') : VL.config;
  const nucleoComandos = noNode ? require('../core/comandos.js') : VL.comandos;

  function criarNucleo(opcoes) {
    const op = opcoes || {};
    const registrarErro = typeof op.aoErro === 'function'
      ? op.aoErro
      : function (texto, erro) { try { console.warn('[Vagalume] ' + texto, erro || ''); } catch (e) { /* sem console */ } };
    // Depois que a extensão é recarregada, o script antigo continua na página, mas sem acesso à extensão.
    const contextoValido = typeof op.contextoValido === 'function'
      ? op.contextoValido
      : function () { return typeof chrome === 'undefined' || !!(chrome.runtime && chrome.runtime.id); };

    const definicoes = new Map(); // id -> definição do módulo
    const ativos = new Map();     // id -> { limpezas: [], aoConfig: [] }
    const ouvintes = new Map();   // evento -> Set de funções
    const abas = new Map();       // id -> definição da aba do painel
    const comandos = nucleoComandos.criarRegistro();
    let cfg = config.mesclar({});
    let armazem = null;
    let soltarArmazem = null;
    let estado = 'parado'; // 'parado' | 'iniciando' | 'ativo'

    // ---------- barramento de eventos ----------

    function ouvir(evento, fn) {
      if (typeof fn !== 'function') return function () {};
      let grupo = ouvintes.get(evento);
      if (!grupo) { grupo = new Set(); ouvintes.set(evento, grupo); }
      grupo.add(fn);
      return function () { grupo.delete(fn); };
    }

    function emitir(evento, dado) {
      const grupo = ouvintes.get(evento);
      if (!grupo) return;
      for (const fn of Array.from(grupo)) {
        try { fn(dado); } catch (erro) { registrarErro('Falha em um ouvinte de "' + evento + '".', erro); }
      }
    }

    // ---------- abas do painel ----------

    function registrarAba(def) {
      if (!def || typeof def.id !== 'string' || !def.id || typeof def.montar !== 'function') throw new Error('Aba inválida.');
      if (abas.has(def.id)) throw new Error('Aba repetida: ' + def.id);
      abas.set(def.id, def);
      emitir('abas');
      return function () {
        if (abas.get(def.id) !== def) return;
        abas.delete(def.id);
        emitir('abas');
      };
    }

    function listarAbas() {
      return Array.from(abas.values()).sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || String(a.titulo).localeCompare(String(b.titulo)));
    }

    // ---------- configuração ----------

    async function gravar(secao, valor) {
      if (!armazem) throw new Error('O Vagalume ainda não foi iniciado.');
      try {
        return await armazem.gravar(secao, valor);
      } catch (erro) {
        if (!contextoValido()) encerrar();
        throw erro;
      }
    }

    // Muda só alguns campos de uma seção, partindo do que está gravado agora (e não da cópia em
    // memória, que pode estar atrasada): assim um comando não desfaz o que a página de opções acabou de gravar.
    async function alterar(secao, campos) {
      if (!armazem) throw new Error('O Vagalume ainda não foi iniciado.');
      let atual = cfg[secao];
      try { const lido = await armazem.ler(); if (lido && lido[secao]) atual = lido[secao]; } catch (erro) { /* fica a cópia em memória */ }
      return gravar(secao, Object.assign({}, atual, campos));
    }

    // ---------- módulos ----------

    function criarContexto(id, reg) {
      const aoParar = function (fn) {
        if (typeof fn === 'function') reg.limpezas.push(fn);
        return fn;
      };
      return {
        id,
        config: () => cfg,
        secao: (nome) => cfg[nome || id],
        gravar,
        alterar,
        emitir,
        ouvir: (evento, fn) => aoParar(ouvir(evento, fn)),
        comando: (def) => aoParar(comandos.registrar(def)),
        aba: (def) => aoParar(registrarAba(def)),
        // Ouvinte de evento do DOM que se desfaz sozinho e se cala quando a extensão foi recarregada.
        escutar(alvo, tipo, fn, opcoesEscuta) {
          const protegido = function (ev) {
            if (!contextoValido()) { encerrar(); return undefined; }
            return fn.call(this, ev);
          };
          alvo.addEventListener(tipo, protegido, opcoesEscuta);
          return aoParar(function () { alvo.removeEventListener(tipo, protegido, opcoesEscuta); });
        },
        aoParar,
        // Quem registra aoConfig trata as mudanças por conta própria e não é reiniciado.
        aoConfig(fn) { if (typeof fn === 'function') reg.aoConfig.push(fn); },
        ativo: (outroId) => ativos.has(outroId),
      };
    }

    function desfazer(reg) {
      reg.aoConfig.length = 0;
      while (reg.limpezas.length) {
        const fn = reg.limpezas.pop();
        try { fn(); } catch (erro) { registrarErro('Falha ao encerrar um módulo.', erro); }
      }
    }

    function ligar(id) {
      const def = definicoes.get(id);
      if (!def || ativos.has(id)) return false;
      const reg = { limpezas: [], aoConfig: [] };
      ativos.set(id, reg);
      try {
        const parar = def.iniciar(criarContexto(id, reg));
        if (typeof parar === 'function') reg.limpezas.push(parar);
      } catch (erro) {
        ativos.delete(id);
        desfazer(reg);
        registrarErro('O módulo "' + id + '" não pôde ser iniciado.', erro);
        return false;
      }
      emitir('modulo', { id, ativo: true });
      return true;
    }

    function desligar(id) {
      const reg = ativos.get(id);
      if (!reg) return false;
      ativos.delete(id);
      desfazer(reg);
      emitir('modulo', { id, ativo: false });
      return true;
    }

    function aplicar() {
      for (const id of Array.from(definicoes.keys())) {
        const deve = estado === 'ativo' && cfg.modulos[id] === true;
        if (deve && !ativos.has(id)) ligar(id);
        else if (!deve && ativos.has(id)) desligar(id);
      }
    }

    function definirModulo(def) {
      if (!def || typeof def.id !== 'string' || !def.id || typeof def.iniciar !== 'function') throw new Error('Módulo inválido.');
      if (definicoes.has(def.id)) throw new Error('Módulo repetido: ' + def.id);
      definicoes.set(def.id, def);
      if (estado === 'ativo' && cfg.modulos[def.id] === true) ligar(def.id);
    }

    function aoMudarSecao(secao, valor) {
      if (estado !== 'ativo' || !valor || !(secao in cfg)) return;
      cfg = Object.assign({}, cfg, { [secao]: valor });
      if (secao === 'modulos') {
        aplicar();
      } else {
        for (const [id, reg] of Array.from(ativos)) {
          if (ativos.get(id) !== reg) continue; // parou no meio do caminho
          if (reg.aoConfig.length) {
            for (const fn of reg.aoConfig.slice()) {
              try { fn(secao); } catch (erro) { registrarErro('O módulo "' + id + '" falhou ao aplicar a configuração.', erro); }
            }
          } else if (secao === id) {
            desligar(id);
            ligar(id);
          }
        }
      }
      emitir('config', { secao });
    }

    // ---------- ciclo de vida ----------

    async function iniciar(novoArmazem) {
      if (estado !== 'parado') return false;
      if (!novoArmazem || typeof novoArmazem.ler !== 'function') throw new Error('Armazém inválido.');
      estado = 'iniciando';
      armazem = novoArmazem;
      let lido;
      try {
        lido = await armazem.ler();
      } catch (erro) {
        lido = config.mesclar({});
        registrarErro('Não foi possível ler as configurações; usando os padrões.', erro);
      }
      if (estado !== 'iniciando') return false; // encerrado durante a leitura
      cfg = lido;
      try { soltarArmazem = armazem.aoMudar(aoMudarSecao); } catch (erro) { soltarArmazem = null; }
      estado = 'ativo';
      aplicar();
      emitir('config', { secao: null });
      return true;
    }

    function encerrar() {
      if (estado === 'parado') return;
      estado = 'parado';
      for (const id of Array.from(ativos.keys()).reverse()) desligar(id);
      if (soltarArmazem) {
        try { soltarArmazem(); } catch (erro) { /* contexto já inválido */ }
        soltarArmazem = null;
      }
      armazem = null;
      if (raiz.VL && raiz.VL.camada && typeof raiz.VL.camada.remover === 'function') {
        try { raiz.VL.camada.remover(); } catch (erro) { /* nada a desfazer */ }
      }
    }

    return {
      definirModulo, iniciar, encerrar,
      config: () => cfg,
      gravar, ouvir, emitir, comandos,
      registrarAba, listarAbas,
      ativo: (id) => ativos.has(id),
      modulos: () => Array.from(definicoes.keys()),
      estado: () => estado,
      contextoValido,
    };
  }

  if (noNode) { module.exports = { criarNucleo }; return; }
  if (!VL.nucleo) VL.nucleo = criarNucleo();
})(typeof globalThis !== 'undefined' ? globalThis : this);
