import logger from '../../utils/logger.js';
import platformLeadRepository from '../../repositories/platform-lead.repository.js';
import { PLATFORM_LEAD_STATUS, PLATFORM_LEAD_STATUS_LABELS } from '../../models/platform-lead.model.js';

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MAX_IMPORT_ROWS = 5000;

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const norm = (v) => clean(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Aceita a chave (new, won...) ou o rótulo em português vindo do CSV ("Fechado").
function resolveStatus(value) {
  const v = norm(value);
  if (!v) return 'new';
  if (PLATFORM_LEAD_STATUS.includes(v)) return v;
  const byLabel = Object.entries(PLATFORM_LEAD_STATUS_LABELS).find(([, label]) => norm(label) === v);
  return byLabel ? byLabel[0] : null;
}

// Valida e normaliza o payload de um lead. Devolve { data } ou { error }.
// `lenientEmail` (importação): e-mail em formato inválido é descartado em vez
// de reprovar a linha — listas do Google Maps nem sempre trazem e-mail válido.
function parseLead(body = {}, { partial = false, lenientEmail = false } = {}) {
  const data = {};
  const has = (k) => body[k] !== undefined;

  if (!partial || has('name')) {
    data.name = clean(body.name);
    if (!data.name) return { error: 'Nome é obrigatório' };
  }
  if (!partial || has('phone')) {
    data.phone = clean(body.phone);
    if (onlyDigits(data.phone).length < 8) return { error: 'Telefone é obrigatório (mínimo 8 dígitos)' };
  }
  if (!partial || has('email')) {
    data.email = clean(body.email).toLowerCase();
    if (data.email && !isEmail(data.email)) {
      if (!lenientEmail) return { error: `E-mail inválido: ${data.email}` };
      data.email = '';
    }
  }
  if (!partial || has('status')) {
    const status = resolveStatus(body.status);
    if (!status) return { error: `Status inválido: ${body.status}` };
    data.status = status;
  }
  for (const k of ['company', 'segment', 'notes']) {
    if (!partial || has(k)) data[k] = clean(body[k]);
  }
  return { data };
}

export const findAll = async (req, res) => {
  try {
    const { search, status, segment } = req.query;
    const leads = await platformLeadRepository.findAll({ search, status, segment });
    return res.status(200).json(leads);
  } catch (err) {
    logger.error('platformLead.findAll error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const segments = async (_req, res) => {
  try {
    return res.status(200).json(await platformLeadRepository.distinctSegments());
  } catch (err) {
    logger.error('platformLead.segments error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const findById = async (req, res) => {
  try {
    const lead = await platformLeadRepository.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead não encontrado' });
    return res.status(200).json(lead);
  } catch (err) {
    logger.error('platformLead.findById error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const create = async (req, res) => {
  try {
    const { data, error } = parseLead(req.body);
    if (error) return res.status(422).json({ message: error });

    const duplicate = await platformLeadRepository.findByPhone(data.phone);
    if (duplicate) {
      return res.status(409).json({ message: `Já existe um lead com este telefone (${duplicate.name})` });
    }

    const lead = await platformLeadRepository.create({ ...data, source: 'manual' });
    return res.status(201).json(lead);
  } catch (err) {
    logger.error('platformLead.create error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const update = async (req, res) => {
  try {
    const { data, error } = parseLead(req.body, { partial: true });
    if (error) return res.status(422).json({ message: error });

    const current = await platformLeadRepository.findById(req.params.id);
    if (!current) return res.status(404).json({ message: 'Lead não encontrado' });

    if (data.phone) {
      const duplicate = await platformLeadRepository.findByPhone(data.phone, { excludeId: current._id });
      if (duplicate) {
        return res.status(409).json({ message: `Já existe um lead com este telefone (${duplicate.name})` });
      }
    }
    if (data.status && data.status !== current.status) data.statusChangedAt = new Date();

    const lead = await platformLeadRepository.update(current._id, data);
    return res.status(200).json(lead);
  } catch (err) {
    logger.error('platformLead.update error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const remove = async (req, res) => {
  try {
    const lead = await platformLeadRepository.remove(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead não encontrado' });
    return res.status(200).json({ message: 'Lead removido' });
  } catch (err) {
    logger.error('platformLead.remove error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// POST /platform/leads/import  { rows: [{ name, company, phone, email, status, segment }] }
// O CSV é lido no front; aqui só validamos linha a linha. Linhas inválidas ou
// com telefone já cadastrado (no banco ou repetido no próprio arquivo) são
// puladas e reportadas — o restante é importado.
export const importRows = async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows || !rows.length) return res.status(422).json({ message: 'Nenhuma linha para importar' });
    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(422).json({ message: `Máximo de ${MAX_IMPORT_ROWS} linhas por importação` });
    }

    const errors = [];
    const valid = [];
    rows.forEach((row, i) => {
      // `line` vem do front (linha real no arquivo, contando o cabeçalho).
      const line = Number(row?.line) || i + 2;
      const { data, error } = parseLead(row, { lenientEmail: true });
      if (error) errors.push({ line, message: error });
      else valid.push({ line, data });
    });

    const existing = await platformLeadRepository.findPhoneDigitsIn(valid.map(v => onlyDigits(v.data.phone)));
    const seen = new Set();
    const toInsert = [];
    let duplicates = 0;
    for (const { line, data } of valid) {
      const digits = onlyDigits(data.phone);
      if (existing.has(digits) || seen.has(digits)) {
        duplicates++;
        errors.push({ line, message: `Telefone já cadastrado: ${data.phone}` });
        continue;
      }
      seen.add(digits);
      toInsert.push({ ...data, source: 'csv' });
    }

    if (toInsert.length) await platformLeadRepository.insertMany(toInsert);

    errors.sort((a, b) => a.line - b.line);
    return res.status(200).json({
      total: rows.length,
      created: toInsert.length,
      duplicates,
      invalid: errors.length - duplicates,
      errors
    });
  } catch (err) {
    logger.error('platformLead.importRows error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /platform/leads/dashboard
export const dashboard = async (_req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [byStatusRaw, bySegmentRaw, monthlyRaw, wonMonthlyRaw, newThisMonth, wonThisMonth, recent] = await Promise.all([
      platformLeadRepository.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      platformLeadRepository.aggregate([
        { $group: { _id: { $ifNull: ['$segment', ''] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      platformLeadRepository.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } }
      ]),
      platformLeadRepository.aggregate([
        { $match: { status: 'won', statusChangedAt: { $gte: twelveMonthsAgo } } },
        { $group: { _id: { year: { $year: '$statusChangedAt' }, month: { $month: '$statusChangedAt' } }, count: { $sum: 1 } } }
      ]),
      platformLeadRepository.aggregate([{ $match: { createdAt: { $gte: monthStart } } }, { $count: 'n' }]),
      platformLeadRepository.aggregate([
        { $match: { status: 'won', statusChangedAt: { $gte: monthStart } } }, { $count: 'n' }
      ]),
      platformLeadRepository.findAll({}, { limit: 8 })
    ]);

    const statusCount = Object.fromEntries(byStatusRaw.map(s => [s._id, s.count]));
    const byStatus = PLATFORM_LEAD_STATUS.map(status => ({
      status,
      label: PLATFORM_LEAD_STATUS_LABELS[status],
      count: statusCount[status] || 0
    }));
    const total = byStatus.reduce((sum, s) => sum + s.count, 0);
    const won = statusCount.won || 0;
    const lost = statusCount.lost || 0;
    const open = total - won - lost;

    // Top 8 ramos + "Outros" agregando o restante; sem ramo vira "Não informado".
    const segmentsSorted = bySegmentRaw.map(s => ({ label: s._id || 'Não informado', count: s.count }));
    const bySegment = segmentsSorted.slice(0, 8);
    const others = segmentsSorted.slice(8).reduce((sum, s) => sum + s.count, 0);
    if (others) bySegment.push({ label: 'Outros', count: others });

    const monthKey = (y, m) => `${y}-${m}`;
    const newMap = Object.fromEntries(monthlyRaw.map(m => [monthKey(m._id.year, m._id.month), m.count]));
    const wonMap = Object.fromEntries(wonMonthlyRaw.map(m => [monthKey(m._id.year, m._id.month), m.count]));
    const monthly = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + i, 1);
      const key = monthKey(d.getFullYear(), d.getMonth() + 1);
      monthly.push({
        label: `${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        new: newMap[key] || 0,
        won: wonMap[key] || 0
      });
    }

    return res.status(200).json({
      summary: {
        total,
        open,
        won,
        lost,
        newThisMonth: newThisMonth[0]?.n || 0,
        wonThisMonth: wonThisMonth[0]?.n || 0,
        // Conversão sobre leads já decididos (fechados ÷ fechados+perdidos).
        conversionRate: won + lost > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : null
      },
      byStatus,
      bySegment,
      monthly,
      recent
    });
  } catch (err) {
    logger.error('platformLead.dashboard error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
