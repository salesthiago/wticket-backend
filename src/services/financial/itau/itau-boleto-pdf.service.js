import PDFDocument from 'pdfkit';

// ─── Formatação ──────────────────────────────────────────────────────────────

const fmtMoney = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString('pt-BR');
};
const fmtDoc = (doc) => {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return doc || '—';
};

const COLORS = {
  border: '#888888',
  headerBg: '#f0f0f0',
  textMuted: '#555555',
  text: '#000000',
  accent: '#EC7000' // laranja Itaú
};

// ─── Primitivas de layout ────────────────────────────────────────────────────

function cell(doc, label, value, x, y, w, h = 24) {
  doc.save();
  doc.lineWidth(0.5).strokeColor(COLORS.border).rect(x, y, w, h).stroke();
  doc.fillColor(COLORS.textMuted).fontSize(5.5).font('Helvetica').text(String(label).toUpperCase(), x + 3, y + 2, { width: w - 6 });
  doc.fillColor(COLORS.text).fontSize(9).font('Helvetica-Bold').text(value == null || value === '' ? '—' : String(value), x + 3, y + 9, { width: w - 6 });
  doc.restore();
}

function sectionTitle(doc, text, x, y, w) {
  doc.save();
  doc.fillColor(COLORS.textMuted).fontSize(7).font('Helvetica-Bold').text(String(text).toUpperCase(), x, y, { width: w });
  doc.restore();
}

function dashedLine(doc, x, y, w) {
  doc.save();
  doc.lineWidth(0.5).strokeColor(COLORS.border).dash(3, { space: 2 }).moveTo(x, y).lineTo(x + w, y).stroke().undash();
  doc.restore();
}

// Interleaved 2 of 5 — código de barras do boleto (44 dígitos).
const I25_PATTERNS = {
  0: [1, 1, 2, 2, 1], 1: [2, 1, 1, 1, 2], 2: [1, 2, 1, 1, 2], 3: [2, 2, 1, 1, 1],
  4: [1, 1, 2, 1, 2], 5: [2, 1, 2, 1, 1], 6: [1, 2, 2, 1, 1], 7: [1, 1, 1, 2, 2],
  8: [2, 1, 1, 2, 1], 9: [1, 2, 1, 2, 1]
};

function drawInterleaved2of5(doc, code, x, y, height) {
  const digits = String(code || '').replace(/\D/g, '');
  if (digits.length !== 44) {
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8).text(digits || '—', x, y + height / 2 - 4);
    return;
  }
  const narrow = 0.95;
  const wide = narrow * 3;
  let cursor = x;
  const bar = (width, painted) => {
    if (painted) doc.rect(cursor, y, width, height).fill(COLORS.text);
    cursor += width;
  };
  // Start guard: narrow-bar, narrow-space, narrow-bar, narrow-space
  bar(narrow, true); bar(narrow, false); bar(narrow, true); bar(narrow, false);
  for (let i = 0; i < digits.length; i += 2) {
    const a = I25_PATTERNS[digits[i]];
    const b = I25_PATTERNS[digits[i + 1]];
    for (let k = 0; k < 5; k++) {
      bar(a[k] === 1 ? narrow : wide, true);   // bar = dígito A
      bar(b[k] === 1 ? narrow : wide, false);  // space = dígito B
    }
  }
  // Stop guard: wide-bar, narrow-space, narrow-bar
  bar(wide, true); bar(narrow, false); bar(narrow, true);
}

// ─── Documento ───────────────────────────────────────────────────────────────

/**
 * @returns {Promise<Buffer>}
 */
