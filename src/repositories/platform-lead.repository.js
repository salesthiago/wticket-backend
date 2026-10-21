import PlatformLead from '../models/platform-lead.model.js';

const onlyDigits = (v) => String(v || '').replace(/\D/g, '');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class PlatformLeadRepository {
  buildQuery({ search, status, segment } = {}) {
    const query = {};
    if (status) query.status = status;
    if (segment) query.segment = segment;
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: 'i' };
      const or = [{ name: rx }, { company: rx }, { email: rx }, { segment: rx }];
      const digits = onlyDigits(search);
      if (digits) or.push({ phoneDigits: { $regex: digits } });
      query.$or = or;
    }
    return query;
  }

  async findAll(filters = {}, { limit = 2000 } = {}) {
    return await PlatformLead.find(this.buildQuery(filters))
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async count(filters = {}) {
    return await PlatformLead.countDocuments(this.buildQuery(filters));
  }

  async findById(id) {
    return await PlatformLead.findById(id);
  }

  async findByPhone(phone, { excludeId } = {}) {
    const digits = onlyDigits(phone);
    if (!digits) return null;
    const query = { phoneDigits: digits };
    if (excludeId) query._id = { $ne: excludeId };
    return await PlatformLead.findOne(query);
  }

  async findPhoneDigitsIn(digitsList) {
    const docs = await PlatformLead.find({ phoneDigits: { $in: digitsList } }, { phoneDigits: 1 }).lean();
    return new Set(docs.map(d => d.phoneDigits));
  }

  async create(data) {
    return await new PlatformLead(data).save();
  }

  async insertMany(rows) {
    return await PlatformLead.insertMany(rows.map(r => ({ ...r, phoneDigits: onlyDigits(r.phone) })));
  }

  async update(id, data) {
    const set = { ...data };
    if (data.phone !== undefined) set.phoneDigits = onlyDigits(data.phone);
    return await PlatformLead.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true });
  }

  async remove(id) {
    return await PlatformLead.findByIdAndDelete(id);
  }

  async distinctSegments() {
    const values = await PlatformLead.distinct('segment');
    return values.filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  async aggregate(pipeline) {
    return await PlatformLead.aggregate(pipeline);
  }
}

export default new PlatformLeadRepository();
