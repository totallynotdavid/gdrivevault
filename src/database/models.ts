export interface DatabaseFile {
    id: string;
    name: string;
    parents: string | null;
    webViewLink: string;
}

export interface RefreshResult {
    totalFiles: number;
    newFiles: number;
}
