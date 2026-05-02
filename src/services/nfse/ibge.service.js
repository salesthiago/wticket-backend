import axios from 'axios';
import logger from '../../utils/logger.js';

// Endpoint público IBGE — todos os municípios do Brasil
const IBGE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';

const STATE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

class IbgeService {
  constructor() {
    this._loadedAt = null;
    this._loading = null;
    /** @type {Map<string, { cMun: string, name: string, normalized: string, uf: string }>} indexed by cMun */
    this._byCMun = new Map();
    /** @type {Map<string, Array<{ cMun: string, name: string, normalized: string, uf: string }>>} indexed by uf+normalized name */
    this._byKey = new Map();
    /** @type {Array<{ cMun: string, name: string, normalized: string, uf: string }>} ordered list for search */
    this._all = [];
  }

  // Normaliza string: minúsculas, sem acentos, trim
  static normalize(s) {
    if (s == null) return '';
    return String(s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  isFresh() {
    return this._loadedAt && (Date.now() - this._loadedAt) < STATE_TTL_MS;
  }

  async ensureLoaded() {
    if (this.isFresh() && this._all.length > 0) return;
    if (this._loading) return this._loading;

    this._loading = this._load().finally(() => { this._loading = null; });
    return this._loading;
  }

  async _load() {
    try {
      logger.info('IbgeService :: fetching municipalities from IBGE...');
      const resp = await axios.get(IBGE_URL, { timeout: 30000 });
      const items = resp.data || [];
      this._byCMun.clear();
      this._byKey.clear();
      this._all = [];

      for (const it of items) {
        const cMun = String(it.id);
        const name = it.nome || '';
        // Estrutura aninhada: municipio.microrregiao.mesorregiao.UF.sigla
        const uf = it?.microrregiao?.mesorregiao?.UF?.sigla
          || it?.regiao?.sigla
          || '';
        if (!cMun || !name) continue;

        const normalized = IbgeService.normalize(name);
        const rec = { cMun, name, normalized, uf };
        this._byCMun.set(cMun, rec);
        this._all.push(rec);

        const key = `${uf.toUpperCase()}|${normalized}`;
        if (!this._byKey.has(key)) this._byKey.set(key, []);
        this._byKey.get(key).push(rec);
      }
      this._loadedAt = Date.now();
      logger.info(`IbgeService :: loaded ${this._all.length} municipalities`);
    } catch (err) {
      logger.error('IbgeService :: failed to load IBGE list >> ', err?.message || err);
      throw err;
    }
  }

  /**
   * Busca municípios por nome parcial e UF opcional.
   * @param {string} query   Texto livre
   * @param {string} [uf]    Sigla da UF (opcional, faz filtro)
   * @param {number} [limit] Default 20
   */
  async search(query, uf, limit = 20) {
    await this.ensureLoaded();
    const q = IbgeService.normalize(query);
    if (!q) return [];

    const ufNorm = uf ? String(uf).toUpperCase().trim() : '';
    const results = [];

    for (const m of this._all) {
      if (ufNorm && m.uf !== ufNorm) continue;
      if (m.normalized.includes(q)) {
        results.push(m);
        if (results.length >= limit) break;
      }
    }

    // Ordenar: nomes que começam com a query primeiro, depois alfabético
    results.sort((a, b) => {
      const aStarts = a.normalized.startsWith(q) ? 0 : 1;
      const bStarts = b.normalized.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name, 'pt');
    });

    return results.map(({ cMun, name, uf }) => ({ cMun, name, uf }));
  }

  async getByCMun(cMun) {
    await this.ensureLoaded();
    const r = this._byCMun.get(String(cMun));
    return r ? { cMun: r.cMun, name: r.name, uf: r.uf } : null;
  }

  /**
   * Resolve um cMun a partir do nome da cidade + UF.
   * Retorna null em caso de zero ou múltiplas correspondências (ambíguo).
   */
  async resolveByName(cityName, uf) {
    await this.ensureLoaded();
    if (!cityName || !uf) return null;
    const normalized = IbgeService.normalize(cityName);
    const key = `${String(uf).toUpperCase().trim()}|${normalized}`;
    const list = this._byKey.get(key);
    if (!list || list.length !== 1) return null;
    const r = list[0];
    return { cMun: r.cMun, name: r.name, uf: r.uf };
  }
}

export default new IbgeService();
