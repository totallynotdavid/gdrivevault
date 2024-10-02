import path from 'path';

const defaultConfig = {
    folderId: '',
    tokenPath: path.join(process.cwd(), 'storage', 'auth', 'tokens', 'token.json'),
    credentialsPath: path.join(process.cwd(), 'storage', 'auth', 'credentials.json'),
    databasePath: path.join(
        process.cwd(),
        'storage',
        'databases',
        'drive_database.sqlite'
    ),
    downloadsPath: path.join(process.cwd(), 'storage', 'downloads'),
    logsPath: path.join(process.cwd(), 'logs'),
};

export default defaultConfig;
