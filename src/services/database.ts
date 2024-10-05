import sqlite3 from 'sqlite3';
import {open, Database, Statement} from 'sqlite';
import {Logger} from '@/utils/logger';
import {GoogleDriveService} from '@/services/google-drive';
import {escapeSingleQuotes} from '@/utils';
import {GoogleFile, RefreshResult, DatabaseFile} from '@/types';
import {extractFileIdFromLink} from '@/utils';

type SQLiteDB = Database<sqlite3.Database, sqlite3.Statement>;
type SQLiteStmt = Statement;

export class FolderDatabase {
    private db!: SQLiteDB;
    private googleDriveService: GoogleDriveService;
    private folderId: string;
    private databasePath: string;
    private logger: Logger;

    // We are caching prepared statements
    private insertOrUpdateStmt!: SQLiteStmt;
    private selectLocalPathStmt!: SQLiteStmt;
    private updateLocalPathStmt!: SQLiteStmt;
    private checkFileExistsStmt!: SQLiteStmt;
    private searchStmt!: SQLiteStmt;

    constructor(
        googleDriveService: GoogleDriveService,
        folderId: string,
        databasePath: string,
        logger: Logger
    ) {
        this.googleDriveService = googleDriveService;
        this.folderId = folderId;
        this.databasePath = databasePath;
        this.logger = logger;
    }

