import winston from 'winston';
import {LOG_LEVEL} from '../config/config';

export class Logger {
    private static instance: winston.Logger;

    private constructor() {}

    static getLogger(): winston.Logger {
        if (!Logger.instance) {
            Logger.instance = winston.createLogger({
                level: LOG_LEVEL,
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.printf(
                        ({timestamp, level, message}) =>
                            `${timestamp} [${level.toUpperCase()}] ${message}`
                    )
                ),
                transports: [
                    new winston.transports.Console(),
                    new winston.transports.File({
                        filename: 'logs/error.log',
                        level: 'error',
                    }),
                    new winston.transports.File({filename: 'logs/combined.log'}),
                ],
            });
        }
        return Logger.instance;
    }
}
