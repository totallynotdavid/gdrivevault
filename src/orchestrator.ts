import {logger} from './utils/logger';
import {authorize, AuthClientConfig} from './auth/client';
import {GoogleDriveService} from './services/google-drive';
import {FolderDatabase, DatabaseFile} from './database/database';
import path from 'path';
import fs from 'fs';

export interface DriveFileManagerConfig extends AuthClientConfig {
    folderId: string;
}

export class DriveFileManager {
    private googleDriveService!: GoogleDriveService;
    private folderDatabase!: FolderDatabase;
    private config: DriveFileManagerConfig;

    constructor(config: DriveFileManagerConfig) {
        this.config = config;
    }

    /**
     * Initializes the orchestrator by authorizing and setting up services and database.
     */
    async init(): Promise<void> {
        try {
            logger.info('Initializing orchestrator...');

            const authClient = await authorize({
                tokenPath: this.config.tokenPath,
                credentialsPath: this.config.credentialsPath,
            });
            this.googleDriveService = new GoogleDriveService(authClient);

            const databasePath = this.getDatabasePath(this.config.folderId);
            this.folderDatabase = new FolderDatabase(
                this.googleDriveService,
                this.config.folderId,
                databasePath
            );
            await this.folderDatabase.initDatabase();

            await this.folderDatabase.refresh();

            logger.info('orchestrator initialized successfully.');
        } catch (err) {
            logger.error('Failed to initialize orchestrator:', err);
            throw err;
        }
    }

    /**
     * Searches for files in the database based on a query string.
     * @param query The search query.
     * @returns An array of DatabaseFile objects matching the query.
     */
    async searchFiles(query: string): Promise<DatabaseFile[]> {
        return await this.folderDatabase.search(query);
    }

    /**
     * Downloads a file from Google Drive given its webViewLink.
     * @param fileLink The webViewLink of the file.
     * @returns The local file path where the file was downloaded.
     */
    async downloadFile(fileLink: string): Promise<string> {
        const fileExists = await this.folderDatabase.fileExists(fileLink);
        if (!fileExists) {
            throw new Error('File not found in the database.');
        }
        return await this.googleDriveService.downloadFileFromGoogleDrive(fileLink);
    }

    /**
     * Refreshes the database by fetching the latest files from Google Drive.
     */
    async refreshDatabase(): Promise<void> {
        await this.folderDatabase.refresh();
    }

    /**
     * Generates a unique database path based on the folder ID.
     * @param folderId The Google Drive folder ID.
     * @returns The absolute path to the SQLite database file.
     */
    private getDatabasePath(folderId: string): string {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, {recursive: true});
        }
        return path.join(dataDir, `${folderId}_database.sqlite`);
    }
}
