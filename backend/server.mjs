import { createApplication } from './app.mjs';
const runtime=await createApplication();
const host=process.env.HOST??'127.0.0.1',port=Number(process.env.PORT??4310);
const server=runtime.app.listen(port,host,()=>console.log(`HelloAgain is ready at http://${host}:${port}${runtime.demo?' (local sample profiles enabled)':''}`));
runtime.video.attach(server);
const cleanupTimer=setInterval(()=>runtime.cleanup().catch(()=>console.error('Retention cleanup failed.')),3600000);cleanupTimer.unref();
async function stop(){clearInterval(cleanupTimer);runtime.video.finishAll();server.close(async()=>{await runtime.close();process.exit(0);});}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
