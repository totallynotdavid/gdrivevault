import {GoogleDriveClient} from './client';
import {FolderValidator} from './folder-validator';
import {FileFetcher} from './file-fetcher';
import {FileDownloader} from './file-downloader';
import {OAuth2Client} from 'google-auth-library';
import {GoogleFile} from '@/types';
import {drive_v3} from 'googleapis';

/**
 * Provides a unified interface for interacting with Google Drive functionalities.
 */
export class GoogleDriveService {
    private client: GoogleDriveClient;
    private validator: FolderValidator;
    private fetcher: FileFetcher;
    private downloader: FileDownloader;

    /**
     * Constructs a new GoogleDriveService.
     * @param authClient - An authenticated OAuth2Client instance.
     * @param downloadsPath - The local path where files will be downloaded.
     */
    constructor(authClient: OAuth2Client, downloadsPath: string) {
        this.client = new GoogleDriveClient(authClient);
        this.validator = new FolderValidator(this.client.drive);
        this.fetcher = new FileFetcher(this.client.drive);
        this.downloader = new FileDownloader(this.client.drive, downloadsPath);
    }

    /**
     * Validates a folder ID.
     * @param folderId The ID of the folder to validate.
     */
    public async validateFolderId(folderId: string): Promise<void> {
        return this.validator.validateFolderId(folderId);
    }

    /**
     * Fetches all files under the specified root folder IDs.
     * @param rootFolderIds Array of root folder IDs.
     * @returns An object containing the folder map, folder IDs, and files.
     */
    public async fetchAllFiles(rootFolderIds: string[]): Promise<{
        folderMap: Map<string, drive_v3.Schema$File>;
        folderIds: string[];
        files: GoogleFile[];
    }> {
        return this.fetcher.fetchAllFiles(rootFolderIds);
    }

    /**
     * Downloads a file from Google Drive.
     * @param fileLink The webViewLink of the file.
     * @returns The local file path where the file was downloaded.
     */
    public async downloadFile(fileLink: string): Promise<string> {
        return this.downloader.downloadFileFromGoogleDrive(fileLink);
    }
}
