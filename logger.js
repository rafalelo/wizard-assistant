const { createLogger, format, transports } = require('winston');

const Logger = createLogger({
    level: 'info',
    format: format.combine(
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      format.errors({ stack: true }),
      format.splat(),
      format.json()
    ),
    //defaultMeta: { service: 'Garage Makezone logging service' },
    transports: [
      new transports.File({ filename: 'errors.log', level: 'error' }),
      new transports.File({ filename: 'traffic.log' })
    ]
});

module.exports = Logger