import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
if(process.env.DATABASE_URL){console.error('For PostgreSQL, use your provider backup controls or an encrypted pg_dump procedure. This script is for local SQLite only.');process.exit(1);}
const source=resolve(process.env.SQLITE_PATH??'./data/helloagain.sqlite');
if(!existsSync(source)){console.error('Start the website once to create the local database.');process.exit(1);}
const directory=resolve('./data/backups');mkdirSync(directory,{recursive:true});
const target=resolve(directory,`helloagain-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
const db=new DatabaseSync(source);
try{await backup(db,target);console.log(`Local database backup saved: ${target}`);}finally{db.close();}
