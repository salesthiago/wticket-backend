import logger from '../../utils/logger.js';
import nfseIssuerService from '../../services/nfse/nfse-issuer.service.js';
import nfseIssuanceRepository from '../../repositories/nfse/nfse-issuance.repository.js';
import serviceOrderRepository from '../../repositories/service-order.repository.js';
import nfseConfigRepository from '../../repositories/nfse/nfse-config.repository.js';
import companyRepository from '../../repositories/company.repository.js';
import { buildDanfsePdf } from '../../services/nfse/danfse-pdf.service.js';
import { getMunicipality } from '../../services/nfse/municipality.registry.js';

// Remove campos pesados (XML) ao listar
function stripHeavy(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.xmlDpsAssinado;
  delete obj.xmlNfseRetorno;
  return obj;
}

export const findAll = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { search, status, customerId, serviceOrderId, dateFrom, dateTo, page, limit } = req.query;
    const result = await nfseIssuanceRepository.findAll(companyId, {
      search,
      status,
      customerId,
      serviceOrderId,
      dateFrom,
      dateTo,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 20
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('NfseController :: findAll >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const doc = await nfseIssuanceRepository.findById(companyId, id);
    if (!doc) return res.status(404).json({ message: 'NFS-e não encontrada' });
    return res.status(200).json(stripHeavy(doc));
  } catch (err) {
    logger.error('NfseController :: findById >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPdf = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const issuance = await nfseIssuanceRepository.findById(companyId, id);
    if (!issuance) return res.status(404).json({ message: 'NFS-e não encontrada' });

    const config = await nfseConfigRepository.findByCompany(companyId);
    const company = await companyRepository.findById(companyId);
    const muni = config?.cMun ? getMunicipality(config.cMun) : null;

    const buffer = await buildDanfsePdf({
      issuance,
      company,
      municipalityName: muni?.name
    });

    const fname = issuance.numeroNfse
      ? `nfse-${issuance.numeroNfse}.pdf`
      : `dps-${issuance.serie}-${issuance.nDPS}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fname}"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.status(200).end(buffer);
  } catch (err) {
    logger.error('NfseController :: getPdf >> ', err);
    return res.status(500).json({ message: 'Falha ao gerar PDF' });
  }
};

export const getXml = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { type = 'dps' } = req.query; // dps | nfse
    const doc = await nfseIssuanceRepository.findById(companyId, id);
    if (!doc) return res.status(404).json({ message: 'NFS-e não encontrada' });
    const xml = type === 'nfse' ? doc.xmlNfseRetorno : doc.xmlDpsAssinado;
    if (!xml) return res.status(404).json({ message: `XML ${type} não disponível` });
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xml);
  } catch (err) {
    logger.error('NfseController :: getXml >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const issue = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const input = req.body || {};

    if (!input.vServ && input.vServ !== 0) {
      return res.status(422).json({ message: 'Campo vServ é obrigatório' });
    }
    if (!input.serviceCodeId && !input.cTribNac) {
      return res.status(422).json({ message: 'Informe serviceCodeId ou cTribNac' });
    }
    if (!input.xDescServ && !input.descricao && !input.serviceCodeId) {
      return res.status(422).json({ message: 'Descrição do serviço é obrigatória' });
    }

    const { issuance } = await nfseIssuerService.issue({ companyId, input });
    return res.status(issuance.status === 'authorized' ? 201 : 200).json(stripHeavy(issuance));
  } catch (err) {
    logger.error('NfseController :: issue >> ', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
      details: err.details
    });
  }
};

export const issueFromServiceOrder = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { serviceOrderId } = req.params;
    const overrides = req.body || {};

    const so = await serviceOrderRepository.findById(companyId, serviceOrderId);
    if (!so) return res.status(404).json({ message: 'Ordem de serviço não encontrada' });

    // Soma serviços + peças para compor o vServ default
    const servicesTotal = (so.services || []).reduce((acc, s) => acc + Number(s.total || 0), 0);
    const partsTotal = (so.parts || []).reduce((acc, p) => acc + Number(p.total || 0), 0);
    const defaultVServ = so.finalCost > 0 ? so.finalCost : (servicesTotal + partsTotal);

    const description = (so.services || []).map(s => `${s.quantity}x ${s.description}`).join('; ')
      || so.diagnosis
      || so.reportedIssue;

    const input = {
      customerId: overrides.customerId || so.customerId?._id || so.customerId,
      serviceOrderId: so._id,
      serviceCodeId: overrides.serviceCodeId,
      cTribNac: overrides.cTribNac,
      cTribMun: overrides.cTribMun,
      cNBS: overrides.cNBS,
      xDescServ: overrides.xDescServ || description,
      cLocPrestacao: overrides.cLocPrestacao,
      vServ: overrides.vServ != null ? overrides.vServ : defaultVServ,
      descIncond: overrides.descIncond,
      descCond: overrides.descCond,
      pAliq: overrides.pAliq,
      retencoes: overrides.retencoes,
      dCompet: overrides.dCompet,
      tomadorOverride: overrides.tomadorOverride
    };

    if (!input.serviceCodeId && !input.cTribNac) {
      return res.status(422).json({ message: 'Informe serviceCodeId ou cTribNac no body' });
    }

    const { issuance } = await nfseIssuerService.issue({ companyId, input });
    return res.status(issuance.status === 'authorized' ? 201 : 200).json(stripHeavy(issuance));
  } catch (err) {
    logger.error('NfseController :: issueFromServiceOrder >> ', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Internal server error',
      details: err.details
    });
  }
};

export const findLogs = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { issuanceId, operation, page, limit } = req.query;
    const result = await nfseIssuanceRepository.findLogs(companyId, {
      issuanceId,
      operation,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 20
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('NfseController :: findLogs >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const editIssuance = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const patch = req.body || {};
    const issuance = await nfseIssuerService.editAndRegenerateXml({ companyId, issuanceId: id, patch });
    return res.status(200).json(stripHeavy(issuance));
  } catch (err) {
    logger.error('NfseController :: editIssuance >> ', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Falha ao editar emissão',
      details: err.details
    });
  }
};

export const retransmit = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { issuance, ws } = await nfseIssuerService.retransmit({ companyId, issuanceId: id });
    const result = stripHeavy(issuance);
    result._ws = {
      httpStatus: ws.httpStatus,
      durationMs: ws.durationMs,
      success: ws.httpStatus >= 200 && ws.httpStatus < 300,
      errorMessage: ws.error || null
    };
    return res.status(200).json(result);
  } catch (err) {
    logger.error('NfseController :: retransmit >> ', err);
    return res.status(err.status || 500).json({
      message: err.message || 'Falha na retransmissão',
      details: err.details
    });
  }
};

export const destroy = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const doc = await nfseIssuanceRepository.softDelete(companyId, id);
    if (!doc) return res.status(404).json({ message: 'NFS-e não encontrada' });
    return res.status(200).json({ message: 'NFS-e arquivada' });
  } catch (err) {
    logger.error('NfseController :: destroy >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
