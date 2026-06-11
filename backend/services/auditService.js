const AuditLog = require('../models/AuditLog');

const logAuditEvent = async (payload = {}) => {
  try {
    await AuditLog.create({
      actor: payload.actor || null,
      actorRole: payload.actorRole || '',
      action: payload.action || 'unknown',
      resource: payload.resource || 'unknown',
      resourceId: payload.resourceId || null,
      description: payload.description || '',
      previousValue: payload.previousValue ?? null,
      nextValue: payload.nextValue ?? null,
      metadata: payload.metadata || {},
      ipAddress: payload.ipAddress || '',
      userAgent: payload.userAgent || '',
    });
  } catch (error) {
    console.warn('Audit log write failed:', error.message);
  }
};

module.exports = { logAuditEvent };
