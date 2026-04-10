const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    systemId: {
      type: String,
      required: [true, 'Please provide a system ID'],
      unique: true,
      immutable: true,
      index: true,
      match: [/^\d{10}$/, 'systemId must match YYYY followed by 6 digits'],
    },
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      // Keep "agent" as a legacy alias so older records remain valid during migration.
      enum: ['student', 'faculty', 'staff', 'admin', 'agent'],
      default: 'student',
      index: true,
    },
    adminTier: {
      type: String,
      enum: ['super_admin', 'admin'],
      default: null,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    passwordNeedsSetup: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    department: {
      type: String,
      trim: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    year: {
      type: String,
      trim: true,
    },
    section: {
      type: String,
      trim: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      default: null,
      index: true,
    },
    enrollmentId: {
      type: String,
      trim: true,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
    avatarChoice: {
      type: String,
      default: null,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match entered password to hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
userSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

module.exports = mongoose.model('User', userSchema);
