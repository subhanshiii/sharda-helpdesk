const crud = require('./academicCrudController');

exports.list = (req, res, next) => { req.resourceName = 'departments'; return crud.list(req, res, next); };
exports.create = (req, res, next) => { req.resourceName = 'departments'; return crud.create(req, res, next); };
exports.update = (req, res, next) => { req.resourceName = 'departments'; return crud.update(req, res, next); };
exports.remove = (req, res, next) => { req.resourceName = 'departments'; return crud.remove(req, res, next); };
