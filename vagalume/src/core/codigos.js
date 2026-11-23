// Vagalume — códigos das mensagens do Habblet e leitura das que o Vagalume usa.
// Mapeados ao vivo em 2026-11-13 (docs/analise/codigos.md). Só entram aqui os confirmados;
// se o Habblet mudar os números numa atualização, é este o único arquivo a corrigir.
(function (raiz) {
  'use strict';

  const SAIDA = Object.freeze({
    // Quarto (lidos na tabela do cliente, 2026-11-22; não conferidos ao vivo):
    PEDIR_PORTA: 3559,        // GET_ROOM_ENTRY_TILE -> 1664
    SALVAR_PLANTA: 875,       // ROOM_MODEL_SAVE: s mapa, i porta x, i porta y, i direção, i parede, i piso, i altura da parede
    APLICAR_DECORACAO: 711,   // ITEM_PAINT: i id do papel de parede/piso/paisagem do inventário
    PEDIR_REGULADOR: 2813,    // ITEM_DIMMER_SETTINGS -> 2710
    SALVAR_REGULADOR: 1648,   // ITEM_DIMMER_SAVE: i efeito, i tipo, s cor "#RRGGBB", i claridade, b aplicar
    LIGAR_REGULADOR: 2296,    // ITEM_DIMMER_TOGGLE (liga/desliga)
    TONALIZADOR: 2880,        // ROOM_TONER_APPLY: i id, i matiz, i saturação, i claridade (0 a 255; cliente 3495)
    DADOS_OBJETO: 3608,       // SET_OBJECT_DATA: i id, i 2×pares, s chave, s valor… (imagem de fundo e afins)
    ANDAR: 3320,          // i x, i y
    FALAR: 1314,          // s texto, i estilo
    ENTRAR_GRUPO: 998,    // i grupo (GROUP_REQUEST do cliente)
    FAVORITAR_GRUPO: 3549, // i grupo (GROUP_FAVORITE)
    PERFIL_POR_NOME: 2249, // s apelido (USER_PROFILE_BY_NAME): o jogo abre o perfil, mesmo de quem não está no quarto
    PERFIL: 3265,         // i id, b abrir (USER_PROFILE): o jogo abre a janela de perfil
    GRITAR: 2085,         // s texto, i estilo
    DIGITANDO: 1597,      // —
    PAROU_DE_DIGITAR: 1474, // —
    OLHAR_PARA: 3301,     // i x, i y
    CLICAR_USUARIO: 431,  // i índice (provável)
    ENTRAR_QUARTO: 2312,  // i id do quarto, s senha
    DADOS_QUARTO: 2230,   // GET_GUEST_ROOM: i id, i 0, i 1 (encaminhar): o servidor manda o jogo entrar e o próprio jogo pede o 2312 (conferido ao vivo, também da vista do hotel)
    EXPRESSAO: 2456,      // i tipo (EXPRESSOES)
    DANCAR: 2080,         // i dança: 0 parar, 1 a 4 as do jogo
    POSTURA: 2235,        // i 1 = sentar
    PLACA: 1975,          // i número da placa
    CLICAR_MOBI: 355,     // i id (seleciona)
    COLOCAR_MOBI: 1258,   // s "id x y direção"
    MOVER_MOBI: 248,      // i id, i x, i y, i direção
    FERRAMENTA_CONSTRUCAO: 397, // ajustes nativos; altura em centésimos (cliente 3495)
    USAR_MOBI: 99,        // i id, i 0
    PEGAR_MOBI: 3456,     // i 10, i id
    // Nomes e números tirados da tabela do próprio cliente (docs/analise/codigos.md).
    PEDIR_AMIGOS: 1523,   // MESSENGER_FRIENDS, sem campos (conferido: o jogo respondeu com a lista)
    MENSAGEM_PRIVADA: 3567, // MESSENGER_CHAT: i id do amigo, s texto (conferido)
    PEDIR_VISUAIS: 2742,  // GET_WARDROBE: i 0 (conferido; a resposta vem em ~200 ms)
    MEUS_DADOS: 357,      // USER_INFO: sem campos (conferido: o servidor responde 2725)
    VESTIR: 2730,         // USER_FIGURE: s gênero, s visual (conferido: o servidor respondeu 3920 e 2429)
    SUSSURRAR: 1543,      // UNIT_CHAT_WHISPER: s "destinatário mensagem", i estilo (lido no cliente)
    SEGUIR_AMIGO: 3997,   // FOLLOW_FRIEND: i id do amigo (lido no cliente)
    PEDIR_INDICE_LOJA: 1195, // GET_CATALOG_INDEX: s "NORMAL" (conferido)
    PEDIR_PAGINA_LOJA: 412, // GET_CATALOG_PAGE: i página, i -1, s "NORMAL" (conferido)
    COMPRAR: 3492,        // CATALOG_PURCHASE: i página, i oferta, s extra, i quantidade (conferido)
    PEDIR_OFERTA: 2594,   // i oferta (GET_PRODUCT_OFFER) -> 3388
    PEDIR_INVENTARIO: 3150, // USER_FURNITURE (conferido)
    // Feira Livre (nomes e argumentos lidos no cliente em 2026-11-13; 2105 e 2407 conferidos ao vivo).
    FEIRA_CONFIG: 2597,   // MARKETPLACE_CONFIG
    FEIRA_BUSCAR: 2407,   // MARKETPLACE_REQUEST_OFFERS: i preço mínimo, i máximo (-1 = sem), s busca, i ordem
    FEIRA_VENDER: 3447,   // MARKETPLACE_SELL_ITEM: i preço, i 1 chão / 2 parede, i id do item (não testado ao vivo)
    FEIRA_COMPRAR: 1603,  // MARKETPLACE_BUY_OFFER: i oferta (não usado pelo Vagalume). Resposta 2032: i resultado, i, i oferta, i; veio 4 sem asinhas (a feira usa asinhas)
    FEIRA_MINHAS: 2105,   // MARKETPLACE_REQUEST_OWN_ITEMS (conferido)
    FEIRA_RETIRAR: 434,   // MARKETPLACE_TAKE_BACK_ITEM: i oferta (não testado ao vivo)
    FEIRA_RESGATAR: 2650, // MARKETPLACE_REDEEM_CREDITS: recebe o das vendas e tira as vendidas da lista
    EXCLUIR_DO_INVENTARIO: 380, // DELETE_INVENTORY_ITEM_PERMANENTLY: i 1 (mobi), s classe; apaga todas as unidades daquele tipo (lido no cliente; não testado ao vivo)
  });

  // Salvar wired, por tipo (nomes da tabela do cliente). O ativador (1520) foi conferido byte a byte.
  const SALVAR_WIRED = Object.freeze({ 1520: 'ativador', 2281: 'efeito', 3203: 'condição', 363: 'seletor', 358: 'add-on', 366: 'variável' });

  // Confirmados pelo menu do avatar em 2026-11-13.
  const EXPRESSOES = Object.freeze({ acenar: 1, beijo: 2, rir: 3 });
  const EXPRESSAO_INATIVO = 5; // "Inativo" no menu do avatar; número não conferido ao vivo
  const MAX_DANCA = 4;   // danças do menu do jogo (1 a 4)
  // Números das danças próprias da HIBISCO (só para não usar os mesmos). O servidor repassa o número,
  // mas o Habblet só tem dance.1 a dance.4 no EffectMap: a HIBISCO escreve a animação e a registra no
  // motor de avatar. Sem isso, nada anima (conferido ao vivo em 2026-11-19).
  const DANCAS_EXTRAS = { 5: 'Palmas', 6: 'Passinho do Jamal', 7: '1D', 8: 'John Cena', 9: 'Olha a onda', 11: 'Ombrinho' };
  const MAX_PLACA = 17;  // 0 a 10 conferidos no menu; 11 a 17 são os ícones, ordem não conferida

  const ENTRADA = Object.freeze({
    PLANTA: 1301,             // ROOM_MODEL: b escala, i altura da parede, s mapa (linhas separadas por \r)
    PORTA: 1664,              // ROOM_MODEL_DOOR: i x, i y, i direção
    ESPESSURA: 3547,          // ROOM_THICKNESS: b esconder paredes, i parede (-2 a 1), i piso (-2 a 1)
    DECORACAO: 2454,          // ROOM_PAINT: s tipo (wallpaper, floor, landscape), s valor
    MOBIS_PAREDE: 1369,       // ITEM_WALL: donos e mobis de parede do quarto
    MOBI_PAREDE_COLOCADO: 2187, // ITEM_WALL_ADD: um mobi de parede + s dono
    MOBI_PAREDE_ATUALIZADO: 2009, // ITEM_WALL_UPDATE
    MOBI_PAREDE_RETIRADO: 3208,   // ITEM_WALL_REMOVE: s id, i dono
    REGULADOR: 2710,          // ITEM_DIMMER_SETTINGS: i nº, i selecionado, por efeito: i id, i tipo, s cor, i claridade
    ALERTA: 3801,             // GENERIC_ALERT: s texto, b aviso
    NOTIFICACAO: 1992,        // NOTIFICATION_LIST: s tipo, i nº, s chave, s valor…
    ALERTA_SIMPLES: 5100,     // NOTIFICATION_SIMPLE_ALERT: s texto, s título (opcional)
    FALA: 1446,           // i índice, s texto, i gesto, i estilo, links, i controle
    GRITO: 1036,          // igual à fala
    SUSSURRO: 2704,       // igual à fala (UNIT_CHAT_WHISPER); também a cópia do que você sussurra
    INFO_UNIDADE: 3920,   // UNIT_INFO: i índice, s visual, s gênero, s missão, i pontos (alguém trocou de roupa)
    PERMISSOES: 411,      // USER_PERMISSIONS: i nível do clube, i nível de segurança, b embaixador
    DIGITANDO: 1717,      // i índice, i 0/1
    USUARIOS: 374,        // lista de entidades
    EFEITO: 1167,         // i índice, i efeito, i atraso (UNIT_EFFECT)
    ENCAMINHAR_QUARTO: 160, // i quarto (ROOM_FORWARD: o jogo entra nesse quarto)
    OFERTA: 3388,         // PRODUCT_OFFER: uma oferta da loja (formato da página 804)
    SEGUIR_FALHOU: 3048,  // i motivo (MESSENGER_FOLLOW_FAILED: o jogo mostra um alerta)
    SAIU: 2661,           // s índice
    ESTADOS: 1640,        // posições e ações
    DANCA: 2233,          // i índice, i dança (UNIT_DANCE)
    ITEM_MAO: 1474,       // i índice, i item (UNIT_HAND_ITEM)
    QUARTO_PRONTO: 2031,  // s modelo, i id do quarto
    INFO_QUARTO: 687,     // ROOM_INFO: b entrou, dados do quarto (i id, s nome, i dono, s dono, …, i máscara, [s foto oficial se máscara & 1]) — lido no cliente
    MOBIS_DO_QUARTO: 1778, // donos e mobis do chão, ao entrar
    MOBI_COLOCADO: 1534,  // um mobi + s nome do dono
    MOBI_ATUALIZADO: 3776, // um mobi
    MOBI_RETIRADO: 2703,  // s id, …
    ESTADO_MOBI: 2547,    // s id, i ?, s estado
    AMIGOS: 3130,         // MESSENGER_FRIENDS: lista em fragmentos (formato conferido byte a byte)
    ATUALIZA_AMIGOS: 2800, // MESSENGER_UPDATE (formato não conferido)
    MENSAGEM_RECEBIDA: 1587, // MESSENGER_CHAT (formato não conferido)
    CONVITE: 3870,        // MESSENGER_INVITE
    VISUAIS: 3315,        // GET_WARDROBE (resposta)
    INDICE_LOJA: 1032,    // CATALOG_PAGE_LIST
    PAGINA_LOJA: 804,     // CATALOG_PAGE
    COMPRA_OK: 869,       // CATALOG_PURCHASE_OK
    SALDO_MOEDAS: 3475,   // USER_CREDITS: saldo de moedas (o jogo toca o som das moedas quando muda)
    COMPRA_ERRO: 1404,    // CATALOG_PURCHASE_ERROR
    COMPRA_NEGADA: 3770,  // CATALOG_PURCHASE_NOT_ALLOWED
    INVENTARIO: 994,      // USER_FURNITURE (fragmentos)
    INVENTARIO_ADD: 104,  // USER_FURNITURE_ADD (um item)
    INVENTARIO_REMOVE: 159, // USER_FURNITURE_REMOVE: i id
    MUTE_RESTANTE: 826,   // REMAINING_MUTE: i segundos (lido no cliente)
    ANTIFLOOD: 566,       // FLOOD_CONTROL: i segundos (lido no cliente)
    QUARTO_MUTADO: 2533,  // ROOM_MUTED: y silenciado pelo dono (lido no cliente)
    MEUS_DADOS: 2725,     // USER_INFO: i id, s apelido, s visual, s gênero, … (conferido ao vivo)
    FEIRA_CONFIG: 1823,   // MARKETPLACE_CONFIG (conferido: y ligada, i comissão %, i ×3 fichas, i preço mín., i máx., i horas, i dias da média)
    FEIRA_OFERTAS: 680,   // MARKETPLACE_ITEMS_SEARCHED (conferido)
    FEIRA_MINHAS: 3884,   // MARKETPLACE_OWN_ITEMS (conferido vazio: i 0 a receber, i 0 ofertas)
    FEIRA_VENDA: 1359,    // MARKETPLACE_ITEM_POSTED: i resultado; 1 = posto à venda; 2 veio ao tentar vender um mobi não vendável (conferido)
    FEIRA_RETIRADA: 3264, // MARKETPLACE_CANCEL_SALE: i oferta, y deu certo (não conferido)
    INVENTARIO_MUDOU: 3151, // USER_FURNITURE_REFRESH (pedir de novo)
    DIREITOS: 780,        // ROOM_RIGHTS: i nível (4 no quarto do próprio usuário)
    CAMPAINHA: 2309,      // ROOM_DOORBELL: s apelido (formato não conferido)
    NOTA_QUARTO: 482,     // ROOM_SCORE: i nota, y pode curtir (formato não conferido)
    INATIVO: 1797,        // UNIT_IDLE: i índice, y 0/1
  });

  // ---------- loja e inventário (formatos conferidos byte a byte em 2026-11-13) ----------

  // Índice da loja (1032): árvore de páginas. Por nó: y visível, i ícone, i id, s nome, s rótulo,
  // i nº de ofertas + ids, i nº de filhos + nós. Devolve a lista achatada { id, nome, rotulo, pai }.
  function lerIndiceLoja(l) {
    const paginas = [];
    function no(pai, profundidade) {
      if (profundidade > 20) throw new RangeError('Índice da loja fundo demais.');
      l.booleano(); l.inteiro();
      const id = l.inteiro();
      const nome = l.texto();
      const rotulo = l.texto();
      const nOfertas = l.inteiro();
      for (let i = 0; i < nOfertas; i++) l.inteiro();
      paginas.push({ id, nome, rotulo, pai, ofertas: nOfertas });
      const nFilhos = l.inteiro();
      for (let i = 0; i < nFilhos; i++) no(rotulo, profundidade + 1);
    }
    no('', 0);
    return paginas;
  }

  // Página da loja (804): i id, s tipo, s layout, imagens e textos (i n + s), i nº de ofertas; por
  // oferta: i id, s nome interno, y aluguel, i moedas, i pontos, i tipo de pontos, y presente,
  // i nº de produtos (por produto: s tipo; "b" é emblema com s código; os outros: i classe, s extra,
  // i quantidade, y limitado [+ i, i]), i clube, y compra em pacote, y mascote, s prévia.
  function lerPaginaLoja(l) {
    const id = l.inteiro();
    l.texto(); l.texto();
    const ni = l.inteiro(); for (let i = 0; i < ni; i++) l.texto();
    const nt = l.inteiro(); for (let i = 0; i < nt; i++) l.texto();
    const n = l.inteiro();
    const ofertas = [];
    for (let i = 0; i < n && i < 1000; i++) ofertas.push(lerUmaOferta(l, id));
    return { id, ofertas };
  }

  // Uma oferta da loja (dentro da página 804 e sozinha no PRODUCT_OFFER 3388, resposta ao 2594).
  function lerUmaOferta(l, pagina) {
    {
      const oferta = { id: l.inteiro(), nome: l.texto(), pagina };
      l.booleano();
      oferta.moedas = l.inteiro();
      oferta.pontos = l.inteiro();
      oferta.tipoPontos = l.inteiro();
      l.booleano();
      const np = l.inteiro();
      oferta.produtos = [];
      for (let p = 0; p < np; p++) {
        const tipo = l.texto();
        if (tipo === 'b') { oferta.produtos.push({ tipo, codigo: l.texto(), quantidade: 1 }); continue; }
        const classe = l.inteiro();
        const extra = l.texto();
        const quantidade = l.inteiro();
        if (l.booleano()) { l.inteiro(); l.inteiro(); }
        oferta.produtos.push({ tipo, classe, extra, quantidade });
      }
      l.inteiro();
      oferta.pacote = l.booleano();
      l.booleano();
      l.texto();
      return oferta;
    }
  }

  // Um item do inventário de mobis (994 e 104): i id, s "S" (chão) ou "I" (parede), i id, i classe
  // (o "tipo" que a exclusão usa), i categoria, dados extras, y, y, y, i validade, y, i quarto e,
  // nos de chão, s encaixe e i extra. Conferido com uma cadeira.
  function lerItemInventario(l) {
    const id = l.inteiro();
    const chao = l.texto() === 'S';
    l.inteiro();
    const classe = l.inteiro();
    const categoria = l.inteiro();
    const estado = lerDadosExtras(l);
    // reciclável, trocável, agrupável, vendável na Feira Livre (4 marcadores: conferido em 2026-11-13, 3.079 itens sem sobra)
    l.booleano(); l.booleano(); l.booleano(); const vendavel = l.booleano();
    l.inteiro(); l.booleano(); l.inteiro();
    if (chao) { l.texto(); l.inteiro(); }
    return { id, chao, classe, categoria, estado, vendavel };
  }
  function lerInventario(l) {
    const total = l.inteiro();
    const indice = l.inteiro();
    const n = l.inteiro();
    const itens = [];
    for (let i = 0; i < n && i < 20000; i++) itens.push(lerItemInventario(l));
    return { total, indice, itens };
  }

  // Quantas unidades comprar de cada oferta para chegar a `meta` no inventário. Só ofertas de um
  // produto de chão ou parede, compráveis em pacote se precisar de mais de uma; até 100 por compra.
  function planoDeCompra(ofertas, contagem, meta) {
    const plano = [];
    for (const o of ofertas) {
      if (o.produtos.length !== 1 || o.produtos[0].tipo === 'b' || o.pontos > 0) continue;
      const p = o.produtos[0];
      const tem = contagem.get(p.classe) || 0;
      let falta = Math.max(0, meta - tem);
      if (!falta) continue;
      const porCompra = o.pacote ? 100 : 1;
      while (falta > 0) {
        const unidades = Math.min(falta, porCompra);
        plano.push({ pagina: o.pagina, oferta: o.id, nome: o.nome, classe: p.classe, quantidade: unidades, moedas: o.moedas * unidades });
        falta -= unidades;
      }
    }
    return plano;
  }

  // Visuais salvos (3315): i ?, i quantidade; por visual: i posição, s visual, s gênero.
  function lerVisuais(l) {
    l.inteiro();
    const n = l.inteiro();
    const lista = [];
    for (let i = 0; i < n && i < 50; i++) lista.push({ posicao: l.inteiro(), visual: l.texto(), genero: l.texto().toUpperCase() });
    return lista;
  }

  // Código de visual aceitável: partes "tipo-número[-cor…]" separadas por ponto.
  function visualValido(codigo) {
    const s = String(codigo || '').trim();
    return s.length <= 300 && /^[a-z]{2}-\d+(-\d+)*(\.[a-z]{2}-\d+(-\d+)*)*$/.test(s) ? s : null;
  }

  // Lista de amigos (3130), conferida byte a byte em 2026-11-13: fragmento e, por amigo, id, apelido,
  // gênero, online, se pode ser seguido, visual, categoria, missão, nome real, id do facebook,
  // três marcas e o relacionamento (inteiro de 16 bits).
  function lerAmigos(l) {
    const total = l.inteiro();
    const indice = l.inteiro();
    const n = l.inteiro();
    const amigos = [];
    for (let i = 0; i < n && i < 2000; i++) amigos.push(lerAmigo(l));
    return { total, indice, amigos };
  }
  function lerAmigo(l) {
    const id = l.inteiro();
    const nome = l.texto();
    l.inteiro(); // gênero
    const online = l.booleano();
    const podeSeguir = l.booleano();
    const visual = l.texto();
    l.inteiro(); // categoria
    const missao = l.texto();
    l.texto(); l.texto(); // nome real, facebook
    l.booleano(); l.booleano(); l.booleano();
    const relacionamento = l.curto();
    return { id, nome, online, podeSeguir, relacionamento, missao, visual };
  }

  // Atualização de amigos (2800). Formato do protocolo desse tipo de cliente, NÃO conferido no
  // Habblet: categorias (i n; i id, s nome) e mudanças (i n; i tipo: -1 saiu da lista, 0 mudou,
  // 1 entrou; com -1 só o id, nos outros um amigo como no 3130). Erro de leitura = ignorar.
  function lerAtualizacaoAmigos(l) {
    const nc = l.inteiro();
    for (let i = 0; i < nc && i < 200; i++) { l.inteiro(); l.texto(); }
    const n = l.inteiro();
    const mudancas = [];
    for (let i = 0; i < n && i < 2000; i++) {
      const tipo = l.inteiro();
      if (tipo === -1) mudancas.push({ tipo, id: l.inteiro() });
      else mudancas.push(Object.assign({ tipo }, lerAmigo(l)));
    }
    return mudancas;
  }

  // Mensagem privada recebida (1587). Formato NÃO conferido: i id de quem mandou, s texto, …
  function lerMensagemRecebida(l) {
    return { de: l.inteiro(), texto: l.texto() };
  }

  // "@apelido texto" numa fala: devolve { apelido, texto } ou null. O apelido para no primeiro espaço.
  function mencaoNaFala(fala) {
    const m = /^\s*@([^\s@]{1,40})\s+(\S[\s\S]{0,250})$/.exec(String(fala || ''));
    return m ? { apelido: m[1], texto: m[2].trim() } : null;
  }

  // Dados extras de um mobi. Só o formato 0 foi visto no Habblet; os outros seguem a forma
  // conhecida do protocolo desse tipo de cliente e não foram conferidos. Devolve o estado em texto.
  function lerDadosExtras(l, det) {
    const formato = l.inteiro();
    let estado = '';
    switch (formato & 0xff) {
      case 0: estado = l.texto(); break;
      case 1: {
        const n = l.inteiro();
        const mapa = {};
        for (let i = 0; i < n; i++) { const k = l.texto(); const v = l.texto(); if (k === 'state') estado = v; else if (i < 20) mapa[k] = v; }
        if (det && Object.keys(mapa).length) det.mapa = mapa;
        break;
      }
      case 2: {
        const n = l.inteiro();
        for (let i = 0; i < n; i++) { const v = l.texto(); if (i === 0) estado = v; }
        break;
      }
      case 3: estado = l.texto(); l.inteiro(); break;
      case 4: break;
      case 5: {
        const n = l.inteiro();
        const numeros = [];
        for (let i = 0; i < n; i++) { const v = l.inteiro(); if (i === 0) estado = String(v); if (i < 8) numeros.push(v); }
        if (det) det.numeros = numeros;
        break;
      }
      case 6: {
        estado = l.texto(); l.inteiro(); l.inteiro();
        const n = l.inteiro();
        for (let i = 0; i < n; i++) { l.inteiro(); const m = l.inteiro(); for (let j = 0; j < m; j++) l.texto(); }
        break;
      }
      case 7: estado = l.texto(); l.inteiro(); l.inteiro(); break;
      default: throw new RangeError('Formato de dados extras desconhecido: ' + formato);
    }
    if (formato & 256) { l.inteiro(); l.inteiro(); }
    return estado;
  }

  // Um mobi do chão, como no 1778 e no 3776.
  function lerMobi(l, tolerante) {
    const id = l.inteiro();
    const tipo = l.inteiro();
    const x = l.inteiro();
    const y = l.inteiro();
    const direcao = l.inteiro();
    const altura = Number(l.texto());
    const textoAlturaMobi = l.texto();
    const alturaMobi = textoAlturaMobi === '' ? null : Number(textoAlturaMobi);
    l.inteiro(); // extra
    const det = {};
    let estado = '', dono = 0;
    try {
      estado = lerDadosExtras(l, det);
      l.inteiro(); // validade
      l.inteiro(); // uso
      dono = l.inteiro();
    } catch (erro) {
      if (!tolerante) throw erro;
    }
    const m = { id, tipo, x, y, direcao, altura: Number.isFinite(altura) ? altura : 0, alturaMobi: Number.isFinite(alturaMobi) ? alturaMobi : null, estado, dono };
    if (det.numeros) m.numeros = det.numeros; // toner de fundo: [ligado, matiz, saturação, claridade]
    if (det.mapa) m.mapa = det.mapa;          // imagem de fundo e afins: imageUrl, offsetX…
    return m;
  }

  // Lista do 1778: { donos: Map(id -> nome), mobis: [...], incompleto }.
  function lerMobisDoQuarto(l) {
    const donos = new Map();
    const nDonos = l.inteiro();
    for (let i = 0; i < nDonos && i < 1000; i++) donos.set(l.inteiro(), l.texto());
    const quantidade = l.inteiro();
    const mobis = [];
    try {
      for (let i = 0; i < quantidade && i < 5000; i++) mobis.push(lerMobi(l));
    } catch (erro) {
      return { donos, mobis, incompleto: true };
    }
    return { donos, mobis, incompleto: false };
  }

  // Nova posição ao mexer um mobi pelo teclado: setas andam pelos eixos do piso; com giro, a direção
  // anda de 2 em 2 (as quatro direções que quase todo mobi aceita).
  const EIXOS = Object.freeze({ ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] });
  function mexer(mobi, tecla, girar) {
    if (!mobi) return null;
    if (girar) {
      if (tecla !== 'ArrowRight' && tecla !== 'ArrowLeft') return null;
      const passo = tecla === 'ArrowRight' ? 2 : -2;
      return { x: mobi.x, y: mobi.y, direcao: ((mobi.direcao + passo) % 8 + 8) % 8 };
    }
    const d = EIXOS[tecla];
    if (!d) return null;
    const x = mobi.x + d[0];
    const y = mobi.y + d[1];
    return x < 0 || y < 0 ? null : { x, y, direcao: mobi.direcao };
  }

  // Fala ou grito: { indice, texto }.
  function lerFala(leitor) {
    return { indice: leitor.inteiro(), texto: leitor.texto() };
  }

  // Lista de entidades (374). Do tipo 1 (usuário) o formato foi conferido byte a byte; dos outros
  // tipos os campos depois do tipo não são conhecidos, então a leitura para no primeiro que não for
  // usuário e devolve o que já leu (com `incompleto`).
  function lerUsuarios(leitor) {
    const quantidade = leitor.inteiro();
    const lista = [];
    const temPosicao = typeof leitor.posicao === 'function';
    for (let i = 0; i < quantidade && i < 500; i++) {
      if (temPosicao && lista.length) lista[lista.length - 1].fim = leitor.posicao();
      const inicio = temPosicao ? leitor.posicao() : null;
      const id = leitor.inteiro();
      const nome = leitor.texto();
      const missao = leitor.texto();
      const visual = leitor.texto();
      const indice = leitor.inteiro();
      const x = leitor.inteiro();
      const y = leitor.inteiro();
      leitor.texto(); // altura
      const direcao = leitor.inteiro();
      const tipo = leitor.inteiro();
      const entidade = { id, nome, indice, x, y, direcao, tipo, visual, genero: '', pontos: null, grupo: -1, grupoNome: '', missao, inicio, fim: null };
      lista.push(entidade);
      // 2 pet, 3 bot, 4 bot alugável: formatos lidos no cliente do jogo em 2026-11-13 (não vistos ao vivo).
      if (tipo === 2) {
        leitor.inteiro(); leitor.inteiro(); leitor.texto(); leitor.inteiro(); // espécie, dono, nome do dono, raridade
        for (let b = 0; b < 6; b++) leitor.booleano(); // sela, montado, cruzar, colher, reviver, permissão
        leitor.inteiro(); leitor.texto(); leitor.booleano(); // nível, postura, transformado
        continue;
      }
      if (tipo === 3) continue;
      if (tipo === 4) {
        entidade.genero = leitor.texto().toUpperCase();
        leitor.inteiro(); leitor.texto(); // dono
        const habilidades = leitor.inteiro();
        for (let h = 0; h < habilidades && h < 100; h++) leitor.curto();
        continue;
      }
      if (tipo !== 1) return { lista, incompleto: i + 1 < quantidade };
      entidade.genero = leitor.texto().toUpperCase();
      entidade.grupo = leitor.inteiro(); // grupo favorito (-1 sem grupo)
      leitor.inteiro(); // situação no grupo
      entidade.grupoNome = leitor.texto(); // nome do grupo favorito
      leitor.texto();   // visual de natação
      entidade.pontos = leitor.inteiro(); // pontos de conquista
      leitor.booleano(); // moderador
    }
    if (temPosicao && lista.length) lista[lista.length - 1].fim = leitor.posicao();
    return { lista, incompleto: false };
  }

  // Para mostrar só alguns ("só amigos"): devolve os bytes de uma lista 374 com só as entidades que
  // manter(entidade) aprovar, em pedaços de até maxBytes (cada pedaço é um 374 completo: i n + entidades).
  // Devolve null quando não dá para filtrar com segurança (lista incompleta).
  function filtrarUsuarios(leitor, bytes, manter, maxBytes) {
    const r = lerUsuarios(leitor);
    if (r.incompleto || r.lista.some((e) => e.inicio == null || e.fim == null)) return null;
    const mantidas = r.lista.filter(manter);
    const limite = maxBytes || 7000;
    const pedacos = [];
    let atual = [];
    let tamanho = 0;
    for (const e of mantidas) {
      const fatia = Array.from(bytes.slice(e.inicio, e.fim));
      if (atual.length && tamanho + fatia.length > limite) { pedacos.push(atual); atual = []; tamanho = 0; }
      atual.push(fatia);
      tamanho += fatia.length;
    }
    if (atual.length) pedacos.push(atual);
    return { removidas: r.lista.filter((e) => !mantidas.includes(e)), pedacos: pedacos.map((p) => ({ quantidade: p.length, bytes: [].concat(...p) })) };
  }

  // Cópia dos bytes de uma entidade do 374 com outra posição (x, y), para devolver alguém à tela onde
  // ele está agora. Formato: i id, s nome, s missão, s visual, i índice, i x, i y, ...
  function trocarPosicao(bytes, x, y) {
    const b = Uint8Array.from(bytes);
    const v = new DataView(b.buffer);
    let p = 4;
    for (let i = 0; i < 3; i++) p += 2 + v.getUint16(p);
    p += 4; // índice
    v.setInt32(p, x);
    v.setInt32(p + 4, y);
    return b;
  }

  // Estados dos avatares (1640): [{ indice, x, y, acoes }].
  function lerEstados(leitor) {
    const quantidade = leitor.inteiro();
    const lista = [];
    const temPosicao = typeof leitor.posicao === 'function';
    for (let i = 0; i < quantidade && i < 500; i++) {
      const inicio = temPosicao ? leitor.posicao() : null;
      const indice = leitor.inteiro();
      const x = leitor.inteiro();
      const y = leitor.inteiro();
      leitor.texto();   // altura
      leitor.inteiro(); // direção da cabeça
      leitor.inteiro(); // direção do corpo
      const acoes = leitor.texto();
      lista.push({ indice, x, y, acoes, inicio, fim: temPosicao ? leitor.posicao() : null });
    }
    return lista;
  }

  // Destino de quem está andando, tirado das ações ("/mv 4,5,0.0/"), ou null.
  function destinoDoMovimento(acoes) {
    const m = /\/mv (\d+),(\d+),/.exec(String(acoes || ''));
    return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
  }

  // Um passo a partir de (x, y) com a tecla de seta, na direção da tela. Conferido ao vivo em
  // 2026-11-13: andar de (3, 5) a (7, 9), somando 1 em x e em y, desce o avatar reto na tela; logo x
  // cresce para baixo e à direita, y para baixo e à esquerda, e cada seta vira um passo diagonal.
  const PASSOS = Object.freeze({
    ArrowUp: [-1, -1],
    ArrowDown: [1, 1],
    ArrowLeft: [-1, 1],
    ArrowRight: [1, -1],
  });
  // Setas do teclado (pedido do usuário em 2026-11-15): cada seta segue um eixo do piso, como no
  // desenho dele — ↑ sobe à direita (y−1), ← sobe à esquerda (x−1), ↓ desce à esquerda (y+1),
  // → desce à direita (x+1). Duas setas juntas somam: ↑+← sobe reto na tela (x−1, y−1).
  // Girado no sentido anti-horário em 2026-11-15 (pedido do usuário): ↑ sobe à esquerda (x−1),
  // ← desce à esquerda (y+1), ↓ desce à direita (x+1), → sobe à direita (y−1).
  const EIXOS_SETAS = Object.freeze({ ArrowUp: [-1, 0], ArrowLeft: [0, 1], ArrowDown: [1, 0], ArrowRight: [0, -1] });
  function passoSetas(posicao, teclas) {
    if (!posicao) return null;
    let dx = 0;
    let dy = 0;
    for (const t of teclas || []) { const e = EIXOS_SETAS[t]; if (e) { dx += e[0]; dy += e[1]; } }
    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));
    if (!dx && !dy) return null;
    const x = posicao.x + dx;
    const y = posicao.y + dy;
    return x < 0 || y < 0 ? null : { x, y };
  }

  // Lados da tela para virar o avatar: [dx, dy] no piso. Para cima na tela é x-1 e y-1.
  const LADOS = Object.freeze({
    cima: [-1, -1], baixo: [1, 1], esquerda: [-1, 1], direita: [1, -1],
    ne: [0, -1], no: [-1, 0], se: [1, 0], so: [0, 1],
    n: [-1, -1], s: [1, 1], o: [-1, 1], l: [1, -1],
  });
  const NOMES_LADOS = ['cima', 'baixo', 'esquerda', 'direita', 'ne', 'no', 'se', 'so'];

  function passo(posicao, tecla) {
    const d = PASSOS[tecla];
    if (!d || !posicao) return null;
    const x = posicao.x + d[0];
    const y = posicao.y + d[1];
    return x < 0 || y < 0 ? null : { x, y };
  }

  // Linhas que o usuário quer mandar ao entrar em cada quarto: só comandos do Habblet (começam com
  // ":"), para nunca virarem fala no quarto; nada que comece com o prefixo do Vagalume.
  function linhasAoEntrar(lista, prefixo) {
    const nosso = ':' + String(prefixo || 'vl').toLowerCase();
    return (Array.isArray(lista) ? lista : [])
      .map((l) => String(l || '').trim())
      .filter((l) => /^:[a-z]/i.test(l) && l.toLowerCase() !== nosso && !l.toLowerCase().startsWith(nosso + ' '))
      .slice(0, 5);
  }

  // Altura aceita pelo `:up` do jogo: número de 0 a MAX_ALTURA, com até duas casas (conferido: 1 e 0.35).
  const MAX_ALTURA = 40;
  function alturaValida(z) {
    const n = Number(z);
    if (!Number.isFinite(n) || n < 0 || n > MAX_ALTURA) return null;
    return Math.round(n * 100) / 100;
  }
  // Altura de um mobi que já existe (pode ser negativa: há quartos com mobis abaixo do chão). Para copiar,
  // colar e mover sem perder a altura; valores digitados pelo usuário continuam em alturaValida (0 a 40).
  function alturaDoMobi(z) {
    const n = Number(z);
    if (!Number.isFinite(n) || n < -MAX_ALTURA || n > MAX_ALTURA) return null;
    return Math.round(n * 100) / 100 || 0;
  }

  // Referências a quartos numa fala: "room:123", "quarto:123" (com ou sem parênteses). Até 5, sem repetir.
  function referenciasDeQuarto(texto) {
    const ids = [];
    for (const m of String(texto || '').matchAll(/\b(?:room|quarto):\(?(\d{1,10})\)?/gi)) {
      const id = Number(m[1]);
      if (Number.isSafeInteger(id) && id > 0 && id <= 2147483647 && !ids.includes(id)) ids.push(id);
      if (ids.length >= 5) break;
    }
    return ids;
  }

  // ---------- copiar e colar quarto ----------

  // Cópia dos mobis do chão: tipo, posição, direção e altura, ordenada pela altura (os do chão
  // primeiro, e cada altura de uma vez, para ligar o :UP o mínimo de vezes).
  // ---------- planta, decoração, mobis de parede e regulador de luz (formatos lidos no cliente) ----------
  function lerPlanta(l) { const escala = l.booleano(); const alturaParede = l.inteiro(); const mapa = l.texto(); return { escala, alturaParede, mapa }; }
  function lerEspessura(l) { return { esconderParedes: l.booleano(), parede: l.inteiro(), piso: l.inteiro() }; }
  function lerPorta(l) { return { x: l.inteiro(), y: l.inteiro(), direcao: l.inteiro() }; }
  function lerDecoracao(l) { return { tipo: l.texto(), valor: l.texto() }; }
  // Mobi de parede: s id, i tipo, s local (":w=x,y l=a,b r"), s dados, i validade, i uso, i dono.
  function lerMobiParede(l) {
    const id = parseInt(l.texto(), 10);
    const tipo = l.inteiro();
    const local = l.texto();
    const estado = l.texto();
    l.inteiro(); l.inteiro();
    const dono = l.inteiro();
    return { id, tipo, local, estado, dono, parede: true };
  }
  function lerMobisParede(l) {
    const nDonos = l.inteiro();
    for (let i = 0; i < nDonos && i < 1000; i++) { l.inteiro(); l.texto(); }
    const n = l.inteiro();
    const lista = [];
    for (let i = 0; i < n && i < 5000; i++) lista.push(lerMobiParede(l));
    return lista;
  }
  function lerRegulador(l) {
    const n = l.inteiro();
    const selecionado = l.inteiro();
    const efeitos = [];
    for (let i = 0; i < n && i < 10; i++) efeitos.push({ id: l.inteiro(), tipo: l.inteiro(), cor: l.texto(), brilho: l.inteiro() });
    return { selecionado, efeitos };
  }
  // Estado do regulador no mobi: "2,efeito,tipo,#cor,claridade" (2 ligado, 1 desligado).
  function reguladorLigado(estado) { const m = /^([12]),\d+,\d+,#/.exec(String(estado || '')); return m ? m[1] === '2' : null; }
  const LOCAL_PAREDE = /^:w=\d{1,3},\d{1,3} l=-?\d{1,4},-?\d{1,4} [lr]$/;
  const CLASSE_DECORACAO = Object.freeze({ wallpaper: 3001, floor: 3002, landscape: 4057 }); // classes do cliente (getProductCategory)
  // O que a cópia guarda além dos mobis; devolve só o que for válido (vindo de arquivo, por exemplo).
  function validarExtrasQuarto(o) {
    const saida = {};
    if (!o || typeof o !== 'object') return saida;
    const p = o.planta;
    const inteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
    const mapa = p && typeof p.mapa === 'string' ? p.mapa.replace(/\r\n|\n/g, '\r').replace(/\r+$/, '') : '';
    if (mapa && mapa.length <= 28000 && /^[0-9a-zA-Z\r]+$/.test(mapa) && inteiro(p.alturaParede, -1, 64)) {
      // Espessuras de -2 a 1 (como o jogo manda); sem elas, a normal (0).
      saida.planta = { mapa, alturaParede: p.alturaParede, parede: inteiro(p.parede, -2, 1) ? p.parede : 0, piso: inteiro(p.piso, -2, 1) ? p.piso : 0 };
      const porta = p.porta;
      if (porta && inteiro(porta.x, 0, 255) && inteiro(porta.y, 0, 255) && inteiro(porta.direcao, 0, 7)) saida.planta.porta = { x: porta.x, y: porta.y, direcao: porta.direcao };
      if (typeof p.esconderParedes === 'boolean') saida.planta.esconderParedes = p.esconderParedes;
    }
    if (o.decoracao && typeof o.decoracao === 'object') {
      const d = {};
      for (const k of Object.keys(CLASSE_DECORACAO)) if (typeof o.decoracao[k] === 'string' && /^[0-9.]{1,12}$/.test(o.decoracao[k])) d[k] = o.decoracao[k];
      if (Object.keys(d).length) saida.decoracao = d;
    }
    const r = o.regulador;
    if (r && Array.isArray(r.efeitos) && r.efeitos.length && r.efeitos.length <= 10 && inteiro(r.selecionado, 0, 99)
      && r.efeitos.every((e) => e && inteiro(e.id, 0, 99) && inteiro(e.tipo, 0, 9) && /^#[0-9a-fA-F]{6}$/.test(e.cor) && inteiro(e.brilho, 0, 255))) {
      saida.regulador = { selecionado: r.selecionado, ligado: r.ligado !== false, efeitos: r.efeitos.map((e) => ({ id: e.id, tipo: e.tipo, cor: e.cor, brilho: e.brilho })) };
    }
    return saida;
  }
  // Floor para colar (pedido do usuário em 2026-11-22: "pegue o floor original", Ctrl+C e Ctrl+V): o mapa do
  // quarto copiado e a porta dele. Só saem linhas e colunas inteiras sem piso das bordas (o hotel recusa
  // mapa grande demais e conta essas bordas; o formato do chão fica igual): quem cola desloca mobis e
  // porta por "deslocar". Sem a porta (cópia antiga), um piso da borda sem mobi da cópia.
  // ocupados: [[x, y], ...] dos mobis da cópia (só para a porta de reserva). Devolve null se não há piso.
  function plantaParaColar(p, ocupados) {
    const valido = (c) => !!c && c !== 'x' && c !== 'X';
    const linhas = String((p && p.mapa) || '').split(/\r\n|\r|\n/);
    let largura = Math.max(0, ...linhas.map((l) => l.length));
    const grade = linhas.map((l) => l.padEnd(largura, 'x').split(''));
    while (grade.length && !grade[grade.length - 1].some(valido)) grade.pop();
    while (largura && !grade.some((l) => valido(l[largura - 1]))) { largura--; grade.forEach((l) => l.pop()); }
    let dy = 0, dx = 0;
    while (grade.length && !grade[0].some(valido)) { grade.shift(); dy++; }
    while (largura && !grade.some((l) => valido(l[0]))) { largura--; dx++; grade.forEach((l) => l.shift()); }
    const altura = grade.length;
    if (!altura || !largura) return null;
    const piso = (x, y) => valido((grade[y] || [])[x]);
    const original = p.porta && piso(p.porta.x - dx, p.porta.y - dy);
    let porta = original ? { x: p.porta.x - dx, y: p.porta.y - dy, direcao: p.porta.direcao } : null;
    if (!porta) {
      // Reserva: o primeiro piso da borda (vizinho de fora do chão) sem mobi da cópia, virado para dentro.
      const ocupado = new Set((ocupados || []).map((q) => (q[0] - dx) + ',' + (q[1] - dy)));
      const VIZ = [[-1, 0, 2], [0, -1, 4], [1, 0, 6], [0, 1, 0]];
      for (let x = 0; x < largura && !porta; x++) {
        for (let y = 0; y < altura && !porta; y++) {
          if (!piso(x, y) || ocupado.has(x + ',' + y)) continue;
          const fora = VIZ.find(([vx, vy]) => !piso(x + vx, y + vy));
          if (fora) porta = { x, y, direcao: fora[2] };
        }
      }
    }
    if (!porta) return null;
    return { mapa: grade.map((l) => l.join('')).join('\r'), porta, portaOriginal: !!original, deslocar: { x: dx, y: dy }, largura, altura };
  }
  // Altura do piso (x, y) no mapa do floor: 0 a 9 e depois letras (a = 10); null fora do chão.
  function alturaDoPiso(mapa, x, y) {
    const linha = String(mapa || '').split(/\r\n|\r|\n/)[y];
    const c = linha ? linha[x] : undefined;
    if (!c || c === 'x' || c === 'X') return null;
    const n = parseInt(c, 36);
    return Number.isFinite(n) ? n : null;
  }
  // Texto de um aviso do hotel (3801, 1992 ou 5100) e, quando é do editor de chão, o motivo em português.
  function lerAlerta(codigo, l) {
    if (codigo === ENTRADA.NOTIFICACAO) {
      const tipo = l.texto();
      const n = l.inteiro();
      const valores = [];
      for (let i = 0; i < n && i < 20; i++) { const k = l.texto(); const v = l.texto(); if (/message|texto|title/i.test(k) || i === 0) valores.push(v); }
      return { tipo, texto: valores.join(' ') };
    }
    return { tipo: '', texto: l.texto() };
  }
  const MOTIVOS_FLOOR = Object.freeze({
    change_blocked_by_room_item: 'há mobis em pisos que deixariam de existir',
    entry_tile_outside_map: 'a porta ficou fora do chão',
    entry_not_on_tile: 'a porta ficou fora do chão',
    invalid_door_setup: 'a porta não é aceita nesse lugar',
    too_large_area: 'o quarto passa do tamanho que o hotel deixa',
    too_large_height: 'o quarto passa do tamanho que o hotel deixa',
    too_large_width: 'o quarto passa do tamanho que o hotel deixa',
    effective_height_is_0: 'o mapa ficou vazio',
    effective_width_is_0: 'o mapa ficou vazio',
    max_furniture: 'o quarto chegou ao limite de mobis do hotel',
    cant_set_item: 'o hotel não deixou colocar alguns mobis no lugar',
    cant_set_not_owner: 'sem direitos neste quarto',
    max_queuetiles: 'limite de rollers do quarto',
    max_soundfurni: 'só um mobi sonoro por quarto',
    max_stickies: 'limite de 50 adesivos por quarto',
  });
  function motivoDoFloor(texto) {
    const t = String(texto || '');
    const chaves = [...t.matchAll(/(?:floorplan_editor\.error\.message|room\.error)\.([a-z_0-9]+)/gi)].map((m) => m[1].toLowerCase());
    const motivos = [...new Set(chaves.map((k) => MOTIVOS_FLOOR[k] || k.replace(/_/g, ' ')))];
    return motivos.length ? motivos.join('; ') : t.replace(/\$\{[^}]*\}/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200).replace(/[\s.!]+$/, '');
  }
  // A cópia levada para o floor recortado: chão por x e y, parede pelo ":w=x,y" (o "l=" é dentro da parede).
  function deslocarCopia(copia, d) {
    if (!d || (!d.x && !d.y)) return copia;
    return copia.map(function (m) {
      if (!m.parede) return Object.assign({}, m, { x: m.x - d.x, y: m.y - d.y });
      return Object.assign({}, m, { local: m.local.replace(/^:w=(\d+),(\d+)/, (t, x, y) => ':w=' + (Number(x) - d.x) + ',' + (Number(y) - d.y)) });
    }).filter((m) => m.parede ? LOCAL_PAREDE.test(m.local) : m.x >= 0 && m.y >= 0);
  }
  // Continuar uma colagem que parou (pedido do usuário em 2026-11-22): o que já está igual (tipo, piso, altura e
  // direção) fica; mobi do mesmo tipo no mesmo piso mas em outra altura ou direção é corrigido no lugar, pelo id
  // dele no quarto (em vez de pôr outro por cima); o resto falta. Parede: pelo tipo e local.
  function planoContinuar(copia, chao, paredes) {
    const porLugar = new Map();
    for (const m of chao) { const k = m.tipo + '|' + m.x + '|' + m.y; if (!porLugar.has(k)) porLugar.set(k, []); porLugar.get(k).push(m); }
    const locais = new Map();
    for (const m of paredes) { const k = m.tipo + '|' + m.local; locais.set(k, (locais.get(k) || 0) + 1); }
    const resto = [];
    for (const e of copia) {
      if (e.parede) { const k = e.tipo + '|' + e.local; if (locais.get(k)) locais.set(k, locais.get(k) - 1); else resto.push(e); continue; }
      const lista = porLugar.get(e.tipo + '|' + e.x + '|' + e.y) || [];
      const i = lista.findIndex((m) => Math.abs((m.altura || 0) - (e.altura || 0)) < 0.01 && m.direcao === e.direcao);
      if (i >= 0) lista.splice(i, 1); else resto.push(e);
    }
    const faltam = [], corrigir = [];
    for (const e of resto) {
      const lista = e.parede ? [] : porLugar.get(e.tipo + '|' + e.x + '|' + e.y) || [];
      if (!lista.length) { faltam.push(e); continue; }
      const c = { itemId: lista.shift().id, x: e.x, y: e.y, direcao: e.direcao, altura: e.altura };
      const est = estadoNumero(e.estado);
      if (est != null) c.estado = est;
      if (e.numeros) c.numeros = e.numeros;
      if (e.mapa) c.mapa = e.mapa;
      corrigir.push(c);
    }
    return { faltam, corrigir };
  }
  function faltandoNoQuarto(copia, chao, paredes) { return planoContinuar(copia, chao, paredes).faltam; }
  // Conferência do quarto colado com a cópia: cada mobi esperado é casado com um do quarto (mesmo tipo e
  // posição; altura e estado comparados). Devolve contagens e os tipos de cada problema.
  function conferirCopia(copia, chao, paredes) {
    const r = { certos: 0, estado: [], altura: [], faltando: [], parede: { certos: 0, faltando: [] } };
    const porLugar = new Map();
    for (const m of chao) { const k = m.tipo + '|' + m.x + '|' + m.y; if (!porLugar.has(k)) porLugar.set(k, []); porLugar.get(k).push(m); }
    for (const e of copia.filter((m) => !m.parede)) {
      const lista = porLugar.get(e.tipo + '|' + e.x + '|' + e.y) || [];
      const mesmaAltura = (m) => Math.abs((m.altura || 0) - (e.altura || 0)) < 0.01;
      const igual = lista.findIndex((m) => mesmaAltura(m) && (e.estado == null || estadoNumero(m.estado) === e.estado));
      if (igual >= 0) { lista.splice(igual, 1); r.certos++; continue; }
      const soAltura = lista.findIndex(mesmaAltura);
      if (soAltura >= 0) { lista.splice(soAltura, 1); r.estado.push(e.tipo); continue; }
      if (lista.length) { lista.shift(); r.altura.push(e.tipo); continue; }
      r.faltando.push(e.tipo);
    }
    const locais = new Map();
    for (const m of paredes) { const k = m.tipo + '|' + m.local; locais.set(k, (locais.get(k) || 0) + 1); }
    for (const e of copia.filter((m) => m.parede)) {
      const k = e.tipo + '|' + e.local;
      if (locais.get(k)) { locais.set(k, locais.get(k) - 1); r.parede.certos++; } else r.parede.faltando.push(e.tipo);
    }
    return r;
  }
  // Raro, LTD e afins (o arquivo de mobis do Habblet não marca raridade: vai pelo nome técnico e pelo nome).
  // Não ficam à venda em moedas, então a compra para completar uma cópia os deixa de fora.
  const RARO_CLASSE = /(^|_)(rare|minirare|ltd|raresrubi)|ltd\d*(_|$)|^nft_|_r\d+_/i;
  const RARO_NOME = /\bltd\b|\braro\b/i;
  function mobiRaro(classe, nome) { return RARO_CLASSE.test(String(classe || '')) || RARO_NOME.test(String(nome || '')); }
  // Estado do mobi como número (o que a ferramenta do jogo aceita fixar); null quando não é um número simples.
  function estadoNumero(v) {
    if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 999999 ? v : null;
    return typeof v === 'string' && /^\d{1,6}$/.test(v) ? Number(v) : null;
  }
  // Dados especiais que a cópia guarda: números (toner: ligado, matiz, saturação, claridade) e pares de
  // texto (imagem de fundo). Limites para o que vem de arquivo.
  function numerosValidos(v) {
    return Array.isArray(v) && v.length && v.length <= 8 && v.every((n) => Number.isInteger(n) && n >= -1 && n <= 999999) ? v.slice() : null;
  }
  function mapaValido(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const pares = Object.entries(o).filter(([k, v]) => k !== 'state' && /^[A-Za-z0-9_.-]{1,40}$/.test(k) && typeof v === 'string' && v.length <= 500);
    return pares.length && pares.length <= 20 ? Object.fromEntries(pares) : null;
  }
  function copiaDoQuarto(lista, paredes) {
    const deParede = (paredes || []).filter((m) => Number.isInteger(m.tipo) && LOCAL_PAREDE.test(m.local)).map((m) => ({ parede: true, tipo: m.tipo, local: m.local }));
    return lista.map(function (m) {
      const c = { tipo: m.tipo, x: m.x, y: m.y, direcao: m.direcao, altura: alturaDoMobi(m.altura) || 0 };
      const numeros = numerosValidos(m.numeros);
      const mapa = mapaValido(m.mapa);
      if (numeros) c.numeros = numeros;
      if (mapa) c.mapa = mapa;
      const e = estadoNumero(m.estado);
      if (e != null && !numeros && !mapa) c.estado = e;
      return c;
    }).concat(deParede)
      .sort((a, b) => a.altura - b.altura || a.y - b.y || a.x - b.x);
  }

  // Cópia vinda de arquivo: aceita só números inteiros nos limites; devolve null se algo não servir.
  function validarCopiaQuarto(lista) {
    if (!Array.isArray(lista) || !lista.length || lista.length > 5000) return null;
    const saida = [];
    const paredes = [];
    for (const m of lista) {
      if (!m || typeof m !== 'object') return null;
      if (m.parede) {
        if (!Number.isInteger(m.tipo) || typeof m.local !== 'string' || !LOCAL_PAREDE.test(m.local)) return null;
        paredes.push({ tipo: m.tipo, local: m.local });
        continue;
      }
      const ok = [m.tipo, m.x, m.y, m.direcao].every(Number.isInteger) && m.x >= 0 && m.y >= 0 && m.x <= 200 && m.y <= 200 && m.direcao >= 0 && m.direcao <= 7;
      const altura = alturaDoMobi(m.altura == null ? 0 : m.altura);
      if (!ok || altura == null) return null;
      if (m.estado != null && estadoNumero(m.estado) == null) return null;
      if ((m.numeros != null && !numerosValidos(m.numeros)) || (m.mapa != null && !mapaValido(m.mapa))) return null;
      saida.push({ tipo: m.tipo, x: m.x, y: m.y, direcao: m.direcao, altura, estado: m.estado, numeros: m.numeros, mapa: m.mapa });
    }
    return copiaDoQuarto(saida, paredes);
  }

  // Plano de colagem: para cada mobi da cópia, um item de chão do inventário com a mesma classe.
  function planoDeColagem(copia, itensInventario) {
    const porClasse = new Map();
    for (const item of itensInventario) {
      const k = (item.chao ? 'c' : 'p') + item.classe;
      if (!porClasse.has(k)) porClasse.set(k, []);
      porClasse.get(k).push(item.id);
    }
    const colocar = [];
    const faltam = new Map();
    const pendentes = [];
    for (const m of copia) {
      const ids = porClasse.get((m.parede ? 'p' : 'c') + m.tipo);
      if (ids && ids.length && m.parede) colocar.push({ itemId: ids.shift(), parede: true, local: m.local });
      else if (ids && ids.length) {
        const c = { itemId: ids.shift(), x: m.x, y: m.y, direcao: m.direcao, altura: m.altura };
        const e = estadoNumero(m.estado);
        if (e != null) c.estado = e;
        if (m.numeros) c.numeros = m.numeros;
        if (m.mapa) c.mapa = m.mapa;
        colocar.push(c);
      }
      else {
        faltam.set(m.tipo, (faltam.get(m.tipo) || 0) + 1);
        pendentes.push(m);
      }
    }
    return { colocar, faltam, pendentes };
  }

  // Páginas da loja cujo nome ou rótulo contém o termo (sem diferenciar maiúsculas e acentos).
  function semAcento(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  function acharPaginasLoja(paginas, termo) {
    const t = semAcento(termo);
    if (!t) return [];
    const exatas = paginas.filter((p) => semAcento(p.rotulo) === t || semAcento(p.nome) === t);
    return exatas.length ? exatas : paginas.filter((p) => semAcento(p.rotulo).includes(t) || semAcento(p.nome).includes(t));
  }

  // Caminho de rótulos até a página, sem a raiz (ex.: Utilitários > Wireds > Efeitos).
  // A raiz é a primeira do índice (no Habblet, com rótulo vazio: conferido ao vivo); ela não aparece na loja.
  function caminhoPaginaLoja(paginas, pagina) {
    const raiz = paginas[0];
    const caminho = [pagina.rotulo];
    let atual = pagina;
    for (let i = 0; i < 20 && atual.pai; i++) {
      const pai = paginas.find((p) => p !== raiz && p.rotulo === atual.pai);
      if (!pai) break;
      caminho.unshift(pai.rotulo);
      atual = pai;
    }
    return caminho;
  }

  // ---------- Carrinho da loja ----------
  // O 3492 como o jogo manda: i página, i oferta, s extra, i quantidade.
  function lerCompra(l) {
    return { pagina: l.inteiro(), oferta: l.inteiro(), extra: l.texto(), quantidade: l.inteiro() };
  }
  // Soma pelo preço de lista (o servidor pode dar desconto por quantidade). pontos: tipo -> total.
  function resumoCarrinho(itens) {
    let moedas = 0;
    let desconhecidos = 0;
    const pontos = new Map();
    for (const c of itens) {
      const q = Math.max(1, c.quantidade || 1);
      if (c.moedas == null) { desconhecidos++; continue; }
      moedas += c.moedas * q;
      if (c.pontos) pontos.set(c.tipoPontos, (pontos.get(c.tipoPontos) || 0) + c.pontos * q);
    }
    return { moedas, pontos, desconhecidos };
  }

  // ---------- Área do quarto ----------
  function areaDe(a, b) {
    return { x1: Math.min(a.x, b.x), y1: Math.min(a.y, b.y), x2: Math.max(a.x, b.x), y2: Math.max(a.y, b.y) };
  }
  function mobisNaArea(lista, area) {
    return lista.filter((m) => m.x >= area.x1 && m.x <= area.x2 && m.y >= area.y1 && m.y <= area.y2);
  }
  function mobisIguaisNaArea(lista, area, tipo) {
    return mobisNaArea(lista, area).filter((m) => m.tipo === tipo);
  }
  // Ordem para mover uma área: primeiro os que estão mais à frente no sentido do movimento, para
  // que nenhum pare em cima de outro que ainda vai sair; no mesmo piso, os de baixo antes.
  function planoMoverArea(lista, dx, dy) {
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);
    return lista.slice()
      .sort((a, b) => ((b.x * sx + b.y * sy) - (a.x * sx + a.y * sy)) || (a.altura - b.altura))
      .map((m) => ({ id: m.id, x: m.x + dx, y: m.y + dy, direcao: m.direcao }));
  }
  // Cada coluna da seleção apoia sua base no topo do mesmo piso no destino.
  function encaixeSobreMobis(lista, dx, dy, existentes, ignorados) {
    const bases = new Map();
    for (const m of lista) {
      const chave = (m.x + dx) + ',' + (m.y + dy);
      bases.set(chave, Math.min(bases.has(chave) ? bases.get(chave) : Infinity, m.altura || 0));
    }
    const topos = new Map();
    let ocupados = 0;
    let semTopo = false;
    for (const m of existentes) {
      const chave = m.x + ',' + m.y;
      if (!bases.has(chave) || (ignorados && ignorados.has(m.id))) continue;
      ocupados++;
      if (!Number.isFinite(m.altura) || !Number.isFinite(m.alturaMobi)) { semTopo = true; continue; }
      topos.set(chave, Math.max(topos.get(chave) || 0, m.altura + m.alturaMobi));
    }
    const deslocamentos = new Map();
    for (const [chave, base] of bases) {
      const deslocamento = Math.round(((topos.get(chave) || 0) - base) * 100) / 100;
      if (deslocamento) deslocamentos.set(chave, deslocamento);
    }
    return { ocupados, deslocamentos, semTopo };
  }
  // ---------- piso <-> tela (ferramenta de construção) ----------
  // O quarto é isométrico: no zoom normal, cada piso tem 64 × 32 px; andar 1 em x vai (+32, +16) na
  // tela e 1 em y vai (−32, +16); cada 1 de altura sobe 32 px. "s" é a escala do jogo (1 normal, 0,5 no
  // zoom longe) e "o" é onde fica o centro do piso (0, 0) em pixels do canvas. A origem sai de cliques
  // no chão: o jogo diz o piso (pedido de andar) e o Vagalume sabe onde foi o clique.
  function origemDaAmostra(local, piso, s) {
    return { x: local.x - (piso.x - piso.y) * 32 * s, y: local.y - (piso.x + piso.y) * 16 * s };
  }
  function pisoNaTela(o, s, x, y, z) {
    return { x: o.x + (x - y) * 32 * s, y: o.y + (x + y) * 16 * s - (z || 0) * 32 * s };
  }
  function telaNoPiso(o, s, lx, ly) {
    const u = (lx - o.x) / (32 * s); // x - y
    const v = (ly - o.y) / (16 * s); // x + y
    return { x: Math.round((u + v) / 2) + 0, y: Math.round((v - u) / 2) + 0 }; // + 0 tira o -0
  }
  // Mediana das origens das amostras (um clique fora do centro do piso não estraga a conta).
  function origemMediana(amostras) {
    if (!amostras.length) return null;
    const med = (l) => { const s = l.slice().sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    return { x: med(amostras.map((a) => a.x)), y: med(amostras.map((a) => a.y)) };
  }
  // Os quatro cantos (em pixels do canvas) de uma área de pisos, para desenhar o losango no chão.
  function cantosDaArea(o, s, area) {
    const c = (x, y) => pisoNaTela(o, s, x, y, 0);
    return [c(area.x1 - 0.5, area.y1 - 0.5), c(area.x2 + 0.5, area.y1 - 0.5), c(area.x2 + 0.5, area.y2 + 0.5), c(area.x1 - 0.5, area.y2 + 0.5)];
  }

  // Girar a área 90° (sentido horário no eixo do quarto) e espelhar (eixo x: esquerda↔direita; eixo y:
  // frente↔trás), pedido do usuário em 2026-11-15. Cada mobi vai ao piso correspondente dentro da mesma
  // área (girando, a área vira de lado a partir do mesmo canto) e a direção dele vira junto: girar soma
  // 2 (90°); espelhar em x troca 2↔6; em y, 0↔4. Mobi de mais de um piso gira pelo canto dele (o jogo
  // pode recusar se não couber). A ordem evita, quando dá, mandar um mobi para um piso ainda ocupado.
  function planoGirarArea(lista, area) {
    const h = area.y2 - area.y1 + 1;
    return lista.slice().sort((a, b) => (a.altura - b.altura) || (b.y - a.y) || (a.x - b.x))
      .map((m) => ({ id: m.id, x: area.x1 + (h - 1 - (m.y - area.y1)), y: area.y1 + (m.x - area.x1), direcao: ((Number(m.direcao) || 0) + 2) % 8 }));
  }
  function planoEspelharArea(lista, area, eixo) {
    const emX = eixo !== 'y';
    return lista.slice().sort((a, b) => (a.altura - b.altura) || (emX ? Math.abs(b.x - (area.x1 + area.x2) / 2) - Math.abs(a.x - (area.x1 + area.x2) / 2) : Math.abs(b.y - (area.y1 + area.y2) / 2) - Math.abs(a.y - (area.y1 + area.y2) / 2)))
      .map((m) => {
        const d = Number(m.direcao) || 0;
        return emX
          ? { id: m.id, x: area.x1 + area.x2 - m.x, y: m.y, direcao: (8 - d) % 8 }
          : { id: m.id, x: m.x, y: area.y1 + area.y2 - m.y, direcao: (12 - d) % 8 };
      });
  }
  // Escada: cada mobi da área ganha uma altura que sobe a cada piso ao longo do eixo (x ou y), a partir
  // da base. Nivelar é a escada com passo 0.
  function planoEscada(lista, eixo, base, passo) {
    const emX = eixo !== 'y';
    const inicio = Math.min(...lista.map((m) => (emX ? m.x : m.y)));
    return lista.map((m) => ({ id: m.id, altura: alturaValida(base + ((emX ? m.x : m.y) - inicio) * passo) })).filter((p) => p.altura != null);
  }

  // Duplicar: os mesmos mobis, deslocados, com itens do inventário da mesma classe.
  function planoDuplicar(lista, dx, dy, itens) {
    const copia = lista.slice().sort((a, b) => a.altura - b.altura)
      .map((m) => ({ tipo: m.tipo, x: m.x + dx, y: m.y + dy, direcao: m.direcao, altura: m.altura, estado: m.estado }));
    return planoDeColagem(copia, itens);
  }
  // Substituir: cada mobi da lista dá lugar a um item de chão da classe nova, no mesmo piso, direção e altura.
  function planoSubstituir(lista, classe, itens) {
    const ids = itens.filter((i) => i.chao && i.classe === classe).map((i) => i.id);
    const trocar = [];
    for (const m of lista.slice().sort((a, b) => a.altura - b.altura)) {
      if (!ids.length) break;
      trocar.push({ velho: m.id, itemId: ids.shift(), x: m.x, y: m.y, direcao: m.direcao, altura: m.altura });
    }
    return { trocar, faltam: lista.length - trocar.length };
  }
  // Preencher: um item da classe em cada piso da área (por camada), mesmo onde já houver um igual.
  const MAX_PISOS_PREENCHER = 400;
  const MAX_CAMADAS = 10;
  function planoPreencher(area, classe, noQuarto, itens, direcao, camadas) {
    const n = Math.min(MAX_CAMADAS, Math.max(1, Math.floor(Number(camadas) || 1)));
    // Em cima da pilha que já está no piso (topo = altura + altura do próprio mobi).
    const topos = new Map();
    for (const m of noQuarto) {
      if (!Number.isFinite(m.altura) || !Number.isFinite(m.alturaMobi)) continue;
      const k = m.x + ',' + m.y;
      topos.set(k, Math.max(topos.get(k) || 0, Math.round((m.altura + m.alturaMobi) * 100) / 100));
    }
    const ids = itens.filter((i) => i.chao && i.classe === classe).map((i) => i.id);
    const colocar = [];
    const pendentes = []; // pisos sem item no inventário (para a prévia e a compra)
    for (let camada = 0; camada < n; camada++) {
      for (let y = area.y1; y <= area.y2; y++) {
        for (let x = area.x1; x <= area.x2; x++) {
          const m = { x, y, direcao: direcao || 0, altura: topos.get(x + ',' + y) || 0, camada };
          if (ids.length) colocar.push(Object.assign({ itemId: ids.shift() }, m));
          else pendentes.push(m);
        }
      }
    }
    return { colocar, pendentes, faltam: pendentes.length };
  }
  // Repetidos: mesma classe, piso, direção e altura. Fica o de id menor; devolve os ids que sobram.
  function repetidos(lista) {
    const vistos = new Set();
    const sobra = [];
    for (const m of lista.slice().sort((a, b) => a.id - b.id)) {
      const chave = [m.tipo, m.x, m.y, m.direcao, m.altura].join(':');
      if (vistos.has(chave)) sobra.push(m.id);
      else vistos.add(chave);
    }
    return sobra;
  }

  // ---------- Feira Livre ----------
  // Estados de uma oferta, lidos no cliente: 1 à venda, 2 vendida, 3 vencida.
  const FEIRA_ESTADO = Object.freeze({ VENDENDO: 1, VENDIDA: 2, VENCIDA: 3 });

  function lerConfigFeira(l) {
    const ligada = l.booleano();
    const comissao = l.inteiro();
    l.inteiro(); l.inteiro(); // fichas: preço do pacote e tamanho
    const minimo = l.inteiro();
    const maximo = l.inteiro();
    const horas = l.inteiro();
    return { ligada, comissao, minimo, maximo, horas };
  }

  // Uma oferta. tipo 1 = chão (com dados extras), 2 = parede (texto), 3 = raro numerado (vira chão).
  // Na lista pública vêm 4 números depois (preço, minutos, média, quantas); na sua, 3.
  function lerOfertaFeira(l, propria) {
    const oferta = l.inteiro();
    const estado = l.inteiro();
    let tipo = l.inteiro();
    const classe = l.inteiro();
    let numero = null;
    if (tipo === 1) lerDadosExtras(l);
    else if (tipo === 2) l.texto();
    else if (tipo === 3) { numero = [l.inteiro(), l.inteiro()]; tipo = 1; }
    else throw new TypeError('Tipo de oferta desconhecido: ' + tipo);
    const preco = l.inteiro();
    const minutos = l.inteiro();
    const media = l.inteiro();
    const saida = { oferta, estado, tipo, classe, numero, preco, minutos, media };
    if (!propria) saida.quantas = l.inteiro();
    return saida;
  }
  function lerOfertasFeira(l) {
    const n = l.inteiro();
    const ofertas = [];
    for (let i = 0; i < n && i < 1000; i++) ofertas.push(lerOfertaFeira(l, false));
    return { ofertas, total: l.inteiro() };
  }
  function lerMinhasOfertas(l) {
    const aReceber = l.inteiro();
    const n = l.inteiro();
    const ofertas = [];
    for (let i = 0; i < n && i < 1000; i++) ofertas.push(lerOfertaFeira(l, true));
    return { aReceber, ofertas };
  }
  // Quais ofertas repor: as que não venderam (à venda ou vencidas), filtradas pelo id se pedir.
  function ofertasParaRepor(ofertas, id) {
    return ofertas.filter((o) => o.estado !== FEIRA_ESTADO.VENDIDA && (id == null || o.oferta === id));
  }

  // Meus dados (2725): só o começo interessa.
  function lerMeusDados(l) {
    const id = l.inteiro();
    const nome = l.texto();
    const visual = l.texto();
    const genero = l.texto().toUpperCase();
    return { id, nome, visual, genero };
  }

  const api = { planoContinuar, faltandoNoQuarto, conferirCopia, deslocarCopia, plantaParaColar, alturaDoPiso, lerAlerta, motivoDoFloor, lerPlanta, lerEspessura, lerPorta, lerDecoracao, lerMobiParede, lerMobisParede, lerRegulador, reguladorLigado, LOCAL_PAREDE, CLASSE_DECORACAO, validarExtrasQuarto, mobiRaro, estadoNumero, origemDaAmostra, pisoNaTela, telaNoPiso, origemMediana, cantosDaArea, planoGirarArea, planoEspelharArea, planoEscada, caminhoPaginaLoja, semAcento, acharPaginasLoja, MAX_PISOS_PREENCHER, MAX_CAMADAS, planoPreencher, lerCompra, resumoCarrinho, areaDe, mobisNaArea, planoMoverArea, planoDuplicar, planoSubstituir, repetidos, lerMeusDados, FEIRA_ESTADO, lerConfigFeira, lerOfertaFeira, lerOfertasFeira, lerMinhasOfertas, ofertasParaRepor, copiaDoQuarto, validarCopiaQuarto, planoDeColagem, SALVAR_WIRED, lerVisuais, visualValido, lerIndiceLoja, lerPaginaLoja, lerItemInventario, lerInventario, planoDeCompra, EXPRESSAO_INATIVO, lerAmigos, lerAmigo, lerAtualizacaoAmigos, lerMensagemRecebida, mencaoNaFala, referenciasDeQuarto, MAX_ALTURA, alturaValida, alturaDoMobi, SAIDA, ENTRADA, EXPRESSOES, MAX_DANCA, DANCAS_EXTRAS, MAX_PLACA, lerUmaOferta, lerFala, lerUsuarios, filtrarUsuarios, trocarPosicao, lerEstados, destinoDoMovimento, passo, PASSOS, EIXOS_SETAS, passoSetas, LADOS, NOMES_LADOS, linhasAoEntrar,
    lerDadosExtras, lerMobi, lerMobisDoQuarto, mexer, EIXOS, mobisIguaisNaArea, encaixeSobreMobis };
  raiz.VL = raiz.VL || {};
  raiz.VL.codigos = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
