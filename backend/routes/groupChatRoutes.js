const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/groupChatController');
const { protect, permissionMiddleware } = require('../middleware/auth');

// ── Multer for chat file uploads ───────────────────────
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadDir = path.join(__dirname, '../uploads/chat');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|txt|ppt|pptx|xls|xlsx|zip/;
  const ext     = allowed.test(path.extname(file.originalname).toLowerCase());
  ext ? cb(null, true) : cb(new Error('File type not supported'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// ── Group routes ───────────────────────────────────────
router.post('/',                       protect, permissionMiddleware('canManageGroups'), ctrl.createGroup);
router.get('/',                        protect, permissionMiddleware('canManageGroups'), ctrl.getAllGroups);
router.get('/my',                      protect, ctrl.getMyGroups);
router.get('/users/options',           protect, permissionMiddleware('canManageGroups'), ctrl.getUserFilterOptions);
router.get('/users/search',            protect, permissionMiddleware('canManageGroups'), ctrl.searchUsers);
router.get('/:id',                     protect, ctrl.getGroup);
router.put('/:id',                     protect, permissionMiddleware('canManageGroups'), ctrl.updateGroup);
router.delete('/:id',                  protect, permissionMiddleware('canManageGroups'), ctrl.deleteGroup);

// Member management
router.post('/:id/members',            protect, permissionMiddleware('canManageGroups'), ctrl.addMembers);
router.put('/:id/members/:userId',     protect, permissionMiddleware('canManageGroups'), ctrl.updateMemberRole);
router.delete('/:id/members/:userId',  protect, ctrl.removeMember);

// Message routes
router.get('/:id/messages',            protect, ctrl.getMessages);
router.post('/:id/messages',           protect, upload.single('file'), ctrl.sendMessage);
router.delete('/messages/:messageId',  protect, ctrl.deleteMessage);

module.exports = router;
