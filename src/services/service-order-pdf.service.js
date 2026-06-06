import PDFDocument from 'pdfkit';

// ─── Helpers de formatação ────────────────────────────────────────────────────
const fmtMoney = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString('pt-BR');
};

const fmtDoc = (doc) => {
  if (!doc) return '—';
  const d = String(doc).replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return doc;
};

const fmtAddress = (a) => {
  if (!a) return '—';
  const l1 = [a.street, a.number].filter(Boolean).join(', ');
  const l2 = [a.neighborhood, a.city, a.state].filter(Boolean).join(' - ');
  const l3 = a.zipCode ? `CEP ${a.zipCode}` : '';
  return [l1, l2, l3].filter(Boolean).join(' • ') || '—';
};

const STATUS_LABELS = {
  open: 'Aberta', diagnosing: 'Em Diagnóstico', quoted: 'Orçamento Enviado',
  approved: 'Aprovada', in_progress: 'Em Execução', completed: 'Concluída',
  delivered: 'Entregue', cancelled: 'Cancelada'
};
const PRIORITY_LABELS = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };
const FUEL_LABELS = {
  gasoline: 'Gasolina', ethanol: 'Etanol', flex: 'Flex', diesel: 'Diesel',
  gnv: 'GNV', electric: 'Elétrico', hybrid: 'Híbrido', other: 'Outro'
};

const COLORS = {
  text: '#1f2937',
  muted: '#6b7280',
  border: '#cbd5e1',
  headerBg: '#f1f5f9',
  accent: '#0f766e'
};

/**
 * Gera o PDF da Ordem de Serviço (oficina). Retorna um Buffer.
 * @param {object} params
 * @param {object} params.order   OS populada (customerId, vehicleId)
 * @param {object} params.company Empresa (nome, documento, contato, endereço)
 * @param {Buffer} [params.logo]  Bytes da logomarca (PNG/JPEG) para o cabeçalho
 */
