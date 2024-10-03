export interface AuthClientConfig {
    tokenPath: string;
    credentialsPath: string;
}

export interface DriveFileManagerConfig {
    folderId: string;
    tokenPath?: string;
    credentialsPath?: string;
    databasePath?: string;
    downloadsPath?: string;
    logsPath?: string;
}

export interface GoogleFile {
    id: string;
    name: string;
    parents: string[];
    webViewLink: string;
}

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
