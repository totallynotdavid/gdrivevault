import {createLogger, format, transports} from 'winston';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data', 'logs');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, {recursive: true});
}

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.errors({stack: true}),
        format.splat(),
        format.json()
    ),
    transports: [
        new transports.File({filename: path.join(dataDir, 'error.log'), level: 'error'}),
        new transports.File({filename: path.join(dataDir, 'combined.log')}),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new transports.Console({
            format: format.combine(format.colorize(), format.simple()),
        })
    );
}

export {logger};
