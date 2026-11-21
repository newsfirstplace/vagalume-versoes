// Vagalume — servidor da comunidade (imagens, GIFs, áudios e chamada de voz) e a marca que vai na fala.
// Na fala do quarto vai só um emoji seguido de caracteres invisíveis com o código da mídia: quem não
// usa o Vagalume vê só o emoji; o Vagalume lê o código e mostra a imagem, o GIF ou o áudio. Se o jogo
// tirar os caracteres invisíveis, a marca vira visível e curta ("📷 vl:i:código").
// Puro (sem DOM); roda também em Node (testes).
(function (raiz) {
  const VL = (raiz.VL = raiz.VL || {});

  // Endereço do servidor publicado (servidor/ na raiz do projeto). Vazio: os recursos ficam desligados.
  const ENDERECO = 'https://vagalume-servidor.matsvalenti.workers.dev';

  const ALFABETO = 'abcdefghijkmnpqrstuvwxyz23456789';
  const TIPOS = { i: '📷', g: '🎬', a: '🎤', c: '📞' }; // imagem, GIF, áudio, chamada de voz no privado
  const INICIO = '⁣';
  const DIGITOS = ['​', '‌', '‍', '⁠'];

  function idValido(id) { return typeof id === 'string' && /^[a-km-np-z2-9]{10}$/.test(id); }

  // tipo 'i' | 'g' | 'a'; modo 'invisivel' (padrão) ou 'visivel'.
  // A marca visível usa hífens: o Habblet troca ":a:" e parecidos por emoji (visto ao vivo em 2026-11-16).
  function marcar(tipo, id, modo) {
    if (!TIPOS[tipo] || !idValido(id)) return '';
    if (modo === 'visivel') return TIPOS[tipo] + ' vl-' + tipo + '-' + id;
    // 2 bits de tipo + 5 bits por letra (52 bits) = 26 dígitos de base 4.
    let bits = ({ i: '00', g: '01', a: '10', c: '11' })[tipo];
    for (const c of id) bits += ALFABETO.indexOf(c).toString(2).padStart(5, '0');
    let s = TIPOS[tipo] + INICIO;
    for (let k = 0; k < bits.length; k += 2) s += DIGITOS[parseInt(bits.slice(k, k + 2), 2)];
    return s;
  }

  // O emoji da marca logo antes da posição p (cada um ocupa 2 unidades UTF-16), com o espaço antes dele.
  function inicioComEmoji(s, p) {
    let i = p;
    while (i > 0 && s[i - 1] === ' ') i--;
    if (i >= 2 && Object.values(TIPOS).includes(s.slice(i - 2, i))) return i - 2;
    return p;
  }

  // Devolve { tipo, id, visivel, inicio, fim } ou null. inicio/fim: o trecho da marca no texto, com o
  // emoji (para esconder tudo de quem usa o Vagalume e deixar só a mídia).
  function ler(texto) {
    const s = String(texto || '');
    const v = /vl[-:]([igac])[-:]([a-km-np-z2-9]{10})/.exec(s);
    if (v) return { tipo: v[1], id: v[2], visivel: true, inicio: inicioComEmoji(s, v.index), fim: v.index + v[0].length };
    const k = s.indexOf(INICIO);
    if (k < 0) return null;
    let bits = '';
    let p = k + 1;
    for (; p < s.length && bits.length < 52; p++) {
      const d = DIGITOS.indexOf(s[p]);
      if (d < 0) break;
      bits += d.toString(2).padStart(2, '0');
    }
    if (bits.length < 52) return null;
    const tipo = ({ '00': 'i', '01': 'g', '10': 'a', '11': 'c' })[bits.slice(0, 2)];
    if (!tipo) return null;
    let id = '';
    for (let q = 2; q < 52; q += 5) id += ALFABETO[parseInt(bits.slice(q, q + 5), 2)];
    return idValido(id) ? { tipo, id, visivel: false, inicio: inicioComEmoji(s, k), fim: p } : null;
  }

  // A fala tem o emoji de mídia mas perdeu a marca invisível (o jogo tirou os caracteres).
  function perdeuMarca(texto) {
    const s = String(texto || '');
    return s.indexOf(INICIO) < 0 && !/vl[-:][igac][-:]/.test(s) && Object.values(TIPOS).some((e) => s.includes(e));
  }

  // Tira a marca do texto (para mostrar a fala sem ela).
  function semMarca(texto) {
    const s = String(texto || '');
    const m = ler(s);
    return (m ? s.slice(0, m.inicio) + s.slice(m.fim) : s).replace(/[⁣​‌‍⁠]/g, '');
  }

  // Fala que é só o emoji de uma mídia (o código foi pelo servidor da comunidade): devolve o tipo
  // ('i', 'g', 'a') e o trecho do emoji, ou null. Os caracteres invisíveis que sobrarem não contam.
  function soEmoji(texto) {
    const s = String(texto || '');
    const limpo = s.replace(/[⁣​‌‍⁠]/g, '').trim();
    for (const t of ['i', 'g', 'a']) if (limpo === TIPOS[t]) { const k = s.indexOf(TIPOS[t]); return { tipo: t, inicio: k, fim: k + TIPOS[t].length }; }
    return null;
  }

  VL.servidor = { ENDERECO, TIPOS, marcar, ler, semMarca, perdeuMarca, soEmoji, idValido, configurado: () => /^https:\/\//.test(ENDERECO) };
  if (typeof module !== 'undefined' && module.exports) module.exports = VL.servidor;
})(typeof globalThis !== 'undefined' ? globalThis : this);
