import {google, drive_v3} from 'googleapis';
import {OAuth2Client} from 'google-auth-library';
import {logger} from '@/utils/logger';

/**
 * Handles the initialization of the Google Drive client.
 */
export class GoogleDriveClient {
    public drive: drive_v3.Drive;

    /**
     * Constructs a new GoogleDriveClient.
     * @param authClient - An authenticated OAuth2Client instance.
     */
    constructor(authClient: OAuth2Client) {
        this.drive = google.drive({version: 'v3', auth: authClient});
        logger.info('Initialized Google Drive client.');
    }
}
