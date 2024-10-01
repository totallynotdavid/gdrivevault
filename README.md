# gdrivevault

gdrivevault simplifies Google Drive integration in your applications, enabling users to search and download files from specified folders. It automatically manages a local database for faster file access.

[![npm](https://img.shields.io/npm/v/gdrivevault)](https://www.npmjs.com/package/gdrivevault)

## Features

-   Search files within designated Google Drive folders
-   Download files directly from Google Drive
-   Automatic database management for faster file access
-   Support for multiple folders, ideal for serving different user groups

## Installation

```bash
npm install gdrivevault
# or
yarn add gdrivevault
```

## Setup

1. Set up Google Drive API credentials following the [official guide](https://developers.google.com/drive/api/v3/quickstart/nodejs).
2. Obtain your `credentials.json` file.

## Usage

### Initialize the Drive Manager

```typescript
import {DriveFileManager} from 'gdrivevault';

const config = {
    tokenPath: './data/token.json',
    credentialsPath: './data/credentials.json',
    folderId: 'your-google-drive-folder-id',
};

const driveManager = new DriveFileManager(config);
await driveManager.init();
```

### Search Files

```typescript
const results = await driveManager.searchFiles('query');
console.log('Search Results:', results);
```

### Download a File

```typescript
const filePath = await driveManager.downloadFile('file-web-view-link');
console.log(`File downloaded to: ${filePath}`);
```

### Refresh Database

```typescript
await driveManager.refreshDatabase();
console.log('Database refreshed successfully.');
```

## API Reference

### `DriveFileManager`

`constructor(config: DriveFileManagerConfig)`: Creates a new DriveFileManager instance.

-   `config`: Object containing `tokenPath`, `credentialsPath`, and `folderId`.

`init(): Promise<void>`: Initializes the DriveFileManager.

`searchFiles(query: string): Promise<DatabaseFile[]>`: Searches for files matching the query.

-   `query`: Search term for file names.
-   Returns: Array of matching `DatabaseFile` objects.

`downloadFile(fileLink: string): Promise<string>`: Downloads a file from Google Drive.

-   `fileLink`: The file's `webViewLink`.
-   Returns: Local path of the downloaded file.

`refreshDatabase(): Promise<void>`: Updates the local database with the latest files from Google Drive.

## Data Management

gdrivevault manages its own SQLite databases in the `data` directory:

```
your-project/
├── data/
│   ├── logs/
│   │   ├── error.log
│   │   └── combined.log
│   ├── downloads/
│   │   └── {fileId}.pdf
│   └── {folderId}_database.sqlite
├── data/
│   ├── token.json
│   └── credentials.json
├── src/
│   └── app.ts
└── package.json
```

## Authentication

gdrivevault uses OAuth 2.0 for Google Drive authentication:

1. First run: You'll be prompted to authorize access, generating `token.json`.
2. Subsequent runs: Uses the stored token for authentication.

> Note: Securely store `credentials.json` and `token.json`. Do not commit them to version control.

## Multiple Folders

To manage multiple Google Drive folders:

```typescript
const groupConfigs = [
    {
        tokenPath: './data/group1_token.json',
        credentialsPath: './data/group1_credentials.json',
        folderId: 'group1-folder-id',
    },
    {
        tokenPath: './data/group2_token.json',
        credentialsPath: './data/group2_credentials.json',
        folderId: 'group2-folder-id',
    },
    // Add more group configurations as needed
];

const groupManagers = await Promise.all(
    groupConfigs.map(async config => {
        const manager = new DriveFileManager(config);
        await manager.init();
        return manager;
    })
);
```

Each `groupManager` can handle its respective folder independently.
