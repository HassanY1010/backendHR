import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
    logger.error('Unhandled Exception', {
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body
    });

    const status = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        error: {
            message,
            status,
            field: err.field,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        },
    });
};
