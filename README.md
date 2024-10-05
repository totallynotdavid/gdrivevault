# gdrivevault

gdrivevault simplifies Google Drive integration for your Node.js projects. It lets you search and download files from specific Google Drive folders while managing a local database for faster searches.

[![npm](https://img.shields.io/npm/v/gdrivevault)](https://www.npmjs.com/package/gdrivevault)

## Quick start

1. Install the package:

```bash
npm install gdrivevault
# or
yarn add gdrivevault
```

2. Set up Google Drive API credentials:

    - Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
    - Create a new project or select an existing one
    - Enable the Google Drive API
    - Create OAuth 2.0 Client IDs credentials (choose "Desktop App" as the application type)
    - Download the `credentials.json` file and save it to `storage/auth/credentials.json`. You can customize the path if needed (see [Customization](#customization))

3. Initialize and use gdrivevault:

```javascript
import {DriveFileManager} from 'gdrivevault';

const config = {
    folderId: 'your-google-drive-folder-id',
};

const driveManager = new DriveFileManager(config);
await driveManager.init();

// Search for files
const results = await driveManager.searchFiles('your-search-query');
console.log('Search Results:', results);

// Download a file
const fileLink = 'file-web-view-link';
const filePath = await driveManager.downloadFile(fileLink);
console.log(`File downloaded to: ${filePath}`);

// Refresh the local database
await driveManager.refreshDatabase();
console.log('Database refreshed successfully.');
```

On first run, you'll be prompted to authenticate your application through a browser window. Grant the necessary permissions, and gdrivevault will save the access token for future use.

## Features

-   Easy Google Drive integration
-   Fast file searches using local database caching
-   Automatic database management
-   Customizable storage paths
-   Support for multiple Google Drive folders

## Customization

You can customize various paths and settings:

```javascript
const config = {
    folderId: 'your-google-drive-folder-id',
    tokenPath: './auth/tokens/token.json',
    credentialsPath: './auth/credentials.json',
    databasePath: './data/databases/my_custom_database.sqlite',
    downloadsPath: './my_downloads',
    logsPath: './my_logs',
};
```

## API Reference

### DriveFileManager

The main class for interacting with Google Drive.

```javascript
constructor(config: DriveFileManagerConfig)
```

#### Configuration options

| Option            | Type   | Required | Default                                                | Description                            |
| ----------------- | ------ | -------- | ------------------------------------------------------ | -------------------------------------- |
| `folderId`        | string | Yes      | N/A                                                    | Google Drive folder ID                 |
| `tokenPath`       | string | No       | `./storage/auth/tokens/token.json`                     | Path to store the authentication token |
| `credentialsPath` | string | No       | `./storage/auth/credentials.json`                      | Path to your `credentials.json` file   |
| `databasePath`    | string | No       | `./storage/databases/{folderId}_drive_database.sqlite` | Path to the SQLite database file       |
| `downloadsPath`   | string | No       | `./storage/downloads/{folderId}`                       | Directory for downloaded files         |
| `logsPath`        | string | No       | `./logs/{folderId}`                                    | Directory for log files                |

#### Methods

-   `init(): Promise<void>`: Initialize the DriveFileManager
-   `searchFiles(query: string): Promise<DatabaseFile[]>`: Search for files
-   `downloadFile(fileLink: string): Promise<string>`: Download a file
-   `refreshDatabase(): Promise<void>`: Update the local database

## Managing multiple folders

To manage multiple Google Drive folders, create separate instances of `DriveFileManager`:

```javascript
const folderIds = ['folder-id-1', 'folder-id-2'];

const managers = await Promise.all(
    folderIds.map(async folderId => {
        const config = {folderId};
        const manager = new DriveFileManager(config);
        await manager.init();
        return manager;
    })
);

// Use managers[0] and managers[1] to interact with each folder
```

## Contributing

We welcome contributions! Fork the repository and submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the [MIT License](LICENSE).

## Support

If you run into issues or have questions, please open an issue on our [GitHub repository](https://github.com/totallynotdavid/gdrivevault/issues).
