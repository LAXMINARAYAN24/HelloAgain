import { openDatabase } from '../backend/database.mjs';
const args=process.argv.slice(2),email=args[args.indexOf('--email')+1];
if(!args.includes('--email')||!email||email.startsWith('--')){console.error('Create the account in the website first. Then run: npm run admin -- --email owner@example.com');process.exit(1);}
const db=await openDatabase({path:process.env.SQLITE_PATH,url:process.env.DATABASE_URL,caPath:process.env.PG_CA_CERT_PATH});
try{await db.transaction(async db=>{const user=await db.get('SELECT id,status FROM users WHERE email=?',[email.toLowerCase()]);if(!user)throw new Error('Create this account in the website first.');if(user.status!=='active')throw new Error('The account must be active.');await db.run("UPDATE users SET role='admin' WHERE id=?",[user.id]);console.log('Administrator access granted. Refresh the website to see Moderation.');});}catch(e){console.error(e.message);process.exitCode=1;}finally{await db.close();}
