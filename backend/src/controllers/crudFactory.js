const catchAsync  = require('../utils/catchAsync');
const ApiError    = require('../utils/ApiError');

/**
 * Creates a standard set of CRUD controller functions for a given model.
 * All controllers follow the pattern { success, data } / { success, error }.
 *
 * @param {object} Model - any model with list/findById/create/update/remove
 * @param {string} name  - display name for error messages (e.g. "Department")
 */
function makeCrudControllers(Model, name) {
  const list = catchAsync(async (req, res) => {
    const result = await Model.list(req.query);
    res.json({ success: true, data: result });
  });

  const getById = catchAsync(async (req, res) => {
    const item = await Model.findById(req.params.id);
    if (!item) throw ApiError.notFound(`${name} not found`);
    res.json({ success: true, data: item });
  });

  const create = catchAsync(async (req, res) => {
    const item = await Model.create(req.body);
    res.status(201).json({ success: true, data: item });
  });

  const update = catchAsync(async (req, res) => {
    const existing = await Model.findById(req.params.id);
    if (!existing) throw ApiError.notFound(`${name} not found`);
    const item = await Model.update(req.params.id, req.body);
    res.json({ success: true, data: item });
  });

  const remove = catchAsync(async (req, res) => {
    const existing = await Model.findById(req.params.id);
    if (!existing) throw ApiError.notFound(`${name} not found`);
    await Model.remove(req.params.id);
    res.json({ success: true, data: { message: `${name} deleted successfully` } });
  });

  return { list, getById, create, update, remove };
}

module.exports = { makeCrudControllers };
