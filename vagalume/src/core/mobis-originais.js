// Vagalume — quais mobis do Habblet existem na Habbo original (sugestão de usuários do Habblet em 2026-11-22: marcar
// na loja os mobis custom, feitos pelo Habblet ou por artistas). Gerado em 2026-11-22 cruzando o furnidata oficial da
// Habbo (habbo.com, revisão 3df8423bd11f9d2f56d5b85c5edccf0c11bdae0b, 14.021 nomes técnicos sem a cor) com o
// habblet_furni.json: 16.749 dos 39.231 mobis do Habblet são originais. Guardados como faixas de ids do Habblet,
// em base 36: "salto.tamanho" (o salto conta a partir do fim da faixa anterior). Mobi que o Habblet acrescentar
// depois desta lista aparece como custom até ela ser gerada de novo.
(function (raiz) {
  'use strict';
  const CHAO = '1.s7,2.co,3.2,1o,2d.2,2.1,5.c,a.4,a,2.t,2,2.1,2,8.22,18,e.5,3.1r,9,2.4a,2,2.3,2.1,2.21,3.9,2.h,2.b,2.q,d.b,3.a,2.b,2.u,7.f,2.9,2.9,4.b,2.g,4.g,3.8,7e,2.s,2.i,7.1u,6.g,6.q,2,2.27,5,2.13,2.q,2.6,2.8,2.15,2.3,2.1,3.6,2.j,2.9,2.6,2l.s,2s.1c,2,2.l,2.5,2.1,2.3,2.4,2.3,2.i,2,x,g,1h,4c,3x.h,v,2f.d,13,6.2,t.6,16.h,2.18,12.2,1k,f.r,7.1,1c.1,2.i,2.1,b.7,2.e,2.q,2.2s,2.r,5.4,3.7,4.e,3.m,2.d,4.1c,8.f,b.9,3.h,8.o,2.c,2.g,7.j,3.g,9j.1,2.1,3.4,2.2,d3.1e,p6.l,j.1,3.d,2.6,fh.34,2.7e,5e.6,u1.6,12.g,1b.l,1a.1k,5.q,6,2.1z,4.b,2.3,2,2.m,l.1a,2.6d,5.c,8.d,3.1k,2.d,o.19,4m,3p9.i,3.2,2.d,3l4.o,fku.3,7o,80,3jv.19,3we.7,5.1,3.6,2.4,3.1,15.1,b.6,7.1h,2,2.9,2.2n,7.1f,2.3,c.k,bpl,lhk.15,2.a,2.4,2.8,2.5,9.1,3.8,10z4,8kd.j,2.12,162x1.3,1n208.4,2.10,14vkm.f,4.1,2hwy0.21,1238n.5,2.1,2.2,3.4,29.3,2.2,2.2,2.1,2.3,2b.2,3,2.2,3zvxs.c,10brm,88bzj.4,2.2,2.9,ll9.8,2.9,29.d,5e76z.4,ds.u,2.7,f8x.c,2.5,2.d,2.2,1q.1,2.1,2.1,6d31.1w,w.1w,w.1w,w.1w,w.1w,w.1w,w.1w,w.1w,w.1i,1a.1w,w.1w,w.1i,1a.1w,w.1w,w.1i,197m2.2q,1m86.4,6hmg.7,190cv.3,bgxlv.a,2.7,29.8,5.2,2,4mejm,7f505.j,29.d,2.6,7453.1,h,eqm.d,2.4,b,2.7,4.h,2.1m,6l5b6.1,5lkvh6.k,2.e,6p5zad.4,2.c,1x.g,2.1q,3i.4,2.f,pn38i.1,10.4,7,1iw.p,j2.2,1m.e,57,k4,8r.6,10.k,e.3,ef.18,4q,a,2v.c,ag,dy,b,8s.1c,2l.3,o.3,db.2c,2.1,f,11,55,1s.1,p.2,2f.1,3p,w.g,12,1p.f,2.8,97.m,g.2,5,c1.1h,z,17.9,gh.l,l,x7,2q,i.7,ei,og.1,6x,h.4,59.5,5.d,2.4,2.a,68.1,42,9w,7d,i8.x,2.k,8y,b3.4,bi,b1.4,6.11,1aw.9,2.j,8y,2v,mp.1s,1je.m,5n.1,7,g6.1,2.2,3g.1,4f.g,rv.2,11m,5s.2,114.e,rt.8,pv,4r,48,2r.1y,pa.7,6d.n,k,jq.h,2.6,4,5r.4,77,1hz,169.1,f8,6.d,2.4,fw.z,1t.2i,ph.3m,2.i,2.c,39,cs.9,by.1,io.1a,1ci,16,y.n,3.1,jt.g,a.7,1a,uf,4.24,6z.8,2.8,2.b,2q.3,3,9s,2.p,9p.5,1l.3,5.5,8i,5h,7m.3,2.h,o.18,3.1,2.1,6y.5,ab,f,71,ea.l,k,2,14.1,2,g,j,2s.2,6h,5b.e,y,33.b,da.2,e7.2,e.k,2.8,g.9,jf.n,5,3.3,3.7,c7,d.d,92.s,w,h,9p.1g,2y.4,3d.1,8.3,8.5,3.5,8l.1,t.4,1v.1a,3.5,2.1,2.2,2.v,ir.4,57.3,2l.5,t.7,49.1c,z,4,33,3k,3a.2,2.w,6i.3,p.8,4x.a,8.w,8k,23,d,3m.6,2.1,1x.1f,10.s,gn,80.l,2,2.x,32.b,8.41,3.c,1o.2,w.2,4,7.1i,2u.d,p,2c,s.o,1w.1,h.1,7p.u,16,8.3,s,4,4.2,65.1e,2,8.d,bx,2v.1b,5.9,8v.w,4,1n,8n,k5.2,yy,9.c,1h.1d,7.18,1s.5,3n.8,sk.h,78,j.t,nr.7,3p.1j,nm.5,14k,92.1u,83.b,b.2,g.4,1e,1l.16,a3,2p.6,2.c,5.a,ja,4y,o,2.y,1d.2,1y.1i,3,27.8,1fs6,1veelp.4,2.2,1nknr7.f,2k9hps.5,1ofhpb.1,mj.d,3.2,5e,21.2,6r.2,25,15,y,5,8l,3,2j.1d,1r.8,2,2.j,2.1,6.3,9.3,e.g,2.m,m.e,7.1,8,2.3,4,3,2.6,4.e,4,48,9,f,64,l.n,2.5,a.6,2.5,2,74,g.3,w.s,2.1u,c,15.3,2,4.1,4,2,2.5,2.12,b,8.1,4.2,4.1,4.1,2.2,2.2,2,4.2,2,2,3.4,2.2,2.2,3,cs.3,7.9,d.1,8.1,d.w,d.1,l.o,6.i,2.2,2.1,2.1,2,2,8.g,m.17,2.2,2.1,n,2h,1u.1,2.1,2.1,2.1,2.1,2.1,2.1,2.1,2.1,2.1,3,2.h,7,a.m,2.13,8.2u,4.2,22.c,u.27,x,3.g,25,2.b,6q,2,1vt.1,c,1g.c,2.1,2.3,3.f,3.c,2.9,2.4,2,2.3,2.2,2.1,3.8,2.g,1l,3z.g,5l.3,3.1f,2.c,2.5,4.n,c.u,2.3,7,3.1v,2.1f,2.p,2.4,3.6,9.2v,2q,2.b,4.9,2.1g,2.22,3,4,2.q,3.4,2.l,6.3,3.m,2.f,5.1z,2.2a,s.10,2,2.2,3.f,2.5,2.1,2.v,r.3,16,d.5,2.1,4.36,2.1,m.s,3.5,2.h,3.66,2g.a,3.6m,2.kd,3.2r,2.1m,1k,e.j,4.i,5.9,2,3.3,2,3.3,2.1j,2.f,2.4,5,o,3.3h,cb.c,2.5w,2.8,2.4,2.j,20.m,2.5,2.bj,9.22,3y.5,5.i,r.2n,5u.1n,3.2i,18,7.1r,4a.v,2k.1m,5.2,7n,2,2.7,3q.m,7u.1,2.8,2.l,2.3,2.1,2.6,8x.1n,2.m,1o.u,2.17,2u.1,6.4,2.5,cao53w.5,2.e,2.2z,2.3u,2.4,2.8,2q,d.17,2.r,2.4,bp,2,2m.j,3.3,2s,d7,2.2,2,2,7e.1,4';
  const PAREDE = 's9,cq.1,4.1e,2.6,2.a,2.1r,w.5,9.8,2,v,2,3,2.5,25.16,2.c,7.1,1t.7,6s,b,j,d,s.b,d.1,c,d,w.5,h,b,b.2,d,i.2,i.1,7o,u,k.5,1w.4,i.4,s,2,29.3,14.1,2,2h,5,3.1,8,w,3m.6,3x,p,7,3,b,5,k,cy,2r,v.1,7u,3,26.3,9,g,s,2u,t.2,7.1,9.2,g.1,o,f.2,1e.6,h.9,b.1,j.6,2c.1,pg,ps.1,f,1pq,3o,2u,v,27.2,i,2l,6y.3,4f,uze,1g.9,1w,32.5,1m.a,x8w,z.7,3.1,a,2ueik,14vm3.2,3k08z,4.1,2i,4,4,3,2d.1,7,4,2,3zvxo,98nrn,4,lls,5e7om,f9p,f,1v,3,ednt0.3,4,c1jmy,7iws,h,a.1,5s60v4,6p5zax,2r,pn7x6.3,c9.b,gj,jv,50g,3yh,8e9,3gp.4,2.4,1iz,2o9.1,31f,2f.1,3,14c,1e3,1rb.6,af,2z.1,7,3,4,rj.2,1bd,132.1,cj,38t.5,7rpo8s,pf.4,c,l,5.2,7.1,9.c,i,o.f,2.3,w,e1,6w.6,2i,40,ko,4,3,3,2,2q,a.b,4a,3v,68,36.1,30,24t,o,25,do,r.9,12.1,4j,62,q,3m.1,1s.4,5.1,o,7k,3i,3,3r.6,7v.1k,2,3.i,6,wg.k,2.4,2.8,2.c,1t,1t,h,t.4,3,mk,ez.7,6u,av,2l.4,14.5,bb,7p,cg,a,bn,4f';

  // Cada faixa: o início é o fim da anterior mais o salto; ".n" quer dizer mais n ids seguidos.
  function faixas(texto) {
    const lista = [];
    let fim = 0;
    for (const parte of texto.split(',')) {
      const [salto, n] = parte.split('.');
      const inicio = fim + parseInt(salto, 36);
      fim = inicio + (n ? parseInt(n, 36) : 0);
      lista.push([inicio, fim]);
    }
    return lista;
  }
  let chao = null, parede = null;
  function dentro(lista, id) {
    let a = 0, b = lista.length - 1;
    while (a <= b) {
      const m = (a + b) >> 1;
      if (id < lista[m][0]) b = m - 1; else if (id > lista[m][1]) a = m + 1; else return true;
    }
    return false;
  }
  // id do mobi no Habblet (o tipo, como no arquivo de mobis do jogo); de parede quando ehParede.
  function ehOriginal(id, ehParede) {
    if (!Number.isInteger(id)) return false;
    if (ehParede) return dentro(parede || (parede = faixas(PAREDE)), id);
    return dentro(chao || (chao = faixas(CHAO)), id);
  }
  function totais() { return { chao: (chao || (chao = faixas(CHAO))).reduce((s, f) => s + f[1] - f[0] + 1, 0), parede: (parede || (parede = faixas(PAREDE))).reduce((s, f) => s + f[1] - f[0] + 1, 0) }; }

  const api = { ehOriginal, totais, REVISAO: '3df8423bd11f9d2f56d5b85c5edccf0c11bdae0b' };
  raiz.VL = raiz.VL || {};
  raiz.VL.mobisOriginais = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
