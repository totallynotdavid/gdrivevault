export class DatabaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export class FileDownloadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileDownloadError';
    }
}
