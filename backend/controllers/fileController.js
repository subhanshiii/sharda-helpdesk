const fs = require('fs');
const path = require('path');

const SCOPE_DIRECTORIES = {
  general: path.join(__dirname, '../uploads'),
  chat: path.join(__dirname, '../uploads/chat'),
};

const resolveSafePath = (scope, filename) => {
  const baseDir = SCOPE_DIRECTORIES[scope];
  if (!baseDir) return null;

  const safeName = path.basename(filename || '');
  if (!safeName || safeName !== filename) return null;

  return path.join(baseDir, safeName);
};

// @desc    Serve uploaded files through a controlled route
// @route   GET /api/files/:scope/:filename
// @access  Private
exports.downloadFile = async (req, res, next) => {
  try {
    const { scope, filename } = req.params;
    const filePath = resolveSafePath(scope, filename);

    if (!filePath) {
      return res.status(400).json({ success: false, message: 'Invalid file path' });
    }

    await fs.promises.access(filePath, fs.constants.R_OK);

    const disposition = req.query.download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${path.basename(filename)}"`);
    res.sendFile(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    next(error);
  }
};
