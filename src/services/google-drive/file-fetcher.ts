import {drive_v3} from 'googleapis';
import {GoogleFile} from '@/types';
import {logger} from '@/utils/logger';
import {chunkArray, escapeQueryString} from '@/utils';

export class FileFetcher {
    private drive: drive_v3.Drive;

    constructor(drive: drive_v3.Drive) {
        this.drive = drive;
    }

    /**
     * Fetches all folders from Google Drive.
     * @returns A Map of folder IDs to folder metadata.
     */
    public async getAllFolders(): Promise<Map<string, drive_v3.Schema$File>> {
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
            throw new Error(`Failed to fetch folders: ${(err as Error).message}`);
        }
    }

    /**
     * Builds a list of folder IDs, including subfolders recursively.
     * @param folderMap Map of all folders fetched from Google Drive.
     * @param rootFolderIds Array of root folder IDs to start building the tree.
     * @returns Array of all relevant folder IDs.
     */
    public async buildFolderTree(
        folderMap: Map<string, drive_v3.Schema$File>,
        rootFolderIds: string[]
    ): Promise<string[]> {
        const allFolderIds: Set<string> = new Set();

        const processFolder = (id: string) => {
            if (allFolderIds.has(id)) return;
            allFolderIds.add(id);
            const folder = folderMap.get(id);
            if (folder && folder.parents) {
                for (const [childId, childFolder] of folderMap.entries()) {
                    if (childFolder.parents && childFolder.parents.includes(id)) {
                        processFolder(childId);
                    }
                }
            }
        };

        try {
            rootFolderIds.forEach(id => processFolder(id));
            logger.info(`Built folder tree with ${allFolderIds.size} folders.`);
            return Array.from(allFolderIds);
        } catch (err) {
            logger.error('Error building folder tree:', err);
            throw new Error(`Failed to build folder tree: ${(err as Error).message}`);
        }
    }

    /**
     * Searches for files within specified folders.
     * @param folderIds Array of folder IDs to search within.
     * @param query Optional query string to filter files.
     * @returns Array of GoogleFile objects.
     */
    public async searchFilesInFolders(
        folderIds: string[],
        query: string = ''
    ): Promise<GoogleFile[]> {
        const files: GoogleFile[] = [];
        const chunkSize = 5; // Adjust as needed
        const folderIdChunks = chunkArray(folderIds, chunkSize);

        logger.info(`Searching files in ${folderIds.length} folders...`);

        try {
            for (const chunk of folderIdChunks) {
                const parentQueries = chunk.map(id => `'${id}' in parents`).join(' or ');
                let pageToken: string | undefined;

                do {
                    let queryString = `(${parentQueries}) and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
                    if (query.trim() !== '') {
                        // Escape single quotes in query
                        const sanitizedQuery = escapeQueryString(query);
                        queryString += ` and name contains '${sanitizedQuery}'`;
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

            logger.info(`Found ${files.length} file(s) matching the criteria.`);
            return files;
        } catch (err) {
            logger.error('Error searching files:', err);
            throw new Error(`Failed to search files: ${(err as Error).message}`);
        }
    }

    /**
     * Fetches all files from Google Drive based on root folder IDs.
     * @param rootFolderIds Array of root folder IDs.
     * @returns An object containing folderMap, folderIds, and files.
     */
    public async fetchAllFiles(rootFolderIds: string[]): Promise<{
        folderMap: Map<string, drive_v3.Schema$File>;
        folderIds: string[];
        files: GoogleFile[];
    }> {
        try {
            const folderMap = await this.getAllFolders();
            const folderIds = await this.buildFolderTree(folderMap, rootFolderIds);
            const files = await this.searchFilesInFolders(folderIds);
            return {folderMap, folderIds, files};
        } catch (err) {
            logger.error('Error fetching all files:', err);
            throw new Error(`Failed to fetch all files: ${(err as Error).message}`);
        }
    }
}
