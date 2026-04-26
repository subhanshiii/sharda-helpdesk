const Content = require('../models/Content');
const Announcement = require('../models/Announcement');
const AcademicCalendar = require('../models/AcademicCalendar');
const { isAdminRole } = require('../utils/roleHelpers');
const {
  buildAudienceVisibilityQuery,
  buildTargetAudiencePayload,
  parseVisibilityValues,
} = require('../utils/visibility');

let syncPromise = null;
let syncComplete = false;

const NOTICE_TYPE_BY_PRIORITY = {
  high: 'urgent',
  medium: 'warning',
  low: 'info',
};

const CALENDAR_PRIORITY_BY_TYPE = {
  Exam: 'high',
  Deadline: 'high',
  Registration: 'high',
  Result: 'medium',
  Event: 'medium',
  Holiday: 'low',
  Other: 'low',
};

const serializeAttachments = (files = []) => files.map((file) => ({
  fileName: file.originalname,
  fileUrl: `/api/files/general/${file.filename}`,
  fileType: file.mimetype,
  size: file.size,
}));

const toContentResponse = (document) => {
  const item = document.toObject ? document.toObject() : document;
  return {
    ...item,
    postedBy: item.createdBy,
    date: item.startsAt,
    endDate: item.endsAt,
    message: item.description,
    feedType: item.contentType === 'calendar' ? 'calendar' : 'notice',
    href: item.contentType === 'calendar' ? '/academic-calendar/manage' : '/notice-board',
  };
};

const mapLegacyAnnouncement = (announcement) => ({
  title: announcement.title,
  description: announcement.description || announcement.message,
  contentType: 'notice',
  category: announcement.category || 'academic',
  type: announcement.type || NOTICE_TYPE_BY_PRIORITY[announcement.priority] || 'info',
  priority: announcement.priority || 'medium',
  targetAudience: announcement.targetAudience || {},
  attachments: announcement.attachments || [],
  publishAt: announcement.createdAt,
  expiresAt: announcement.expiresAt || null,
  status: announcement.isActive === false ? 'archived' : 'published',
  createdBy: announcement.postedBy,
  source: {
    legacyModel: 'Announcement',
    legacyId: String(announcement._id),
  },
});

const mapLegacyCalendar = (event) => ({
  title: event.title,
  description: event.description || '',
  contentType: 'calendar',
  category: 'academic',
  type: event.type || 'Other',
  priority: CALENDAR_PRIORITY_BY_TYPE[event.type] || 'medium',
  targetAudience: event.targetAudience || {},
  startsAt: event.date,
  endsAt: event.endDate || null,
  publishAt: event.createdAt,
  status: 'published',
  createdBy: event.postedBy,
  source: {
    legacyModel: 'AcademicCalendar',
    legacyId: String(event._id),
  },
});

const ensureLegacyContentSynced = async () => {
  if (syncComplete) return;
  if (syncPromise) {
    await syncPromise;
    return;
  }

  syncPromise = (async () => {
    const [announcements, calendarEvents] = await Promise.all([
      Announcement.find().lean(),
      AcademicCalendar.find().lean(),
    ]);

    const operations = [
      ...announcements.map((announcement) => ({
        updateOne: {
          filter: {
            'source.legacyModel': 'Announcement',
            'source.legacyId': String(announcement._id),
          },
          update: {
            $setOnInsert: mapLegacyAnnouncement(announcement),
          },
          upsert: true,
          timestamps: false,
        },
      })),
      ...calendarEvents.map((event) => ({
        updateOne: {
          filter: {
            'source.legacyModel': 'AcademicCalendar',
            'source.legacyId': String(event._id),
          },
          update: {
            $setOnInsert: mapLegacyCalendar(event),
          },
          upsert: true,
          timestamps: false,
        },
      })),
    ];

    if (operations.length > 0) {
      await Content.bulkWrite(operations, { ordered: false });
    }

    syncComplete = true;
  })();

  try {
    await syncPromise;
  } finally {
    syncPromise = null;
  }
};

const buildContentQuery = async ({ user, view = 'feed', contentType, category, priority, type, search, month, limit, upcomingOnly }) => {
  const query = {
    status: 'published',
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  };

  if (view === 'calendar') {
    query.contentType = 'calendar';
  } else if (contentType) {
    query.contentType = contentType;
  } else {
    query.contentType = 'notice';
    query.category = {
      ...(query.category && query.category !== 'all' ? { $eq: query.category } : {}),
      $nin: ['event', 'opportunity'],
    };
  }

  if (category && category !== 'all') query.category = category;
  if (priority && priority !== 'all') query.priority = priority;
  if (type && type !== 'all') query.type = type;

  if (search) {
    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { type: { $regex: search, $options: 'i' } },
        ],
      },
    ];
  }

  if (month) {
    const [year, monthIndex] = String(month).split('-').map(Number);
    if (year && monthIndex) {
      const start = new Date(year, monthIndex - 1, 1);
      const end = new Date(year, monthIndex, 1);
      query.startsAt = {
        ...(query.startsAt || {}),
        $gte: start,
        $lt: end,
      };
    }
  }

  if (upcomingOnly) {
    query.startsAt = {
      ...(query.startsAt || {}),
      $gte: new Date(),
    };
  }

  const audienceQuery = await buildAudienceVisibilityQuery(user);
  if (audienceQuery) {
    query.$and = [...(query.$and || []), audienceQuery];
  }

  return { query, limit: limit ? parseInt(limit, 10) : null };
};

