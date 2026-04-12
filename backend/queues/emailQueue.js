const Bull = require('bull');
const {
  sendPasswordResetEmail,
  sendTicketCreatedEmail,
  sendEmailVerificationEmail,
  sendTicketUpdatedEmail,
  sendTicketAssignedEmail,
} = require('../utils/emailService');

// Bull stores jobs in Redis; workers send mail via SMTP (emailService).
const emailQueue = new Bull('email-queue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

const JOB_TYPES = {
  PASSWORD_RESET: 'password_reset',
  EMAIL_VERIFICATION: 'email_verification',
  TICKET_CREATED: 'ticket_created',
  TICKET_UPDATED: 'ticket_updated',
  TICKET_ASSIGNED: 'ticket_assigned',
};

emailQueue.process(JOB_TYPES.PASSWORD_RESET, async (job) => {
  const result = await sendPasswordResetEmail(job.data);
  if (!result.success) throw new Error(`Email failed: ${result.error}`);
  return result;
});

emailQueue.process(JOB_TYPES.EMAIL_VERIFICATION, async (job) => {
  const result = await sendEmailVerificationEmail(job.data);
  if (!result.success) throw new Error(`Email failed: ${result.error}`);
  return result;
});

emailQueue.process(JOB_TYPES.TICKET_CREATED, async (job) => {
  const result = await sendTicketCreatedEmail(job.data);
  if (!result.success) throw new Error(`Email failed: ${result.error}`);
  return result;
});

emailQueue.process(JOB_TYPES.TICKET_UPDATED, async (job) => {
  const result = await sendTicketUpdatedEmail(job.data);
  if (!result.success) throw new Error(`Email failed: ${result.error}`);
  return result;
});

emailQueue.process(JOB_TYPES.TICKET_ASSIGNED, async (job) => {
  const result = await sendTicketAssignedEmail(job.data);
  if (!result.success) throw new Error(`Email failed: ${result.error}`);
  return result;
});

emailQueue.on('failed', (job, err) => {
  console.error(`❌ Email job ${job.id} (${job.name}) failed: ${err.message}`);
});

const queuePasswordResetEmail = async (data) => {
  try {
    return await emailQueue.add(JOB_TYPES.PASSWORD_RESET, data, { priority: 1 });
  } catch (error) {
    return sendPasswordResetEmail(data);
  }
};

const queueEmailVerificationEmail = async (data) => {
  try {
    return await emailQueue.add(JOB_TYPES.EMAIL_VERIFICATION, data, { priority: 1 });
  } catch (error) {
    return sendEmailVerificationEmail(data);
  }
};

const queueTicketCreatedEmail = async (data) => {
  try {
    return await emailQueue.add(JOB_TYPES.TICKET_CREATED, data, {
      priority: 2,
      delay: 1000,
    });
  } catch (error) {
    return sendTicketCreatedEmail(data);
  }
};

const queueTicketUpdatedEmail = async (data) => {
  try {
    return await emailQueue.add(JOB_TYPES.TICKET_UPDATED, data, { priority: 3 });
  } catch (error) {
    return sendTicketUpdatedEmail(data);
  }
};

const queueTicketAssignedEmail = async (data) => {
  try {
    return await emailQueue.add(JOB_TYPES.TICKET_ASSIGNED, data, { priority: 2 });
  } catch (error) {
    return sendTicketAssignedEmail(data);
  }
};

const getQueueStats = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
};

module.exports = {
  emailQueue,
  queuePasswordResetEmail,
  queueEmailVerificationEmail,
  queueTicketCreatedEmail,
  queueTicketUpdatedEmail,
  queueTicketAssignedEmail,
  getQueueStats,
  JOB_TYPES,
};
