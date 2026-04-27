const mongoose = require('mongoose');
const Resource = require('../models/Resource');
const Course = require('../models/Course');
const Program = require('../models/Program');
const Department = require('../models/Department');
const College = require('../models/College');
const { normalizeRole } = require('../utils/roleHelpers');

const RESOURCE_TYPE_LABELS = {
  notes: 'Notes',
  pyq: 'PYQ',
  'study-material': 'Study Material',
  document: 'Document',
};

const SORT_MAP = {
  latest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  downloads: { downloadCount: -1, createdAt: -1 },
  relevant: { score: { $meta: 'textScore' }, createdAt: -1 },
};

const buildMetadataFromCourse = async (courseId) => {
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    const error = new Error('A valid course is required');
    error.statusCode = 400;
    throw error;
  }

  const course = await Course.findById(courseId)
    .populate({
      path: 'program',
      populate: {
        path: 'department',
        populate: { path: 'college' },
      },
    })
    .populate('department')
    .lean();

  if (!course) {
    const error = new Error('Selected course was not found');
    error.statusCode = 404;
    throw error;
  }

  const program = course.program;
  const department = program?.department || course.department;
  const school = department?.college;

  if (!program || !department || !school) {
    const error = new Error('Course metadata is incomplete. Please contact an administrator.');
    error.statusCode = 400;
    throw error;
  }

  return {
    courseId: course._id,
    courseName: course.name,
    departmentId: department._id,
    department: department.name,
    programId: program._id,
    program: program.name,
    schoolId: school._id,
    school: school.name,
  };
};

const buildResourcePayload = async ({ body, file, user }) => {
  if (!file) {
    const error = new Error('Please upload a resource file');
    error.statusCode = 400;
    throw error;
  }

  const resourceType = String(body.resourceType || '').trim();
  if (!Resource.RESOURCE_TYPES.includes(resourceType)) {
    const error = new Error('Invalid resource type');
    error.statusCode = 400;
    throw error;
  }

  const title = String(body.title || '').trim();
  if (!title) {
    const error = new Error('Title is required');
    error.statusCode = 400;
    throw error;
  }

  const metadata = await buildMetadataFromCourse(body.courseId);

  return {
    title,
    description: String(body.description || '').trim(),
    fileUrl: `/api/files/general/${file.filename}`,
    fileName: file.filename,
    originalFileName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    uploadedBy: user._id,
    resourceType,
    ...metadata,
  };
};

const buildResourceFilters = (query = {}) => {
  const filters = {};

  if (query.resourceType && Resource.RESOURCE_TYPES.includes(String(query.resourceType))) {
    filters.resourceType = String(query.resourceType);
  }

  ['courseId', 'departmentId', 'programId', 'schoolId', 'uploadedBy'].forEach((key) => {
    const value = query[key];
    if (value && mongoose.Types.ObjectId.isValid(value)) {
      filters[key] = value;
    }
  });

  if (query.search) {
    const search = String(query.search).trim();
    if (search) {
      filters.$text = { $search: search };
    }
  }

  if (query.dateRange === 'recent') {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    filters.createdAt = { $gte: sevenDaysAgo };
  } else if (query.dateRange === 'month') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    filters.createdAt = { $gte: thirtyDaysAgo };
  }

  return filters;
};

const buildSort = (sortKey = 'latest', hasTextSearch = false) => {
  if (sortKey === 'relevant' && !hasTextSearch) {
    return SORT_MAP.latest;
  }
  return SORT_MAP[sortKey] || SORT_MAP.latest;
};

const listResources = async (query = {}) => {
  const filters = buildResourceFilters(query);
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 48);
  const sort = buildSort(query.sort, Boolean(filters.$text));

  let cursor = Resource.find(filters)
    .populate('uploadedBy', 'name role adminTier')
    .populate('courseId', 'name code')
    .sort(sort);

  if (filters.$text) {
    cursor = cursor.select({ score: { $meta: 'textScore' } });
  }

  const [items, total] = await Promise.all([
    cursor.skip((page - 1) * limit).limit(limit).lean(),
    Resource.countDocuments(filters),
  ]);

  return {
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total,
  };
};

const getFilterMeta = async () => {
  const [courses, departments, programs, schools] = await Promise.all([
    Course.find({ isActive: true })
      .sort({ name: 1 })
      .select('name code program department')
      .populate({
        path: 'program',
        select: 'name code department',
        populate: {
          path: 'department',
          select: 'name code college',
          populate: { path: 'college', select: 'name code' },
        },
      })
      .populate('department', 'name code college')
      .lean(),
    Department.find({ isActive: true }).sort({ name: 1 }).select('name code college').lean(),
    Program.find({ isActive: true }).sort({ name: 1 }).select('name code department').lean(),
    College.find({ isActive: true }).sort({ name: 1 }).select('name code').lean(),
  ]);

  return {
    resourceTypes: Resource.RESOURCE_TYPES.map((key) => ({ key, label: RESOURCE_TYPE_LABELS[key] || key })),
    courses: courses.map((course) => ({
      _id: course._id,
      name: course.name,
      code: course.code,
      programId: course.program?._id || course.program,
      programName: course.program?.name || '',
      departmentId: course.program?.department?._id || course.department,
      departmentName: course.program?.department?.name || '',
      schoolId: course.program?.department?.college?._id || '',
      schoolName: course.program?.department?.college?.name || '',
    })),
    departments,
    programs,
    schools,
    sortOptions: [
      { key: 'latest', label: 'Latest' },
      { key: 'oldest', label: 'Oldest' },
      { key: 'downloads', label: 'Most downloaded' },
      { key: 'relevant', label: 'Most relevant' },
    ],
    dateOptions: [
      { key: 'all', label: 'Any time' },
      { key: 'recent', label: 'Last 7 days' },
      { key: 'month', label: 'Last 30 days' },
    ],
  };
};

const incrementDownloadCount = async (resourceId) => {
  if (!mongoose.Types.ObjectId.isValid(resourceId)) return null;
  return Resource.findByIdAndUpdate(resourceId, { $inc: { downloadCount: 1 } }, { new: true }).lean();
};

const getResourceById = async (resourceId) => {
  if (!mongoose.Types.ObjectId.isValid(resourceId)) {
    const error = new Error('Invalid resource');
    error.statusCode = 400;
    throw error;
  }

  const resource = await Resource.findById(resourceId)
    .populate('uploadedBy', 'name role adminTier')
    .populate('courseId', 'name code')
    .lean();

  if (!resource) {
    const error = new Error('Resource not found');
    error.statusCode = 404;
    throw error;
  }

  return resource;
};

const canManageResource = (resource, user) => {
  const role = normalizeRole(user?.role);
  if (role === 'admin' || user?.adminTier === 'super_admin') return true;
  return String(resource.uploadedBy?._id || resource.uploadedBy) === String(user?._id || user?.id);
};

module.exports = {
  RESOURCE_TYPE_LABELS,
  buildMetadataFromCourse,
  buildResourcePayload,
  buildResourceFilters,
  listResources,
  getFilterMeta,
  incrementDownloadCount,
  getResourceById,
  canManageResource,
};
