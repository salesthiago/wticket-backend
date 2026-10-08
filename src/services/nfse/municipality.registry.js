// Catálogo de municípios suportados pelo módulo NFS-e.
// cMun: código IBGE de 7 dígitos
// uf: sigla estadual
// provider: identificador do provedor/sistema usado pela prefeitura
// endpoints: URLs SOAP por ambiente (homologação / produção)
//
// IMPORTANTE: as URLs abaixo precisam ser confirmadas/atualizadas com a
// documentação oficial vigente do município antes do uso em produção.
// Goiânia e Aparecida de Goiânia mantêm sistemas próprios e a adesão ao
// "NFS-e Padrão Nacional" pode mudar layout/endpoint.

export const MUNICIPALITIES = {
  '5208707': {
    cMun: '5208707',
    uf: 'GO',
    name: 'Goiânia',
    provider: 'issnet',
    layout: 'abrasf-nacional-1.01',
    // Desde 01/10/2025 Goiânia usa o provedor ISSNet. Estes são os endpoints
    // "Nota Control" do Padrão Nacional (DPS). O endpoint ABRASF 2.04
    // (https://nfse.issnetonline.com.br/abrasf204/goiania/nfse.asmx) usa
    // outro layout (RPS) e não é compatível com o xml-builder atual.
    endpoints: {
      homologacao: 'https://nfse.issnetonline.com.br/wsnfsenacional/homologacao/nfse.asmx',
      producao: 'https://nfse.issnetonline.com.br/wsnfsenacional/goiania/nfse.asmx'
    },
    docs: 'https://www.issnetonline.com.br/goiania/',
    // A homologação da Nota Control roda sobre a base de Campo Grande/MS:
    // a tag cLocEmi deve levar 5002704 (o Id da DPS mantém o cMun real).
    cLocEmiHomologacao: '5002704'
  },
  '5201405': {
    cMun: '5201405',
    uf: 'GO',
    name: 'Aparecida de Goiânia',
    provider: 'aparecida_de_goiania',
    layout: 'abrasf-nacional-1.01',
    endpoints: {
      homologacao: 'https://nfse-hom.aparecida.go.gov.br/ws/nfse',
      producao: 'https://nfse.aparecida.go.gov.br/ws/nfse'
    },
    docs: 'https://www.aparecida.go.gov.br/sefin/nfse'
  }
};

export function getMunicipality(cMun) {
  return MUNICIPALITIES[String(cMun)] || null;
}

export function listMunicipalities() {
  return Object.values(MUNICIPALITIES).map(m => ({
    cMun: m.cMun,
    uf: m.uf,
    name: m.name,
    provider: m.provider,
    layout: m.layout
  }));
}

/**
 * Código a informar na tag cLocEmi: alguns provedores exigem outro município
 * no ambiente de homologação.
 */
export function resolveCLocEmi(cMun, ambiente) {
  const m = getMunicipality(cMun);
  if (String(ambiente) !== '1' && m?.cLocEmiHomologacao) return m.cLocEmiHomologacao;
  return String(cMun);
}

export function resolveEndpoint(cMun, ambiente) {
  const m = getMunicipality(cMun);
  if (!m) return null;
  // ambiente: 1 = produção, 2 = homologação (padrão DPS)
  const key = String(ambiente) === '1' ? 'producao' : 'homologacao';
  return m.endpoints[key] || null;
}
