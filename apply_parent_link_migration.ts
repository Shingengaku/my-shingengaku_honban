import { readFileSync } from 'fs';
import { parse } from 'dotenv';
import path from 'path';
import { Client } from 'pg';

const envConfig = parse(readFileSync(path.resolve(process.cwd(), '.env.local')));
const connectionString = envConfig.DATABASE_URL;

async function run() {
    if (!connectionString) {
        console.error("No DATABASE_URL found in .env.local");
        return;
    }

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // SQLファイルの読み込み
        const sqlPath = path.resolve(process.cwd(), 'supabase_migration_add_parent_link.sql');
        const sql = readFileSync(sqlPath, 'utf8');

        console.log("Applying migration...");
        await client.query(sql);
        console.log("Migration applied successfully!");

    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await client.end();
    }
}
run();
