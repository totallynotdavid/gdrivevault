import path from 'path';

const baseDirectories = {
    databases: path.join(process.cwd(), 'storage', 'databases'),
    downloads: path.join(process.cwd(), 'storage', 'downloads'),
    logs: path.join(process.cwd(), 'logs'),
};

const defaultConfig = {
    folderId: '',
    tokenPath: path.join(process.cwd(), 'storage', 'auth', 'tokens', 'token.json'),
    credentialsPath: path.join(process.cwd(), 'storage', 'auth', 'credentials.json'),
};

export {defaultConfig, baseDirectories};
