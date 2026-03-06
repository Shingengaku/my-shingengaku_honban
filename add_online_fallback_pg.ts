import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'dotenv';
import path from 'path';
import { Client } from 'pg';

const envConfig = parse(readFileSync(path.resolve(process.cwd(), '.env.local')));
const connectionString = envConfig.DATABASE_URL;

async function run() {
    if (!connectionString) {
        console.error("No DATABASE_URL found");
        return;
    }

    // We might need to adjust ssl depending on provider
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Check if exists
        const checkRes = await client.query("SELECT * FROM public.online_options WHERE name = 'LIVE視聴（2会場）'");
        if (checkRes.rows.length > 0) {
            console.log("Option already exists:", checkRes.rows[0]);
        } else {
            // 2. Insert
            const insertRes = await client.query("INSERT INTO public.online_options (name, type, sort_order) VALUES ('LIVE視聴（2会場）', 'online', 15) RETURNING *");
            console.log("Inserted:", insertRes.rows[0]);
        }

    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await client.end();
    }
}
run();
