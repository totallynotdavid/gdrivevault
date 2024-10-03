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

export async function ensureDirectoryExists(filePath: string): Promise<void> {
    const dirname = path.dirname(filePath);
    await fs.mkdir(dirname, {recursive: true});
}
