/*
 * This file is for development purposes only.
 * It is not part of the final package.
 * It is used to test the DriveFileManager class.
 * To run this file, use the command `npm run dev`.
 * Update the config object with your own values.
 */

import {DriveFileManager} from './index';

async function main() {
    const config = {
        tokenPath: './data/driveToken.json',
        credentialsPath: './data/driveCredentials.json',
        folderId: '1PZfURZ_iYmd2z7Ikn9ZYY7FY0nHOneSD',
    };

    const manager = new DriveFileManager(config);
    await manager.init();

    await manager.refreshDatabase();

    const userQuery = 'statistical mech';
    const searchResults = await manager.searchFiles(userQuery);
    console.log('Search Results:', searchResults);

    // To simplify the example, we download the first file in the search results.
    if (searchResults.length > 0) {
        const selectedFileLink = searchResults[0].webViewLink;
        const filePath = await manager.downloadFile(selectedFileLink);
        console.log(`File downloaded to: ${filePath}`);
    }
}

main().catch(console.error);
