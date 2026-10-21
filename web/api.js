export async function api(path, options={}){
 const response=await fetch(`/api${path}`,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},body:options.body?JSON.stringify(options.body):undefined});
 const data=await response.json().catch(()=>({error:'The server could not be reached.'}));
 if(!response.ok){const e=new Error(data.error||'Something went wrong.');e.status=response.status;throw e;}return data;
}
export const post=(path,body={})=>api(path,{method:'POST',body});
