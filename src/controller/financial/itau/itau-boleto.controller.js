import logger from '../../../utils/logger.js';
import itauBoletoService from '../../../services/financial/itau/itau-boleto.service.js';

// ─── Escopo /financial/itau/boletos ──────────────────────────────────────────

export const list = async (req, res) => {
  try {
    const { status, receivableId, dateFrom, dateTo, page, limit } = req.query;
    const result = await itauBoletoService.list(req.user.companyId, {
      status, receivableId, dateFrom, dateTo,
      page: page ? parseInt(page) - 1 : 0,
      limit: limit ? parseInt(limit) : 20
    });
    return res.status(200).json(result);
  } catch (err) {
    logger.error('ItauBoletoController :: list >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const doc = await itauBoletoService.getById(req.user.companyId, req.params.id);
    return res.status(200).json(doc);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

export const refreshStatus = async (req, res) => {
  try {
    const doc = await itauBoletoService.refreshStatus({ companyId: req.user.companyId, boletoId: req.params.id });
    return res.status(200).json(doc);
  } catch (err) {
    logger.error('ItauBoletoController :: refreshStatus >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

export const cancel = async (req, res) => {
  try {
    const doc = await itauBoletoService.cancel({
      companyId: req.user.companyId, userId: req.user.sub, boletoId: req.params.id
    });
    return res.status(200).json(doc);
  } catch (err) {
    logger.error('ItauBoletoController :: cancel >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

export const getPdfById = async (req, res) => {
  try {
    const buffer = await itauBoletoService.buildPdfById(req.user.companyId, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="boleto-${req.params.id}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.status(200).end(buffer);
  } catch (err) {
    logger.error('ItauBoletoController :: getPdfById >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Falha ao gerar PDF' });
  }
};

// ─── Escopo /financial/receivables/:id/itau-boleto ───────────────────────────

export const generateForReceivable = async (req, res) => {
  try {
    const doc = await itauBoletoService.generateForReceivable({
      companyId: req.user.companyId,
      userId: req.user.sub,
      receivableId: req.params.id
    });
    return res.status(201).json(doc);
  } catch (err) {
    logger.error('ItauBoletoController :: generateForReceivable >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
  }
};

export const getForReceivable = async (req, res) => {
  try {
    const doc = await itauBoletoService.getByReceivable(req.user.companyId, req.params.id);
    if (!doc) return res.status(404).json({ message: 'Nenhum boleto Itaú para este título' });
    return res.status(200).json(doc);
  } catch (err) {
    logger.error('ItauBoletoController :: getForReceivable >> ', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getPdfForReceivable = async (req, res) => {
  try {
    const buffer = await itauBoletoService.buildPdfForReceivable(req.user.companyId, req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="fatura-${req.params.id}.pdf"`);
    res.setHeader('Content-Length', String(buffer.length));
    return res.status(200).end(buffer);
  } catch (err) {
    logger.error('ItauBoletoController :: getPdfForReceivable >> ', err);
    return res.status(err.status || 500).json({ message: err.message || 'Falha ao gerar PDF' });
  }
};
