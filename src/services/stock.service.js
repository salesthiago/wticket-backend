import logger from '../utils/logger.js';
import Product from '../models/product.model.js';
import stockMovementRepository from '../repositories/stock-movement.repository.js';

class StockService {
  /**
   * Registra um movimento de estoque (entrada ou saída) de forma atômica e
   * grava o histórico. Produtos sem controle de estoque (trackStock=false)
   * não sofrem movimentação.
   *
   * @returns {Promise<{ product: object|null, movement: object|null }>}
   */
  async registerMovement({ companyId, productId, type, quantity, reason, notes, reference = {}, userId } = {}) {
    if (!companyId) throw Object.assign(new Error('companyId é obrigatório'), { status: 422 });
    if (!productId) throw Object.assign(new Error('productId é obrigatório'), { status: 422 });
    if (!['in', 'out'].includes(type)) throw Object.assign(new Error('Tipo de movimento inválido'), { status: 422 });

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw Object.assign(new Error('Quantidade deve ser maior que zero'), { status: 422 });
    }

    const product = await Product.findOne({ _id: productId, companyId });
    if (!product) throw Object.assign(new Error('Produto não encontrado'), { status: 404 });

    // Produtos sem controle de estoque: não movimentam nem registram histórico.
    if (product.trackStock === false) {
      return { product, movement: null };
    }

    let updated;
    if (type === 'out') {
      // Saída atômica condicional: só decrementa se houver saldo suficiente.
      updated = await Product.findOneAndUpdate(
        { _id: productId, companyId, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      );
      if (!updated) {
        throw Object.assign(
          new Error(`Estoque insuficiente para "${product.name}". Saldo atual: ${product.stock}, solicitado: ${qty}.`),
          { status: 409 }
        );
      }
    } else {
      updated = await Product.findOneAndUpdate(
        { _id: productId, companyId },
        { $inc: { stock: qty } },
        { new: true }
      );
    }

    const movement = await stockMovementRepository.create({
      companyId,
      productId,
      type,
      reason: reason || (type === 'in' ? 'manual_in' : 'manual_out'),
      quantity: qty,
      balanceAfter: updated.stock,
      referenceType: reference.referenceType || 'manual',
      referenceId: reference.referenceId,
      referenceLabel: reference.referenceLabel,
      notes,
      createdBy: userId
    });

    return { product: updated, movement };
  }

  /**
   * Soma as quantidades por produto de uma lista de peças (apenas as que têm productId).
   * @returns {Map<string, number>} productId -> quantidade somada
   */
  _sumByProduct(parts = [], field) {
    const map = new Map();
    for (const part of parts) {
      if (!part?.productId) continue;
      const key = String(part.productId);
      const value = Number(part[field]) || 0;
      map.set(key, (map.get(key) || 0) + value);
    }
    return map;
  }

  /**
   * Reconcilia o estoque ao salvar as peças de uma OS. Compara o que já foi
   * baixado (oldParts.deductedQuantity) com o desejado (newParts.quantity) por
   * produto e movimenta apenas o delta. Bloqueia (409) se faltar saldo.
   *
   * @returns {Promise<Array>} newParts anotadas com deductedQuantity
   */
  async reconcileServiceOrderParts({ companyId, serviceOrderId, orderNumber, oldParts = [], newParts = [], userId } = {}) {
    const desired = this._sumByProduct(newParts, 'quantity');
    const alreadyDeducted = this._sumByProduct(oldParts, 'deductedQuantity');

    const productIds = new Set([...desired.keys(), ...alreadyDeducted.keys()]);
    const reference = {
      referenceType: 'service_order',
      referenceId: serviceOrderId,
      referenceLabel: orderNumber
    };

    for (const productId of productIds) {
      const delta = (desired.get(productId) || 0) - (alreadyDeducted.get(productId) || 0);
      if (delta === 0) continue;

      if (delta > 0) {
        await this.registerMovement({
          companyId, productId, type: 'out', quantity: delta,
          reason: 'service_order', reference, userId,
          notes: `Baixa pela OS ${orderNumber || ''}`.trim()
        });
      } else {
        await this.registerMovement({
          companyId, productId, type: 'in', quantity: -delta,
          reason: 'service_order_reversal', reference, userId,
          notes: `Estorno de peça da OS ${orderNumber || ''}`.trim()
        });
      }
    }

    // Cada peça com produto passa a ter deductedQuantity = sua quantidade atual.
    return newParts.map(part => {
      if (!part?.productId) return { ...part, deductedQuantity: 0 };
      return { ...part, deductedQuantity: Number(part.quantity) || 0 };
    });
  }

  /**
   * Estorna (devolve ao estoque) todas as baixas feitas pelas peças de uma OS.
   * Usado ao cancelar ou excluir a OS. Best-effort: não derruba a operação principal.
   */
  async reverseServiceOrderParts({ companyId, serviceOrderId, orderNumber, parts = [], userId } = {}) {
    const deducted = this._sumByProduct(parts, 'deductedQuantity');
    const reference = {
      referenceType: 'service_order',
      referenceId: serviceOrderId,
      referenceLabel: orderNumber
    };

    for (const [productId, quantity] of deducted) {
      if (quantity <= 0) continue;
      try {
        await this.registerMovement({
          companyId, productId, type: 'in', quantity,
          reason: 'service_order_reversal', reference, userId,
          notes: `Estorno por cancelamento/exclusão da OS ${orderNumber || ''}`.trim()
        });
      } catch (err) {
        logger.error('StockService :: reverseServiceOrderParts >> ', err);
      }
    }
  }
}

export default new StockService();
