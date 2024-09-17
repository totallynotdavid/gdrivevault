import {google, drive_v3} from 'googleapis';
import {OAuth2Client} from 'google-auth-library';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import {escapeSingleQuotes, chunkArray, extractFileIdFromDriveLink} from './utils';
import {GoogleFile} from './types';
import {authorize} from './client';

export async function getAllFolders(
    authClient: OAuth2Client
): Promise<Map<string, drive_v3.Schema$File>> {
    const drive = google.drive({version: 'v3', auth: authClient});
    const folders: drive_v3.Schema$File[] = [];
    let pageToken: string | undefined;

    do {
        const res = await drive.files.list({
            pageSize: 1000,
            pageToken,
            q: `mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'nextPageToken, files(id, name, parents)',
        });

        if (res.data.files) {
            folders.push(...res.data.files);
        }
        pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return new Map(folders.map(folder => [folder.id!, folder]));
}

export async function buildFolderTree(
    folderMap: Map<string, drive_v3.Schema$File>,
    folderIds: string[]
): Promise<string[]> {
    const allFolderIds: Set<string> = new Set();

    const processFolder = (id: string) => {
        allFolderIds.add(id);
        const folder = folderMap.get(id);
        if (folder) {
            console.log(`Processing folder: ${folder.name} (ID: ${id})`);
            for (const [key, childFolder] of folderMap.entries()) {
                if (childFolder.parents && childFolder.parents.includes(id)) {
                    processFolder(key);
                }
            }
        } else {
            console.warn(`Folder with ID ${id} not found in folderMap.`);
        }
    };

    folderIds.forEach(id => processFolder(id));
    return Array.from(allFolderIds);
}

export async function searchFilesInFolders(
    authClient: OAuth2Client,
    folderIds: string[],
    query: string
): Promise<GoogleFile[]> {
    const drive = google.drive({version: 'v3', auth: authClient});
    const files: GoogleFile[] = [];
    const escapedQuery = escapeSingleQuotes(query);
    const folderIdChunks = chunkArray(folderIds, 5); // Adjust chunk size as needed

    for (const chunk of folderIdChunks) {
        const parentQueries = chunk.map(id => `'${id}' in parents`).join(' or ');
        let pageToken: string | undefined;

        do {
            // If query is empty, omit the fullText filter
            let queryString = `(${parentQueries}) and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
            if (escapedQuery) {
                queryString += ` and fullText contains '${escapedQuery}'`;
            }

            const res = await drive.files.list({
                pageSize: 1000,
                pageToken,
                q: queryString,
                fields: 'nextPageToken, files(id, name, parents, webViewLink)',
            });

            if (res.data.files) {
                files.push(...(res.data.files as GoogleFile[]));
            }
            pageToken = res.data.nextPageToken || undefined;
        } while (pageToken);
    }

    return files;
}

export async function downloadFileFromGoogleDrive(fileLink: string): Promise<string> {
    const fileId = extractFileIdFromDriveLink(fileLink);
    if (!fileId) throw new Error('Invalid Google Drive file link.');

    const authClient = await authorize();
    const drive = google.drive({version: 'v3', auth: authClient});

    const response = await drive.files.get(
        {fileId, alt: 'media'},
        {responseType: 'stream'}
    );

    return new Promise<string>((resolve, reject) => {
        if (!response.data) {
            return reject(new Error('No data received from Google Drive.'));
        }

        const pdfDir = path.join(process.cwd(), 'pdf');
        fsPromises.mkdir(pdfDir, {recursive: true}).catch(reject);

        const filePath = path.join(pdfDir, `${fileId}.pdf`);
        const dest = fs.createWriteStream(filePath);

        response.data
            .on('end', () => {
                console.log(`Downloaded file to ${filePath}`);
                resolve(filePath);
            })
            .on('error', err => {
                console.error('Error downloading file.');
                reject(err);
            })
            .pipe(dest);
    });
}
