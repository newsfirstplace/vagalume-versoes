// Vagalume — campos de ajuste de cada módulo, comuns à página de opções e ao painel do jogo.
// Cada campo diz o tipo (chave, numero, faixa, escolha, texto, termos, prefixo, atalho, css, macros,
// captura), a chave na seção do módulo, o rótulo e, se houver, uma nota.
(function (raiz) {
  'use strict';
  const VL = raiz.VL || {};
  const LIMITES = (VL.config && VL.config.LIMITES) || (typeof require === 'function' ? require('./config.js').LIMITES : {});

  // Imagem (data:) de um balão de digitando, ampliada 2×; vazio onde não há desenho nem canvas.
  const imagensDigitando = {};
  function imagemDigitando(id) {
    if (id in imagensDigitando) return imagensDigitando[id];
    let url = '';
    try {
      const tema = raiz.VL && raiz.VL.digitandoTemas && raiz.VL.digitandoTemas[id];
      if (tema) { imagensDigitando[id] = tema.quadros[0]; return tema.quadros[0]; }
      const D = raiz.VL && raiz.VL.digitando;
      const p = D && D.pixels(id);
      if (p && typeof document !== 'undefined' && typeof ImageData === 'function') {
        const tela = document.createElement('canvas');
        tela.width = D.LARGURA; tela.height = D.ALTURA;
        tela.getContext('2d').putImageData(new ImageData(p, D.LARGURA, D.ALTURA), 0, 0);
        url = tela.toDataURL('image/png');
      }
    } catch (e) { url = ''; }
    imagensDigitando[id] = url;
    return url;
  }

  const AJUSTES = {
    mencoes: [
      { tipo: 'chave', chave: 'soComArroba', rotulo: 'Seu apelido só conta com @ antes (como @apelido)', nota: 'Desligado, qualquer fala com o seu apelido avisa. Os outros termos valem sem o @.' },
      { tipo: 'termos', chave: 'termos', rotulo: 'Outros termos, um por linha', empilhado: true, nota: 'O apelido da sua conta já conta sozinho (precisa do módulo Conexão do jogo ligado). Até ' + LIMITES.termos + ' termos de até ' + LIMITES.texto + ' caracteres.' },
      { tipo: 'chave', chave: 'destacar', rotulo: 'Destacar a fala que menciona você' },
      { tipo: 'chave', chave: 'console', rotulo: 'Contar menções nas mensagens privadas (console)', nota: 'Precisa do módulo Amigos e console ligado. A mensagem entra na lista de menções e toca o som.' },
      { tipo: 'chave', chave: 'som', rotulo: 'Tocar um som ao ser mencionado' },
      { tipo: 'faixa', chave: 'volume', rotulo: 'Volume do som', unidade: '%', passo: 5, depende: 'som' },
      { tipo: 'chave', chave: 'corNoBalao', rotulo: 'Etiqueta nos @apelidos dos balões (clique abre o perfil; o seu brilha)' },
      { tipo: 'chave', chave: 'sugerirApelidos', rotulo: 'Ao digitar @ no chat, sugerir quem está no quarto (Tab completa)', nota: 'A lista de quem está no quarto vem do módulo Conexão do jogo.' },
    ],
    historico: [
      { tipo: 'numero', chave: 'limite', rotulo: 'Falas por página', unidade: 'falas', passo: 50, nota: 'Define quantas falas aparecem por página. O arquivo local continua guardado ao sair do hotel.' },
    ],
    digitando: [
      { tipo: 'escolha-imagem', chave: 'estilo', rotulo: 'Seu balão de digitando', nota: 'Aparece em cima do seu avatar enquanto você escreve, na sua tela e na das outros Vagalumes do quarto. Quem não usa a extensão vê o balão do jogo.', opcoes: [{ valor: 'vagalume', curto: 'Vagalume', rotulo: 'Vagalume (escuro com bolinhas limão)' }, { valor: 'limao', curto: 'Limão', rotulo: 'Limão (limão com bolinhas escuras)' }, { valor: 'noite', curto: 'Noite', rotulo: 'Noite (bolinhas acendendo)' }, { valor: 'brilho', curto: 'Brilho', rotulo: 'Brilho (branco com contorno limão)' }, { valor: 'pergaminho', curto: 'Pergaminho', rotulo: 'Pergaminho (dourado com fita)' }, { valor: 'floresta', curto: 'Floresta', rotulo: 'Floresta (folhas e florzinhas)' }, { valor: 'neon', curto: 'Neon', rotulo: 'Neon (metal com luz rosa)' }, { valor: 'galaxia', curto: 'Galáxia', rotulo: 'Galáxia (estrelas e planeta)' }, { valor: 'jogo', curto: 'Do jogo', rotulo: 'Do jogo (original)' }].map(function (o) { o.imagem = function () { return imagemDigitando(o.valor); }; return o; }) },
      { tipo: 'chave', chave: 'animado', rotulo: 'Bolinhas pulando enquanto a pessoa digita', nota: 'Vale na sua tela, para o seu balão e o das outros Vagalumes; também anima o balão do jogo.' },
      { tipo: 'chave', chave: 'verDosOutros', rotulo: 'Ver o balão escolhido pelas outros Vagalumes' },
      { tipo: 'chave', chave: 'paraTodos', rotulo: 'Usar o meu balão em todo mundo, só na minha tela' },
    ],
    chat: [
      { tipo: 'chave', chave: 'arrastarBaloes', rotulo: 'Arrastar os balões de fala: segure e arraste para mudar o balão de lugar (duplo clique devolve)' },
      { tipo: 'chave', chave: 'botaoCopiar', rotulo: 'Botão de copiar ao lado de cada fala (aparece ao passar o mouse)' },
      { tipo: 'chave', chave: 'botaoResponder', rotulo: 'Botão de responder ao lado de cada fala: quem usa o Vagalume vê a fala respondida em cima do balão; os outros veem @apelido mensagem' },
      { tipo: 'chave', chave: 'linksClicaveis', rotulo: 'Links das falas em azul, abrindo numa aba nova com um clique', nota: 'Só endereços http, https e www. A aba abre sem perguntar: confira o endereço passando o mouse antes de clicar.' },
      { tipo: 'chave', chave: 'responderComDireito', rotulo: 'Botão direito num balão escreve @apelido no chat, para responder' },
      { tipo: 'numero', chave: 'estiloOutros', rotulo: 'Estilo de balão forçado nas falas dos outros', passo: 1, nota: '-1 deixa como está. O número é o do estilo de balão do jogo (0 é o comum). Vale para pessoas, bots e pets, só na sua tela. Saber qual balão é o seu precisa do módulo Conexão do jogo.' },
    ],
    comandos: [
      { tipo: 'prefixo', chave: 'prefixo', rotulo: 'Prefixo dos comandos', nota: 'Use / (barra: /ajuda) ou uma palavra (com dois-pontos e espaço: :vl ajuda).' },
      { tipo: 'chave', chave: 'sugestoes', rotulo: 'Sugerir comandos enquanto você digita', nota: 'A lista aparece acima do chat; Tab completa a primeira sugestão.' },
      { tipo: 'chave', chave: 'novidades', rotulo: 'Mostrar as novidades uma vez quando o Vagalume for atualizado' },
    ],
    notificacoes: [
      { tipo: 'chave', chave: 'ocultarCompras', rotulo: 'Esconder o aviso "Você comprou…" depois de cada compra', nota: 'O aviso some do canto da tela, mas continua no histórico (comando notificacoes).' },
      { tipo: 'chave', chave: 'ocultarConquistas', rotulo: 'Esconder os avisos de conquista', nota: 'Continuam no histórico (comando notificacoes).' },
    ],
    silenciar: [
      { tipo: 'termos', chave: 'apelidos', rotulo: 'Apelidos silenciados, um por linha', empilhado: true, maximo: LIMITES.silenciados, contagem: ['apelido', 'apelidos'], nota: 'Até ' + LIMITES.silenciados + ' apelidos. Também dá para usar os comandos silenciar e liberar no chat. Ninguém é avisado.' },
      { tipo: 'termos', chave: 'termos', rotulo: 'Termos silenciados, um por linha', empilhado: true, nota: 'Some toda fala que tiver o termo no apelido de quem falou ou no texto, sem diferenciar maiúsculas. Até ' + LIMITES.termos + ' termos.' },
      { tipo: 'chave', chave: 'ocultarPessoas', rotulo: 'Esconder os balões de todas as pessoas' },
      { tipo: 'chave', chave: 'ocultarBots', rotulo: 'Esconder os balões de bots', nota: 'Saber quem é bot ou pet precisa do módulo Conexão do jogo.' },
      { tipo: 'chave', chave: 'ocultarPets', rotulo: 'Esconder os balões de pets' },
      { tipo: 'chave', chave: 'excetoMeus', rotulo: 'Nunca esconder os meus balões' },
      { tipo: 'chave', chave: 'excetoAmigos', rotulo: 'Nunca esconder os balões de amigos', nota: 'Precisa do módulo Amigos e console.' },
      { tipo: 'numero', chave: 'minimoPontos', rotulo: 'Silenciar quem tem menos pontos de conquista que', passo: 50, nota: '0 desliga. Precisa do módulo Conexão do jogo: os pontos vêm quando a pessoa entra no quarto.' },
      { tipo: 'escolha', chave: 'modo', rotulo: 'O que fazer com as falas', opcoes: [{ valor: 'esconder', rotulo: 'Esconder' }, { valor: 'esmaecer', rotulo: 'Deixar apagadas' }] },
    ],
    wired: [
      { tipo: 'chave', chave: 'copiarAoSalvar', rotulo: 'Ao salvar um wired, guardar a configuração para colar em outro' },
      { tipo: 'chave', chave: 'enterSalva', rotulo: 'Enter salva a janela de wired aberta' },
      { tipo: 'chave', chave: 'avancadasAbertas', rotulo: 'Abrir sempre as configurações avançadas da janela de wired' },
      { tipo: 'chave', chave: 'naoAndarAoClicar', rotulo: 'Não andar ao clicar em mobis (útil para mexer em wireds)' },
    ],
    loja: [
      { tipo: 'numero', chave: 'quantidadePadrao', rotulo: 'Quantidade que a loja já mostra ao escolher um item', passo: 1, nota: '1 deixa como o jogo faz.' },
      { tipo: 'chave', chave: 'confirmarOutraMoeda', rotulo: 'Perguntar antes de comprar com diamantes ou outra moeda especial', nota: 'Vale para o botão Comprar da loja do jogo, mesmo com "Pular a confirmação" ligado. Itens só de moedas vão direto.' },
      { tipo: 'chave', chave: 'marcarCustom', rotulo: 'Marcar os mobis custom', nota: 'Na loja e no inventário, os mobis que não existem na Habbo original (feitos pelo Habblet ou por artistas) ganham fundo roxo e um C no canto. A lista dos originais vem do arquivo oficial de mobis da Habbo.' },
      { tipo: 'chave', chave: 'pularConfirmacao', rotulo: 'Pular a confirmação de compra', nota: 'Se aparecer um botão de confirmar depois de Comprar, o Vagalume clica nele. Gasta moedas sem perguntar de novo.' },
      { tipo: 'chave', chave: 'repor', rotulo: 'Repor sozinho os mobis que estão acabando no inventário', nota: 'Só tipos já vistos na loja, pagos com moedas. Compra sem perguntar.' },
      { tipo: 'numero', chave: 'reporLimite', rotulo: 'Repor quando restarem', unidade: 'ou menos', passo: 1 },
      { tipo: 'numero', chave: 'reporQuantidade', rotulo: 'Quantos comprar ao repor', passo: 1 },
      { tipo: 'chave', chave: 'reporSoWired', rotulo: 'Repor só wireds' },
      { tipo: 'chave', chave: 'reporSemTeleporte', rotulo: 'Não repor mobis com "tele" no nome (teleportes)' },
    ],
    musica: [
      { tipo: 'lastfm', chave: 'usuario', rotulo: 'Seu apelido no Last.fm', nota: 'Siga os 3 passos do guia acima. Os outros só veem a sua música depois que você confirmar que o Last.fm é seu.' },
      { tipo: 'chave', chave: 'compartilhar', rotulo: 'Deixar outros Vagalumes verem a minha música', nota: 'Responde, por um sussurro que ninguém vê, quando outro Vagalume do quarto pergunta o seu apelido do Last.fm.' },
      { tipo: 'chave', chave: 'mostrar', rotulo: 'Mostrar a música no quadro de quem usa o Vagalume', nota: 'O Vagalume pergunta o apelido por um sussurro escondido e consulta o Last.fm (sem cookies) a cada 30 s com o quadro aberto. O Last.fm recebe o seu endereço de internet nessas consultas.' },
    ],
    midia: [
      { tipo: 'faixa', chave: 'volume', rotulo: 'Volume dos áudios', unidade: '%', passo: 5 },
      { tipo: 'termos', chave: 'bloqueados', rotulo: 'Não ver mídias destas pessoas, uma por linha', empilhado: true, nota: 'Também pelo botão "Não ver mais" ao ampliar uma imagem.' },
    ],
    comunidade: [
      { tipo: 'chave', chave: 'entrarNoGrupo', rotulo: 'Entrar no grupo Vagalume e deixá-lo como favorito', nota: 'Feito uma vez por conta, com aviso. É assim que os outros usuários do Vagalume reconhecem você: o grupo favorito aparece para todos no Habblet. Se você favoritar outro grupo depois, o Vagalume não troca de novo.' },
      { tipo: 'chave', chave: 'selo', rotulo: 'Ponto verde ao lado do apelido de quem usa o Vagalume', nota: 'Nos balões de fala e no quadro de informações.' },
      { tipo: 'chave', chave: 'aparecer', rotulo: 'Aparecer para as outros Vagalumes do quarto', nota: 'Avisa ao servidor do Vagalume o quarto em que você está (só o número do quarto, o seu id e o apelido do Habblet), para o ponto verde e para beijar e socar aparecerem para os outros. Desligado, você também não vê quem usa.' },
    ],
    amigos: [
      { tipo: 'chave', chave: 'soAmigos', rotulo: 'Mostrar só amigos no quarto (esconde quem não é seu amigo, só na sua tela)', nota: 'Vale em todos os quartos enquanto estiver ligado. Você, bots e pets continuam aparecendo. O comando /soamigos liga e desliga isto.' },
      { tipo: 'chave', chave: 'destacarLotado', rotulo: 'Destacar amigos em quartos lotados: quem não é amigo muda de aparência por alguns segundos ao entrar (só na sua tela)', nota: 'Também pelo comando /lotado, a qualquer momento.' },
      { tipo: 'numero', chave: 'lotado', rotulo: 'Quarto lotado a partir de quantas pessoas', passo: 1, depende: 'destacarLotado' },
      { tipo: 'numero', chave: 'segundosLotado', rotulo: 'Por quantos segundos', passo: 1, depende: 'destacarLotado' },
      { tipo: 'chave', chave: 'amigosNoNavegador', rotulo: 'Mostrar embaixo de cada quarto do navegador os amigos que estão nele', nota: 'Com o navegador aberto (no máximo a cada 15 segundos), o Vagalume pergunta ao jogo onde cada amigo online está, como o botão Seguir, mas segura a resposta: você não sai do quarto. Amigos que não deixam ser seguidos não aparecem.' },
      { tipo: 'chave', chave: 'mencaoPorConsole', rotulo: 'Ao falar "@amigo texto" no quarto, mandar o texto também por mensagem privada a esse amigo' },
      { tipo: 'chave', chave: 'avisarMensagens', rotulo: 'Avisar na tela quando chegar mensagem privada', nota: 'O formato dessa mensagem ainda não foi conferido no Habblet.' },
      { tipo: 'chave', chave: 'avisarOnline', rotulo: 'Avisar quando um amigo entrar ou sair do hotel', nota: 'O formato desse aviso ainda não foi conferido no Habblet.' },
      { tipo: 'chave', chave: 'missaoNaDica', rotulo: 'Mostrar a missão do amigo ao passar o mouse na lista de amigos' },
      { tipo: 'chave', chave: 'silenciarConvites', rotulo: 'Silenciar os convites para quartos que chegam pelo console' },
    ],
    zoom: [
      { tipo: 'escolha', chave: 'modo', rotulo: 'Tipo de zoom da roda', nota: 'Câmera: aproxima aos poucos, na direção do mouse. Jogo: usa os dois níveis do botão de zoom do Habblet.', opcoes: [{ valor: 'camera', rotulo: 'Câmera (suave)' }, { valor: 'jogo', rotulo: 'Do jogo (dois níveis)' }] },
      { tipo: 'chave', chave: 'afastarAlem', rotulo: 'Afastar além do normal (o "zoom longe" do jogo)', nota: 'Girando a roda para afastar depois do tamanho normal, o quarto fica ainda mais distante, como no botão de zoom longe do Habblet. Girando para aproximar, volta.' },
    ],
    construcao: [
      { tipo: 'chave', chave: 'tipoNoQuadro', rotulo: 'Mostrar o tipo do mobi no quadro de informações (clique copia o número)', nota: 'O tipo é o número que os comandos substituir e preencher usam.' },
      { tipo: 'chave', chave: 'desfazer', rotulo: 'Ctrl+Z desfaz e Ctrl+Y refaz movimentos, giros e alturas de mobis', nota: 'Guarda os últimos 50 deste quarto. Colocar e recolher mobis não entram. Se outra extensão também usar Ctrl+Z, desligue uma das duas.' },
      { tipo: 'chave', chave: 'alturaScroll', rotulo: 'Shift+roda do mouse sobre o quarto muda a altura do mobi selecionado' },
      { tipo: 'numero', chave: 'passoAltura', rotulo: 'Quanto cada giro da roda (e os botões − e +) muda a altura', passo: 0.05, nota: 'A mudança vai ao jogo depois de uma pausa, pelo comando :up. O jogo responde com um sussurro a cada mudança.' },
      { tipo: 'chave', chave: 'teclado', rotulo: 'Ctrl+setas movem o último mobi clicado; Ctrl+Shift+← e → giram', nota: 'Pelos eixos do chão: → e ← mudam o x, ↓ e ↑ mudam o y. Só vale com o foco fora do chat e em quartos onde você pode mexer nos mobis.' },
    ],
    agrupar: [
      { tipo: 'numero', chave: 'janela', rotulo: 'Juntar se a repetição vier em até', unidade: 's', passo: 1, nota: 'Contado desde a última repetição. Depois disso, a mesma fala começa um grupo novo.' },
    ],
    macros: [
      { tipo: 'numero', chave: 'intervaloMs', rotulo: 'Intervalo entre as falas', unidade: 'ms', passo: 100, nota: 'Cada acionamento roda a macro uma vez, fala por fala. Ela nunca se repete sozinha.' },
      { tipo: 'macros' },
    ],
    painel: [
      { tipo: 'atalho', chave: 'atalho', rotulo: 'Atalho do painel' },
      { tipo: 'chave', chave: 'mostrarBotao', rotulo: 'Mostrar o botão do Vagalume (na barra do hotel, depois da câmera)', nota: 'Sem a barra do hotel na tela (carregando), aparece a bolinha no canto esquerdo.' },
    ],
    janelas: [
      { tipo: 'chave', chave: 'escFecha', rotulo: 'Fechar com Esc a janela do jogo que está na frente' },
      { tipo: 'chave', chave: 'minimizar', rotulo: 'Duplo clique na barra de título minimiza a janela' },
      { tipo: 'chave', chave: 'animar', rotulo: 'Animação curta ao abrir as janelas' },
      { tipo: 'chave', chave: 'lembrarTamanho', rotulo: 'Lembrar o tamanho da loja e do inventário', nota: 'Vale quando a janela pode ser redimensionada pelo canto.' },
      { tipo: 'chave', chave: 'ocultarQuartos', rotulo: 'Ocultar quartos do navegador (como os de Meus Quartos) com um × ao passar o mouse', nota: 'Os quartos ocultos ficam guardados neste navegador. A linha "N quartos ocultos · mostrar" acima da lista mostra de novo e permite desfazer (↺).' },
      { tipo: 'chave', chave: 'nomeInventario', rotulo: 'Nome do mobi no inventário: inteiro ao passar o mouse e copiado com um clique' },
      { tipo: 'chave', chave: 'buscaInventario', rotulo: 'Filtros do inventário (Wired, LTD, Parede e Chão), Limpar e Ctrl+F', nota: 'Os filtros usam os tipos de mobi do jogo e podem ser combinados com a busca pelo nome. Ctrl+F foca a busca com o inventário aberto.' },
    ],
    interface: [
      { tipo: 'chave', chave: 'ocultarCarteira', rotulo: 'Ocultar a carteira' },
      { tipo: 'chave', chave: 'ocultarCursor', rotulo: 'Ocultar o ponteiro do mouse sobre o quarto' },
      { tipo: 'chave', chave: 'textoSelecionavel', rotulo: 'Deixar selecionar e copiar o texto das falas e das janelas' },
      { tipo: 'chave', chave: 'toolbarTranslucido', rotulo: 'Barra de baixo translúcida (volta ao normal com o mouse em cima)' },
      { tipo: 'chave', chave: 'menusTranslucidos', rotulo: 'Placares e menu de usuário translúcidos' },
      { tipo: 'chave', chave: 'ocultarHotel', rotulo: 'Ocultar o botão do Hotel' },
      { tipo: 'chave', chave: 'ocultarNavegador', rotulo: 'Ocultar o botão do Navegador' },
      { tipo: 'chave', chave: 'ocultarMissoes', rotulo: 'Ocultar o botão das Missões' },
      { tipo: 'chave', chave: 'ocultarCatalogo', rotulo: 'Ocultar o botão do Catálogo' },
      { tipo: 'chave', chave: 'ocultarInventario', rotulo: 'Ocultar o botão do Inventário' },
      { tipo: 'chave', chave: 'ocultarCamera', rotulo: 'Ocultar o botão da Câmera' },
      { tipo: 'chave', chave: 'ocultarAmigos', rotulo: 'Ocultar o botão da Lista de amigos' },
      { tipo: 'chave', chave: 'ocultarBuscaAmigos', rotulo: 'Ocultar o botão da Pesquisa de amigos' },
      { tipo: 'chave', chave: 'minificarInfostand', rotulo: 'Infostand de mobis menor (sem a imagem do mobi)' },
      { tipo: 'chave', chave: 'ocultarInfostands', rotulo: 'Ocultar os infostands (o painel do canto ao clicar em alguém ou num mobi)' },
      { tipo: 'chave', chave: 'ocultarSetaEsquerda', rotulo: 'Ocultar a seta da esquerda da barra de baixo' },
      { tipo: 'chave', chave: 'ocultarSetaDireita', rotulo: 'Ocultar a seta da direita da barra de baixo (barra de amigos)' },
      { tipo: 'chave', chave: 'semAnimacaoBarra', rotulo: 'Sem animação nos ícones da barra ao passar o mouse', nota: 'Não conferido no jogo.' },
      { tipo: 'chave', chave: 'ocultarRodapeAmigos', rotulo: 'Ocultar o rodapé da lista de amigos' },
      { tipo: 'chave', chave: 'missaoClicavel', rotulo: 'Endereço na missão de alguém vira link (abre direto numa aba nova)', nota: 'Só http e https. A sua própria missão fica de fora, porque clicar nela é editar.' },
      { tipo: 'chave', chave: 'chatArrastavel', rotulo: 'Alt+arrastar move a barra do chat (Alt+duplo clique volta ao lugar)' },
      { tipo: 'chave', chave: 'colunaVidro', rotulo: 'Carteira e balões da direita translúcidos (vidro)', nota: 'Só com o tema Vagalume. O quarto aparece desfocado atrás da carteira, da rádio e dos avisos.' },
      { tipo: 'chave', chave: 'botaoLateral', rotulo: 'Botão para recolher a coluna da direita (carteira e rádio)' },
      { tipo: 'chave', chave: 'pausarRadio', rotulo: 'Pausar a rádio do Habblet ao abrir o hotel' },
      { tipo: 'chave', chave: 'ocultarRadio', rotulo: 'Esconder a rádio do Habblet (e mantê-la pausada)' },
      { tipo: 'chave', chave: 'removerPresentear', rotulo: 'Tirar o botão Presentear da loja' },
      { tipo: 'chave', chave: 'relacionamentosPrimeiro', rotulo: 'Na lista de amigos, relacionamentos primeiro (coração, sorriso, caveira)', nota: 'Só muda a ordem na tela, dentro de Online e de Offline.' },
      { tipo: 'chave', chave: 'atalhosNoQuadro', rotulo: 'Botões do Vagalume no quadro de uma pessoa (vestir o visual, seguir, sussurrar, mensagem, silenciar)', nota: 'Aparecem no quadro que abre ao clicar num avatar. Os que dependem de um módulo desligado ficam de fora.' },
      { tipo: 'escolha', chave: 'tema', rotulo: 'Tema das janelas do jogo', nota: 'Com outra extensão de tema ligada, algumas abas podem ficar com as cores dela.', opcoes: [{ valor: 'nenhum', rotulo: 'O do jogo' }, { valor: 'vagalume', rotulo: 'Vagalume (escuro com destaque limão)' }] },
      { tipo: 'escolha', chave: 'filtro', rotulo: 'Filtro de cor do quarto', nota: 'Vale só para o desenho do quarto, não para as janelas.', opcoes: [
        { valor: 'nenhum', rotulo: 'Nenhum' }, { valor: 'cinza', rotulo: 'Tons de cinza' }, { valor: 'sepia', rotulo: 'Sépia' },
        { valor: 'inverter', rotulo: 'Cores invertidas' }, { valor: 'contraste', rotulo: 'Mais contraste' }, { valor: 'vivo', rotulo: 'Cores vivas' },
        { valor: 'suave', rotulo: 'Cores suaves' }, { valor: 'escuro', rotulo: 'Mais escuro' },
      ] },
    ],
    estilo: [
      { tipo: 'css', chave: 'css', rotulo: 'Seu CSS', empilhado: true, nota: 'Vale para a tela do hotel. O Vagalume retira @import, image-set() e url() que aponte para fora; url() com data: continua valendo.' },
    ],
    captura: [{ tipo: 'captura' }],
    contador: [
      { tipo: 'chave', chave: 'mostrarFps', rotulo: 'Mostrar o FPS (quadros por segundo)' },
      { tipo: 'chave', chave: 'mostrarPing', rotulo: 'Mostrar o ping (ms até o servidor)', nota: 'Precisa do módulo Conexão do jogo ligado. Cada medida pede ao servidor a lista de visuais salvos, que é pequena.' },
      { tipo: 'numero', chave: 'intervaloPing', rotulo: 'Medir o ping a cada', unidade: 'segundos', passo: 5, depende: 'mostrarPing' },
      { tipo: 'escolha', chave: 'canto', rotulo: 'Canto da tela', opcoes: [{ valor: 'sup-esq', rotulo: 'Em cima, à esquerda' }, { valor: 'sup-dir', rotulo: 'Em cima, à direita' }, { valor: 'inf-esq', rotulo: 'Embaixo, à esquerda' }, { valor: 'inf-dir', rotulo: 'Embaixo, à direita' }] },
    ],
    fps: [
      { tipo: 'numero', chave: 'limite', rotulo: 'Quadros por segundo', passo: 1, nota: 'O número pode ser trocado com o hotel aberto.' },
    ],
    conexao: [
      { tipo: 'chave', chave: 'escurecerQuemSaiu', rotulo: 'Escurecer as falas de quem saiu do quarto' },
      { tipo: 'chave', chave: 'esconderMeuDigitando', rotulo: 'Não mostrar aos outros o meu balão de "digitando"' },
      { tipo: 'chave', chave: 'ocultarDigitando', rotulo: 'Esconder para mim os balões de "digitando" dos outros' },
      { tipo: 'chave', chave: 'antiGiro', rotulo: 'Não virar o meu avatar quando eu clicar em alguém' },
      { tipo: 'chave', chave: 'cliqueSemAviso', rotulo: 'Clicar nas pessoas sem avisar o quarto', nota: 'Evita que o clique dispare wireds de clique. Ainda não conferido em todos os quartos.' },
      { tipo: 'chave', chave: 'setinhas', rotulo: 'Andar com as setas do teclado (↑ sobe à esquerda, → sobe à direita, ← desce à esquerda, ↓ desce à direita; duas setas juntas andam na diagonal da tela)', nota: 'Com o foco fora do chat. O Vagalume aprende onde você está quando você anda ou fala pela primeira vez no quarto.' },
      { tipo: 'chave', chave: 'antiAusente', rotulo: 'Anti-ausente: evita que o jogo te tire do quarto por inatividade', nota: 'A cada minuto sem nenhuma ação sua, manda a expressão "Inativo": o avatar continua com o zzz. Pode contrariar as regras do jogo; use por sua conta.' },
      { tipo: 'chave', chave: 'simularDireitos', rotulo: 'Simular direitos nos quartos onde você não tem', nota: 'Só na sua tela, para ver os menus de quem tem direitos. O servidor continua recusando o que você não pode fazer.' },
      { tipo: 'chave', chave: 'avisarCampainha', rotulo: 'Avisar quem tocou a campainha do quarto' },
      { tipo: 'chave', chave: 'avisarDireitos', rotulo: 'Avisar quando você receber direitos no quarto' },
      { tipo: 'chave', chave: 'avisarCurtidas', rotulo: 'Avisar quando o quarto ganhar curtida' },
      { tipo: 'chave', chave: 'avisarMute', rotulo: 'Avisar quando você tomar mute, cair no antiflood ou o quarto for silenciado, com o tempo que falta' },
      { tipo: 'chave', chave: 'meioAnda', rotulo: 'Clique do meio num balão anda até quem falou' },
      { tipo: 'chave', chave: 'iconeVoltar', rotulo: 'Ícone de quarto anterior na barra do hotel', nota: 'Fica entre o Hotel e o Navegador de quartos. Um clique volta ao último quarto visitado nesta sessão.' },
      { tipo: 'numero', chave: 'placaNoMute', rotulo: 'Levantar esta placa ao tomar mute', passo: 1, nota: '-1 desliga. Número da placa como no comando placa (0 a 17). Não vale para o antiflood.' },
      { tipo: 'chave', chave: 'referencias', rotulo: 'Ctrl+clique numa fala com room:123 ou quarto:123 oferece entrar no quarto' },
      { tipo: 'chave', chave: 'nomeNoTitulo', rotulo: 'Mostrar o seu apelido no título da aba do hotel', nota: 'O Vagalume descobre o apelido quando você fala ou anda pela primeira vez num quarto.' },
      { tipo: 'chave', chave: 'avisarQueda', rotulo: 'Avisar quando a conexão com o hotel cair, com botão para recarregar' },
      { tipo: 'chave', chave: 'voltarAoRelogar', rotulo: 'Ao recarregar o hotel, voltar ao quarto em que você estava', nota: 'Só se você ficou fora por até 2 minutos. O número do quarto fica guardado só nesta aba e some quando ela é fechada.' },
      { tipo: 'termos', chave: 'aoEntrar', rotulo: 'Comandos do Habblet ao entrar em cada quarto, um por linha', empilhado: true, maximo: 5, contagem: ['comando', 'comandos'], nota: 'Por exemplo :enable 215 ou :handitem 2. Só linhas que começam com dois-pontos, até 5, mandadas uma a cada 1,2 s depois que o quarto carrega.' },
    ],
  };

  const api = { AJUSTES };
  raiz.VL = raiz.VL || {};
  raiz.VL.campos = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
