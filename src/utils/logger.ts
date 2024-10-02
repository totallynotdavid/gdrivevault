import path from 'path';
import fs from 'fs';
import {createLogger, format, transports} from 'winston';

export class Logger {
    private loggerInstance!: ReturnType<typeof createLogger>;
    private logsPath: string;

    constructor() {
        this.logsPath = path.join(process.cwd(), 'logs');
        this.initializeLogger();
    }

    setLogsPath(logsPath: string) {
        this.logsPath = logsPath;
        this.initializeLogger();
    }

    private initializeLogger() {
        if (!fs.existsSync(this.logsPath)) {
            fs.mkdirSync(this.logsPath, {recursive: true});
        }

        this.loggerInstance = createLogger({
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
                new transports.File({
                    filename: path.join(this.logsPath, 'error.log'),
                    level: 'error',
                }),
                new transports.File({
                    filename: path.join(this.logsPath, 'combined.log'),
                }),
            ],
        });

        if (process.env.NODE_ENV !== 'production') {
            this.loggerInstance.add(
                new transports.Console({
                    format: format.combine(format.colorize(), format.simple()),
                })
            );
        }
    }

    info(message: string, ...meta: unknown[]) {
        this.loggerInstance.info(message, ...meta);
    }

    warn(message: string, ...meta: unknown[]) {
        this.loggerInstance.warn(message, ...meta);
    }

    error(message: string, ...meta: unknown[]) {
        this.loggerInstance.error(message, ...meta);
    }
}

export const logger = new Logger();
