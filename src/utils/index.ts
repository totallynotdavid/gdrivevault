/**
 * Escapes single quotes in a string to prevent SQL injection.
 * @param str The input string.
 * @returns The escaped string.
 */
export function escapeSingleQuotes(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Splits an array into chunks of a specified size.
 * @param array The array to split.
 * @param chunkSize The size of each chunk.
 * @returns An array of chunks.
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Extracts the file ID from a Google Drive link.
 * @param link The Google Drive file link.
 * @returns The file ID or null if not found.
 */
export function extractFileIdFromDriveLink(link: string): string | null {
    const fileIdRegex = /[-\w]{25,}/;
    const match = fileIdRegex.exec(link);
    return match ? match[0] : null;
}
