// Smoke test do builder + signer da NFS-e.
// Gera um certificado RSA self-signed em memória, monta uma DPS fictícia
// e assina. NÃO faz chamada de rede.
//
// Uso: NFSE_CERT_KEY=qualquer node src/scripts/nfse-smoke-test.js

import forge from 'node-forge';
import { buildDpsXml, computeValues, buildLoteDps } from '../services/nfse/xml-builder.service.js';
import { signDps, signLote } from '../services/nfse/xml-signer.service.js';
import { buildSoapEnvelope } from '../services/nfse/soap-client.service.js';

function genSelfSignedCert() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);
  const attrs = [{ name: 'commonName', value: 'TESTE LTDA:00000000000000' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey)
  };
}

function run() {
  const cert = genSelfSignedCert();
  console.log('✓ certificado self-signed gerado');

  const valores = computeValues({
    vServ: 1500,
    descIncond: 0,
    descCond: 0,
    issqn: { tribISSQN: 1, tpRetISSQN: 1, pAliq: 5 },
    pis: { aliq: 0.65, retido: false },
    cofins: { aliq: 3.0, retido: false },
    irrf: { aliq: 0, retido: false },
    csll: { aliq: 0, retido: false },
    cp: { aliq: 0, retido: false }
  });
  console.log('✓ valores computados:', { vBC: valores.vBC, vISSQN: valores.vISSQN, vLiq: valores.vLiq });

  const { xml, dpsId } = buildDpsXml({
    cLocEmi: '5208707',
    tpAmb: 2,
    tpEmit: 1,
    verAplic: 'wticket-nfse-1.0-test',
    serie: 1,
    nDPS: 1,
    dCompet: new Date(),
    prestador: {
      documentType: 'cnpj',
      document: '00000000000191',
      inscricaoMunicipal: '12345',
      nome: 'PRESTADOR TESTE LTDA',
      email: 'prestador@example.com',
      fone: '6232225555',
      endereco: {
        cMun: '5208707',
        uf: 'GO',
        cep: '74000000',
        xLgr: 'AV TESTE',
        nro: '100',
        xBairro: 'CENTRO'
      }
    },
    tomador: {
      documentType: 'cpf',
      document: '11144477735',
      nome: 'TOMADOR TESTE',
      endereco: {
        cMun: '5208707',
        uf: 'GO',
        cep: '74000010',
        xLgr: 'RUA TOMADOR',
        nro: '50',
        xBairro: 'JARDIM'
      }
    },
    servico: {
      cTribNac: '010101',
      cTribMun: '0101',
      xDescServ: 'Manutenção e suporte técnico de equipamentos de informática (smoke test)',
      cLocPrestacao: '5208707',
      cPaisPrestacao: '1058'
    },
    valores,
    regTrib: { opSimpNac: 1, regEspTrib: 0 }
  });
  console.log('✓ DPS gerada — Id:', dpsId);
  console.log('  tamanho do XML:', xml.length, 'bytes');

  const signed = signDps(xml, dpsId, cert);
  console.log('✓ DPS assinada — tamanho:', signed.length, 'bytes');
  if (!signed.includes('<Signature') && !signed.includes(':Signature')) {
    throw new Error('Signature não encontrada no XML assinado');
  }

  // Lote com 1 DPS assinada
  const lote = buildLoteDps({
    numeroLote: '1',
    cnpjEmitente: '00000000000191',
    dpsXmls: [signed]
  });
  console.log('✓ Lote montado — tamanho:', lote.length);
  const loteSigned = signLote(lote, 'Lote1', cert);
  console.log('✓ Lote assinado — tamanho:', loteSigned.length);

  const envelope = buildSoapEnvelope({ method: 'GerarNfse', xmlMessage: signed });
  console.log('✓ Envelope SOAP montado — tamanho:', envelope.length);

  if (process.argv.includes('--print')) {
    console.log('\n--- DPS XML (não assinado) ---\n' + xml);
    console.log('\n--- DPS XML (assinado) ---\n' + signed);
  }

  console.log('\nSmoke test concluído com sucesso.');
}

try {
  run();
  process.exit(0);
} catch (err) {
  console.error('\nFAIL:', err.message);
  console.error(err.stack);
  process.exit(1);
}
