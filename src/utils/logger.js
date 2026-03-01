import winston from 'winston';

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

// Fields to redact for PII protection
const REDACT_FIELDS = [
    'email', 'password', 'passwordHash', 'phone', 'address',
    'userId', 'id', 'token', 'access_token', 'refresh_token',
    'salary', 'performanceScore', 'riskLevel', 'interviewCode'
];

/**
 * Recursively redacts sensitive fields from objects.
 */
const redactPII = (val) => {
    if (!val || typeof val !== 'object') return val;

    if (Array.isArray(val)) {
        return val.map(redactPII);
    }

    const redacted = { ...val };
    Object.keys(redacted).forEach(key => {
        if (REDACT_FIELDS.includes(key)) {
            redacted[key] = '[REDACTED]';
        } else if (typeof redacted[key] === 'object') {
            redacted[key] = redactPII(redacted[key]);
        }
    });

    return redacted;
};

// Custom format for PII scrubbing
const piiScrub = winston.format((info) => {
    const { ...rest } = info;

    // Scrub PII from metadata
    Object.keys(rest).forEach(key => {
        if (typeof rest[key] === 'object') {
            rest[key] = redactPII(rest[key]);
        } else if (REDACT_FIELDS.includes(key)) {
            rest[key] = '[REDACTED]';
        }
    });

    // Also attempt to scrub PII from the message if it's an object/captured data
    if (typeof info.message === 'object') {
        info.message = redactPII(info.message);
    }

    return info;
});

// Human-readable dev format
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${stack || message} ${metaStr}`;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        piiScrub(),
        process.env.NODE_ENV === 'production' ? json() : combine(colorize(), devFormat)
    ),
    transports: [
        new winston.transports.Console()
    ]
});

export default logger;
