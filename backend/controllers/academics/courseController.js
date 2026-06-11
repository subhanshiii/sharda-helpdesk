const crud = require('./academicCrudController');

exports.list = (req, res, next) => { req.resourceName = 'courses'; return crud.list(req, res, next); };
exports.create = (req, res, next) => { req.resourceName = 'courses'; return crud.create(req, res, next); };
exports.update = (req, res, next) => { req.resourceName = 'courses'; return crud.update(req, res, next); };
exports.remove = (req, res, next) => { req.resourceName = 'courses'; return crud.remove(req, res, next); };
