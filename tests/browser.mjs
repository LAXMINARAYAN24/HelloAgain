import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {createApplication} from '../backend/app.mjs';
const origin='http://127.0.0.1:4312',mailDirectory=resolve('../../work/browser-mail',randomUUID());
const runtime=await createApplication({videoModerator:null,databasePath:':memory:',databaseUrl:'',demo:false,production:false,origin,mailDirectory});
const server=runtime.app.listen(4312,'127.0.0.1');await once(server,'listening');
const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];
const screenshots=new URL('../docs/screenshots/',import.meta.url);mkdirSync(screenshots,{recursive:true});
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1050}});const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.getByRole('heading',{name:/Say hello/}).waitFor();
 assert.equal(await page.locator('.profile-card').count(),0);assert.equal(await page.getByRole('button',{name:'Start',exact:true}).isDisabled(),true);await page.getByText('Camera screening unavailable',{exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL('random-home-desktop.png',screenshots)),fullPage:true});
 await page.getByRole('button',{name:/Log in/}).click();await page.getByRole('button',{name:'Create an account',exact:true}).click();
 await page.getByLabel('Display name',{exact:true}).fill('Jordan');await page.getByLabel('Email address',{exact:true}).fill('browser-member@example.test');await page.getByLabel(/^Password/).fill('Browser-test-password-2026!');await page.getByLabel('Date of birth',{exact:true}).fill('1999-04-12');await page.getByLabel(/^I am a/).selectOption('woman');
 await page.getByRole('dialog').getByRole('checkbox').nth(0).check();await page.getByRole('dialog').getByRole('checkbox').nth(1).check();await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('button',{name:'Jordan',exact:true}).waitFor();
 assert.equal(await page.locator('.profile-card').count(),0);assert.deepEqual(await page.getByLabel('Who to meet').locator('option').allTextContents(),['Random (everyone)','Men']);await page.getByLabel('Who to meet').selectOption('opposite');assert.equal(await page.getByLabel('Who to meet').inputValue(),'opposite');await page.getByLabel('Who to meet').selectOption('random');
 await page.getByRole('button',{name:'Jordan',exact:true}).click();await page.getByLabel('Display name',{exact:true}).fill('Jordan Updated');await page.getByRole('button',{name:'Save account',exact:true}).click();await page.getByRole('status').filter({hasText:'Account changes saved.'}).waitFor();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download my data'}).click();assert.equal((await download).suggestedFilename(),'helloagain-my-data.json');
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Live chat',exact:true}).click();await page.getByRole('button',{name:'Jordan Updated',exact:true}).waitFor();
 await page.getByRole('button',{name:'Rules',exact:true}).click();await page.getByRole('dialog').getByText(/Black screens, covered/i).first().waitFor();await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Log out',exact:true}).click();await page.getByRole('button',{name:/Log in/}).click();await page.getByRole('button',{name:'Forgot password?'}).click();await page.getByLabel('Email address',{exact:true}).fill('browser-member@example.test');await page.getByRole('button',{name:'Request recovery'}).click();await page.getByRole('status').filter({hasText:/reset email is saved/}).waitFor();
 const resetMail=readFileSync(resolve(mailDirectory,readdirSync(mailDirectory)[0]),'utf8');const resetUrl=resetMail.match(/http:\/\/\S+/)[0];await page.goto(resetUrl);await page.getByRole('heading',{name:'A fresh start.'}).waitFor();await page.getByLabel(/^New password/).fill('Changed-through-the-browser-2026!');await page.getByLabel('Repeat new password',{exact:true}).fill('Changed-through-the-browser-2026!');await page.getByRole('button',{name:'Set new password'}).click();await page.getByRole('heading',{name:'Good to see you again.'}).waitFor();await page.getByLabel('Email address',{exact:true}).fill('browser-member@example.test');await page.getByLabel('Password',{exact:true}).fill('Changed-through-the-browser-2026!');await page.getByRole('dialog').getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('button',{name:'Jordan Updated',exact:true}).waitFor();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true});const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(origin);await mp.getByRole('heading',{name:/Say hello/}).waitFor();assert.equal(await mp.locator('.profile-card').count(),0);assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mp.screenshot({path:fileURLToPath(new URL('random-home-mobile.png',screenshots)),fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: random-chat homepage without profiles, truthful unavailable state, simplified signup, Random/Men matching selector, account editing/export, rules, logout/recovery/login and mobile layout.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await runtime.close();}


