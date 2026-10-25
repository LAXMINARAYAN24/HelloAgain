import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
export async function openDatabase({ path = './data/helloagain.sqlite', url, caPath } = {}) {
  if (url) {
    // The private schema is intentionally absent from Supabase's browser Data API.
    const localDatabase=['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname);
    const pool = new pg.Pool({connectionString:url, max:5, ssl:caPath ? {ca:readFileSync(caPath,'utf8'),rejectUnauthorized:true} : localDatabase?undefined:{rejectUnauthorized:true}});
    const query = async (client, sql, args=[]) => {let index=0; return client.query(sql.replace(/\?/g,()=>`$${++index}`),args);};
    const wrap = client => ({
      all: async (sql,args=[]) => (await query(client,sql,args)).rows,
      get: async (sql,args=[]) => (await query(client,sql,args)).rows[0],
      run: async (sql,args=[]) => {const r=await query(client,sql,args);return {changes:r.rowCount};}
    });
    const setup=await pool.connect();
    try {
      await setup.query('CREATE SCHEMA IF NOT EXISTS helloagain');
      await setup.query('REVOKE ALL ON SCHEMA helloagain FROM PUBLIC');
      await setup.query('SET search_path TO helloagain');
      await setup.query(schema);
      for(const table of ['users','sessions','account_tokens','connections','messages','random_rooms','blocks','reports','audit','rate_limits','traffic_meta','traffic_daily','traffic_seen'])await setup.query(`ALTER TABLE helloagain.${table} ENABLE ROW LEVEL SECURITY`);
      // Explicitly revoke browser roles when running on Supabase.
      await setup.query(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
          REVOKE ALL ON SCHEMA helloagain FROM anon;
          REVOKE ALL ON ALL TABLES IN SCHEMA helloagain FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
          REVOKE ALL ON SCHEMA helloagain FROM authenticated;
          REVOKE ALL ON ALL TABLES IN SCHEMA helloagain FROM authenticated;
        END IF;
      END $$`);
    } finally {setup.release();}
    return {kind:'postgres', async transaction(fn) {const c=await pool.connect();try{await c.query('BEGIN');await c.query('SET LOCAL search_path TO helloagain');await c.query("SELECT pg_advisory_xact_lock(725931)");const r=await fn(wrap(c));await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}},close:()=>pool.end()};
  }
  const file=path===':memory:' ? path : resolve(path);
  if(file!==':memory:')mkdirSync(dirname(file),{recursive:true});
  const sqlite=new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  sqlite.exec(schema);
  const wrap={all:async(s,a=[])=>sqlite.prepare(s).all(...a),get:async(s,a=[])=>sqlite.prepare(s).get(...a),run:async(s,a=[])=>sqlite.prepare(s).run(...a)};
  let tail=Promise.resolve();
  return {kind:'sqlite',transaction(fn){const pending=tail.then(async()=>{sqlite.exec('BEGIN IMMEDIATE');try{const r=await fn(wrap);sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}});tail=pending.catch(()=>{});return pending;},close:async()=>{await tail;sqlite.close();}};
}
