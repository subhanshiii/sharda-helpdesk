const Group = require('../models/Group');

const buildAudienceSignature = (rules = {}) => {
  const roleSignature = [...(rules.roles || [])].sort().join('|') || 'all-roles';
  const departmentSignature = [...(rules.departmentIds || [])].map(String).sort().join('|') || 'all-departments';
  const sectionSignature = [...(rules.sectionIds || [])].map(String).sort().join('|') || 'all-sections';
  return `${roleSignature}::${departmentSignature}::${sectionSignature}`;
};

const migrateGroupChatIndexes = async (logger = console) => {
  try {
    const groups = await Group.find({}, '_id selectionRules audienceSignature');
    for (const group of groups) {
      const nextSignature = buildAudienceSignature(group.selectionRules || {});
      if (group.audienceSignature !== nextSignature) {
        group.audienceSignature = nextSignature;
        await group.save();
      }
    }

    const indexes = await Group.collection.indexes();
    const desiredKey = { name: 1, createdBy: 1, audienceSignature: 1, isActive: 1 };

    for (const index of indexes) {
      if (index.name === '_id_') continue;

      const indexKeys = Object.keys(index.key || {});
      const isInvalidParallelAudienceIndex =
        indexKeys.includes('selectionRules.roles') &&
        indexKeys.includes('selectionRules.departmentIds');

      if (isInvalidParallelAudienceIndex) {
        await Group.collection.dropIndex(index.name);
        logger.info(`Dropped invalid parallel-array group index: ${index.name}`);
        continue;
      }

      if (!index.unique) continue;
      const isNameBasedIndex = indexKeys.includes('name');
      const matchesDesiredIndex = JSON.stringify(index.key || {}) === JSON.stringify(desiredKey);

      if (isNameBasedIndex && !matchesDesiredIndex) {
        await Group.collection.dropIndex(index.name);
        logger.info(`Dropped legacy group uniqueness index: ${index.name}`);
      }
    }

    await Group.collection.createIndex(
      desiredKey,
      { unique: true, partialFilterExpression: { isActive: true } }
    );
    logger.info('Ensured group audience uniqueness index');
  } catch (error) {
    logger.warn(`Group chat index migration skipped: ${error.message}`);
  }
};

module.exports = {
  migrateGroupChatIndexes,
};
