import {folderDatabase, downloadFileFromGoogleDrive} from './index';

folderDatabase
    .refresh()
    .then(result => {
        console.log(`Database refreshed: ${result.totalFiles} total files.`);
    })
    .catch(console.error);

folderDatabase
    .search('statistical mech')
    .then(files => {
        console.log('Search results:', files);
    })
    .catch(console.error);

downloadFileFromGoogleDrive(
    'https://drive.google.com/file/d/1Rrt8VyWL0jlK-yfy_Rwn4zaapwTLeRX8/view'
)
    .then(filePath => {
        console.log('File downloaded to:', filePath);
    })
    .catch(console.error);
