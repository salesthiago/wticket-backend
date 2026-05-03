import multer from 'multer';

// Imagens de produto agora são enviadas para o S3 (services/storage/s3.service.js).
// O multer apenas mantém o arquivo em memória — o controller faz o upload e
// persiste a chave/URL no banco.

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
