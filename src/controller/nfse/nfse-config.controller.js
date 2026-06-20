import logger from '../../utils/logger.js';
import nfseConfigRepository from '../../repositories/nfse/nfse-config.repository.js';
import certificateService from '../../services/nfse/certificate.service.js';
import { encryptSecret } from '../../utils/crypto.util.js';
import {
  getMunicipality,
  listMunicipalities,
  resolveEndpoint
} from '../../services/nfse/municipality.registry.js';

// Remove campos sensíveis antes de devolver ao cliente
function sanitize(config) {
  if (!config) return null;
  const obj = config.toObject ? config.toObject() : { ...config };
  if (obj.certificate) {
    obj.certificate = {
      filename: obj.certificate.filename,
      subjectCN: obj.certificate.subjectCN,
      subjectCNPJ: obj.certificate.subjectCNPJ,
      issuer: obj.certificate.issuer,
      notBefore: obj.certificate.notBefore,
      notAfter: obj.certificate.notAfter,
      serialNumber: obj.certificate.serialNumber,
      uploadedAt: obj.certificate.uploadedAt,
      configured: true
    };
  } else {
    obj.certificate = { configured: false };
  }
  return obj;
}

export const getMunicipalitiesList = async (_req, res) => {
  return res.status(200).json(listMunicipalities());
};

export const get = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const config = await nfseConfigRepository.findByCompany(companyId);
    return res.status(200).json(sanitize(config));
  } catch (err) {
    logger.error('NfseConfigController :: get >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const upsert = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const {
      cMun,
      uf,
      inscricaoMunicipal,
      ambiente,
      opSimpNac,
      regApTribSN,
      regEspTrib,
      serie,
      proximoNumeroDps,
      endpoints,
      verAplic,
      isActive
    } = req.body;

    if (!cMun) {
      return res.status(422).json({ message: 'Campo cMun é obrigatório' });
    }
    const municipality = getMunicipality(cMun);
    if (!municipality) {
      return res.status(422).json({
        message: `Município ${cMun} não suportado. Suportados: ${listMunicipalities().map(m => `${m.cMun} (${m.name})`).join(', ')}`
      });
    }

    const data = {
      cMun,
      uf: uf || municipality.uf,
      inscricaoMunicipal,
      ambiente: ambiente !== undefined ? Number(ambiente) : 2,
      opSimpNac: opSimpNac !== undefined ? Number(opSimpNac) : 1,
      regApTribSN: regApTribSN !== undefined ? Number(regApTribSN) : undefined,
      regEspTrib: regEspTrib !== undefined ? Number(regEspTrib) : 0,
      serie: serie !== undefined ? Number(serie) : undefined,
      proximoNumeroDps: proximoNumeroDps !== undefined ? Number(proximoNumeroDps) : undefined,
      endpoints,
      verAplic,
      isActive
    };

    // Remove undefined para não sobrescrever em update
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    const saved = await nfseConfigRepository.upsert(companyId, data);
    return res.status(200).json(sanitize(saved));
  } catch (err) {
    logger.error('NfseConfigController :: upsert >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const resolveEndpointForCompany = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const config = await nfseConfigRepository.findByCompany(companyId);
    if (!config || !config.cMun) {
      return res.status(404).json({ message: 'Configuração NFS-e não encontrada' });
    }
    const overrideKey = config.ambiente === 1 ? 'producao' : 'homologacao';
    const override = config.endpoints?.[overrideKey];
    const endpoint = override || resolveEndpoint(config.cMun, config.ambiente);
    return res.status(200).json({
      cMun: config.cMun,
      ambiente: config.ambiente,
      endpoint,
      source: override ? 'override' : 'registry'
    });
  } catch (err) {
    logger.error('NfseConfigController :: resolveEndpoint >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const uploadCertificate = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!req.file) {
      return res.status(422).json({ message: 'Arquivo certificate (PFX/P12) é obrigatório' });
    }
    const password = req.body?.password;
    if (!password) {
      return res.status(422).json({ message: 'Campo password é obrigatório' });
    }

    let parsed;
    try {
      parsed = certificateService.parsePfx(req.file.buffer, password);
    } catch (e) {
      logger.warn('NfseConfigController :: parsePfx failed >> ', e?.message);
      return res.status(422).json({ message: 'Falha ao ler o certificado. Verifique o arquivo e a senha.' });
    }

    if (parsed.info.notAfter && new Date(parsed.info.notAfter) < new Date()) {
      return res.status(422).json({
        message: 'Certificado vencido',
        notAfter: parsed.info.notAfter
      });
    }

    // Remove arquivo anterior, se existia
    const existing = await nfseConfigRepository.findByCompany(companyId);
    if (existing?.certificate?.storagePath) {
      certificateService.removePfxFile(existing.certificate.storagePath);
    }

    const { filename, storagePath } = certificateService.storePfxFile(
      companyId,
      req.file.buffer,
      req.file.originalname
    );

    const certificate = {
      filename,
      storagePath,
      passwordEnc: encryptSecret(password),
      subjectCN: parsed.info.subjectCN,
      subjectCNPJ: parsed.info.subjectCNPJ,
      issuer: parsed.info.issuer,
      notBefore: parsed.info.notBefore,
      notAfter: parsed.info.notAfter,
      serialNumber: parsed.info.serialNumber,
      uploadedAt: new Date()
    };

    const saved = await nfseConfigRepository.setCertificate(companyId, certificate);
    return res.status(200).json(sanitize(saved));
  } catch (err) {
    logger.error('NfseConfigController :: uploadCertificate >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getCertificateInfo = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const config = await nfseConfigRepository.findByCompany(companyId);
    if (!config?.certificate) {
      return res.status(404).json({ message: 'Certificado não configurado' });
    }
    const c = config.certificate;
    return res.status(200).json({
      filename: c.filename,
      subjectCN: c.subjectCN,
      subjectCNPJ: c.subjectCNPJ,
      issuer: c.issuer,
      notBefore: c.notBefore,
      notAfter: c.notAfter,
      serialNumber: c.serialNumber,
      uploadedAt: c.uploadedAt,
      expired: c.notAfter ? new Date(c.notAfter) < new Date() : false,
      daysToExpire: c.notAfter
        ? Math.ceil((new Date(c.notAfter).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null
    });
  } catch (err) {
    logger.error('NfseConfigController :: getCertificateInfo >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const removeCertificate = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const existing = await nfseConfigRepository.findByCompany(companyId);
    if (existing?.certificate?.storagePath) {
      certificateService.removePfxFile(existing.certificate.storagePath);
    }
    await nfseConfigRepository.clearCertificate(companyId);
    return res.status(200).json({ message: 'Certificado removido com sucesso' });
  } catch (err) {
    logger.error('NfseConfigController :: removeCertificate >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
