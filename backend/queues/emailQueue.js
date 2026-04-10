const Bull  = require('bull');
const { sendPasswordResetEmail, sendTicketCreatedEmail, sendEmailVerificationEmail } = require('../utils/emailService');

// ── Create Bull queue ──────────────────────────────────
// Bull uses Redis as its backing store for job persistence
// If app crashes, jobs survive and are retried when app restarts
const emailQueue = new Bull('email-queue', {
  redis: {
    host:     process.env.REDIS_HOST || 'localhost',
    port:     parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    attempts:       3,           // Retry up to 3 times on failure
    backoff: {
      type:  'exponential',      // Wait 2s, 4s, 8s between retries
      delay: 2000,
    },
    removeOnComplete: 50,        // Keep last 50 completed jobs for debugging
    removeOnFail:     100,       // Keep last 100 failed jobs for inspection
  },
});

// ── Job types ──────────────────────────────────────────
const JOB_TYPES = {
  PASSWORD_RESET:   'password_reset',
  EMAIL_VERIFICATION: 'email_verification',
  TICKET_CREATED:   'ticket_created',
  TICKET_UPDATED:   'ticket_updated',
  TICKET_ASSIGNED:  'ticket_assigned',
};

// ── Process jobs ───────────────────────────────────────
// This runs in background — doesn't block HTTP responses
emailQueue.process(JOB_TYPES.PASSWORD_RESET, async (job) => {
  console.log(`📧 Processing password reset email for: ${job.data.toEmail}`);
  const result = await sendPasswordResetEmail(job.data);
  if (!result.success) throw new Error(`Email failed: ${result.error}`);
  return result;
});

emailQueue.process(JOB_TYPES.EMAIL_VERIFICATION, async (job) => {
  console.log(`📧 Processing email verification for: ${job.data.toEmail}`);
  const result = await sendEmailVerificationEmail(job.data);
  if (!result.success) throw new Error(`Email failed: ${result.error}`);
  return result;
});

emailQueue.process(JOB_TYPES.TICKET_CREATED, async (job) => {
  console.log(`📧 Processing ticket created email for: ${job.data.toEmail}`);
  const result = await sendTicketCreatedEmail(job.data);
  if (!result.success) throw new Error(`Email failed: ${result.error}`);
  return result;
});

emailQueue.process(JOB_TYPES.TICKET_UPDATED, async (job) => {
  console.log(`📧 Processing ticket updated email for: ${job.data.toEmail}`);
  // Add sendTicketUpdatedEmail when you build it
  return { success: true };
});

emailQueue.process(JOB_TYPES.TICKET_ASSIGNED, async (job) => {
  console.log(`📧 Processing ticket assigned email for: ${job.data.toEmail}`);
  return { success: true };
});

// ── Event listeners for monitoring ────────────────────
emailQueue.on('completed', (job) => {
  console.log(`✅ Email job ${job.id} (${job.name}) completed`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`❌ Email job ${job.id} (${job.name}) failed: ${err.message}`);
  console.error(`   Attempt ${job.attemptsMade} of ${job.opts.attempts}`);
});

emailQueue.on('stalled', (job) => {
  console.warn(`⚠️  Email job ${job.id} stalled — will retry`);
});

// ── Queue helper functions ─────────────────────────────

/**
 * Add password reset email to queue
 * Returns immediately — email sends in background
 */
const queuePasswordResetEmail = async (data) => {
  try {
    const job = await emailQueue.add(JOB_TYPES.PASSWORD_RESET, data, {
      priority: 1, // High priority — user is waiting for this
    });
    console.log(`📬 Password reset email queued — job id: ${job.id}`);
    return job;
  } catch (error) {
    // FIXED: fall back to direct send when Redis/Bull is unavailable so auth email flows still work.
    return sendPasswordResetEmail(data);
  }
};

const queueEmailVerificationEmail = async (data) => {
  try {
    const job = await emailQueue.add(JOB_TYPES.EMAIL_VERIFICATION, data, {
      priority: 1,
    });
    return job;
  } catch (error) {
    // FIXED: send verification email immediately if queueing fails so signup verification is not blocked.
    return sendEmailVerificationEmail(data);
  }
};

/**
 * Add ticket creation notification to queue
 */
const queueTicketCreatedEmail = async (data) => {
  try {
    const job = await emailQueue.add(JOB_TYPES.TICKET_CREATED, data, {
      priority: 2,
      delay:    1000, // Small delay — don't spam if user creates multiple tickets
    });
    console.log(`📬 Ticket created email queued — job id: ${job.id}`);
    return job;
  } catch (error) {
    // FIXED: avoid silently dropping ticket emails when the queue backend is down.
    return sendTicketCreatedEmail(data);
  }
};

/**
 * Add ticket update notification to queue
 */
const queueTicketUpdatedEmail = async (data) => {
  const job = await emailQueue.add(JOB_TYPES.TICKET_UPDATED, data, {
    priority: 3,
  });
  return job;
};

/**
 * Add ticket assigned notification to queue
 */
const queueTicketAssignedEmail = async (data) => {
  const job = await emailQueue.add(JOB_TYPES.TICKET_ASSIGNED, data, {
    priority: 2,
  });
  return job;
};

/**
 * Get queue stats — for monitoring dashboard
 */
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
