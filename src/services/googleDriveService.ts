import {google, drive_v3} from 'googleapis';
import {OAuth2Client} from 'google-auth-library';
import {FileDownloadError, APIError} from '../errors';
import {GoogleFile} from '../types';
import {Logger} from '../utils/logger';
import path from 'path';
import fs from 'fs';

const logger = Logger.getLogger();

export class GoogleDriveService {
    private drive: drive_v3.Drive;

    constructor(authClient: OAuth2Client) {
        this.drive = google.drive({version: 'v3', auth: authClient});
    }

    /**
     * Fetches all folders from Google Drive.
     * @returns A Map of folder IDs to folder metadata.
     */
    async getAllFolders(): Promise<Map<string, drive_v3.Schema$File>> {
        const folders: drive_v3.Schema$File[] = [];
        let pageToken: string | undefined;

        logger.info('Fetching all folders from Google Drive...');
        try {
            do {
                const res = await this.drive.files.list({
                    pageSize: 1000,
                    pageToken,
                    q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
                    fields: 'nextPageToken, files(id, name, parents)',
                });

                if (res.data.files) {
                    folders.push(...res.data.files);
                }
                pageToken = res.data.nextPageToken || undefined;
            } while (pageToken);

            logger.info(`Fetched ${folders.length} folders.`);
            return new Map(folders.map(folder => [folder.id!, folder]));
        } catch (err) {
            logger.error('Error fetching folders:', err);
            throw new APIError(`Failed to fetch folders: ${(err as Error).message}`);
        }
    }

    /**
     * Builds a list of folder IDs, including subfolders recursively.
     * @param folderMap Map of all folders fetched from Google Drive.
     * @param rootFolderIds Array of root folder IDs to start building the tree.
     * @returns Array of all relevant folder IDs.
     */
    async buildFolderTree(
        folderMap: Map<string, drive_v3.Schema$File>,
        rootFolderIds: string[]
    ): Promise<string[]> {
        const allFolderIds: Set<string> = new Set();

        const processFolder = (id: string) => {
            if (allFolderIds.has(id)) return;
            allFolderIds.add(id);
            const folder = folderMap.get(id);
            if (folder && folder.parents) {
                for (const [key, childFolder] of folderMap.entries()) {
                    if (childFolder.parents && childFolder.parents.includes(id)) {
                        processFolder(childFolder.id!);
                    }
                }
            }
        };

        rootFolderIds.forEach(id => processFolder(id));
        logger.info(`Built folder tree with ${allFolderIds.size} folders.`);
        return Array.from(allFolderIds);
    }

    /**
     * Searches for files within specified folders.
     * @param folderIds Array of folder IDs to search within.
     * @param query Optional query string to filter files.
     * @returns Array of GoogleFile objects.
     */
    async searchFilesInFolders(
        folderIds: string[],
        query: string = ''
    ): Promise<GoogleFile[]> {
        const files: GoogleFile[] = [];
        const chunkSize = 5; // Adjust as needed
        const folderIdChunks = this.chunkArray(folderIds, chunkSize);

        logger.info(`Searching files in ${folderIds.length} folders...`);

        try {
            for (const chunk of folderIdChunks) {
                const parentQueries = chunk.map(id => `'${id}' in parents`).join(' or ');
                let pageToken: string | undefined;

                do {
                    let queryString = `(${parentQueries}) and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
                    if (query.trim() !== '') {
                        queryString += ` and name contains '${query}'`;
                    }

                    const res = await this.drive.files.list({
                        pageSize: 1000,
                        pageToken,
                        q: queryString,
                        fields: 'nextPageToken, files(id, name, parents, webViewLink)',
                    });

                    if (res.data.files) {
                        files.push(
                            ...res.data.files.map(file => ({
                                id: file.id!,
                                name: file.name!,
                                parents: file.parents || [],
                                webViewLink: file.webViewLink || '',
                            }))
                        );
                    }
                    pageToken = res.data.nextPageToken || undefined;
                } while (pageToken);
            }

            logger.info(`Found ${files.length} files.`);
            return files;
        } catch (err) {
            logger.error('Error searching files:', err);
            throw new APIError(`Failed to search files: ${(err as Error).message}`);
        }
    }

    /**
     * Fetches all files from Google Drive based on root folder IDs.
     * @param rootFolderIds Array of root folder IDs.
     * @returns An object containing folderMap, folderIds, and files.
     */
    async fetchAllFiles(rootFolderIds: string[]): Promise<{
        folderMap: Map<string, drive_v3.Schema$File>;
        folderIds: string[];
        files: GoogleFile[];
    }> {
        const folderMap = await this.getAllFolders();
        const folderIds = await this.buildFolderTree(folderMap, rootFolderIds);
        const files = await this.searchFilesInFolders(folderIds);
        return {folderMap, folderIds, files};
    }

    /**
     * Downloads a file from Google Drive given its webViewLink.
     * @param fileLink The webViewLink of the file.
     * @returns The local file path where the file was downloaded.
     */
    async downloadFileFromGoogleDrive(fileLink: string): Promise<string> {
        const fileId = this.extractFileIdFromLink(fileLink);
        if (!fileId) throw new Error('Invalid Google Drive file link.');

        try {
            const destDir = path.join(process.cwd(), 'pdf');
            await fs.promises.mkdir(destDir, {recursive: true});

            const filePath = path.join(destDir, `${fileId}.pdf`);
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
                    .on('error', err => {
                        logger.error('Error downloading file:', err);
                        reject(new FileDownloadError('Failed to download the file.'));
                    })
                    .pipe(dest);
            });

            return filePath;
        } catch (err) {
            logger.error('Error in downloadFileFromGoogleDrive:', err);
            throw new FileDownloadError(
                `Failed to download file: ${(err as Error).message}`
            );
        }
    }

    /**
     * Extracts the file ID from a Google Drive link.
     * @param link The Google Drive file link.
     * @returns The file ID or null if not found.
     */
    private extractFileIdFromLink(link: string): string | null {
        const regex = /[-\w]{25,}/;
        const match = regex.exec(link);
        return match ? match[0] : null;
    }

    /**
     * Splits an array into chunks of a specified size.
     * @param array The array to split.
     * @param size The size of each chunk.
     * @returns An array of chunks.
     */
    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}