    /**
     * Initializes the SQLite database, creates necessary tables, indexes,
     * and prepares frequently used statements.
     */
    async initDatabase(): Promise<void> {
        try {
            this.db = await open({
                filename: this.databasePath,
                driver: sqlite3.Database,
            });

            await this.db.exec(`
                CREATE TABLE IF NOT EXISTS files (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    parents TEXT,
                    webViewLink TEXT NOT NULL,
                    localPath TEXT
                );
            `);

            await this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_name ON files(name);
            `);

            this.logger.info('SQLite database initialized successfully.');

            await this.prepareStatements();
        } catch (err) {
            this.logger.error('Error initializing SQLite database:', err);
            throw new Error('Failed to initialize the database.');
        }
    }

    /**
     * Prepares and caches frequently used SQL statements to enhance performance.
     */
    private async prepareStatements(): Promise<void> {
        try {
            this.insertOrUpdateStmt = await this.db.prepare(`
                INSERT INTO files (id, name, parents, webViewLink, localPath)
                VALUES (?, ?, ?, ?, COALESCE((SELECT localPath FROM files WHERE id = ?), NULL))
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    parents = excluded.parents,
                    webViewLink = excluded.webViewLink;
            `);

            this.selectLocalPathStmt = await this.db.prepare(`
                SELECT localPath FROM files WHERE id = ?;
            `);

            this.updateLocalPathStmt = await this.db.prepare(`
                UPDATE files SET localPath = ? WHERE id = ?;
            `);

            this.checkFileExistsStmt = await this.db.prepare(`
                SELECT 1 FROM files WHERE id = ? LIMIT 1;
            `);

            this.searchStmt = await this.db.prepare(`
                SELECT * FROM files WHERE name LIKE ?;
            `);
        } catch (err) {
            this.logger.error('Error preparing SQL statements:', err);
            throw new Error('Failed to prepare SQL statements.');
        }
    }

    /**
     * Closes all prepared statements and the database connection gracefully.
     */
    async closeDatabase(): Promise<void> {
        try {
            await this.insertOrUpdateStmt.finalize();
            await this.selectLocalPathStmt.finalize();
            await this.updateLocalPathStmt.finalize();
            await this.checkFileExistsStmt.finalize();
            await this.searchStmt.finalize();
            await this.db.close();
            this.logger.info('SQLite database closed successfully.');
        } catch (err) {
            this.logger.error('Error closing SQLite database:', err);
        }
    }

    /**
     * Retrieves all existing file IDs from the database.
     * @returns A Set of file IDs.
     */
    async getExistingFileIds(): Promise<Set<string>> {
        try {
            const rows: Pick<DatabaseFile, 'id'>[] =
                await this.db.all(`SELECT id FROM files;`);
            return new Set(rows.map(row => row.id));
        } catch (err) {
            this.logger.error('Error fetching existing file IDs:', err);
            throw new Error('Failed to fetch existing file IDs.');
        }
    }

    /**
     * Updates the database with new and existing files in bulk within a transaction.
     * @param files Array of GoogleFile objects to be inserted or updated.
     */
    async updateDatabase(files: GoogleFile[]): Promise<void> {
        try {
            await this.db.run('BEGIN TRANSACTION;');
            for (const file of files) {
                const parentsStr = file.parents ? JSON.stringify(file.parents) : null;
                await this.insertOrUpdateStmt.run(
                    file.id,
                    file.name,
                    parentsStr,
                    file.webViewLink,
                    file.id
                );
            }
            await this.db.run('COMMIT;');
            this.logger.info('Database updated successfully.');
        } catch (err) {
            await this.db.run('ROLLBACK;');
            this.logger.error('Error during database update:', err);
            throw new Error(`Failed to update database: ${(err as Error).message}`);
        }
    }

    /**
     * Deletes files from the database that are no longer present in Google Drive.
     * Executes the deletion in a single statement using NOT IN with formatted placeholders.
     * @param currentFileIds Set of currently fetched file IDs.
     */
    async deleteRemovedFiles(currentFileIds: Set<string>): Promise<void> {
        if (currentFileIds.size === 0) {
            this.logger.warn('No current file IDs provided for deletion.');
            return;
        }

        const placeholders = Array.from(currentFileIds)
            .map(() => '?')
            .join(',');
        const deleteStmt = `
            DELETE FROM files
            WHERE id NOT IN (${placeholders});
        `;

        try {
            const result = await this.db.run(deleteStmt, Array.from(currentFileIds));
            this.logger.info(
                `Deleted ${result.changes} removed files from the database.`
            );
        } catch (err) {
            this.logger.error('Error deleting removed files:', err);
            throw new Error(`Failed to delete removed files: ${(err as Error).message}`);
        }
    }

    /**
     * Refreshes the database by fetching the latest files from Google Drive.
     * Optimized to reduce redundant operations and log meaningful information.
     * @returns RefreshResult containing total and new file counts.
     */
    async refresh(): Promise<RefreshResult> {
        try {
            this.logger.info('Starting database refresh...');
            const {files} = await this.googleDriveService.fetchAllFiles([this.folderId]);

            const existingIds = await this.getExistingFileIds();
            const fetchedIds = new Set(files.map(file => file.id));
            const newIds = new Set(
                Array.from(fetchedIds).filter(id => !existingIds.has(id))
            );

            await this.updateDatabase(files);
            await this.deleteRemovedFiles(fetchedIds);

            const totalFiles = fetchedIds.size;
            const newFiles = newIds.size;

            this.logger.info(
                `Database refreshed. Total files: ${totalFiles}, New files: ${newFiles}.`
            );

            return {totalFiles, newFiles};
        } catch (error: unknown) {
            this.logger.error('Error refreshing the database:', error);
            throw new Error('Failed to refresh the database.');
        }
    }

    /**
     * Searches for files in the database based on a query string.
     * Utilizes a prepared statement for efficiency.
     * @param query The search query.
     * @returns An array of DatabaseFile objects matching the query.
     */
    async search(query: string): Promise<DatabaseFile[]> {
        const escapedQuery = escapeSingleQuotes(query);
        const queryString = `%${escapedQuery}%`;

        try {
            const rows: DatabaseFile[] = await this.searchStmt.all([queryString]);

            return rows.map(file => ({
                ...file,
                parents: file.parents ? JSON.parse(file.parents) : null,
            }));
        } catch (err) {
            this.logger.error('Error during search query:', err);
            throw new Error(`Search query failed: ${(err as Error).message}`);
        }
    }

    /**
     * Checks if a file exists in the database based on its webViewLink.
     * Utilizes a prepared statement for efficiency.
     * @param fileLink The webViewLink of the file.
     * @returns Boolean indicating existence.
     */
    async fileExists(fileLink: string): Promise<boolean> {
        const fileId = extractFileIdFromLink(fileLink);
        if (!fileId) return false;

        try {
            const result = await this.checkFileExistsStmt.get([fileId]);
            return !!result;
        } catch (err) {
            this.logger.error('Error checking file existence:', err);
            throw new Error(`Failed to check file existence: ${(err as Error).message}`);
        }
    }

    /**
     * Retrieves the local file path for a file based on its webViewLink.
     * Utilizes a prepared statement for efficiency.
     * @param fileLink The webViewLink of the file.
     * @returns The local file path if it exists, otherwise null.
     */
    async getLocalFilePath(fileLink: string): Promise<string | null> {
        const fileId = extractFileIdFromLink(fileLink);
        if (!fileId) return null;

        try {
            const result = await this.selectLocalPathStmt.get([fileId]);
            return result?.localPath || null;
        } catch (err) {
            this.logger.error('Error retrieving local file path:', err);
            throw new Error(
                `Failed to retrieve local file path: ${(err as Error).message}`
            );
        }
    }

    /**
     * Updates the local file path for a given file based on its webViewLink.
     * Utilizes a prepared statement for efficiency.
     * @param fileLink The webViewLink of the file.
     * @param localPath The local path where the file is stored.
     */
    async updateLocalFilePath(fileLink: string, localPath: string): Promise<void> {
        const fileId = extractFileIdFromLink(fileLink);
        if (!fileId) {
            throw new Error('Invalid file link provided.');
        }

        try {
            await this.updateLocalPathStmt.run([localPath, fileId]);
            this.logger.info(`Updated local file path for file ID ${fileId}.`);
        } catch (err) {
            this.logger.error('Error updating local file path:', err);
            throw new Error(
                `Failed to update local file path: ${(err as Error).message}`
            );
        }
    }
}
