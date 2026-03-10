const Joi = require("joi");

module.exports = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).required(),
    monthlyPrice: Joi.number().positive().required(),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  req.body = value;
  next();
};
