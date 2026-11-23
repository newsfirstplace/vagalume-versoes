// Vagalume — configuração: validação, exportação/importação e armazenamento por seção.
(function (raiz) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    require('./padroes.js'); require('./atalhos.js'); require('./texto.js');
  }
  const { PADROES, ESQUEMA } = raiz.VL.padroes;
  const atalhos = raiz.VL.atalhos;
  const texto = raiz.VL.texto;

  const FAIXAS = {
    'zoom.maximo': [1.5, 8],
    'contador.intervaloPing': [5, 60],
    'amigos.lotado': [5, 200],
    'amigos.segundosLotado': [1, 60],
    'zoom.passo': [5, 50],
    'macros.intervaloMs': [500, 10000],
    'historico.limite': [50, 2000],
    'mencoes.volume': [0, 100],
    'midia.volume': [0, 100],
    'fps.limite': [5, 144],
    'agrupar.janela': [1, 60],
    'silenciar.minimoPontos': [0, 100000],
    'chat.estiloOutros': [-1, 200],
    'conexao.placaNoMute': [-1, 17],
    'construcao.passoAltura': [0.05, 5],
    'loja.reporLimite': [0, 50],
    'loja.reporQuantidade': [1, 100],
    'loja.quantidadePadrao': [1, 100],
  };
  // Números que aceitam casas decimais (os outros são arredondados para inteiro).
  const DECIMAIS = { 'zoom.maximo': 1, 'construcao.passoAltura': 2 };
  const MAX_MACROS = 30;
  const MAX_LINHAS = 20;
  const MAX_LINHA = 200;
  const MAX_TERMOS = 20;
  const MAX_TEXTO = 40; // nome de macro, termo e apelido
  const MAX_CSS = 20000;
  const MAX_SILENCIADOS = 100;
  const MODOS_SILENCIO = ['esconder', 'esmaecer'];
  const FILTROS_TELA = ['nenhum', 'cinza', 'sepia', 'inverter', 'contraste', 'vivo', 'suave', 'escuro'];
  const TEMAS_JANELA = ['nenhum', 'vagalume'];
  // Seções grandes ficam só neste computador; as demais acompanham a conta do navegador.
  const LOCAIS = new Set(['estilo', 'macros']);
  const PREFIXO_CHAVE = 'vl.';

  function copiar(v) { return JSON.parse(JSON.stringify(v)); }

  // Lista de textos curtos sem vazios nem repetidos (maiúsculas não contam). Serve a termos e apelidos.
  function limparTermos(lista, maximo) {
    if (!Array.isArray(lista)) return [];
    const limite = maximo || MAX_TERMOS;
    const saida = [];
    for (const t of lista) {
      if (typeof t !== 'string') continue;
      const limpo = t.trim().slice(0, MAX_TEXTO);
      if (limpo && !saida.some((x) => x.toLowerCase() === limpo.toLowerCase())) saida.push(limpo);
      if (saida.length >= limite) break;
    }
    return saida;
  }

  function limparMacros(lista) {
    if (!Array.isArray(lista)) return [];
    const saida = [];
    const ids = new Set();
    for (const m of lista) {
      if (!m || typeof m !== 'object') continue;
      const nome = typeof m.nome === 'string' ? m.nome.trim().slice(0, MAX_TEXTO) : '';
      if (!nome) continue;
      let id = typeof m.id === 'string' && /^[a-z0-9_-]{1,24}$/i.test(m.id) ? m.id : 'm' + (saida.length + 1);
      while (ids.has(id)) id += 'x';
      ids.add(id);
      const linhas = (Array.isArray(m.linhas) ? m.linhas : [])
        .filter((l) => typeof l === 'string')
        .map((l) => l.replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_LINHA))
        .filter(Boolean)
        .slice(0, MAX_LINHAS);
      const v = atalhos.validar(typeof m.atalho === 'string' ? m.atalho : '');
      saida.push({ id, nome, atalho: v.ok ? v.combo : '', linhas });
      if (saida.length >= MAX_MACROS) break;
    }
    return saida;
  }

  // Prefixo dos comandos: uma letra seguida de letras ou números, até 12 caracteres.
  // Devolve '' quando o texto não serve.
  function limparPrefixo(bruto) {
    const p = typeof bruto === 'string' ? bruto.trim().toLowerCase() : '';
    return p === '/' || /^[a-z][a-z0-9]{0,11}$/.test(p) ? p : '';
  }

  function mesclarSecao(secao, valor) {
    const base = PADROES[secao];
    if (!base) return undefined;
    const saida = copiar(base);
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return saida;
    for (const chave of Object.keys(base)) {
      const v = valor[chave];
      const caminho = secao + '.' + chave;
      if (caminho === 'macros.lista') { saida.lista = limparMacros(v); continue; }
      if (caminho === 'mencoes.termos') { saida.termos = limparTermos(v); continue; }
      if (caminho === 'silenciar.apelidos') { saida.apelidos = limparTermos(v, MAX_SILENCIADOS); continue; }
      if (caminho === 'silenciar.termos') { saida.termos = limparTermos(v); continue; }
      if (caminho === 'conexao.aoEntrar') { saida.aoEntrar = limparTermos(v, 5); continue; }
      if (caminho === 'silenciar.modo') { if (MODOS_SILENCIO.includes(v)) saida.modo = v; continue; }
      if (caminho === 'interface.filtro') { if (FILTROS_TELA.includes(v)) saida.filtro = v; continue; }
      if (caminho === 'interface.abrirMissao') { saida.abrirMissao = 'pagina'; continue; } // só o visor
      // O tema "escuro" saiu (2026-11-14): quem o tinha gravado passa para o vagalume.
      if (caminho === 'interface.tema') { const tv = v === 'escuro' ? 'vagalume' : v; if (TEMAS_JANELA.includes(tv)) saida.tema = tv; continue; }
      if (caminho === 'contador.canto') { if (['sup-esq', 'sup-dir', 'inf-esq', 'inf-dir'].includes(v)) saida.canto = v; continue; }
      // O Congelado saiu (2026-11-15: pesava no FPS): quem o tinha gravado passa para o Fantasma.
      if (caminho === 'amigos.desconhecidos') { saida.desconhecidos = 'fantasma'; continue; } // só o Fantasma (pedido do usuário em 2026-11-16)
      if (caminho === 'midia.bloqueados') { saida.bloqueados = limparTermos(v, MAX_SILENCIADOS); continue; }
      if (caminho === 'digitando.estilo') { if (['jogo', 'vagalume', 'limao', 'noite', 'brilho', 'pergaminho', 'floresta', 'neon', 'galaxia', 'bolha', 'explosao', 'gatinho', 'coracao', 'nuvem', 'melancia', 'gelo', 'docinho', 'vulcao'].includes(v)) saida.estilo = v; continue; }
      if (caminho === 'jogos.velocidade') { if (['rapida', 'lenta'].includes(v)) saida.velocidade = v; continue; }
      if (caminho === 'zoom.modo') { if (['camera', 'jogo'].includes(v)) saida.modo = v; continue; }
      if (caminho === 'zoom.aoEntrar') { if (['manter', 'perto', 'longe'].includes(v)) saida.aoEntrar = v; continue; }
      if (typeof v !== typeof base[chave] || v === null) continue;
      if (typeof v === 'number') {
        if (!Number.isFinite(v)) continue;
        const faixa = FAIXAS[caminho];
        const casas = DECIMAIS[caminho] || 0;
        const n = Math.round(v * 10 ** casas) / 10 ** casas;
        saida[chave] = faixa ? Math.min(faixa[1], Math.max(faixa[0], n)) : n;
      } else if (typeof v === 'string') {
        if (caminho === 'painel.atalho') {
          const r = atalhos.validar(v);
          if (r.ok) saida[chave] = r.combo;
        } else if (caminho === 'comandos.prefixo') {
          const p = limparPrefixo(v);
          if (p) saida[chave] = p;
        } else if (caminho === 'estilo.css') {
          saida[chave] = texto.limparCss(v, MAX_CSS);
        } else {
          saida[chave] = v.trim().slice(0, MAX_TEXTO);
        }
      } else if (typeof v === 'boolean') {
        saida[chave] = v;
      }
    }
    return saida;
  }

  function mesclar(entrada) {
    const saida = {};
    for (const secao of Object.keys(PADROES)) {
      saida[secao] = mesclarSecao(secao, entrada && typeof entrada === 'object' ? entrada[secao] : undefined);
    }
    return saida;
  }

  function exportar(cfg) {
    return JSON.stringify({ app: 'vagalume', esquema: ESQUEMA, config: mesclar(cfg) }, null, 2);
  }

  function importar(textoJson) {
    let dado;
    try { dado = JSON.parse(textoJson); } catch (e) { throw new Error('O arquivo não é um JSON válido.'); }
    if (!dado || dado.app !== 'vagalume' || typeof dado.config !== 'object' || !dado.config) {
      throw new Error('Este arquivo não é uma cópia de configurações do Vagalume.');
    }
    if (typeof dado.esquema === 'number' && dado.esquema > ESQUEMA) {
      throw new Error('O arquivo veio de uma versão mais nova do Vagalume.');
    }
    return mesclar(dado.config);
  }

  // `storage` é o chrome.storage (ou um objeto equivalente nos testes).
  function criarArmazem(storage) {
    const secoes = Object.keys(PADROES);
    const area = (secao) => (LOCAIS.has(secao) ? storage.local : storage.sync);
    const chave = (secao) => PREFIXO_CHAVE + secao;

    async function ler() {
      const sync = secoes.filter((s) => !LOCAIS.has(s)).map(chave);
      const local = secoes.filter((s) => LOCAIS.has(s)).map(chave);
      const [a, b] = await Promise.all([storage.sync.get(sync), storage.local.get(local)]);
      const junto = Object.assign({}, a, b);
      const bruto = {};
      for (const s of secoes) bruto[s] = junto[chave(s)];
      return mesclar(bruto);
    }

    async function gravar(secao, valor) {
      const limpo = mesclarSecao(secao, valor);
      if (!limpo) throw new Error('Seção desconhecida: ' + secao);
      await area(secao).set({ [chave(secao)]: limpo });
      return limpo;
    }

    async function gravarTudo(cfg) {
      const limpo = mesclar(cfg);
      for (const s of secoes) await area(s).set({ [chave(s)]: limpo[s] });
      return limpo;
    }

    async function redefinir() {
      await storage.sync.remove(secoes.filter((s) => !LOCAIS.has(s)).map(chave));
      await storage.local.remove(secoes.filter((s) => LOCAIS.has(s)).map(chave));
    }

    function aoMudar(fn) {
      const ouvinte = (mudancas, nomeArea) => {
        for (const k of Object.keys(mudancas)) {
          if (!k.startsWith(PREFIXO_CHAVE)) continue;
          const secao = k.slice(PREFIXO_CHAVE.length);
          if (!PADROES[secao]) continue;
          if ((nomeArea === 'local') !== LOCAIS.has(secao)) continue;
          fn(secao, mesclarSecao(secao, mudancas[k].newValue));
        }
      };
      storage.onChanged.addListener(ouvinte);
      return () => storage.onChanged.removeListener(ouvinte);
    }

    return { ler, gravar, gravarTudo, redefinir, aoMudar };
  }

  // Limites que as telas mostram e conferem antes de gravar, para avisar em vez de cortar o texto em silêncio.
  const LIMITES = { macros: MAX_MACROS, linhas: MAX_LINHAS, linha: MAX_LINHA, termos: MAX_TERMOS, texto: MAX_TEXTO, css: MAX_CSS, silenciados: MAX_SILENCIADOS };
  const api = { mesclar, mesclarSecao, limparMacros, limparTermos, limparPrefixo, exportar, importar, criarArmazem, FAIXAS, LIMITES, LOCAIS };
  raiz.VL.config = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
