import PDFDocument from 'pdfkit';

// ─── Helpers de formatação ────────────────────────────────────────────────────

const fmtMoney = (n) => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtPct = (n) => (Number(n) || 0).toFixed(2).replace('.', ',') + '%';
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString('pt-BR');
};
const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleString('pt-BR');
};
const fmtDoc = (doc) => {
  if (!doc) return '—';
  const d = String(doc).replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return doc;
};
const fmtChave = (c) => (c ? String(c).replace(/(\d{4})/g, '$1 ').trim() : '—');

const compactAddress = (p) => {
  if (!p?.endereco) return '—';
  const e = p.endereco;
  const linha1 = [e.xLgr, e.nro].filter(Boolean).join(', ');
  const linha2 = [e.xCpl].filter(Boolean).join(', ');
  const linha3 = [e.xBairro, e.cep].filter(Boolean).join(' • CEP ');
  return [linha1, linha2, linha3].filter(Boolean).join('\n');
};

// ─── Layout primitives ────────────────────────────────────────────────────────

const COLORS = {
  border: '#888888',
  headerBg: '#f0f0f0',
  textMuted: '#555555',
  text: '#000000',
  warning: '#b85c00',
  danger: '#b30000'
};

function drawSection(doc, title, x, y, w, h) {
  doc.save();
  doc.lineWidth(0.5).strokeColor(COLORS.border).rect(x, y, w, h).stroke();
  doc.fillColor(COLORS.headerBg).rect(x, y, w, 14).fill();
  doc.fillColor(COLORS.textMuted).fontSize(7).font('Helvetica-Bold')
    .text(String(title).toUpperCase(), x + 4, y + 4, { width: w - 8 });
  doc.restore();
}

function field(doc, label, value, x, y, w) {
  doc.fillColor(COLORS.textMuted).fontSize(6.5).font('Helvetica').text(label, x, y, { width: w });
  doc.fillColor(COLORS.text).fontSize(9).font('Helvetica-Bold').text(value || '—', x, y + 8, { width: w });
}

function fieldMulti(doc, label, value, x, y, w, h) {
  doc.fillColor(COLORS.textMuted).fontSize(6.5).font('Helvetica').text(label, x, y, { width: w });
  doc.fillColor(COLORS.text).fontSize(9).font('Helvetica').text(value || '—', x, y + 8, { width: w, height: h - 8 });
}

// ─── Geração principal ───────────────────────────────────────────────────────

/**
 * Gera o PDF do DANFSE como Buffer.
 * @param {object} params
 * @param {object} params.issuance     documento NfseIssuance (pode estar populated)
 * @param {object} [params.company]    dados da empresa emitente
 * @param {string} [params.municipalityName]  nome do município emissor (para cabeçalho)
 * @returns {Promise<Buffer>}
 */
