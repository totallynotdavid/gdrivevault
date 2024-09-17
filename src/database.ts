import sqlite3 from 'sqlite3';
import {DATABASE_PATH, FOLDER_IDS} from './config';
import {GoogleFile, DatabaseFile, RefreshResult} from './types';
import {authorize} from './client';
import {getAllFolders, buildFolderTree, searchFilesInFolders} from './file-manager';
import {escapeSingleQuotes} from './utils';
import {DatabaseError} from './errors';

export class FolderDatabase {
    private db: sqlite3.Database;

    constructor() {
        this.db = new sqlite3.Database(DATABASE_PATH, err => {
            if (err) {
                console.error('Error initializing SQLite database:', err);
                throw new DatabaseError('Failed to initialize the database.');
            }
            console.log('SQLite database initialized.');
        });
        this.initDatabase()
            .then(() => this.scheduleRefresh())
            .catch(console.error);
    }

    private async initDatabase(): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS files (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        parents TEXT,
                        webViewLink TEXT NOT NULL
                    )`,
                    err => {
                        if (err) reject(err);
                        else resolve();
                    }
                );

                this.db.run(`CREATE INDEX IF NOT EXISTS idx_name ON files(name)`, err => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    private async getExistingFileIds(): Promise<Set<string>> {
        return new Promise<Set<string>>((resolve, reject) => {
            const ids = new Set<string>();
            this.db.each(
                `SELECT id FROM files`,
                (err, row: {id: string}) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    ids.add(row.id);
                },
                err => {
                    if (err) reject(err);
                    else resolve(ids);
                }
            );
        });
    }

    private async updateDatabase(files: GoogleFile[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.db.serialize(() => {
                const stmt = this.db.prepare(
                    `INSERT OR REPLACE INTO files (id, name, parents, webViewLink) VALUES (?, ?, ?, ?)`
                );

                files.forEach(file => {
                    const parentsStr = file.parents ? JSON.stringify(file.parents) : null;
                    stmt.run(
                        file.id,
                        file.name,
                        parentsStr,
                        file.webViewLink,
                        (err: Error | null) => {
                            if (err) {
                                reject(err);
                            }
                        }
                    );
                });

                stmt.finalize(err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    private async deleteRemovedFiles(currentFileIds: Set<string>): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const placeholders = Array.from(currentFileIds)
                .map(() => '?')
                .join(',');
            const query = `DELETE FROM files WHERE id NOT IN (${placeholders})`;

            this.db.run(query, Array.from(currentFileIds), function (err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(
                        `Deleted ${this.changes} removed files from the database.`
                    );
                    resolve();
                }
            });
        });
    }

    private async load(): Promise<RefreshResult> {
        try {
            console.log('Authorizing...');
            const authClient = await authorize();
            console.log('Getting all folders...');
            const folderMap = await getAllFolders(authClient);
            console.log('Building folder tree...');
            const folderIds = await buildFolderTree(folderMap, FOLDER_IDS);
            console.log('Scanning the following folders:');

            folderIds.forEach(id => {
                const folder = folderMap.get(id);
                if (folder) {
                    console.log(`- ${folder.name} (ID: ${id})`);
                }
            });

            console.log('Searching files in folders...');
            const files = await searchFilesInFolders(authClient, folderIds, '');

            const existingIds = await this.getExistingFileIds();
            const fetchedIds = new Set(files.map(file => file.id));

            console.log('Updating database with new and existing files...');
            await this.updateDatabase(files);

            console.log('Removing deleted files from the database...');
            await this.deleteRemovedFiles(fetchedIds);

            const newIds = await this.getExistingFileIds();
            const newFileCount = Array.from(newIds).filter(
                id => !existingIds.has(id)
            ).length;
            return {totalFiles: newIds.size, newFiles: newFileCount};
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw new DatabaseError(`Failed to load data: ${error.message}`);
            } else {
                throw new DatabaseError('Failed to load data: Unknown error');
            }
        }
    }

    public async refresh(): Promise<RefreshResult> {
        try {
            console.log('Updating the SQLite database...');
            const result = await this.load();
            console.log(
                `Database updated. Found ${result.totalFiles} total files, ${result.newFiles} new files.`
            );
            return result;
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error('Error updating the database:', error.message);
            } else {
                console.error('Error updating the database: Unknown error');
            }
            throw error;
        }
    }

    public async search(query: string): Promise<DatabaseFile[]> {
        const escapedQuery = escapeSingleQuotes(query);
        const queryString = `%${escapedQuery}%`;

        return new Promise<DatabaseFile[]>((resolve, reject) => {
            const results: DatabaseFile[] = [];
            this.db.each(
                `SELECT * FROM files WHERE name LIKE ?`,
                [queryString],
                (err, row: DatabaseFile) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    row.parents = row.parents ? JSON.parse(row.parents) : null;
                    results.push(row);
                },
                err => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });
    }

    private scheduleRefresh(): void {
        const oneDay = 24 * 60 * 60 * 1000;
        setTimeout(() => {
            this.load()
                .then(() => console.log('Database refreshed successfully.'))
                .catch((error: unknown) => {
                    if (error instanceof Error) {
                        console.error('Error refreshing database:', error.message);
                    } else {
                        console.error('Error refreshing database: Unknown error');
                    }
                })
                .finally(() => this.scheduleRefresh());
        }, oneDay);
    }
}

export const folderDatabase = new FolderDatabase();
