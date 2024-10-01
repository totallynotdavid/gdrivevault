export interface AuthClientConfig {
    tokenPath: string;
    credentialsPath: string;
}

export interface DriveFileManagerConfig extends AuthClientConfig {
    folderId: string;
}

export interface GoogleFile {
    id: string;
    name: string;
    parents?: string[];
    webViewLink?: string;
}
