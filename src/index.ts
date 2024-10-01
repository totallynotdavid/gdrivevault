import {authorize} from './auth/client';
import {GoogleDriveService} from './services/googleDriveService';
import {FolderDatabase} from './database/database';
import {Logger} from './utils/logger';

const logger = Logger.getLogger();

/**
 * Initializes the application, sets up the database, and schedules periodic refreshes.
 */
async function main() {
    try {
        logger.info('Starting application...');

        // Authorize and initialize Google Drive service
        const authClient = await authorize();
        const googleDriveService = new GoogleDriveService(authClient);

        // Initialize and setup the database
        const folderDatabase = new FolderDatabase(googleDriveService);
        await folderDatabase.initDatabase();

        // Initial database refresh
        await folderDatabase.refresh();

        // Schedule daily refreshes
        const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        setInterval(async () => {
            try {
                await folderDatabase.refresh();
            } catch (err) {
                logger.error('Scheduled refresh failed:', err);
            }
        }, oneDayInMs);

        logger.info('Application initialized successfully.');
    } catch (err) {
        logger.error('Failed to initialize application:', err);
        process.exit(1);
    }
}

main();
