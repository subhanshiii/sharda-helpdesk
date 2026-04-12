const Assignment = require('../models/Assignment');

const AUDIENCE_INDEX_FIELDS = [
  'targetAudience.departments',
  'targetAudience.years',
  'targetAudience.sections',
];

const migrateAssignmentIndexes = async () => {
  try {
    const indexes = await Assignment.collection.indexes();
    const legacyIndexes = indexes.filter((index) => {
      const keys = Object.keys(index.key || {});
      const audienceKeyCount = AUDIENCE_INDEX_FIELDS.filter((field) => keys.includes(field)).length;
      return audienceKeyCount > 1 || keys.some((field) => AUDIENCE_INDEX_FIELDS.includes(field));
    });

    for (const legacyIndex of legacyIndexes) {
      if (legacyIndex.name === '_id_') continue;
      await Assignment.collection.dropIndex(legacyIndex.name);
    }
  } catch (error) {
    if (!/index not found/i.test(error.message)) {
      throw error;
    }
  }
};

module.exports = { migrateAssignmentIndexes };
