import {mkdir,writeFile,readdir,readFile,stat,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';

export function createMailer({production=false,origin,mailDirectory=process.env.MAIL_DIRECTORY??'./data/mail',mode=process.env.EMAIL_MODE??(production?'smtp':'local'),brevoKey=process.env.BREVO_API_KEY,fromEmail=process.env.EMAIL_FROM,fromName=process.env.EMAIL_FROM_NAME??'HelloAgain',fetchImpl=fetch}={}){
 if(!['smtp','local','brevo'].includes(mode))throw new Error('EMAIL_MODE must be local, smtp, or brevo.');
 if(production&&mode==='local')throw new Error('Production requires a real email provider; local mail is development-only.');
 if(mode==='smtp'&&(!process.env.SMTP_HOST||!process.env.SMTP_FROM))throw new Error('SMTP_HOST and SMTP_FROM are required for email delivery.');
 if(mode==='brevo'&&(!brevoKey||!fromEmail||!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(fromEmail)))throw new Error('BREVO_API_KEY and a verified EMAIL_FROM address are required.');
 const transport=mode==='smtp'?nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT??587),secure:process.env.SMTP_SECURE==='true',requireTLS:process.env.SMTP_SECURE!=='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,connectionTimeout:8000,greetingTimeout:8000,socketTimeout:10000}):null;
 async function purge(email){if(mode!=='local')return;const dir=resolve(mailDirectory);const files=await readdir(dir).catch(()=>[]);for(const file of files){if(!file.endsWith('.eml'))continue;const path=resolve(dir,file);const info=await stat(path);if(Date.now()-info.mtimeMs>86400000||(email&&(await readFile(path,'utf8')).startsWith(`To: ${email}\n`)))await unlink(path);}}
 return {mode,purge,async reset(email,token){
  const url=new URL(origin);url.searchParams.set('reset',token);
  const text=`Someone requested a password reset for your HelloAgain account.\n\nOpen this link within 30 minutes:\n${url.href}\n\nIf this was not you, ignore this email. Your password has not changed.\n`;
  const subject='Reset your HelloAgain password';
  if(mode==='smtp')await transport.sendMail({from:process.env.SMTP_FROM,to:email,subject,text});
  else if(mode==='brevo'){
   let response;
   try{response=await fetchImpl('https://api.brevo.com/v3/smtp/email',{method:'POST',redirect:'error',headers:{'api-key':brevoKey,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{email:fromEmail,name:fromName},to:[{email}],subject,textContent:text}),signal:AbortSignal.timeout(8000)});}catch{throw new Error('Email provider could not be reached.');}
   if(response.status!==201)throw new Error('Email provider did not accept the message.');
   let result;try{result=await response.json();}catch{throw new Error('Email provider returned an invalid response.');}
   if(typeof result.messageId!=='string'||!result.messageId)throw new Error('Email provider did not confirm acceptance.');
  }else{
   await mkdir(resolve(mailDirectory),{recursive:true});await writeFile(resolve(mailDirectory,`${Date.now()}-${randomUUID()}.eml`),`To: ${email}\nSubject: ${subject}\n\n${text}`,{mode:0o600});
  }
 }};
}
