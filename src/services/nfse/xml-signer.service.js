import { SignedXml } from 'xml-crypto';

// Algoritmos definidos no manual NFS-e (seção 7.3.3)
const ALG_C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ALG_ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';
const ALG_SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
const ALG_RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';

// Limpa o PEM do certificado para incluir apenas o conteúdo Base64
function certPemToBase64(certPem) {
  return certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
}

/**
 * Assina um elemento identificado por Id dentro de um XML.
 * A assinatura é adicionada como filho do elemento pai (apêndice ao final).
 *
 * @param {object} params
 * @param {string} params.xml          XML a ser assinado
 * @param {string} params.elementId    Valor do atributo Id do elemento a assinar (ex: 'DPS<chave>')
 * @param {string} params.parentLocalName  local-name do elemento pai onde a Signature será inserida (ex: 'DPS')
 * @param {string} params.certPem      Certificado X.509 em PEM
 * @param {string} params.keyPem       Chave privada em PEM
 * @returns {string}                   XML assinado
 */
export function signXmlElement({ xml, elementId, parentLocalName, certPem, keyPem }) {
  if (!xml) throw new Error('xml é obrigatório');
  if (!elementId) throw new Error('elementId é obrigatório');
  if (!parentLocalName) throw new Error('parentLocalName é obrigatório');
  if (!certPem || !keyPem) throw new Error('certPem e keyPem são obrigatórios');

  const sig = new SignedXml({
    privateKey: keyPem,
    publicCert: certPem,
    signatureAlgorithm: ALG_RSA_SHA1,
    canonicalizationAlgorithm: ALG_C14N
  });

  // KeyInfo deve conter X509Certificate (Base64) — implementação default
  sig.getKeyInfoContent = () => {
    return `<X509Data><X509Certificate>${certPemToBase64(certPem)}</X509Certificate></X509Data>`;
  };

  sig.addReference({
    xpath: `//*[@Id='${elementId}']`,
    transforms: [ALG_ENVELOPED, ALG_C14N],
    digestAlgorithm: ALG_SHA1,
    uri: `#${elementId}`
  });

  sig.computeSignature(xml, {
    location: {
      reference: `//*[local-name(.)='${parentLocalName}']`,
      action: 'append'
    }
  });

  return sig.getSignedXml();
}

/**
 * Assina uma DPS já gerada.
 * @param {string} xml
 * @param {string} dpsId  valor do atributo Id em <infDPS>
 * @param {{certPem:string, keyPem:string}} certificate
 */
export function signDps(xml, dpsId, certificate) {
  return signXmlElement({
    xml,
    elementId: dpsId,
    parentLocalName: 'DPS',
    certPem: certificate.certPem,
    keyPem: certificate.keyPem
  });
}

/**
 * Assina o Lote de DPS.
 * @param {string} xml
 * @param {string} loteId  valor do atributo Id em <LoteDps>
 * @param {{certPem:string, keyPem:string}} certificate
 */
export function signLote(xml, loteId, certificate) {
  return signXmlElement({
    xml,
    elementId: loteId,
    parentLocalName: 'LoteDps',
    certPem: certificate.certPem,
    keyPem: certificate.keyPem
  });
}

export default {
  signXmlElement,
  signDps,
  signLote
};