export function buildServiceOrderPdf({ order, company, logo }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', (b) => chunks.push(b));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const pageWidth = doc.page.width;
      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentW = right - left;

      const customer = (order.customerId && typeof order.customerId === 'object') ? order.customerId : {};
      const vehicle = (order.vehicleId && typeof order.vehicleId === 'object') ? order.vehicleId : {};
      const eq = order.equipment || {};

      // ── Cabeçalho: logo + empresa + título ──
      // Desenha a logomarca à esquerda (quando configurada) e desloca o texto.
      let headerTextX = left;
      if (logo) {
        const logoSize = 56;
        try {
          doc.image(logo, left, 40, { fit: [logoSize, logoSize] });
          headerTextX = left + logoSize + 12;
        } catch (imgErr) {
          // Formato não suportado pelo PDFKit (ex.: WEBP/GIF) — segue sem logo.
          headerTextX = left;
        }
      }
      const headerTextW = (right - headerTextX) - 190; // reserva espaço do bloco da OS
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(16)
        .text(company?.name || 'Oficina', headerTextX, 40, { width: headerTextW });
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
      const compLines = [
        company?.document ? `Doc: ${fmtDoc(company.document)}` : null,
        company?.phone ? `Tel: ${company.phone}` : null,
        company?.email || null,
        fmtAddress(company?.address)
      ].filter(Boolean);
      doc.text(compLines.join('\n'), headerTextX, doc.y + 2, { width: headerTextW });

      // Bloco título OS (direita)
      const boxW = 180;
      const boxX = right - boxW;
      doc.roundedRect(boxX, 40, boxW, 56, 4).fillAndStroke(COLORS.headerBg, COLORS.border);
      doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(13)
        .text('ORDEM DE SERVIÇO', boxX, 48, { width: boxW, align: 'center' });
      doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(12)
        .text(order.orderNumber || '—', boxX, 66, { width: boxW, align: 'center' });
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
        .text(`Emissão: ${fmtDate(order.createdAt)}`, boxX, 82, { width: boxW, align: 'center' });

      let y = 120;
      doc.moveTo(left, y).lineTo(right, y).strokeColor(COLORS.border).stroke();
      y += 10;

      // ── Helper: caixa de seção com título ──
      const sectionTitle = (title) => {
        doc.rect(left, y, contentW, 16).fill(COLORS.headerBg);
        doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(9)
          .text(title.toUpperCase(), left + 6, y + 4);
        y += 22;
      };

      const field = (label, value, x, w) => {
        doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7).text(label.toUpperCase(), x, y);
        doc.fillColor(COLORS.text).font('Helvetica-Bold').fontSize(9).text(value || '—', x, y + 9, { width: w });
      };

      // ── Cliente ──
      sectionTitle('Cliente');
      const colW = contentW / 2;
      field('Nome', customer.name, left, colW - 10);
      field('Telefone', customer.phone, left + colW, colW - 10);
      y += 26;
      field('Documento', fmtDoc(customer.document), left, colW - 10);
      field('E-mail', customer.email, left + colW, colW - 10);
      y += 26;
      field('Endereço', fmtAddress(customer.address), left, contentW);
      y += 30;

      // ── Veículo ──
      sectionTitle('Veículo');
      const c3 = contentW / 3;
      field('Placa', (eq.plate || vehicle.plate || '').toUpperCase(), left, c3 - 10);
      field('Marca / Modelo', [vehicle.brand || eq.brand, vehicle.model || eq.model].filter(Boolean).join(' '), left + c3, c3 - 10);
      field('Ano', vehicle.year ? String(vehicle.year) : '—', left + c3 * 2, c3 - 10);
      y += 26;
      field('Cor', vehicle.color, left, c3 - 10);
      field('Combustível', FUEL_LABELS[vehicle.fuel] || '—', left + c3, c3 - 10);
      field('KM', (eq.mileage ?? vehicle.mileage) != null ? String(eq.mileage ?? vehicle.mileage) : '—', left + c3 * 2, c3 - 10);
      y += 30;

      // ── Status / prioridade ──
      sectionTitle('Atendimento');
      field('Status', STATUS_LABELS[order.status] || order.status, left, c3 - 10);
      field('Prioridade', PRIORITY_LABELS[order.priority] || order.priority, left + c3, c3 - 10);
      field('Previsão', fmtDate(order.estimatedCompletionDate), left + c3 * 2, c3 - 10);
      y += 30;

      // ── Problema relatado / diagnóstico ──
      const textBlock = (label, value) => {
        doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7).text(label.toUpperCase(), left, y);
        y += 10;
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
          .text(value || '—', left, y, { width: contentW });
        y = doc.y + 12;
      };
      textBlock('Problema relatado', order.reportedIssue);
      if (order.diagnosis) textBlock('Diagnóstico', order.diagnosis);

      // ── Tabela genérica de itens ──
      const drawTable = (title, items, nameKey) => {
        if (!items || !items.length) return;
        // quebra de página simples
        if (y > doc.page.height - 140) { doc.addPage(); y = 40; }
        sectionTitle(title);
        const cols = [
          { w: contentW - 220, align: 'left' },   // descrição
          { w: 50, align: 'right' },               // qtd
          { w: 80, align: 'right' },               // unit
          { w: 90, align: 'right' }                // total
        ];
        const headers = ['Descrição', 'Qtd', 'Valor unit.', 'Total'];
        let x = left;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted);
        headers.forEach((h, i) => { doc.text(h, x + 2, y, { width: cols[i].w - 4, align: cols[i].align }); x += cols[i].w; });
        y += 14;
        doc.moveTo(left, y - 2).lineTo(right, y - 2).strokeColor(COLORS.border).stroke();

        doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
        items.forEach((it) => {
          if (y > doc.page.height - 80) { doc.addPage(); y = 40; }
          x = left;
          const cells = [it[nameKey] || '—', String(it.quantity ?? 1), fmtMoney(it.unitPrice), fmtMoney(it.total)];
          const h = Math.max(14, doc.heightOfString(cells[0], { width: cols[0].w - 4 }) + 4);
          cells.forEach((cv, i) => { doc.text(cv, x + 2, y, { width: cols[i].w - 4, align: cols[i].align }); x += cols[i].w; });
          y += h;
        });
        y += 6;
      };

      drawTable('Serviços', order.services, 'description');
      drawTable('Peças', order.parts, 'name');

      // ── Totais ──
      const servicesTotal = (order.services || []).reduce((a, s) => a + (s.total || 0), 0);
      const partsTotal = (order.parts || []).reduce((a, p) => a + (p.total || 0), 0);
      const grand = servicesTotal + partsTotal;

      if (y > doc.page.height - 120) { doc.addPage(); y = 40; }
      const tX = right - 220;
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted);
      doc.text('Serviços:', tX, y, { width: 120, align: 'right' });
      doc.fillColor(COLORS.text).text(fmtMoney(servicesTotal), tX + 120, y, { width: 100, align: 'right' });
      y += 14;
      doc.fillColor(COLORS.muted).text('Peças:', tX, y, { width: 120, align: 'right' });
      doc.fillColor(COLORS.text).text(fmtMoney(partsTotal), tX + 120, y, { width: 100, align: 'right' });
      y += 16;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.accent);
      doc.text('TOTAL:', tX, y, { width: 120, align: 'right' });
      doc.text(fmtMoney(grand), tX + 120, y, { width: 100, align: 'right' });
      y += 24;

      // ── Observações / garantia ──
      if (order.internalNotes) {
        doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7).text('OBSERVAÇÕES', left, y);
        y += 10;
        doc.fillColor(COLORS.text).font('Helvetica').fontSize(9).text(order.internalNotes, left, y, { width: contentW });
        y = doc.y + 10;
      }
      if (order.warrantyDays) {
        doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8)
          .text(`Garantia: ${order.warrantyDays} dias.`, left, y);
        y += 16;
      }

      // ── Assinaturas ──
      if (y > doc.page.height - 90) { doc.addPage(); y = 40; }
      y = Math.max(y + 20, doc.page.height - 90);
      const sigW = (contentW - 40) / 2;
      doc.strokeColor(COLORS.border);
      doc.moveTo(left, y).lineTo(left + sigW, y).stroke();
      doc.moveTo(left + sigW + 40, y).lineTo(right, y).stroke();
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8);
      doc.text('Assinatura do cliente', left, y + 4, { width: sigW, align: 'center' });
      doc.text('Responsável técnico', left + sigW + 40, y + 4, { width: sigW, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export default { buildServiceOrderPdf };
