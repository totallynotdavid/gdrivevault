import path from 'path';
import fs from 'fs/promises';

/**
 * Escapes single quotes in a string to prevent SQL injection.
 * @param input The input string.
 * @returns The escaped string.
 */
export function escapeSingleQuotes(input: string): string {
    return input.replace(/'/g, "''");
}

export async function ensureDirectoryExists(filePath: string) {
    const dirname = path.dirname(filePath);
    try {
        await fs.access(dirname);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            await fs.mkdir(dirname, {recursive: true});
        } else {
            throw err;
        }
    }
}
