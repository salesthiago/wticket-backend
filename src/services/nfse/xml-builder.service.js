import { create } from 'xmlbuilder2';

export const NFSE_NAMESPACE = 'http://www.sped.fazenda.gov.br/nfse';
export const NFSE_VERSION = '1.01';

// ─── Utilitários de formatação ────────────────────────────────────────────────

const onlyDigits = (s) => String(s ?? '').replace(/\D+/g, '');

const padLeft = (s, len) => String(s ?? '').padStart(len, '0');

const formatDateUTC = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  // AAAA-MM-DDThh:mm:ss-03:00 (ISO com offset)
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = dt.getFullYear();
  const mm = pad(dt.getMonth() + 1);
  const dd = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const mi = pad(dt.getMinutes());
  const ss = pad(dt.getSeconds());
  const offMin = -dt.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const offHH = pad(Math.floor(Math.abs(offMin) / 60));
  const offMM = pad(Math.abs(offMin) % 60);
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${offHH}:${offMM}`;
};

const formatDate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const fmtDecimal = (n, dec = 2) => {
  if (n == null || isNaN(n)) return undefined;
  return Number(n).toFixed(dec);
};

// Calcula DV módulo 11 (esquema NFS-e/SEFAZ comum)
function mod11Dv(num) {
  const digits = String(num).split('').map(Number);
  let weight = 2;
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += digits[i] * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rem = sum % 11;
  const dv = 11 - rem;
  return dv >= 10 ? 0 : dv;
}

/**
 * Gera o atributo Id (e a chave correspondente) da DPS conforme
 * padrão NFS-e Nacional (50 dígitos). O formato exato pode variar entre
 * provedores/municípios — ajustar quando confirmado em homologação.
 *
 * Composição (50 dígitos):
 *   cMun(7) + AAMM(4) + cnpjCpfPad(14) + tpEmit(1) + serie(5) + nDPS(15) + DV(4)
 */
export function buildDpsKey({ cMun, dCompet, documentEmitter, tpEmit, serie, nDPS }) {
  const compet = dCompet instanceof Date ? dCompet : new Date(dCompet);
  const aa = String(compet.getFullYear()).slice(-2);
  const mm = String(compet.getMonth() + 1).padStart(2, '0');
  const docPad = padLeft(onlyDigits(documentEmitter), 14);
  const seriePad = padLeft(serie, 5);
  const nPad = padLeft(nDPS, 15);
  const base = `${cMun}${aa}${mm}${docPad}${tpEmit}${seriePad}${nPad}`;
  // base = 7 + 4 + 14 + 1 + 5 + 15 = 46 dígitos → completar 50 com DV(4)
  const dv1 = mod11Dv(base);
  const dv2 = mod11Dv(base + dv1);
  const dvFull = `${dv1}${dv2}`.padStart(4, '0');
  const key = `${base}${dvFull}`;
  return key;
}

// ─── Builders de blocos ───────────────────────────────────────────────────────

function buildPartyDoc(node, party) {
  if (!party) return;
  const doc = onlyDigits(party.document);
  if (party.documentType === 'cnpj') {
    node.ele('CNPJ').txt(padLeft(doc, 14));
  } else if (party.documentType === 'cpf') {
    node.ele('CPF').txt(padLeft(doc, 11));
  } else if (party.documentType === 'nif') {
    node.ele('NIF').txt(party.document);
  }
  // cNaoNIF não tratado aqui (caso especial sem NIF)
}

function buildEndereco(parent, party) {
  if (!party?.endereco) return;
  const e = party.endereco;
  const end = parent.ele('end');

  if (e.cMun) {
    const endNac = end.ele('endNac');
    endNac.ele('cMun').txt(String(e.cMun));
    if (e.cep) endNac.ele('CEP').txt(padLeft(onlyDigits(e.cep), 8));
  } else if (e.cPais) {
    const endExt = end.ele('endExt');
    endExt.ele('cPais').txt(e.cPais);
    if (e.cEndPost) endExt.ele('cEndPost').txt(e.cEndPost);
    if (e.xCidade) endExt.ele('xCidade').txt(e.xCidade);
    if (e.xEstProvReg) endExt.ele('xEstProvReg').txt(e.xEstProvReg);
  }

  if (e.xLgr) end.ele('xLgr').txt(e.xLgr);
  if (e.nro) end.ele('nro').txt(e.nro);
  if (e.xCpl) end.ele('xCpl').txt(e.xCpl);
  if (e.xBairro) end.ele('xBairro').txt(e.xBairro);
}

function buildPrestador(infDPS, prestador, regTrib) {
  const prest = infDPS.ele('prest');
  buildPartyDoc(prest, prestador);
  if (prestador.inscricaoMunicipal) prest.ele('IM').txt(String(prestador.inscricaoMunicipal));
  prest.ele('xNome').txt(prestador.nome);
  buildEndereco(prest, prestador);
  if (prestador.fone) prest.ele('fone').txt(onlyDigits(prestador.fone));
  if (prestador.email) prest.ele('email').txt(prestador.email);

  const rt = prest.ele('regTrib');
  rt.ele('opSimpNac').txt(String(regTrib.opSimpNac ?? 1));
  if (regTrib.regApTribSN != null) rt.ele('regApTribSN').txt(String(regTrib.regApTribSN));
  rt.ele('regEspTrib').txt(String(regTrib.regEspTrib ?? 0));
}

function buildTomador(infDPS, tomador) {
  if (!tomador) return;
  const toma = infDPS.ele('toma');
  buildPartyDoc(toma, tomador);
  if (tomador.inscricaoMunicipal) toma.ele('IM').txt(String(tomador.inscricaoMunicipal));
  toma.ele('xNome').txt(tomador.nome);
  buildEndereco(toma, tomador);
  if (tomador.fone) toma.ele('fone').txt(onlyDigits(tomador.fone));
  if (tomador.email) toma.ele('email').txt(tomador.email);
}

function buildIntermediario(infDPS, intermediario) {
  if (!intermediario) return;
  const interm = infDPS.ele('interm');
  buildPartyDoc(interm, intermediario);
  if (intermediario.inscricaoMunicipal) interm.ele('IM').txt(String(intermediario.inscricaoMunicipal));
  interm.ele('xNome').txt(intermediario.nome);
  buildEndereco(interm, intermediario);
}

function buildServico(infDPS, servico) {
  const serv = infDPS.ele('serv');

  const locPrest = serv.ele('locPrest');
  locPrest.ele('cLocPrestacao').txt(String(servico.cLocPrestacao));
  if (servico.cPaisPrestacao) locPrest.ele('cPaisPrestacao').txt(servico.cPaisPrestacao);

  const cServ = serv.ele('cServ');
  cServ.ele('cTribNac').txt(String(servico.cTribNac));
  if (servico.cTribMun) cServ.ele('cTribMun').txt(String(servico.cTribMun));
  cServ.ele('xDescServ').txt(servico.xDescServ);
  if (servico.cNBS) cServ.ele('cNBS').txt(String(servico.cNBS));
  if (servico.cIntContrib) cServ.ele('cIntContrib').txt(String(servico.cIntContrib));
}

function buildValores(infDPS, valores) {
  const v = infDPS.ele('valores');

  const vServPrest = v.ele('vServPrest');
  vServPrest.ele('vServ').txt(fmtDecimal(valores.vServ, 2));

  if (valores.descIncond > 0) v.ele('vDescIncond').txt(fmtDecimal(valores.descIncond, 2));
  if (valores.descCond > 0) v.ele('vDescCondic').txt(fmtDecimal(valores.descCond, 2));

  // Bloco trib (tribMun + totTrib)
  const trib = v.ele('trib');

  const tribMun = trib.ele('tribMun');
  tribMun.ele('tribISSQN').txt(String(valores.issqn?.tribISSQN ?? 1));
  if (valores.issqn?.tpRetISSQN != null) tribMun.ele('tpRetISSQN').txt(String(valores.issqn.tpRetISSQN));
  if (valores.issqn?.pAliq != null) tribMun.ele('pAliq').txt(fmtDecimal(valores.issqn.pAliq, 2));

  // Federais (retenções) — opcional
  const hasFed =
    valores.pis?.retido || valores.cofins?.retido ||
    valores.irrf?.retido || valores.csll?.retido || valores.cp?.retido;
  if (hasFed) {
    const tribFed = trib.ele('tribFed');
    if (valores.pis?.retido) {
      const piscofins = tribFed.ele('piscofins');
      piscofins.ele('CST').txt('01');
      piscofins.ele('vBCPisCofins').txt(fmtDecimal(valores.vServ - (valores.descIncond || 0), 2));
      piscofins.ele('pAliqPis').txt(fmtDecimal(valores.pis.aliq || 0, 4));
      piscofins.ele('pAliqCofins').txt(fmtDecimal(valores.cofins?.aliq || 0, 4));
    }
    if (valores.irrf?.retido) {
      const irrf = tribFed.ele('irrf');
      irrf.ele('vBCIR').txt(fmtDecimal(valores.vServ - (valores.descIncond || 0), 2));
      irrf.ele('pAliqIR').txt(fmtDecimal(valores.irrf.aliq || 0, 4));
    }
    if (valores.csll?.retido) {
      const csll = tribFed.ele('csll');
      csll.ele('vBCCSLL').txt(fmtDecimal(valores.vServ - (valores.descIncond || 0), 2));
      csll.ele('pAliqCSLL').txt(fmtDecimal(valores.csll.aliq || 0, 4));
    }
    if (valores.cp?.retido) {
      const cp = tribFed.ele('cp');
      cp.ele('vBCCP').txt(fmtDecimal(valores.vServ - (valores.descIncond || 0), 2));
      cp.ele('pAliqCP').txt(fmtDecimal(valores.cp.aliq || 0, 4));
    }
  }

  const totTrib = trib.ele('totTrib');
  totTrib.ele('indTotTrib').txt('0'); // 0=Não informa total de tributos
}

// ─── Cálculo de totais ────────────────────────────────────────────────────────

export function computeValues(input) {
  const vServ = Number(input.vServ || 0);
  const descIncond = Number(input.descIncond || 0);
  const descCond = Number(input.descCond || 0);

  const vBC = Math.max(0, vServ - descIncond);

  const issqn = input.issqn || {};
  const pAliq = Number(issqn.pAliq || 0);
  const vISSQN = +(vBC * (pAliq / 100)).toFixed(2);

  const fed = ['pis', 'cofins', 'irrf', 'csll', 'cp'];
  let vTotalRet = 0;
  for (const k of fed) {
    const r = input[k];
    if (r?.retido) {
      vTotalRet += +(vBC * (Number(r.aliq || 0) / 100)).toFixed(2);
    }
  }
  if (issqn.tpRetISSQN === 2) vTotalRet += vISSQN;

  const vLiq = +(vServ - descIncond - descCond - vTotalRet).toFixed(2);

  return {
    vServ,
    descIncond,
    descCond,
    issqn: { ...issqn, pAliq },
    pis: input.pis || {},
    cofins: input.cofins || {},
    irrf: input.irrf || {},
    csll: input.csll || {},
    cp: input.cp || {},
    vBC,
    vISSQN,
    vTotalRet: +vTotalRet.toFixed(2),
    vLiq
  };
}

// ─── DPS principal ────────────────────────────────────────────────────────────

/**
 * Monta o XML da DPS conforme layout v1.01 (subset implementado).
 * @returns {{ xml: string, dpsId: string }}
 */
export function buildDpsXml(payload) {
  const {
    cLocEmi,
    tpAmb,
    tpEmit = 1,
    dhEmi = new Date(),
    verAplic = 'wticket-nfse-1.0',
    serie,
    nDPS,
    dCompet,
    prestador,
    tomador,
    intermediario,
    servico,
    valores,
    regTrib
  } = payload;

  if (!cLocEmi) throw new Error('cLocEmi é obrigatório');
  if (!serie || !nDPS) throw new Error('serie e nDPS são obrigatórios');
  if (!prestador?.document) throw new Error('Documento do prestador é obrigatório');
  if (!servico?.cTribNac) throw new Error('cTribNac é obrigatório');
  if (!servico?.xDescServ) throw new Error('Descrição do serviço é obrigatória');

  const dpsId = 'DPS' + buildDpsKey({
    cMun: cLocEmi,
    dCompet: dCompet || dhEmi,
    documentEmitter: prestador.document,
    tpEmit,
    serie,
    nDPS
  });

  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('DPS', { xmlns: NFSE_NAMESPACE, versao: NFSE_VERSION });

  const infDPS = root.ele('infDPS', { Id: dpsId });
  infDPS.ele('tpAmb').txt(String(tpAmb));
  infDPS.ele('dhEmi').txt(formatDateUTC(dhEmi));
  infDPS.ele('verAplic').txt(verAplic);
  infDPS.ele('serie').txt(String(serie));
  infDPS.ele('nDPS').txt(String(nDPS));
  infDPS.ele('dCompet').txt(formatDate(dCompet || dhEmi));
  infDPS.ele('tpEmit').txt(String(tpEmit));
  infDPS.ele('cLocEmi').txt(String(cLocEmi));

  buildPrestador(infDPS, prestador, regTrib);
  buildTomador(infDPS, tomador);
  buildIntermediario(infDPS, intermediario);
  buildServico(infDPS, servico);
  buildValores(infDPS, valores);

  const xml = root.end({ prettyPrint: false, headless: false });
  return { xml, dpsId };
}

// ─── Lote de DPS ──────────────────────────────────────────────────────────────

/**
 * Monta um Lote contendo várias DPS já assinadas.
 * @param {object} params
 * @param {string} params.numeroLote
 * @param {string} params.cnpjEmitente
 * @param {string[]} params.dpsXmls  XML strings já assinados
 */
export function buildLoteDps({ numeroLote, cnpjEmitente, dpsXmls }) {
  if (!Array.isArray(dpsXmls) || dpsXmls.length === 0) {
    throw new Error('Lote precisa de ao menos uma DPS');
  }
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('LoteDps', { xmlns: NFSE_NAMESPACE, Id: `Lote${numeroLote}`, versao: NFSE_VERSION });

  root.ele('NumeroLote').txt(String(numeroLote));
  root.ele('CNPJ').txt(padLeft(onlyDigits(cnpjEmitente), 14));
  root.ele('QtdDPS').txt(String(dpsXmls.length));

  const listaDps = root.ele('ListaDps');
  for (const dpsXml of dpsXmls) {
    // Importa a string XML como nó filho — xmlbuilder2 aceita via .import()
    listaDps.import(create(dpsXml).root());
  }

  return root.end({ prettyPrint: false, headless: false });
}

export default {
  buildDpsXml,
  buildDpsKey,
  buildLoteDps,
  computeValues,
  NFSE_NAMESPACE,
  NFSE_VERSION
};
