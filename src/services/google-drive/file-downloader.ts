import path from 'path';
import fs from 'fs';
import {drive_v3} from 'googleapis';
import {logger} from '@/utils/logger';
import {extractFileIdFromLink} from '@/utils';

/**
 * Manages the downloading of files from Google Drive.
 */
export class FileDownloader {
    private drive: drive_v3.Drive;
    private downloadsPath: string;

    /**
     * Constructs a new FileDownloader.
     * @param drive - An instance of Google Drive client.
     * @param downloadsPath - The local path where files will be downloaded.
     */
    constructor(drive: drive_v3.Drive, downloadsPath: string) {
        this.drive = drive;
        this.downloadsPath = downloadsPath;
    }

    /**
     * Downloads a file from Google Drive given its webViewLink.
     * @param fileLink The webViewLink of the file.
     * @returns The local file path where the file was downloaded.
     */
    public async downloadFileFromGoogleDrive(fileLink: string): Promise<string> {
        const fileId = extractFileIdFromLink(fileLink);
        if (!fileId) throw new Error('Invalid Google Drive file link.');

        try {
            await fs.promises.mkdir(this.downloadsPath, {recursive: true});

            const filePath = path.join(this.downloadsPath, `${fileId}.pdf`);
            const dest = fs.createWriteStream(filePath);

            const res = await this.drive.files.get(
                {fileId, alt: 'media'},
                {responseType: 'stream'}
            );

            await new Promise<void>((resolve, reject) => {
                res.data
                    .on('end', () => {
                        logger.info(`Downloaded file to ${filePath}`);
                        resolve();
                    })
                    .on('error', (err: Error) => {
                        logger.error('Error downloading file:', err);
                        reject(new Error('Failed to download the file.'));
                    })
                    .pipe(dest);
            });

            return filePath;
        } catch (err: unknown) {
            logger.error('Error downloading file:', err);
            throw new Error('Failed to download the file.');
        }
    }
}
