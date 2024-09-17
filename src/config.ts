import path from 'path';
import dotenv from 'dotenv';

dotenv.config({path: path.resolve(__dirname, '../.env')});

export const SCOPES = ['https://www.googleapis.com/auth/drive'];
export const TOKEN_PATH = path.join(process.cwd(), 'data', 'driveToken.json');
export const CREDENTIALS_PATH = path.join(process.cwd(), 'data', 'driveCredentials.json');
export const DATABASE_PATH = path.join(process.cwd(), 'data', 'folderDatabase.sqlite');
export const FOLDER_IDS = process.env.DRIVE_FOLDER_IDS?.split(',') || [];
