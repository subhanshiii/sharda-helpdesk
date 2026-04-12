/**
 * Authorization for files stored under backend/uploads (scope "general").
 * Every file must be referenced by at least one domain record the user may access.
 */

const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Event = require('../models/Event');
const Content = require('../models/Content');
const Announcement = require('../models/Announcement');
const ticketService = require('./ticketService');
const { getAssignmentById, getAssignmentAccess } = require('./assignmentService');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @throws Error with statusCode 403 or 404
 */
const assertGeneralUploadAccess = async (user, safeName) => {
  const ticketIds = await Ticket.find({
    $or: [
      { 'attachments.filename': safeName },
      { 'replies.attachments.filename': safeName },
    ],
  }).distinct('_id');

  if (ticketIds.length) {
    let allowed = false;
    for (const tid of ticketIds) {
      try {
        await ticketService.getTicketById(tid.toString(), user);
        allowed = true;
        break;
      } catch (e) {
        if (!e.statusCode || ![403, 404].includes(e.statusCode)) throw e;
      }
    }
    if (allowed) return;
    const err = new Error('Not authorized to access this file');
    err.statusCode = 403;
    throw err;
  }

  const profileRx = new RegExp(`${escapeRegex(safeName)}$`);
  if (await User.exists({ profileImage: profileRx })) return;

  const assignment = await Assignment.findOne({ 'attachments.filename': safeName }).select('_id');
  if (assignment) {
    await getAssignmentById(assignment._id.toString(), user);
    return;
  }

  const submission = await Submission.findOne({ 'attachments.filename': safeName }).select('assignment student');
  if (submission) {
    const uid = (user.id || user._id).toString();
    const { managesAssignment } = await getAssignmentAccess(submission.assignment, user);
    if (managesAssignment) return;
    if (submission.student.toString() === uid) return;
    const err = new Error('Not authorized to access this file');
    err.statusCode = 403;
    throw err;
  }

  if (await Event.exists({ 'poster.filename': safeName })) return;

  const urlRx = new RegExp(`${escapeRegex(safeName)}(?:\\?.*)?$`);
  if (await Content.exists({ 'attachments.fileUrl': { $regex: urlRx } })) return;
  if (await Announcement.exists({ 'attachments.fileUrl': { $regex: urlRx } })) return;

  const notFound = new Error('File not found');
  notFound.statusCode = 404;
  throw notFound;
};

module.exports = { assertGeneralUploadAccess };
