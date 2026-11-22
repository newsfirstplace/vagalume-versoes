// Vagalume — leitura e escrita dos quadros do protocolo do jogo. Funções puras, sem DOM:
// rodam no mundo da página (adaptador de conexão), nos content scripts e nos testes em Node.
//
// Formato observado no Habblet (docs/analise/jogo-ao-vivo.md): cada quadro é um inteiro de 32 bits
// com o tamanho do resto, um inteiro de 16 bits com o código da mensagem e os dados, tudo em
// big-endian. Texto: inteiro de 16 bits sem sinal com o número de bytes, depois UTF-8.
(function (raiz) {
  'use strict';

  const MAX_QUADRO = 4 * 1024 * 1024; // acima disso o quadro é tratado como inválido
  const MAX_CAMPOS = 64;
  const MAX_TEXTO = 30000; // caracteres por campo de texto (o floor de um quarto grande passa de 4000; o limite do protocolo é 65535 bytes)
  const MAX_CRU = 200000; // bytes crus por campo 'r' (a lista de pessoas de um quarto cheio passa de 8 KB)
  const codificador = new TextEncoder();
  const decodificador = new TextDecoder('utf-8');

  function bytesDe(dados) {
    if (dados instanceof Uint8Array) return dados;
    if (dados instanceof ArrayBuffer) return new Uint8Array(dados);
    if (ArrayBuffer.isView(dados)) return new Uint8Array(dados.buffer, dados.byteOffset, dados.byteLength);
    if (Array.isArray(dados)) return Uint8Array.from(dados);
    throw new TypeError('Dados do quadro em formato desconhecido.');
  }

  function juntar(a, b) {
    if (!a || !a.length) return b;
    const saida = new Uint8Array(a.length + b.length);
    saida.set(a, 0);
    saida.set(b, a.length);
    return saida;
  }

  // Separa uma mensagem do WebSocket em quadros. `sobra` é o pedaço incompleto da mensagem anterior.
  // Devolve { quadros: [{ cabecalho, dados }], sobra, invalido }. Com `invalido`, o resto é descartado.
  function separar(mensagem, sobra) {
    const bytes = juntar(sobra || null, bytesDe(mensagem));
    const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const quadros = [];
    let pos = 0;
    while (bytes.length - pos >= 4) {
      const tamanho = vista.getInt32(pos);
      if (tamanho < 2 || tamanho > MAX_QUADRO) return { quadros, sobra: null, invalido: true };
      if (bytes.length - pos - 4 < tamanho) break;
      quadros.push({ cabecalho: vista.getInt16(pos + 4), dados: bytes.subarray(pos + 6, pos + 4 + tamanho) });
      pos += 4 + tamanho;
    }
    return { quadros, sobra: pos < bytes.length ? bytes.slice(pos) : null, invalido: false };
  }

  function criarLeitor(dados) {
    const bytes = bytesDe(dados);
    const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let pos = 0;
    function exigir(n) {
      if (pos + n > bytes.length) throw new RangeError('Fim dos dados do quadro.');
      const inicio = pos;
      pos += n;
      return inicio;
    }
    return {
      inteiro: () => vista.getInt32(exigir(4)),
      curto: () => vista.getInt16(exigir(2)),
      byte: () => vista.getUint8(exigir(1)),
      booleano: () => vista.getUint8(exigir(1)) !== 0,
      texto() {
        const n = vista.getUint16(exigir(2));
        const inicio = exigir(n);
        return decodificador.decode(bytes.subarray(inicio, inicio + n));
      },
      restante: () => bytes.length - pos,
      posicao: () => pos,
    };
  }

  // Campos: lista de pares [tipo, valor]. Tipos: 'i' inteiro de 32 bits, 'h' de 16 bits,
  // 'y' byte, 'b' booleano, 's' texto.
  function tamanhoDoCampo(tipo, valor) {
    switch (tipo) {
      case 'i': return 4;
      case 'h': return 2;
      case 'y':
      case 'b': return 1;
      case 's': return 2 + valor.length;
      case 'r': return valor.length;
      default: throw new TypeError('Tipo de campo desconhecido: ' + tipo);
    }
  }

  function validarInteiro(valor, min, max) {
    if (!Number.isInteger(valor) || valor < min || valor > max) throw new RangeError('Número fora do intervalo: ' + valor);
    return valor;
  }

  function montar(cabecalho, campos) {
    validarInteiro(cabecalho, 0, 32767);
    const lista = campos || [];
    if (!Array.isArray(lista) || lista.length > MAX_CAMPOS) throw new RangeError('Campos demais.');
    const preparados = lista.map(function (campo) {
      if (!Array.isArray(campo) || campo.length !== 2) throw new TypeError('Campo deve ser [tipo, valor].');
      const tipo = campo[0];
      let valor = campo[1];
      if (tipo === 's') {
        if (typeof valor !== 'string' || valor.length > MAX_TEXTO) throw new TypeError('Texto inválido.');
        valor = codificador.encode(valor);
        if (valor.length > 65535) throw new RangeError('Texto longo demais.');
      } else if (tipo === 'r') {
        // Bytes crus (reenvio de uma configuração copiada): lista de 0 a 255, no máximo MAX_CRU.
        if (!Array.isArray(valor) || valor.length > MAX_CRU || !valor.every((x) => Number.isInteger(x) && x >= 0 && x <= 255)) throw new TypeError('Bytes inválidos.');
        valor = Uint8Array.from(valor);
      } else if (tipo === 'b') {
        if (typeof valor !== 'boolean') throw new TypeError('Booleano inválido.');
      } else if (tipo === 'i') validarInteiro(valor, -2147483648, 2147483647);
      else if (tipo === 'h') validarInteiro(valor, -32768, 32767);
      else if (tipo === 'y') validarInteiro(valor, 0, 255);
      return [tipo, valor];
    });
    const corpo = preparados.reduce((soma, [tipo, valor]) => soma + tamanhoDoCampo(tipo, valor), 0);
    const saida = new Uint8Array(6 + corpo);
    const vista = new DataView(saida.buffer);
    vista.setInt32(0, 2 + corpo);
    vista.setInt16(4, cabecalho);
    let pos = 6;
    for (const [tipo, valor] of preparados) {
      if (tipo === 'i') { vista.setInt32(pos, valor); pos += 4; }
      else if (tipo === 'h') { vista.setInt16(pos, valor); pos += 2; }
      else if (tipo === 'y') { vista.setUint8(pos, valor); pos += 1; }
      else if (tipo === 'b') { vista.setUint8(pos, valor ? 1 : 0); pos += 1; }
      else if (tipo === 'r') { saida.set(valor, pos); pos += valor.length; }
      else { vista.setUint16(pos, valor.length); saida.set(valor, pos + 2); pos += 2 + valor.length; }
    }
    return saida;
  }

  // Remonta um quadro a partir do código e dos dados já separados.
  function remontar(cabecalho, dados) {
    const corpo = bytesDe(dados);
    const saida = new Uint8Array(6 + corpo.length);
    const vista = new DataView(saida.buffer);
    vista.setInt32(0, 2 + corpo.length);
    vista.setInt16(4, cabecalho);
    saida.set(corpo, 6);
    return saida;
  }

  function hex(dados, maximo) {
    const bytes = bytesDe(dados);
    const limite = Math.min(bytes.length, maximo || 64);
    let s = '';
    for (let i = 0; i < limite; i++) s += (i ? ' ' : '') + bytes[i].toString(16).padStart(2, '0');
    return bytes.length > limite ? s + ' …' : s;
  }

  // Palpite legível para o mapeamento: tenta ler os dados como sequência de inteiros e textos.
  // Só serve para quem está descobrindo os códigos; nada do Vagalume depende dele.
  // Com `ocultarSenhas`, texto comprido e sem espaços (jeito de chave de acesso) sai só com o tamanho.
  function palpite(dados, opcoes) {
    const ocultar = !!(opcoes && opcoes.ocultarSenhas);
    const bytes = bytesDe(dados);
    const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const partes = [];
    let pos = 0;
    while (pos < bytes.length && partes.length < 24) {
      if (bytes.length - pos >= 2) {
        const n = vista.getUint16(pos);
        if (n > 0 && n <= bytes.length - pos - 2 && n <= 200) {
          const pedaco = bytes.subarray(pos + 2, pos + 2 + n);
          const imprimivel = pedaco.every((c) => c >= 0x20 || c === 0x0a);
          if (imprimivel) {
            const texto = decodificador.decode(pedaco);
            partes.push(ocultar && texto.length >= 24 && !/s/.test(texto) ? "«texto oculto, " + texto.length + " caracteres»" : JSON.stringify(texto));
            pos += 2 + n;
            continue;
          }
        }
      }
      if (bytes.length - pos >= 4) { partes.push(String(vista.getInt32(pos))); pos += 4; continue; }
      partes.push('0x' + bytes[pos].toString(16).padStart(2, '0'));
      pos += 1;
    }
    if (pos < bytes.length) partes.push('…');
    return partes.join(' ');
  }

  const api = { separar, criarLeitor, montar, remontar, hex, palpite, bytesDe, MAX_QUADRO, MAX_CAMPOS, MAX_TEXTO };
  raiz.VL = raiz.VL || {};
  raiz.VL.protocolo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
