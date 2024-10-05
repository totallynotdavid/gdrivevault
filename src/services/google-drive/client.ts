import {google, drive_v3} from 'googleapis';
import {OAuth2Client} from 'google-auth-library';
import {logger} from '@/utils/logger';

export class GoogleDriveClient {
    public drive: drive_v3.Drive;

    constructor(authClient: OAuth2Client) {
        this.drive = google.drive({version: 'v3', auth: authClient});
        logger.info('Initialized Google Drive client.');
    }
}
