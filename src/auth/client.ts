import fs from 'fs/promises';
import {authenticate} from '@google-cloud/local-auth';
import {google, Auth} from 'googleapis';
import {logger} from '../utils/logger';
import {AuthClientConfig} from '../types';

export async function loadSavedCredentialsIfExist(
    tokenPath: string
): Promise<Auth.OAuth2Client | null> {
    try {
        const content = await fs.readFile(tokenPath, 'utf-8');
        const credentials = JSON.parse(content);
        const client = google.auth.fromJSON(credentials) as Auth.OAuth2Client;
        client.setCredentials(credentials);
        logger.info('Loaded saved credentials.');
        return client;
    } catch (err) {
        logger.warn('No saved credentials found or failed to load:', err);
        return null;
    }
}

export async function saveCredentials(
    client: Auth.OAuth2Client,
    tokenPath: string
): Promise<void> {
    try {
        const content = await fs.readFile(tokenPath, 'utf-8');
        const keys = JSON.parse(content);
        const key = keys.installed || keys.web;

        const payload = JSON.stringify({
            type: 'authorized_user',
            client_id: key.client_id,
            client_secret: key.client_secret,
            refresh_token: client.credentials.refresh_token,
            access_token: client.credentials.access_token,
            expiry_date: client.credentials.expiry_date,
        });

        await fs.writeFile(tokenPath, payload);
        logger.info('Credentials saved successfully.');
    } catch (err) {
        logger.error('Error saving credentials:', err);
        throw new Error('Failed to save credentials.');
    }
}

export async function authorize(config: AuthClientConfig): Promise<Auth.OAuth2Client> {
    const {tokenPath, credentialsPath} = config;
    let client = await loadSavedCredentialsIfExist(tokenPath);

    if (client) {
        try {
            await client.getAccessToken();
            return client;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            if (err?.response?.data?.error === 'invalid_grant') {
                logger.warn('Invalid refresh token. Reauthenticating...');
                await fs.unlink(tokenPath).catch(() => {
                    logger.warn('Token file does not exist.');
                });
                client = null;
            } else {
                logger.error('Error obtaining access token:', err);
                throw err;
            }
        }
    }

    if (!client) {
        client = await authenticate({
            scopes: ['https://www.googleapis.com/auth/drive'],
            keyfilePath: credentialsPath,
        });

        if (client.credentials) {
            await saveCredentials(client, tokenPath);
            return client;
        } else {
            throw new Error(
                'Failed to obtain credentials. Please reauthorize the application.'
            );
        }
    }

    throw new Error('Authorization failed. Please reauthorize the application.');
}
