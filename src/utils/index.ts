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

/*
 * Escapes a string for use in a SQL query.
 * @param str The string to escape.
 * @returns The escaped string.
 */
export function escapeQueryString(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Ensures that the directory of a file path exists.
 * @param filePath The file path.
 */
export async function ensureDirectoryExists(filePath: string): Promise<void> {
    const dirname = path.dirname(filePath);
    await fs.mkdir(dirname, {recursive: true});
}

/**
 * Extracts the file ID from a Google Drive link.
 * @param link The Google Drive file link.
 * @returns The file ID or null if not found.
 */
export function extractFileIdFromLink(link: string): string | null {
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
export function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
