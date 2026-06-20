import multer from 'multer';

// Imagens de produto são enviadas para o S3 (services/storage/s3.service.js).
// O multer mantém o arquivo em memória — o controller faz o upload e persiste
// a chave no banco.

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG, WEBP ou GIF.'), false);
  }
};

export const uploadProductImage = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
}).single('image');

// ─── Fotos da Ordem de Serviço (oficina) ──────────────────────────────────────
// Memória: o controller decide entre S3 e disco local.
const MAX_OS_PHOTO_SIZE = 50 * 1024 * 1024; // 50MB

const osPhotoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_OS_PHOTO_SIZE }
}).single('photo');

// Envolve o multer para traduzir os erros (tamanho/tipo) em mensagens claras,
// caso contrário o limite estourado cai no handler padrão do Express (HTML 500).
export const uploadServiceOrderPhoto = (req, res, next) => {
  osPhotoUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        message: 'A foto excede o tamanho máximo permitido de 50MB. Envie uma imagem menor.'
      });
    }
    return res.status(400).json({ message: err.message || 'Falha ao processar o upload da foto.' });
  });
};

// ─── Logo da Empresa ──────────────────────────────────────────────────────────
// Memória: o controller faz o upload ao S3 e persiste a URL/chave na empresa.
export const uploadCompanyLogo = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
}).single('logo');

// ─── Certificado Digital NFS-e (PFX/P12) ──────────────────────────────────────
const certFileFilter = (req, file, cb) => {
  const okMime = ['application/x-pkcs12', 'application/pkcs12', 'application/octet-stream'];
  const okExt = /\.(pfx|p12)$/i.test(file.originalname);
  if (okExt || okMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Envie um certificado .pfx ou .p12.'), false);
  }
};

export const uploadNfseCertificate = multer({
  storage: multer.memoryStorage(), // o conteúdo é tratado pelo certificate.service
  fileFilter: certFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB é suficiente para PFX
}).single('certificate');
