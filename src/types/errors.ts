export class DatabaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export class APIError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'APIError';
    }
}

export class FileDownloadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileDownloadError';
    }
}
