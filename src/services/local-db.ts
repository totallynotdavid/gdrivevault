import sqlite3 from 'sqlite3';
import {open, Database, Statement} from 'sqlite';
import {Logger} from '@/utils/logger';
import {GoogleDriveService} from '@/services/google-drive';
import {escapeSingleQuotes} from '@/utils';
import {GoogleFile, RefreshResult, DatabaseFile} from '@/types';
import {DatabaseError} from '@/types/errors';

type SQLiteDB = Database<sqlite3.Database, sqlite3.Statement>;
type SQLiteStmt = Statement;

export class FolderDatabase {
    private db!: SQLiteDB;
    private googleDriveService: GoogleDriveService;
    private folderId: string;
    private databasePath: string;
    private logger: Logger;

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
     * Initializes the SQLite database and creates necessary tables and indexes.
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
                    webViewLink TEXT NOT NULL
                );
            `);

            await this.db.exec(`
                CREATE INDEX IF NOT EXISTS idx_name ON files(name);
            `);

            this.logger.info('SQLite database initialized successfully.');
        } catch (err) {
            this.logger.error('Error initializing SQLite database:', err);
            throw new DatabaseError('Failed to initialize the database.');
        }
    }

    /**
     * Retrieves all existing file IDs from the database.
     * @returns A Set of file IDs.
     */
    async getExistingFileIds(): Promise<Set<string>> {
        try {
            const rows: DatabaseFile[] = await this.db.all(`SELECT id FROM files;`);
            return new Set(rows.map(row => row.id));
        } catch (err) {
            this.logger.error('Error fetching existing file IDs:', err);
            throw new DatabaseError('Failed to fetch existing file IDs.');
        }
    }

    /**
     * Updates the database with new and existing files.
     * @param files Array of GoogleFile objects to be inserted or updated.
     */
    async updateDatabase(files: GoogleFile[]): Promise<void> {
        const insertStmt = `
            INSERT INTO files (id, name, parents, webViewLink)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                parents = excluded.parents,
                webViewLink = excluded.webViewLink;
        `;

        let update: SQLiteStmt;
        try {
            update = await this.db.prepare(insertStmt);
        } catch (err) {
            this.logger.error('Error preparing INSERT statement:', err);
            throw new DatabaseError('Failed to prepare database statement.');
        }

        try {
            await this.db.run('BEGIN TRANSACTION;');
            for (const file of files) {
                const parentsStr = file.parents ? JSON.stringify(file.parents) : null;
                await update.run(file.id, file.name, parentsStr, file.webViewLink);
            }
            await this.db.run('COMMIT;');
            this.logger.info('Database updated successfully.');
        } catch (err) {
            await this.db.run('ROLLBACK;');
            this.logger.error('Error during database update:', err);
            throw new DatabaseError(
                `Failed to update database: ${(err as Error).message}`
            );
        } finally {
            await update.finalize();
        }
    }

    /**
     * Deletes files from the database that are no longer present in Google Drive.
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
            throw new DatabaseError(
                `Failed to delete removed files: ${(err as Error).message}`
            );
        }
    }

    /**
     * Refreshes the database by fetching the latest files from Google Drive.
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
            if (error instanceof Error) {
                this.logger.error('Failed to refresh database:', error.message);
                throw new DatabaseError(`Failed to refresh database: ${error.message}`);
            } else {
                this.logger.error('Failed to refresh database due to an unknown error.');
                throw new DatabaseError(
                    'Failed to refresh database due to an unknown error.'
                );
            }
        }
    }

    /**
     * Searches for files in the database based on a query string.
     * @param query The search query.
     * @returns An array of DatabaseFile objects matching the query.
     */
    async search(query: string): Promise<DatabaseFile[]> {
        const escapedQuery = escapeSingleQuotes(query);
        const queryString = `%${escapedQuery}%`;

        try {
            const results: DatabaseFile[] = await this.db.all(
                `SELECT * FROM files WHERE name LIKE ?;`,
                [queryString]
            );

            return results.map(file => ({
                ...file,
                parents: file.parents ? JSON.parse(file.parents) : null,
            }));
        } catch (err) {
            this.logger.error('Error during search query:', err);
            throw new DatabaseError(`Search query failed: ${(err as Error).message}`);
        }
    }

    /**
     * Checks if a file exists in the database based on its webViewLink.
     * @param fileLink The webViewLink of the file.
     * @returns Boolean indicating existence.
     */
    async fileExists(fileLink: string): Promise<boolean> {
        const fileId = this.googleDriveService.extractFileIdFromLink(fileLink);
        if (!fileId) return false;

        try {
            const result = await this.db.get(`SELECT id FROM files WHERE id = ?;`, [
                fileId,
            ]);
            return !!result;
        } catch (err) {
            this.logger.error('Error checking file existence:', err);
            throw new DatabaseError(
                `Failed to check file existence: ${(err as Error).message}`
            );
        }
    }
}
