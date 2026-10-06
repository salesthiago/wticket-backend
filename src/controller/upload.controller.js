import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import * as s3Service from '../services/storage/s3.service.js';

// Upload de imagem embutida em conteúdo de editor rich text (descrição de
// projeto/tarefa, resposta de ticket). Sempre pública — diferente dos
// documentos de projeto (URL assinada) — porque a URL fica salva dentro do
// HTML persistido e precisa continuar válida indefinidamente.
export const uploadEditorImage = async (req, res) => {
  try {
    const companyId = req.user.companyId ?? null;
    if (!req.file) return res.status(422).json({ message: 'Imagem é obrigatória' });

    const ts = Date.now();
    const rand = Math.round(Math.random() * 1e9);
    const ext = (req.file.originalname.match(/\.([A-Za-z0-9]+)$/)?.[1] || 'dat').toLowerCase();
    const objectName = `${ts}-${rand}.${ext}`;

    const useS3 = await s3Service.hasConfig(companyId);
    if (useS3) {
      const result = await s3Service.uploadObject({
        companyId,
        category: 'editor-images',
        filename: objectName,
        body: req.file.buffer,
        contentType: req.file.mimetype,
        publicRead: true
      });
      return res.status(201).json({ url: result.url });
    }

    // Fallback local: grava em uploads/editor-images/<companyId> e serve por /uploads.
    const dir = path.join('uploads', 'editor-images', String(companyId || 'default'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, objectName), req.file.buffer);
    const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
    return res.status(201).json({ url: `${baseUrl}/uploads/editor-images/${companyId || 'default'}/${objectName}` });
  } catch (err) {
    logger.error('upload uploadEditorImage error >>>', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
