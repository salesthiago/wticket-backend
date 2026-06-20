// Smoke test do gerador de PDF DANFSE.
// Gera um PDF com dados fictícios e grava em disco para inspeção.
//
// Uso: NFSE_CERT_KEY=qualquer node src/scripts/nfse-pdf-smoke-test.js

import fs from 'fs';
import path from 'path';
import { buildDanfsePdf } from '../services/nfse/danfse-pdf.service.js';

const issuance = {
  serie: 1,
  nDPS: 42,
  tpAmb: 2,
  tpEmit: 1,
  cLocEmi: '5208707',
  dCompet: new Date(),
  dhEmi: new Date(),
  status: 'authorized',
  numeroNfse: '2026000000042',
  chaveAcesso: '52087072604000000000001911000010000000000000420060',
  protocolo: 'PRT123456789',
  urlConsulta: 'https://nfse.goiania.go.gov.br/consulta?chave=52087072604000000000001911000010000000000000420060',
  prestador: {
    documentType: 'cnpj',
    document: '00000000000191',
    inscricaoMunicipal: '12345',
    nome: 'WTICKET PRESTADOR LTDA',
    email: 'contato@prestador.com',
    fone: '6232225555',
    endereco: {
      cMun: '5208707', uf: 'GO', cep: '74000000',
      xLgr: 'AV TESTE', nro: '100', xBairro: 'CENTRO', xCpl: 'SALA 101'
    }
  },
  tomador: {
    documentType: 'cpf',
    document: '11144477735',
    nome: 'CLIENTE TOMADOR DE TESTE',
    email: 'cliente@example.com',
    fone: '6298884444',
    endereco: {
      cMun: '5208707', uf: 'GO', cep: '74000010',
      xLgr: 'RUA TOMADOR', nro: '50', xBairro: 'JARDIM'
    }
  },
  servico: {
    cTribNac: '010101',
    cTribMun: '0101',
    cNBS: '101010101',
    cLocPrestacao: '5208707',
    xDescServ: 'Manutenção e suporte técnico de equipamentos de informática (smoke test). Inclui formatação, instalação de drivers, atualização de sistema operacional e teste de hardware.'
  },
  valores: {
    vServ: 1500,
    descIncond: 0,
    descCond: 0,
    vBC: 1500,
    vISSQN: 75,
    vTotalRet: 0,
    vLiq: 1500,
    issqn: { tribISSQN: 1, tpRetISSQN: 1, pAliq: 5 },
    pis: { aliq: 0.65, retido: false },
    cofins: { aliq: 3.0, retido: false },
    irrf: { aliq: 1.5, retido: true },
    csll: { aliq: 1.0, retido: true },
    cp: { aliq: 0, retido: false }
  }
};

async function run() {
  const buffer = await buildDanfsePdf({
    issuance,
    municipalityName: 'Goiânia'
  });
  const outDir = path.resolve(process.cwd(), 'logs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'danfse-smoke.pdf');
  fs.writeFileSync(outPath, buffer);
  console.log('✓ PDF gerado:', outPath, `(${buffer.length} bytes)`);
}

run().then(() => process.exit(0)).catch(e => {
  console.error('FAIL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
