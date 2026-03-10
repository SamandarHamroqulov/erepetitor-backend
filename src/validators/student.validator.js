const Joi = require("joi");

module.exports = (req, res, next) => {
  const schema = Joi.object({
    groupId: Joi.number().integer().positive().required(),
    name: Joi.string().min(2).max(60).required(),
    parentPhone: Joi.string().pattern(/^\+998\d{9}$/).optional().allow("", null),
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  req.body = value;
  next();
};