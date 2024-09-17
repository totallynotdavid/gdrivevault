export function escapeSingleQuotes(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

export function extractFileIdFromDriveLink(link: string): string | null {
    const fileIdRegex = /[-\w]{25,}/;
    const match = fileIdRegex.exec(link);
    return match ? match[0] : null;
}
