import {authorize} from '@/services/authorizer';
import {GoogleDriveService} from '@/services/google-drive';
import {FolderDatabase} from '@/services/local-db';
import {logger} from '@/utils/logger';
import {DriveFileManagerConfig, DatabaseFile} from '@/types';
import defaultConfig from '@/config';

export class DriveFileManager {
    private googleDriveService!: GoogleDriveService;
    private folderDatabase!: FolderDatabase;
    private config: Required<DriveFileManagerConfig>;

    constructor(config: DriveFileManagerConfig) {
        this.config = {
            ...defaultConfig,
            ...config,
            tokenPath: config.tokenPath || defaultConfig.tokenPath,
            credentialsPath: config.credentialsPath || defaultConfig.credentialsPath,
            databasePath: config.databasePath || defaultConfig.databasePath,
            downloadsPath: config.downloadsPath || defaultConfig.downloadsPath,
            logsPath: config.logsPath || defaultConfig.logsPath,
        };
        logger.setLogsPath(this.config.logsPath);
    }

    /**
     * Initializes the orchestrator by authorizing and setting up services and database.
     */
    async init(): Promise<void> {
        try {
            logger.info('Initializing Orchestrator...');

            const authClient = await authorize({
                folderId: this.config.folderId,
                tokenPath: this.config.tokenPath,
                credentialsPath: this.config.credentialsPath,
                databasePath: this.config.databasePath,
                downloadsPath: this.config.downloadsPath,
                logsPath: this.config.logsPath,
            });

            this.googleDriveService = new GoogleDriveService(
                authClient,
                this.config.downloadsPath
            );

            this.folderDatabase = new FolderDatabase(
                this.googleDriveService,
                this.config.folderId,
                this.config.databasePath,
                logger
            );
            await this.folderDatabase.initDatabase();

            await this.folderDatabase.refresh();

            logger.info('Orchestrator initialized successfully.');
        } catch (err) {
            logger.error('Failed to initialize Orchestrator:', err);
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
}
