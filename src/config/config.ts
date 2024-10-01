import path from 'path';
import dotenv from 'dotenv';
import {cleanEnv, str} from 'envalid';

dotenv.config({path: path.resolve(__dirname, '../../.env')});

const env = cleanEnv(process.env, {
    DRIVE_FOLDER_IDS: str(),
    LOG_LEVEL: str({
        choices: ['error', 'warn', 'info', 'verbose', 'debug', 'silly'],
        default: 'info',
    }),
});

export const SCOPES = ['https://www.googleapis.com/auth/drive'];
export const TOKEN_PATH = path.join(process.cwd(), 'data', 'driveToken.json');
export const CREDENTIALS_PATH = path.join(process.cwd(), 'data', 'driveCredentials.json');
export const DATABASE_PATH = path.join(process.cwd(), 'data', 'folderDatabase.sqlite');
export const FOLDER_IDS = env.DRIVE_FOLDER_IDS.split(',').map(id => id.trim());
export const LOG_LEVEL = env.LOG_LEVEL;
