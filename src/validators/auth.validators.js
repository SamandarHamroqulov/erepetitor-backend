const Joi = require("joi");

function registerTeacherValidator(req, res, next) {
  const schema = Joi.object({
    name: Joi.string().min(3).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  const { error, value } = schema.validate(req.body, { abortEarly: true });

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  req.body = value;
  next();
};

module.exports = {
  registerTeacherValidator
};