const express = require('express');
const {
  getMeta,
  getResources,
  createResource,
  trackDownload,
  deleteResource,
} = require('../controllers/resourceController');
const { verifyAuth, checkPermission } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

const resourceUpload = upload.createUpload({
  allowedExtensions: ['.pdf', '.doc', '.docx'],
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  errorMessage: 'Only PDF, DOC, and DOCX files are allowed for shared resources.',
  maxFileSize: 10 * 1024 * 1024,
});

router.use(verifyAuth);

router.get('/meta', checkPermission('view', 'resources'), getMeta);
router.get('/', checkPermission('view', 'resources'), getResources);
router.post('/', checkPermission('create', 'resources'), resourceUpload.single('file'), createResource);
router.post('/:id/download', checkPermission('view', 'resources'), trackDownload);
router.delete('/:id', checkPermission('delete', 'resources'), deleteResource);

module.exports = router;
