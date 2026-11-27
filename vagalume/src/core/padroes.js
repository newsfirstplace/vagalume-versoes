// Vagalume — valores padrão e catálogo de módulos.
// Arquivo puro (sem DOM, sem chrome.*): serve ao conteúdo, ao fundo, às páginas e aos testes.
(function (raiz) {
  'use strict';

  const PADROES = {
    modulos: {
      painel: true,
      comandos: true,
      macros: true,
      historico: true,
      apelidos: true,
      mencoes: true,
      chat: true,
      baloes: true,
      digitando: true,
      janelas: true,
      interface: true,
      estilo: false,
      captura: true,
      anuncios: false,
      medicao: false,
      fps: false,
      fluido: true, // 2026-11-20: o jogo trava em 60 FPS; ligado de fábrica para ficar fluido
      silenciar: true,
      contador: false,
      conexao: true, // ligada de fábrica (2026-11-14): a Comunidade e o grupo Vagalume dependem dela
      agrupar: false,
      construcao: true,
      notificacoes: true,
      zoom: true,
      amigos: true,
      loja: true,
      visual: true,
      wired: true,
      comunidade: true,
      musica: true,
      midia: true,
      jogos: true,
    },
    painel: { atalho: 'Alt+V', mostrarBotao: true },
    comandos: { prefixo: '/', sugestoes: true, novidades: true },
    macros: { intervaloMs: 800, lista: [] },
    historico: { limite: 500 },
    mencoes: { apelido: '', soComArroba: true, termos: [], som: true, volume: 60, destacar: true, corNoBalao: true, sugerirApelidos: true, console: true },
    digitando: { estilo: 'vagalume', animado: true, verDosOutros: true, paraTodos: false },
    chat: { arrastarBaloes: true, botaoCopiar: true, botaoResponder: true, linksClicaveis: true, responderComDireito: false, estiloOutros: -1 },
    baloes: { estilo: 'jogo' },
    notificacoes: { ocultarCompras: false, ocultarConquistas: false },
    silenciar: { apelidos: [], termos: [], modo: 'esconder', minimoPontos: 0, ocultarPessoas: false, ocultarBots: false, ocultarPets: false, excetoMeus: true, excetoAmigos: true },
    agrupar: { janela: 5 },
    jogos: { som: true, velocidade: 'lenta' },
    wired: { copiarAoSalvar: true, enterSalva: true, naoAndarAoClicar: false, avancadasAbertas: false },
    loja: { repor: false, reporLimite: 2, reporQuantidade: 10, reporSoWired: false, reporSemTeleporte: true, quantidadePadrao: 1, pularConfirmacao: true, confirmarOutraMoeda: true, marcarCustom: true },
    comunidade: { entrarNoGrupo: true, selo: true, aparecer: true },
    musica: { mostrar: true, usuario: '', compartilhar: true, chave: '' },
    midia: { volume: 80, bloqueados: [] },
    visual: { manterEfeito: true, manterHanditem: false, sempreManterEfeito: false, sempreManterHanditem: false },
    amigos: { soAmigos: false, destacarLotado: true, lotado: 20, segundosLotado: 5, desconhecidos: 'fantasma', amigosNoNavegador: true, mencaoPorConsole: true, avisarMensagens: true, avisarOnline: false, silenciarConvites: false, missaoNaDica: true },
    zoom: { roda: true, modo: 'camera', afastarAlem: false, maximo: 4, passo: 15, aoEntrar: 'manter' }, // modo: camera ou jogo; aoEntrar: manter, perto, longe
    construcao: { teclado: true, alturaScroll: true, passoAltura: 0.5, desfazer: true, tipoNoQuadro: true }, // segundos desde a última repetição // modo: 'esconder' ou 'esmaecer'
    janelas: { escFecha: true, minimizar: true, animar: true, lembrarTamanho: true, buscaInventario: true, ocultarQuartos: true, nomeInventario: true },
    interface: {
      atalhosNoQuadro: true, relacionamentosPrimeiro: false, ocultarCarteira: false, ocultarCursor: false, textoSelecionavel: false, toolbarTranslucido: false, menusTranslucidos: false,
      ocultarHotel: false, ocultarNavegador: false, ocultarMissoes: false, ocultarCatalogo: false, ocultarInventario: false,
      ocultarCamera: false, ocultarAmigos: false, ocultarBuscaAmigos: false,
      filtro: 'nenhum', // nenhum, cinza, sepia, inverter, contraste, vivo, suave, escuro
      tema: 'vagalume', // nenhum ou vagalume (janelas do jogo)
      colunaVidro: true, // carteira e balões da direita translúcidos (só com o tema Vagalume)
      ocultarInfostands: false, minificarInfostand: false, removerPresentear: false, ocultarRodapeAmigos: false, pausarRadio: false, ocultarRadio: false, botaoLateral: true, chatArrastavel: true, missaoClicavel: true, abrirMissao: 'pagina',
      ocultarSetaEsquerda: false, ocultarSetaDireita: false, semAnimacaoBarra: false,
    },
    estilo: { css: '' },
    fps: { limite: 30 },
    contador: { canto: 'sup-esq', mostrarFps: true, mostrarPing: true, intervaloPing: 10 }, // canto: sup-esq, sup-dir, inf-esq, inf-dir
    conexao: { esconderMeuDigitando: false, ocultarDigitando: false, antiGiro: false, cliqueSemAviso: false, escurecerQuemSaiu: true, setinhas: false, aoEntrar: [], avisarQueda: true, voltarAoRelogar: false, nomeNoTitulo: false, referencias: true, antiAusente: false, simularDireitos: false, avisarCampainha: true, somCampainha: true, somVisitantes: true, avisarDireitos: true, avisarCurtidas: false, avisarMute: true, placaNoMute: -1, meioAnda: false, iconeVoltar: true, dancasExtras: true },
  };

  // grupo: onde o módulo aparece nas telas. recarregar: precisa recarregar o hotel para valer.
  const CATALOGO = [
    { id: 'mencoes', nome: 'Menções', grupo: 'chat', resumo: 'Avisa quando falam seu apelido ou um termo que você escolheu.' },
    { id: 'historico', nome: 'Histórico do chat', grupo: 'chat', resumo: 'Guarda as falas neste navegador, com busca e exportação entre sessões.' },
    { id: 'apelidos', nome: 'Apelidos locais', grupo: 'chat', resumo: 'Personalize seu nome e o dos seus amigos só na sua tela.' },
    { id: 'digitando', nome: 'Balão de digitando', grupo: 'chat', resumo: 'Troca o balãozinho de "digitando" em cima do seu avatar por um com as cores do Vagalume; as outros Vagalumes do quarto também veem.' },
    { id: 'chat', nome: 'Atalhos nos balões', grupo: 'chat', resumo: 'Botão de copiar ao lado de cada fala; links das falas ficam azuis e abrem numa aba nova com um clique.' },
    { id: 'baloes', nome: 'Temas dos balões', grupo: 'chat', resumo: 'Mostra nove temas no seletor de Bubble IDs do Habblet, compartilhados com outros Vagalumes.' },
    { id: 'silenciar', nome: 'Silenciar no chat', grupo: 'chat', resumo: 'Esconde ou apaga as falas de quem você escolher, só na sua tela.' },
    { id: 'notificacoes', nome: 'Histórico de avisos', grupo: 'chat', resumo: 'Guarda os avisos do jogo no canto da tela para rever com o comando notificacoes (só na memória) e pode esconder os de compra e de conquista.' },
    { id: 'agrupar', nome: 'Juntar falas repetidas', grupo: 'chat', resumo: 'Quando alguém repete a mesma fala em poucos segundos (respeitos, recados de wired), mostra uma só com ×2, ×3…' },
    { id: 'comandos', nome: 'Comandos', grupo: 'automacao', resumo: 'Comandos locais digitados no chat, como /ajuda.' },
    { id: 'macros', nome: 'Macros', grupo: 'automacao', resumo: 'Sequências de falas disparadas por atalho ou comando.' },
    { id: 'painel', nome: 'Painel no jogo', grupo: 'aparencia', resumo: 'Janela do Vagalume sobre o hotel, aberta por atalho.' },
    { id: 'janelas', nome: 'Janelas do jogo', grupo: 'aparencia', resumo: 'Esc fecha a janela da frente; duplo clique na barra de título minimiza; animação ao abrir.' },
    { id: 'interface', nome: 'Ajustes da tela', grupo: 'aparencia', resumo: 'Esconde a carteira, o ponteiro e ícones da barra; deixa o texto selecionável, a barra e os menus translúcidos, aplica um filtro de cor ao quarto e um tema escuro às janelas.' },
    { id: 'estilo', nome: 'Estilo personalizado', grupo: 'aparencia', resumo: 'Aplica o CSS que você escrever à tela do hotel.' },
    { id: 'zoom', nome: 'Zoom do quarto', grupo: 'aparencia', resumo: 'A roda do mouse sobre o quarto aproxima e afasta; o zoom pode ser ajustado ao entrar em cada quarto.' },
    { id: 'captura', nome: 'Captura de tela', grupo: 'aparencia', resumo: 'Salva ou copia uma imagem da aba do hotel.' },
    { id: 'contador', nome: 'Contador de FPS e ping', grupo: 'desempenho', resumo: 'Mostra no canto da tela os quadros por segundo do hotel e o ping até o servidor. Cada um liga e desliga nos ajustes.' },
    { id: 'fluido', nome: 'Jogo fluido', grupo: 'desempenho', resumo: 'Tira a trava de 60 quadros por segundo do Habblet: o jogo desenha a cada quadro da tela (144 Hz, 180 Hz…). Para limitar, use o Limite de quadros.', recarregar: true },
    { id: 'fps', nome: 'Limite de quadros', grupo: 'desempenho', resumo: 'Reduz os quadros por segundo para poupar processador.', recarregar: true },
    { id: 'anuncios', nome: 'Bloquear anúncios', grupo: 'desempenho', resumo: 'Bloqueia dois domínios de anúncios quando abertos pelo Habblet.', recarregar: true },
    { id: 'conexao', nome: 'Conexão do jogo', grupo: 'avancado', resumo: 'Lê e manda mensagens pela conexão do jogo, para as funções que dependem dela. Traz o registro de códigos.', recarregar: true },
    { id: 'construcao', nome: 'Construção', grupo: 'avancado', resumo: 'Lista os mobis do chão; move, gira, usa e recolhe o mobi selecionado por comando ou com Ctrl+setas. Precisa da conexão do jogo.' },
    { id: 'musica', nome: 'Música (Last.fm)', grupo: 'chat', resumo: 'Mostra no quadro de quem usa o Vagalume a música que a pessoa está ouvindo agora (ou ouviu por último) pelo Last.fm, com capa, como um rich presence. Sem mexer na missão.' },
    { id: 'midia', nome: 'Imagens, áudios e voz', grupo: 'chat', resumo: 'Mandar imagens, GIFs e áudios no chat e falar nas chamadas do quarto, do privado e de grupos salvos com até 12 amigos no Vagalume. Os arquivos ficam 7 dias no servidor do Vagalume. Precisa da conexão do jogo.' },
    { id: 'comunidade', nome: 'Comunidade Vagalume', grupo: 'chat', resumo: 'Entra no grupo Vagalume do Habblet e o favorita (uma vez por conta) e mostra um ponto verde ao lado do apelido de quem também usa o Vagalume. Precisa da conexão do jogo.' },
    { id: 'amigos', nome: 'Amigos e console', grupo: 'avancado', resumo: '@amigo no quarto vai também por mensagem privada; avisos de mensagens e de amigos online; silenciar convites; comandos amigos e msg. Precisa da conexão do jogo.' },
    { id: 'loja', nome: 'Loja e inventário', grupo: 'avancado', resumo: 'Comprar wireds até ter N de cada, repor mobis que acabam, quantidade padrão, pular confirmação e excluir mobis em massa. Gasta moedas e apaga mobis só depois de confirmar. Precisa da conexão do jogo.' },
    { id: 'visual', nome: 'Visual e avatar', grupo: 'avancado', resumo: 'Tudo sobre o seu visual: gera visuais novos no seu estilo (com temas e combinando com alguém), veste o visual de quem está no quarto, copia códigos, lista os visuais salvos e escolhe efeitos e itens de mão pelo nome.' },
    { id: 'wired', nome: 'Wired', grupo: 'avancado', resumo: 'Copiar, colar, exportar e importar configurações de wired; Enter salva a janela de wired; opção de não andar ao clicar em mobis. Precisa da conexão do jogo.' },
    { id: 'jogos', nome: 'Jogos', grupo: 'chat', resumo: 'Xadrez, damas e ping-pong pela aba Jogos do painel ou por /jogos (xadrez e damas também com dois cliques num tabuleiro do quarto): contra o bot (três níveis), contra quem usa o Vagalume no quarto ou chamando um amigo de outro quarto. Precisa da conexão do jogo.' },
    { id: 'medicao', nome: 'Bloquear medição', grupo: 'desempenho', resumo: 'Bloqueia o script de estatísticas de terceiros da página.', recarregar: true },
  ];

  // Grupos usados para organizar os módulos no painel, no popup e na página de opções.
  const GRUPOS = [
    { id: 'chat', nome: 'Chat' },
    { id: 'automacao', nome: 'Automação' },
    { id: 'aparencia', nome: 'Aparência' },
    { id: 'desempenho', nome: 'Desempenho' },
    { id: 'avancado', nome: 'Avançado' },
  ];

  // Novidades mostradas uma vez quando a versão instalada muda (o usuário pode desligar o aviso nas opções do módulo Comandos).
  const NOVIDADES = [
    'Jogos com cara de jogo de verdade: cada um com janela, capa, cores e letras próprias (Xadrez de madeira, Ludo colorido, Sinuca de salão, Corrida neon...) e a lista de jogos em capas, como um fliperama.',
    'Sinuca: a tacada não trava mais (às vezes as bolas ficavam paradas) e as bolas rolam de verdade, com o número e a listra girando.',
    'Ping-pong: a bola não para mais esperando a devolução do outro; ela volta numa devolução prevista e se ajusta quando a jogada de verdade chega.',
  ];

  const api = { PADROES, CATALOGO, GRUPOS, NOVIDADES, ESQUEMA: 1, VERSAO: '0.1.13' };
  raiz.VL = raiz.VL || {};
  raiz.VL.padroes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
