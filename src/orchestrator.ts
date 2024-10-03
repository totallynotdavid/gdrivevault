import path from 'path';
import fs from 'fs/promises';
import {authorize} from '@/services/authorizer';
import {GoogleDriveService} from '@/services/google-drive';
import {FolderDatabase} from '@/services/local-db';
import {logger} from '@/utils/logger';
import {DriveFileManagerConfig, DatabaseFile} from '@/types';
import {defaultConfig, baseDirectories} from '@/config';

export class DriveFileManager {
    private googleDriveService!: GoogleDriveService;
    private folderDatabase!: FolderDatabase;
    private config: Required<DriveFileManagerConfig>;
    private initialized = false;

    constructor(config: DriveFileManagerConfig) {
        const {folderId} = config;

        const databasePath =
            config.databasePath ??
            path.join(baseDirectories.databases, `${folderId}_drive_database.sqlite`);
        const downloadsPath =
            config.downloadsPath ?? path.join(baseDirectories.downloads, folderId);
        const logsPath = config.logsPath ?? path.join(baseDirectories.logs, folderId);

        this.config = {
            ...defaultConfig,
            ...config,
            tokenPath: config.tokenPath ?? defaultConfig.tokenPath,
            credentialsPath: config.credentialsPath ?? defaultConfig.credentialsPath,
            databasePath,
            downloadsPath,
            logsPath,
        };

        this.initializeDirectories().catch(err => {
            logger.error('Error initializing directories:', err);
        });

        logger.setLogsPath(this.config.logsPath);
    }

    /**
     * Asynchronously creates necessary directories.
     */
    private async initializeDirectories(): Promise<void> {
        const dirPromises = [
            fs.mkdir(path.dirname(this.config.databasePath), {recursive: true}),
            fs.mkdir(this.config.downloadsPath, {recursive: true}),
            fs.mkdir(this.config.logsPath, {recursive: true}),
        ];

        await Promise.all(dirPromises);
    }

    /**
     * Ensures the orchestrator is initialized before use.
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.init();
        }
    }

    /**
     * Initializes the orchestrator by authorizing, validating the folder ID,
     * and setting up services and the local database.
     */
    async init(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            logger.info('Initializing Orchestrator...');

            const credentialsExist = await this.fileExists(this.config.credentialsPath);
            if (!credentialsExist) {
                console.error(
                    `\nCredentials file not found at "${this.config.credentialsPath}".`
                );
                console.error(
                    'Please obtain a credentials.json file by following the instructions at:'
                );
                console.error(
                    'https://developers.google.com/drive/api/v3/quickstart/nodejs\n'
                );
                throw new Error('Credentials file not found.');
            }

            const [authClient] = await Promise.all([
                authorize({
                    folderId: this.config.folderId,
                    tokenPath: this.config.tokenPath,
                    credentialsPath: this.config.credentialsPath,
                }),
                this.initializeDirectories(),
            ]);

            this.googleDriveService = new GoogleDriveService(
                authClient,
                this.config.downloadsPath
            );

            await Promise.all([
                this.googleDriveService.validateFolderId(this.config.folderId),
                this.initializeDatabase(),
            ]);

            this.initialized = true;
            logger.info('Orchestrator initialized successfully.');
        } catch (err) {
            logger.error('Error during initialization:', err);
            throw err;
        }
    }

    /**
     * Initializes the folder database.
     */
    private async initializeDatabase(): Promise<void> {
        this.folderDatabase = new FolderDatabase(
            this.googleDriveService,
            this.config.folderId,
            this.config.databasePath,
            logger
        );

        await this.folderDatabase.initDatabase();
    }

    /**
     * Searches for files in the local database based on a query string.
     * @param query The search query.
     * @returns An array of DatabaseFile objects matching the query.
     */
    async searchFiles(query: string): Promise<DatabaseFile[]> {
        await this.ensureInitialized();

        try {
            const results = await this.folderDatabase.search(query);
            logger.info(
                `Search completed. Found ${results.length} file(s) matching "${query}".`
            );
            return results;
        } catch (err) {
            logger.error('Error searching files:', err);
            throw new Error(`Failed to search files: ${(err as Error).message}`);
        }
    }

    /**
     * Downloads a file from Google Drive given its webViewLink.
     * @param fileLink The webViewLink of the file.
     * @returns The local file path where the file was downloaded.
     */
    async downloadFile(fileLink: string): Promise<string> {
        await this.ensureInitialized();

        try {
            const cachedFilePath = await this.folderDatabase.getLocalFilePath(fileLink);

            if (cachedFilePath && (await this.fileExists(cachedFilePath))) {
                logger.info(`File retrieved from cache at ${cachedFilePath}`);
                return cachedFilePath;
            }

            const fileExists = await this.folderDatabase.fileExists(fileLink);
            if (!fileExists) {
                throw new Error('File not found in the database.');
            }

            const localPath =
                await this.googleDriveService.downloadFileFromGoogleDrive(fileLink);
            logger.info(`File downloaded successfully to ${localPath}`);

            await this.folderDatabase.updateLocalFilePath(fileLink, localPath);

            return localPath;
        } catch (err) {
            logger.error('Error during file download:', err);
            throw err;
        }
    }

    /**
     * Checks if a file exists at the given path.
     * @param filePath The path of the file to check.
     * @returns True if the file exists, false otherwise.
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Refreshes the local database by fetching the latest files from Google Drive.
     */
    async refreshDatabase(): Promise<void> {
        await this.ensureInitialized();

        try {
            await this.folderDatabase.refresh();
            logger.info('Database refreshed successfully.');
        } catch (err) {
            logger.error('Error refreshing the database:', err);
            throw new Error(`Failed to refresh database: ${(err as Error).message}`);
        }
    }
}
