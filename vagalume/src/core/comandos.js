// Vagalume — leitura de comandos digitados no chat (":vl ajuda") e registro de comandos.
(function (raiz) {
  'use strict';

  // "/" é um prefixo especial: "/ajuda". Uma palavra vai depois de dois-pontos e antes de um espaço: ":vl ajuda".
  function cabeca(prefixo) {
    const p = String(prefixo || '/').toLowerCase();
    return p === '/' ? '/' : ':' + p;
  }
  // Como o comando começa quando digitado (para textos de ajuda): "/" ou ":vl ".
  function inicioDigitado(prefixo) {
    const c = cabeca(prefixo);
    return c === '/' ? '/' : c + ' ';
  }

  // Devolve { nome, args, resto } ou null quando o texto não é um comando do Vagalume.
  function interpretar(texto, prefixo) {
    if (typeof texto !== 'string') return null;
    const limpo = texto.trim();
    const cab = cabeca(prefixo);
    if (limpo.slice(0, cab.length).toLowerCase() !== cab) return null;
    const depois = limpo.slice(cab.length);
    if (cab !== '/' && depois && !/^\s/.test(depois)) return null; // ":vlx" não é ":vl"
    if (cab === '/' && /^\//.test(depois)) return null; // "//" não é comando
    const partes = depois.trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return { nome: 'ajuda', args: [], resto: '' };
    const nome = partes[0].toLowerCase();
    const resto = depois.trim().slice(partes[0].length).trim();
    return { nome, args: partes.slice(1), resto };
  }

  // Comandos que combinam com o que está sendo digitado. Devolve [] quando o texto não é o começo
  // de um comando do Vagalume ou quando a pessoa já passou para os argumentos.
  function sugerir(texto, prefixo, lista, maximo) {
    if (typeof texto !== 'string' || !Array.isArray(lista)) return [];
    const cab = cabeca(prefixo);
    const inicio = texto.replace(/^\s+/, '');
    if (inicio.slice(0, cab.length).toLowerCase() !== cab) return [];
    const depois = inicio.slice(cab.length);
    if (cab !== '/' && depois && !/^\s/.test(depois)) return [];
    const parcial = depois.replace(/^\s+/, '').toLowerCase();
    if (/\s/.test(parcial)) return [];
    const achados = lista.filter((def) => [def.nome].concat(def.apelidos || []).some((n) => n.toLowerCase().startsWith(parcial)));
    // Quem começa pelo nome principal vem antes de quem só combina por um apelido.
    achados.sort((a, b) => Number(!a.nome.toLowerCase().startsWith(parcial)) - Number(!b.nome.toLowerCase().startsWith(parcial)));
    return achados.slice(0, maximo || 6).map((def) => ({ nome: def.nome, uso: def.uso || def.nome, descricao: def.descricao || '' }));
  }

  function criarRegistro() {
    const porNome = new Map();
    const lista = [];

    function registrar(def) {
      if (!def || typeof def.nome !== 'string' || typeof def.executar !== 'function') {
        throw new Error('Comando inválido.');
      }
      const nomes = [def.nome].concat(def.apelidos || []).map((n) => n.toLowerCase());
      for (const n of nomes) if (porNome.has(n)) throw new Error('Comando repetido: ' + n);
      for (const n of nomes) porNome.set(n, def);
      lista.push(def);
      return () => {
        for (const n of nomes) if (porNome.get(n) === def) porNome.delete(n);
        const i = lista.indexOf(def);
        if (i >= 0) lista.splice(i, 1);
      };
    }

    return {
      registrar,
      achar: (nome) => porNome.get(String(nome).toLowerCase()) || null,
      listar: () => lista.slice().sort((a, b) => a.nome.localeCompare(b.nome)),
    };
  }

  // Comandos do próprio Habblet, como a lista de ajuda da BANANA os mostrava (docs/analise/banana-comandos-chat.txt).
  // O Vagalume não os executa nem os intercepta: só ajuda a lembrar o nome. Sem descrição, porque o
  // que cada um faz é definido pelo Habblet e não foi conferido aqui.
  const COMANDOS_DO_JOGO = Object.freeze([
    'abracar', 'afk', 'ativar', 'aus', 'blockroom', 'cara', 'copy', 'ct', 'deletegroup', 'desativar', 'diagonal',
    'eject', 'ejectall', 'empty', 'emptybots', 'emptypets', 'emptyrel', 'enable', 'floor', 'follow', 'friends',
    'habbletname', 'handitem', 'home', 'kickbots', 'kickpets', 'kis', 'kiss', 'lay', 'moonwalk', 'mutebots', 'mutepets',
    'pet', 'pickall', 'pickrare', 'pickwired', 'playtest', 'pull', 'push', 'pyramid', 'quickpoll', 'random',
    'reload', 'setmax', 'setspeed', 'sit', 'soco', 'spin', 'state', 'tele', 'tile', 'trade', 'up', 'wired', 'wiredtool',
  ]);

  // Sugestões entre os comandos do Habblet, para quem digitou ":" e o começo de um nome que não é o
  // prefixo do Vagalume. Cada item já traz o texto a completar.
  function sugerirDoJogo(texto, prefixo, maximo) {
    if (typeof texto !== 'string') return [];
    const m = /^\s*:([a-z]*)$/i.exec(texto);
    if (!m || !m[1]) return [];
    const parcial = m[1].toLowerCase();
    const nosso = String(prefixo || '/').toLowerCase();
    if (parcial === nosso) return []; // é o prefixo do Vagalume: as sugestões dele cuidam
    return COMANDOS_DO_JOGO.filter((nome) => nome.startsWith(parcial) && nome !== parcial)
      .slice(0, maximo || 6)
      .map((nome) => ({ nome, uso: ':' + nome, descricao: 'Comando do Habblet', completar: ':' + nome + ' ' }));
  }

  // Busca de funções: acha comandos e módulos cujo nome ou descrição tenham todas as palavras do
  // termo, sem diferenciar acentos nem maiúsculas.
  function normalizar(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function sugerirPessoas(pessoas, parcial, maximo) {
    const busca = normalizar(parcial).trim();
    return (pessoas || []).filter((p) => {
      const nome = normalizar(p.nome);
      const apelido = normalizar(p.apelido);
      return (nome.startsWith(busca) && nome !== busca) || (apelido && apelido.startsWith(busca));
    }).slice(0, maximo || 30);
  }
  // Apelidos são locais. O hotel sempre recebe o nick original e um apelido ambíguo não é trocado.
  function substituirApelidoInicial(texto, pessoas) {
    const entrada = String(texto || '');
    const m = /^(\s*@?)(.*)$/.exec(entrada);
    const inicio = m[1];
    const resto = m[2];
    const primeiro = /^\S+/.exec(resto);
    if (primeiro && (pessoas || []).some((p) => normalizar(p.nome) === normalizar(primeiro[0]))) return entrada;
    const achados = (pessoas || []).filter((p) => {
      const apelido = String(p.apelido || '');
      return apelido && normalizar(resto.slice(0, apelido.length)) === normalizar(apelido)
        && (!resto[apelido.length] || /\s/.test(resto[apelido.length]));
    });
    return achados.length === 1 ? inicio.replace('@', '') + achados[0].nome + resto.slice(achados[0].apelido.length) : entrada;
  }
  function buscarFuncoes(termo, comandos, catalogo, maximo) {
    const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
    if (!palavras.length) return [];
    const casa = (texto) => { const n = normalizar(texto); return palavras.every((p) => n.includes(p)); };
    const achados = [];
    for (const m of catalogo || []) if (casa(m.nome + ' ' + m.resumo + ' ' + m.id)) achados.push({ tipo: 'modulo', id: m.id, nome: m.nome, texto: m.resumo });
    for (const c of comandos || []) if (casa([c.nome].concat(c.apelidos || []).join(' ') + ' ' + (c.descricao || ''))) achados.push({ tipo: 'comando', id: c.nome, nome: c.uso || c.nome, texto: c.descricao || '' });
    return achados.slice(0, maximo || 30);
  }

  const api = { cabeca, inicioDigitado, interpretar, sugerir, sugerirDoJogo, sugerirPessoas, substituirApelidoInicial, buscarFuncoes, criarRegistro, COMANDOS_DO_JOGO };
  raiz.VL = raiz.VL || {};
  raiz.VL.comandos = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
