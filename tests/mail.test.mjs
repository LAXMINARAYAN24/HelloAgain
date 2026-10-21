import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMailer} from '../backend/mail.mjs';
const options={production:true,mode:'brevo',origin:'https://helloagain.example',brevoKey:'isolated-test-key',fromEmail:'hello@verified.example'};

test('production email never falls back to a local outbox or starts without API credentials',()=>{
 assert.throws(()=>createMailer({...options,mode:'local'}),/development-only/);
 assert.throws(()=>createMailer({...options,brevoKey:''}),/BREVO_API_KEY/);
 assert.throws(()=>createMailer({...options,fromEmail:'bad sender'}),/verified EMAIL_FROM/);
});

test('HTTPS recovery sends only the requested recipient and a single-use link to the configured site',async()=>{
 let sent;
 const mailer=createMailer({...options,fetchImpl:async(url,request)=>{sent={url,request};return {status:201,json:async()=>({messageId:'accepted-test-message'})};}});
 await mailer.reset('member@example.test','isolated-reset-token');
 assert.equal(sent.url,'https://api.brevo.com/v3/smtp/email');assert.equal(sent.request.redirect,'error');
 const message=JSON.parse(sent.request.body);assert.deepEqual(message.to,[{email:'member@example.test'}]);assert.equal(message.sender.email,'hello@verified.example');
 assert.match(message.textContent,/https:\/\/helloagain\.example\/\?reset=isolated-reset-token/);assert.match(message.textContent,/30 minutes/);assert.equal(message.bcc,undefined);
});

test('email refusal, redirects, bad responses and network failures never report acceptance or expose provider details',async()=>{
 for(const fetchImpl of [async()=>({status:403,json:async()=>({message:'private-provider-details'})}),async()=>({status:302}),async()=>({status:201,json:async()=>({})}),async()=>{throw new Error('private-provider-details');}]){
  const mailer=createMailer({...options,fetchImpl});await assert.rejects(mailer.reset('member@example.test','isolated-reset-token'),error=>error.message.startsWith('Email provider')&&!error.message.includes('private-provider-details'));
 }
});
