const mongoose = require('mongoose');

const RESOURCE_TYPES = ['notes', 'pyq', 'study-material', 'document'];

const resourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 180,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: '',
  },
  fileUrl: {
    type: String,
    required: true,
    trim: true,
  },
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  originalFileName: {
    type: String,
    required: true,
    trim: true,
  },
  mimeType: {
    type: String,
    required: true,
    trim: true,
  },
  size: {
    type: Number,
    required: true,
    min: 0,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  resourceType: {
    type: String,
    enum: RESOURCE_TYPES,
    required: true,
    index: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true,
  },
  courseName: {
    type: String,
    required: true,
    trim: true,
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
    index: true,
  },
  department: {
    type: String,
    required: true,
    trim: true,
  },
  programId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Program',
    required: true,
    index: true,
  },
  program: {
    type: String,
    required: true,
    trim: true,
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
    index: true,
  },
  school: {
    type: String,
    required: true,
    trim: true,
  },
  downloadCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { timestamps: true });

resourceSchema.index({ title: 'text', courseName: 'text', department: 'text', program: 'text', school: 'text' });
resourceSchema.index({ resourceType: 1, courseId: 1, createdAt: -1 });
resourceSchema.index({ departmentId: 1, programId: 1, schoolId: 1, createdAt: -1 });
resourceSchema.index({ uploadedBy: 1, createdAt: -1 });

resourceSchema.statics.RESOURCE_TYPES = RESOURCE_TYPES;

module.exports = mongoose.model('Resource', resourceSchema);
