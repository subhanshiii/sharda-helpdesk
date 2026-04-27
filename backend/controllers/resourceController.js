const fs = require('fs');
const path = require('path');
const Resource = require('../models/Resource');
const {
  buildResourcePayload,
  listResources,
  getFilterMeta,
  incrementDownloadCount,
  getResourceById,
  canManageResource,
} = require('../services/resourceService');

const removeUploadedFile = async (filename) => {
  if (!filename) return;
  const filePath = path.join(__dirname, '../uploads', filename);
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

exports.getMeta = async (req, res, next) => {
  try {
    const meta = await getFilterMeta();
    res.status(200).json({ success: true, data: meta });
  } catch (error) {
    next(error);
  }
};

exports.getResources = async (req, res, next) => {
  try {
    const data = await listResources(req.query);
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
};

exports.createResource = async (req, res, next) => {
  try {
    const payload = await buildResourcePayload({ body: req.body, file: req.file, user: req.user });
    const resource = await Resource.create(payload);
    const populated = await getResourceById(resource._id);
    res.status(201).json({ success: true, data: populated, message: 'Resource uploaded successfully' });
  } catch (error) {
    if (req.file?.filename) {
      try {
        await removeUploadedFile(req.file.filename);
      } catch (cleanupError) {
        return next(cleanupError);
      }
    }
    next(error);
  }
};

exports.trackDownload = async (req, res, next) => {
  try {
    const resource = await incrementDownloadCount(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }
    res.status(200).json({ success: true, data: { downloadCount: resource.downloadCount } });
  } catch (error) {
    next(error);
  }
};

exports.deleteResource = async (req, res, next) => {
  try {
    const resource = await getResourceById(req.params.id);
    if (!canManageResource(resource, req.user)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this resource' });
    }

    await Resource.findByIdAndDelete(req.params.id);
    await removeUploadedFile(resource.fileName);
    res.status(200).json({ success: true, message: 'Resource deleted successfully' });
  } catch (error) {
    next(error);
  }
};