const sortContent = (items, view) => {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  return [...items].sort((a, b) => {
    if (view === 'calendar') {
      return new Date(a.startsAt || a.publishAt || a.createdAt) - new Date(b.startsAt || b.publishAt || b.createdAt);
    }

    const rankDiff = (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.publishAt || b.createdAt) - new Date(a.publishAt || a.createdAt);
  });
};

const listContent = async ({ user, view, contentType, category, priority, type, search, month, limit, upcomingOnly }) => {
  await ensureLegacyContentSynced();
  const { query, limit: parsedLimit } = await buildContentQuery({
    user,
    view,
    contentType,
    category,
    priority,
    type,
    search,
    month,
    limit,
    upcomingOnly,
  });

  let cursor = Content.find(query).populate('createdBy', 'name role department year section');
  if (view === 'calendar') {
    cursor = cursor.sort({ startsAt: 1, createdAt: -1 });
  } else {
    cursor = cursor.sort({ publishAt: -1, createdAt: -1 });
  }

  if (parsedLimit) cursor = cursor.limit(parsedLimit);

  const contentItems = (await cursor).map(toContentResponse);
  return sortContent(contentItems, view);
};

const createContent = async ({ body, files, userId }) => {
  await ensureLegacyContentSynced();

  const contentType = body.contentType === 'calendar' ? 'calendar' : 'notice';
  if (contentType === 'notice' && !(body.description || body.message || '').trim()) {
    const error = new Error('Description is required');
    error.statusCode = 400;
    throw error;
  }
  const priority = body.priority || (contentType === 'calendar' ? (CALENDAR_PRIORITY_BY_TYPE[body.type] || 'medium') : 'medium');
  const document = await Content.create({
    title: body.title,
    description: body.description || body.message,
    contentType,
    category: body.category || (contentType === 'calendar' ? 'academic' : 'academic'),
    type: body.type || (contentType === 'calendar' ? 'Other' : NOTICE_TYPE_BY_PRIORITY[priority] || 'info'),
    priority,
    targetAudience: buildTargetAudiencePayload(body),
    attachments: serializeAttachments(files),
    startsAt: contentType === 'calendar' ? body.startsAt || body.date : body.startsAt || null,
    endsAt: contentType === 'calendar' ? body.endsAt || body.endDate || null : body.endsAt || null,
    publishAt: body.publishAt || Date.now(),
    expiresAt: body.expiresAt || null,
    createdBy: userId,
    source: undefined,
  });

  await document.populate('createdBy', 'name role department year section');
  return toContentResponse(document);
};

const updateContent = async ({ contentId, body, files, requesterId, requesterRole }) => {
  await ensureLegacyContentSynced();
  const document = await Content.findById(contentId);
  if (!document) {
    const error = new Error('Content not found');
    error.statusCode = 404;
    throw error;
  }

  if (!isAdminRole(requesterRole) && document.createdBy.toString() !== requesterId) {
    const error = new Error('Not authorized');
    error.statusCode = 403;
    throw error;
  }

  if (body.title !== undefined) document.title = body.title;
  if (body.description !== undefined || body.message !== undefined) document.description = body.description || body.message;
  if (body.category !== undefined) document.category = body.category;
  if (body.type !== undefined) document.type = body.type;
  if (body.priority !== undefined) document.priority = body.priority;
  if (body.expiresAt !== undefined) document.expiresAt = body.expiresAt || null;
  if (body.startsAt !== undefined || body.date !== undefined) document.startsAt = body.startsAt || body.date || null;
  if (body.endsAt !== undefined || body.endDate !== undefined) document.endsAt = body.endsAt || body.endDate || null;
  if (body.contentType !== undefined) document.contentType = body.contentType;
  if (body.publishAt !== undefined) document.publishAt = body.publishAt || document.publishAt;
  if (
    body.audienceTiers !== undefined ||
    body.audienceRoles !== undefined ||
    body.audienceCollegeId !== undefined ||
    body.audienceDepartmentId !== undefined ||
    body.audienceProgramId !== undefined ||
    body.audienceCourseId !== undefined ||
    body.audienceStudyYear !== undefined ||
    body.audienceSectionId !== undefined ||
    body.audienceDepartments !== undefined ||
    body.audienceYears !== undefined ||
    body.audienceSections !== undefined
  ) {
    document.targetAudience = buildTargetAudiencePayload(body);
  }
  if (files?.length) document.attachments = serializeAttachments(files);

  await document.save();
  await document.populate('createdBy', 'name role department year section');
  return toContentResponse(document);
};

const deleteContent = async ({ contentId, requesterId, requesterRole }) => {
  await ensureLegacyContentSynced();
  const document = await Content.findById(contentId);
  if (!document) {
    const error = new Error('Content not found');
    error.statusCode = 404;
    throw error;
  }

  if (!isAdminRole(requesterRole) && document.createdBy.toString() !== requesterId) {
    const error = new Error('Not authorized');
    error.statusCode = 403;
    throw error;
  }

  await document.deleteOne();
};

module.exports = {
  listContent,
  createContent,
  updateContent,
  deleteContent,
};