export function buildBoletoPdf({ boleto, config, company, receivable }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks = [];
      doc.on('data', (b) => chunks.push(b));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const margin = 36;
      const pageW = doc.page.width - margin * 2;
      let y = margin;

      const beneficiarioNome = config?.nomeCobranca || company?.name || 'Beneficiário';
      const beneficiarioDoc = fmtDoc(config?.documento || company?.document);
      const linhaDigitavel = boleto.linhaDigitavel || '—';
      const pagador = boleto.pagador || {};

      // ─── Cabeçalho ────────────────────────────────────────────────────────
      doc.fillColor(COLORS.accent).fontSize(16).font('Helvetica-Bold').text('Itaú', margin, y);
      doc.fillColor(COLORS.text).fontSize(9).font('Helvetica')
        .text('341-7', margin + 48, y + 4);
      doc.fontSize(13).font('Helvetica-Bold').fillColor(COLORS.text)
        .text(linhaDigitavel, margin + 90, y, { width: pageW - 90, align: 'right' });
      y += 26;
      doc.lineWidth(1).strokeColor(COLORS.text).moveTo(margin, y).lineTo(margin + pageW, y).stroke();
      y += 8;

      // ─── Recibo do Pagador ────────────────────────────────────────────────
      sectionTitle(doc, 'Recibo do Pagador', margin, y, pageW);
      y += 10;
      cell(doc, 'Beneficiário', `${beneficiarioNome}  —  ${beneficiarioDoc}`, margin, y, pageW * 0.7);
      cell(doc, 'Agência / Código', `${config?.agencia || '—'} / ${config?.conta || '—'}-${config?.contaDAC || ''}`, margin + pageW * 0.7, y, pageW * 0.3);
      y += 24;
      cell(doc, 'Nosso Número', boleto.nossoNumero, margin, y, pageW * 0.25);
      cell(doc, 'Nº do Documento', receivable?.number || '—', margin + pageW * 0.25, y, pageW * 0.25);
      cell(doc, 'Vencimento', fmtDate(boleto.dataVencimento), margin + pageW * 0.5, y, pageW * 0.25);
      cell(doc, 'Valor do Documento', fmtMoney(boleto.valor), margin + pageW * 0.75, y, pageW * 0.25);
      y += 24;
      cell(doc, 'Pagador', `${pagador.nome || '—'}  —  ${fmtDoc(pagador.documento)}`, margin, y, pageW);
      y += 24;
      cell(doc, 'Descrição', receivable?.description || '—', margin, y, pageW, 30);
      y += 38;

      dashedLine(doc, margin, y, pageW);
      doc.fillColor(COLORS.textMuted).fontSize(6).font('Helvetica-Oblique')
        .text('Corte na linha pontilhada', margin, y + 2, { width: pageW, align: 'right' });
      y += 14;

      // ─── Ficha de Compensação ─────────────────────────────────────────────
      sectionTitle(doc, 'Ficha de Compensação', margin, y, pageW);
      y += 10;

      doc.fillColor(COLORS.accent).fontSize(14).font('Helvetica-Bold').text('Itaú', margin, y);
      doc.fillColor(COLORS.text).fontSize(11).font('Helvetica-Bold')
        .text('341-7', margin + 46, y + 2);
      doc.fontSize(11).text(linhaDigitavel, margin + 90, y + 2, { width: pageW - 90, align: 'right' });
      y += 20;
      doc.lineWidth(0.75).strokeColor(COLORS.text).moveTo(margin, y).lineTo(margin + pageW, y).stroke();
      y += 4;

      cell(doc, 'Local de Pagamento', 'Pague pelo aplicativo, internet banking, PIX ou em qualquer banco/lotérica até o vencimento', margin, y, pageW * 0.75, 30);
      cell(doc, 'Vencimento', fmtDate(boleto.dataVencimento), margin + pageW * 0.75, y, pageW * 0.25, 30);
      y += 30;
      cell(doc, 'Beneficiário', `${beneficiarioNome} — ${beneficiarioDoc}`, margin, y, pageW * 0.75);
      cell(doc, 'Agência / Código Beneficiário', `${config?.agencia || '—'} / ${config?.conta || '—'}-${config?.contaDAC || ''}`, margin + pageW * 0.75, y, pageW * 0.25);
      y += 24;
      cell(doc, 'Data Documento', fmtDate(boleto.dataEmissao), margin, y, pageW * 0.2);
      cell(doc, 'Nº Documento', receivable?.number || '—', margin + pageW * 0.2, y, pageW * 0.25);
      cell(doc, 'Espécie', 'DM', margin + pageW * 0.45, y, pageW * 0.1);
      cell(doc, 'Aceite', 'N', margin + pageW * 0.55, y, pageW * 0.1);
      cell(doc, 'Carteira', boleto.carteira || config?.carteira, margin + pageW * 0.65, y, pageW * 0.1);
      cell(doc, 'Nosso Número', boleto.nossoNumero, margin + pageW * 0.75, y, pageW * 0.25);
      y += 24;
      cell(doc, '(=) Valor do Documento', fmtMoney(boleto.valor), margin + pageW * 0.75, y, pageW * 0.25);
      cell(doc, 'Instruções', config?.instrucoes || 'Não receber após 60 dias do vencimento.', margin, y, pageW * 0.75, 60);
      y += 24;
      cell(doc, '(+) Mora / Multa', config?.multaPercent ? `${config.multaPercent}%` : '—', margin + pageW * 0.75, y, pageW * 0.25);
      y += 36;
      cell(doc, 'Pagador', `${pagador.nome || '—'} — ${fmtDoc(pagador.documento)}\n${[pagador.logradouro, pagador.numero, pagador.bairro, pagador.cidade, pagador.uf].filter(Boolean).join(', ')}`, margin, y, pageW, 34);
      y += 42;

      // Código de barras
      drawInterleaved2of5(doc, boleto.codigoBarras, margin, y, 40);
      y += 48;

      dashedLine(doc, margin, y, pageW);
      y += 14;

      // ─── Seção PIX ────────────────────────────────────────────────────────
      sectionTitle(doc, 'Pague com PIX', margin, y, pageW);
      y += 12;

      if (boleto.pix?.qrCodeImage) {
        try {
          const b64 = boleto.pix.qrCodeImage.split(',')[1];
          const img = Buffer.from(b64, 'base64');
          doc.image(img, margin, y, { width: 120, height: 120 });
        } catch { /* ignora QR inválido */ }
      }

      const pixX = margin + 140;
      const pixW = pageW - 140;
      doc.fillColor(COLORS.text).fontSize(9).font('Helvetica')
        .text('Abra o app do seu banco, escolha pagar com PIX por QR Code e aponte a câmera para o código ao lado — ou copie o código abaixo:', pixX, y, { width: pixW });
      doc.fontSize(7).font('Courier').fillColor(COLORS.textMuted)
        .text(boleto.pix?.emv || 'PIX indisponível para este boleto.', pixX, y + 44, { width: pixW });

      if (config?.mensagemPix) {
        doc.fontSize(8).font('Helvetica-Oblique').fillColor(COLORS.textMuted)
          .text(config.mensagemPix, pixX, y + 100, { width: pixW });
      }

      y += 132;
      doc.fontSize(6).fillColor(COLORS.textMuted).font('Helvetica-Oblique').text(
        `Boleto e QR Code PIX gerados via integração Itaú. Nosso número ${boleto.nossoNumero} • Título ${receivable?.number || ''}.`,
        margin, doc.page.height - 28, { width: pageW, align: 'center' }
      );

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

export default { buildBoletoPdf };
