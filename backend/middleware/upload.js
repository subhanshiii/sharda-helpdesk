const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const buildStorage = (destinationPath) => multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, destinationPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const createFileFilter = ({
  allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt', '.zip'],
  allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/zip', 'application/x-zip-compressed'],
  errorMessage = 'File type not allowed.',
} = {}) => (req, file, cb) => {
  const extname = allowedExtensions.includes(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedMimeTypes.includes((file.mimetype || '').toLowerCase());

  if (extname || mimetype) {
    return cb(null, true);
  }
  cb(new Error(errorMessage));
};

const createUpload = ({
  subdirectory = '',
  allowedExtensions,
  allowedMimeTypes,
  errorMessage,
  maxFileSize = 5 * 1024 * 1024,
} = {}) => {
  const destinationPath = subdirectory ? path.join(uploadDir, subdirectory) : uploadDir;
  if (!fs.existsSync(destinationPath)) {
    fs.mkdirSync(destinationPath, { recursive: true });
  }

  return multer({
    storage: buildStorage(destinationPath),
    fileFilter: createFileFilter({ allowedExtensions, allowedMimeTypes, errorMessage }),
    limits: { fileSize: maxFileSize },
  });
};

const upload = createUpload();

module.exports = upload;
module.exports.createUpload = createUpload;
