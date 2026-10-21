import {mkdir,writeFile,readdir,readFile,stat,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';
export function createMailer({production=false,origin,mailDirectory=process.env.MAIL_DIRECTORY??'./data/mail'}={}){
 const mode=production?'smtp':process.env.EMAIL_MODE??'local';
 if(!['smtp','local'].includes(mode))throw new Error('EMAIL_MODE must be local or smtp.');
 if(mode==='smtp'&&(!process.env.SMTP_HOST||!process.env.SMTP_FROM))throw new Error('SMTP_HOST and SMTP_FROM are required for email delivery.');
 const transport=mode==='smtp'?nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT??587),secure:process.env.SMTP_SECURE==='true',requireTLS:process.env.SMTP_SECURE!=='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000}):null;
 async function purge(email){if(mode!=='local')return;const dir=resolve(mailDirectory);const files=await readdir(dir).catch(()=>[]);for(const file of files){if(!file.endsWith('.eml'))continue;const path=resolve(dir,file);const info=await stat(path);if(Date.now()-info.mtimeMs>86400000||(email&&(await readFile(path,'utf8')).startsWith(`To: ${email}\n`)))await unlink(path);}}
 return {mode,purge,async reset(email,token){const url=new URL(origin);url.searchParams.set('reset',token);const text=`Someone requested a password reset for your HelloAgain account.\n\nOpen this link within 30 minutes:\n${url.href}\n\nIf this was not you, ignore this email. Your password has not changed.\n`;
   if(mode==='smtp')await transport.sendMail({from:process.env.SMTP_FROM,to:email,subject:'Reset your HelloAgain password',text});
   else{await mkdir(resolve(mailDirectory),{recursive:true});await writeFile(resolve(mailDirectory,`${Date.now()}-${randomUUID()}.eml`),`To: ${email}\nSubject: Reset your HelloAgain password\n\n${text}`,{mode:0o600});}
 }};
}
