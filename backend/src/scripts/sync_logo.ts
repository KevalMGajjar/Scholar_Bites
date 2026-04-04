import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

const AHMEDABAD_UNIVERSITY_ID = '453dcc78-486d-4d80-b59a-b5c578260bc4';

async function syncLogo() {
    const client = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'postgres',
        password: process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT || '5432'),
    });

    try {
        await client.connect();
        console.log('Connected to DB');

        const result = await client.query('SELECT logo_url FROM universities WHERE id = $1', [AHMEDABAD_UNIVERSITY_ID]);
        if (result.rows.length === 0) {
            console.error('Ahmedabad University not found.');
            process.exit(1);
        }

        const logoUrl = result.rows[0].logo_url;
        console.log('Logo URL:', logoUrl);

        if (!logoUrl) {
            console.log('No logo URL found in DB.');
            process.exit(0);
        }

        // Download the logo
        const downloadFile = (url: string, dest: string) => {
            return new Promise<void>((resolve, reject) => {
                const file = fs.createWriteStream(dest);
                https.get(url, (response) => {
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlink(dest, () => {});
                    reject(err);
                });
            });
        };

        const adminLogoPath = path.resolve(__dirname, '../../admin-panel/public/admin/logo.png');
        const deanLogoPath = path.resolve(__dirname, '../../dean-portal/public/logo.png');
        const flutterLogoPath = path.resolve(__dirname, '../../frontend/assets/logo.png');
        
        console.log('Downloading to:', adminLogoPath);
        await downloadFile(logoUrl, adminLogoPath);
        console.log('Successfully saved admin logo');

        console.log('Downloading to:', deanLogoPath);
        await downloadFile(logoUrl, deanLogoPath);
        console.log('Successfully saved dean portal logo');

        if (fs.existsSync(path.dirname(flutterLogoPath))) {
            console.log('Downloading to:', flutterLogoPath);
            await downloadFile(logoUrl, flutterLogoPath);
            console.log('Successfully saved flutter logo');
        }

        console.log('Logo successfully synchronized everywhere.');
    } catch (error) {
        console.error('Error synchronizing logo:', (error as Error).message);
    } finally {
        await client.end();
    }
}

syncLogo();
