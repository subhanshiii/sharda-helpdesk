const crud = require('./academicCrudController');

exports.list = (req, res, next) => { req.resourceName = 'academic-sessions'; return crud.list(req, res, next); };
exports.create = (req, res, next) => { req.resourceName = 'academic-sessions'; return crud.create(req, res, next); };
exports.update = (req, res, next) => { req.resourceName = 'academic-sessions'; return crud.update(req, res, next); };
exports.remove = (req, res, next) => { req.resourceName = 'academic-sessions'; return crud.remove(req, res, next); };
exports.rolloverSession = (req, res, next) => { return crud.rolloverSession(req, res, next); };
