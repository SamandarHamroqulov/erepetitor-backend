const Joi = require("joi");

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

module.exports = {
  create(req, res, next) {
    const schema = Joi.object({
      weekday: Joi.string().valid(...WEEKDAYS).required(),
      startTime: Joi.string()
        .pattern(/^\d{2}:\d{2}$/)
        .required(), // "HH:MM"
      durationMin: Joi.number().integer().min(30).max(300).default(90),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    // extra: time bounds
    const [hh, mm] = value.startTime.split(":").map(Number);
    if (hh > 23 || mm > 59) return res.status(400).json({ message: "startTime noto'g'ri" });

    req.body = value;
    next();
  },

  patch(req, res, next) {
    const schema = Joi.object({
      weekday: Joi.string().valid(...WEEKDAYS).optional(),
      startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
      durationMin: Joi.number().integer().min(30).max(300).optional(),
      isActive: Joi.boolean().optional(),
    }).min(1);

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    if (value.startTime) {
      const [hh, mm] = value.startTime.split(":").map(Number);
      if (hh > 23 || mm > 59) return res.status(400).json({ message: "startTime noto'g'ri" });
    }

    req.body = value;
    next();
  },
};  