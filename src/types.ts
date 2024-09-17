import {Credentials} from 'google-auth-library';

export interface AuthClient {
    credentials: Credentials;
}

export interface GoogleFile {
    id: string;
    name: string;
    parents?: string[];
    webViewLink?: string;
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
