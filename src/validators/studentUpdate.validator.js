const Joi = require("joi");

module.exports = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(60).optional(),
    parentPhone: Joi.string().pattern(/^\+998\d{9}$/).optional().allow("", null),
    isActive: Joi.boolean().optional(),
    paymentStartDate: Joi.date().iso().optional().allow(null),
    customMonthlyFee: Joi.number().positive().optional().allow(null),
  }).min(1);

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  req.body = value;
  next();
};