export function buildDanfsePdf({ issuance, company, municipalityName }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 30 });
      const chunks = [];
      doc.on('data', (b) => chunks.push(b));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageW = doc.page.width;
      const margin = 30;
      const usableW = pageW - margin * 2;
      let y = margin;

      // ─── Cabeçalho ─────────────────────────────────────────────────────────
      const headerH = 60;
      doc.lineWidth(0.5).strokeColor(COLORS.border).rect(margin, y, usableW, headerH).stroke();

      // Bloco esquerdo: prefeitura/município
      doc.fillColor(COLORS.text).fontSize(11).font('Helvetica-Bold')
        .text(`PREFEITURA MUNICIPAL DE ${(municipalityName || 'MUNICÍPIO').toUpperCase()}`,
          margin + 8, y + 8, { width: usableW * 0.55 });
      doc.fontSize(7).font('Helvetica')
        .text('Secretaria Municipal de Finanças', margin + 8, y + 22, { width: usableW * 0.55 });

      // Linha divisória vertical
      doc.moveTo(margin + usableW * 0.55, y).lineTo(margin + usableW * 0.55, y + headerH).stroke();

      // Bloco direito: identificação da NFS-e
      const rightX = margin + usableW * 0.55 + 8;
      const rightW = usableW * 0.45 - 16;
      doc.fontSize(11).font('Helvetica-Bold')
        .text('NOTA FISCAL DE SERVIÇOS ELETRÔNICA — NFS-e', rightX, y + 6, { width: rightW, align: 'center' });

      doc.fontSize(8).font('Helvetica');
      doc.text(`Nº NFS-e: ${issuance.numeroNfse || '—'}`, rightX, y + 22, { width: rightW });
      doc.text(`Série/DPS: ${issuance.serie}/${issuance.nDPS}`, rightX, y + 32, { width: rightW });
      doc.text(`Emissão: ${fmtDateTime(issuance.dhEmi)}`, rightX, y + 42, { width: rightW });

      // Tag de ambiente HOM se aplicável
      if (issuance.tpAmb === 2) {
        doc.save();
        doc.fillColor(COLORS.warning).font('Helvetica-Bold').fontSize(10)
          .text('AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL',
            margin, y + headerH + 2, { width: usableW, align: 'center' });
        doc.restore();
        y += 12;
      }
      y += headerH + 6;

      // ─── Status / mensagem ─────────────────────────────────────────────────
      if (issuance.status !== 'authorized') {
        doc.save();
        doc.fillColor(COLORS.danger).font('Helvetica-Bold').fontSize(10)
          .text(`STATUS: ${String(issuance.status || '').toUpperCase()}`,
            margin, y, { width: usableW, align: 'center' });
        doc.restore();
        y += 14;
      }

      // ─── Chave de Acesso ────────────────────────────────────────────────────
      const chaveH = 30;
      drawSection(doc, 'Chave de Acesso da NFS-e', margin, y, usableW, chaveH);
      doc.fillColor(COLORS.text).font('Courier-Bold').fontSize(10)
        .text(fmtChave(issuance.chaveAcesso), margin + 8, y + 16, { width: usableW - 16 });
      y += chaveH + 4;

      // ─── Prestador ──────────────────────────────────────────────────────────
      const prestadorH = 70;
      drawSection(doc, 'Prestador de Serviços', margin, y, usableW, prestadorH);
      const px = margin + 6;
      const pw = usableW - 12;
      const py = y + 18;
      field(doc, 'CNPJ/CPF', fmtDoc(issuance.prestador?.document), px, py, pw * 0.25);
      field(doc, 'Inscrição Municipal', issuance.prestador?.inscricaoMunicipal || '—', px + pw * 0.25, py, pw * 0.25);
      field(doc, 'Razão Social', issuance.prestador?.nome, px + pw * 0.5, py, pw * 0.5);
      fieldMulti(doc, 'Endereço', compactAddress(issuance.prestador), px, py + 22, pw * 0.6, 30);
      field(doc, 'E-mail', issuance.prestador?.email || '—', px + pw * 0.6, py + 22, pw * 0.4);
      field(doc, 'Telefone', issuance.prestador?.fone || '—', px + pw * 0.6, py + 38, pw * 0.4);
      y += prestadorH + 4;

      // ─── Tomador ────────────────────────────────────────────────────────────
      if (issuance.tomador) {
        const tomadorH = 70;
        drawSection(doc, 'Tomador de Serviços', margin, y, usableW, tomadorH);
        const ty = y + 18;
        field(doc, `${(issuance.tomador.documentType || '').toUpperCase() || 'DOC'}`,
          fmtDoc(issuance.tomador.document), px, ty, pw * 0.25);
        field(doc, 'Inscrição Municipal', issuance.tomador.inscricaoMunicipal || '—', px + pw * 0.25, ty, pw * 0.25);
        field(doc, 'Nome / Razão Social', issuance.tomador.nome, px + pw * 0.5, ty, pw * 0.5);
        fieldMulti(doc, 'Endereço', compactAddress(issuance.tomador), px, ty + 22, pw * 0.6, 30);
        field(doc, 'E-mail', issuance.tomador.email || '—', px + pw * 0.6, ty + 22, pw * 0.4);
        field(doc, 'Telefone', issuance.tomador.fone || '—', px + pw * 0.6, ty + 38, pw * 0.4);
        y += tomadorH + 4;
      }

      // ─── Serviço prestado ──────────────────────────────────────────────────
      const servH = 80;
      drawSection(doc, 'Discriminação dos Serviços', margin, y, usableW, servH);
      const sy = y + 18;
      field(doc, 'cTribNac', issuance.servico?.cTribNac || '—', px, sy, pw * 0.18);
      field(doc, 'cTribMun', issuance.servico?.cTribMun || '—', px + pw * 0.18, sy, pw * 0.18);
      field(doc, 'cNBS', issuance.servico?.cNBS || '—', px + pw * 0.36, sy, pw * 0.18);
      field(doc, 'Local da Prestação', issuance.servico?.cLocPrestacao || '—', px + pw * 0.54, sy, pw * 0.18);
      field(doc, 'Competência', fmtDate(issuance.dCompet), px + pw * 0.72, sy, pw * 0.28);
      fieldMulti(doc, 'Descrição', issuance.servico?.xDescServ, px, sy + 22, pw, 40);
      y += servH + 4;

      // ─── Valores ──────────────────────────────────────────────────────────
      const valuesH = 120;
      drawSection(doc, 'Valores e Tributação', margin, y, usableW, valuesH);
      const vy = y + 18;
      const colW = pw / 4;
      field(doc, 'Valor do Serviço', fmtMoney(issuance.valores?.vServ), px, vy, colW);
      field(doc, 'Desc. Incond.', fmtMoney(issuance.valores?.descIncond), px + colW, vy, colW);
      field(doc, 'Desc. Cond.', fmtMoney(issuance.valores?.descCond), px + colW * 2, vy, colW);
      field(doc, 'Base de Cálculo', fmtMoney(issuance.valores?.vBC), px + colW * 3, vy, colW);

      const vy2 = vy + 22;
      field(doc, 'Alíquota ISSQN', fmtPct(issuance.valores?.issqn?.pAliq), px, vy2, colW);
      field(doc, 'Valor ISSQN', fmtMoney(issuance.valores?.vISSQN), px + colW, vy2, colW);
      field(doc, 'Total Retenções', fmtMoney(issuance.valores?.vTotalRet), px + colW * 2, vy2, colW);
      field(doc, 'Valor Líquido', fmtMoney(issuance.valores?.vLiq), px + colW * 3, vy2, colW);

      // Lista de retenções federais (compacta)
      const retencoes = [];
      const v = issuance.valores || {};
      if (v.pis?.retido) retencoes.push(`PIS ${fmtPct(v.pis.aliq)}`);
      if (v.cofins?.retido) retencoes.push(`COFINS ${fmtPct(v.cofins.aliq)}`);
      if (v.irrf?.retido) retencoes.push(`IRRF ${fmtPct(v.irrf.aliq)}`);
      if (v.csll?.retido) retencoes.push(`CSLL ${fmtPct(v.csll.aliq)}`);
      if (v.cp?.retido) retencoes.push(`CP/INSS ${fmtPct(v.cp.aliq)}`);

      const vy3 = vy2 + 22;
      fieldMulti(doc, 'Retenções aplicadas',
        retencoes.length ? retencoes.join(' • ') : 'Nenhuma',
        px, vy3, pw * 0.7, 30);
      field(doc, 'ISS retido?', (issuance.valores?.issqn?.tpRetISSQN === 2) ? 'Sim' : 'Não',
        px + pw * 0.7, vy3, pw * 0.3);
      y += valuesH + 4;

      // ─── Rodapé ───────────────────────────────────────────────────────────
      const footerH = 40;
      drawSection(doc, 'Verificação de Autenticidade', margin, y, usableW, footerH);
      const fy = y + 18;
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8);
      if (issuance.urlConsulta) {
        doc.text(`URL de consulta: ${issuance.urlConsulta}`, px, fy, { width: pw });
      }
      if (issuance.protocolo) {
        doc.text(`Protocolo: ${issuance.protocolo}`, px, fy + 12, { width: pw });
      }

      // Texto institucional no fim da página
      doc.fontSize(6).fillColor(COLORS.textMuted).font('Helvetica-Oblique').text(
        `Documento gerado eletronicamente. A autenticidade desta NFS-e pode ser confirmada no portal da prefeitura de ${municipalityName || ''}.`,
        margin, doc.page.height - 24, { width: usableW, align: 'center' }
      );

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

export default { buildDanfsePdf };
