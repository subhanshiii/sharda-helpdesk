/**
 * Soft-delete plugin for Mongoose models.
 *
 * Adds `isDeleted` (Boolean) and `deletedAt` (Date) fields, and provides:
 *   - instance.softDelete()   — marks as deleted
 *   - instance.restore()      — restores a soft-deleted document
 *   - Model.findNotDeleted()  — queries only non-deleted documents
 *
 * Also applies a default query filter to find/findOne/count/countDocuments
 * so that soft-deleted records are automatically excluded unless explicitly
 * queried with { isDeleted: true }.
 *
 * Usage:
 *   const softDeletePlugin = require('../utils/softDeletePlugin');
 *   schema.plugin(softDeletePlugin);
 */

function softDeletePlugin(schema) {
  schema.add({
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  });

  // Instance methods
  schema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
  };

  schema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = null;
    return this.save();
  };

  // Static helpers
  schema.statics.findNotDeleted = function (conditions = {}) {
    return this.find({ ...conditions, isDeleted: { $ne: true } });
  };

  schema.statics.findOneNotDeleted = function (conditions = {}) {
    return this.findOne({ ...conditions, isDeleted: { $ne: true } });
  };

  schema.statics.softDeleteById = async function (id) {
    return this.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    }, { new: true });
  };

  schema.statics.restoreById = async function (id) {
    return this.findByIdAndUpdate(id, {
      isDeleted: false,
      deletedAt: null,
    }, { new: true });
  };

  // Pre-query middleware — automatically exclude soft-deleted documents
  // from standard queries unless `isDeleted` is explicitly part of the filter.
  const autoExcludeDeleted = function () {
    const filter = this.getFilter();
    if (filter.isDeleted === undefined && filter.$or === undefined) {
      this.where({ isDeleted: { $ne: true } });
    }
  };

  schema.pre('find', autoExcludeDeleted);
  schema.pre('findOne', autoExcludeDeleted);
  schema.pre('countDocuments', autoExcludeDeleted);
  schema.pre('findOneAndUpdate', autoExcludeDeleted);
}

module.exports = softDeletePlugin;
