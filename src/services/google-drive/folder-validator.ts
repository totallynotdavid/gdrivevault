import {drive_v3} from 'googleapis';
import {logger} from '@/utils/logger';

export class FolderValidator {
    private drive: drive_v3.Drive;

    constructor(drive: drive_v3.Drive) {
        this.drive = drive;
    }

    /**
     * Validates that the provided folderId is valid, accessible, and represents a folder.
     * @param folderId The ID of the folder to validate.
     */
    public async validateFolderId(folderId: string): Promise<void> {
        try {
            logger.info(`Validating folderId: ${folderId}`);

            const res = await this.drive.files.get({
                fileId: folderId,
                fields: 'id, name, mimeType',
            });

            const file = res.data;

            if (!file) {
                throw new Error(`Folder with ID ${folderId} not found.`);
            }

            if (file.mimeType !== 'application/vnd.google-apps.folder') {
                throw new Error(`The provided ID ${folderId} is not a folder.`);
            }

            logger.info(`Validated folderId ${folderId}: ${file.name}`);
        } catch (error: unknown) {
            const errorCode = (error as {code?: number}).code;
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error occurred.';

            if (errorCode === 404) {
                throw new Error(`Folder with ID ${folderId} not found.`);
            } else {
                logger.error(`Error validating folderId ${folderId}:`, error);
                throw new Error(
                    `An error occurred while validating folderId ${folderId}: ${errorMessage}`
                );
            }
        }
    }
}
