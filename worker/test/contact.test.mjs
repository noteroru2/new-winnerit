import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../index.js';
const root='https://winnerit.in.th';
const env=()=>({ASSETS:{fetch:async()=>new Response('hello',{status:200})}});
const configured=()=>({...env(),CONTACT_WEBHOOK_URL:'https://n8n.example.test/webhook/winnerit',CONTACT_WEBHOOK_BEARER_TOKEN:'top-secret',TURNSTILE_SITE_KEY:'test-public',TURNSTILE_SECRET_KEY:'test-private',SEO_EVENTS:{writeDataPoint:()=>{}}});
const post=(url,body,origin=root)=>new Request(root+url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const data={name:'Somchai',phone:'0812345678',email:'',category:'notebook',message:'Notebook Intel i5 SSD 512GB screen good',consent:true,turnstileToken:'test-token',page:'/contact/',utm_source:'google',utm_medium:'organic'};
test('canonical redirects legacy url and assets still serve',async()=>{
 const r=await worker.fetch(new Request(root+'/buy-laptop'),env());assert.equal(r.status,308);assert.equal(decodeURIComponent(new URL(r.headers.get('location')).pathname),'/รับซื้อโน๊ตบุ๊ค/');
 const ok=await worker.fetch(new Request(root+'/'),env());assert.equal(ok.status,200);
});
test('form disabled without secrets and no false delivery',async()=>{
 const config=await worker.fetch(new Request(root+'/api/contact-config'),env());assert.equal((await config.json()).enabled,false);
 const res=await worker.fetch(post('/api/contact',data),env());assert.equal(res.status,503);
});
test('cross origin rejected, malformed data rejected',async()=>{
 assert.equal((await worker.fetch(post('/api/contact',data,'https://evil.example'),configured())).status,403);
 assert.equal((await worker.fetch(post('/api/contact',{...data,phone:'',email:''}),configured())).status,400);
});
test('Turnstile and webhook must both succeed; no PIIs in event',async()=>{
 const oldFetch=globalThis.fetch, forwarded=[];let count=0;
 globalThis.fetch=async(url,opts)=>{
  if(String(url).includes('siteverify')) return new Response(JSON.stringify({success:true,hostname:'winnerit.in.th'}));
  if(String(url).includes('n8n.example.test')){forwarded.push(JSON.parse(opts.body));return new Response('{}',{status:200});}
  throw Error('unexpected fetch');
 };
 try {
  const r=await worker.fetch(post('/api/contact',data),configured());
  const result=await r.json();assert.equal(r.status,200);assert.equal(result.ok,true);assert.ok(result.leadId);
  assert.equal(forwarded.length,1);assert.equal(forwarded[0].contact.phone,data.phone);
  assert.equal(forwarded[0].attribution.utm_source,'google');
  const events=[];
  const e=await worker.fetch(post('/api/events',{event:'line_click',page:'/รับซื้อโน๊ตบุ๊ค/',placement:'hero',utm_source:'google'}),{...env(),SEO_EVENTS:{writeDataPoint:(x)=>events.push(x)}});
  assert.equal(e.status,200);assert.equal(events.length,1);
  assert.equal(events[0].blobs[1],'/รับซื้อโน๊ตบุ๊ค/', 'Thai landing page must not be stripped from analytics');
  assert.ok(!JSON.stringify(events).includes(data.phone));assert.ok(!JSON.stringify(events).includes(data.name));
 } finally {globalThis.fetch=oldFetch;}
});
test('no false success if webhook fails or CAPTCHA fails',async()=>{
 const oldFetch=globalThis.fetch;try{
  globalThis.fetch=async(url)=>String(url).includes('siteverify')?new Response(JSON.stringify({success:false})):new Response('{}',{status:200});
  const captcha=await worker.fetch(post('/api/contact',data),configured());assert.equal(captcha.status,403);
  globalThis.fetch=async(url)=>String(url).includes('siteverify')?new Response(JSON.stringify({success:true,hostname:'winnerit.in.th'})):new Response('failure',{status:503});
  const webhook=await worker.fetch(post('/api/contact',data),configured());assert.equal(webhook.status,502);
 } finally {globalThis.fetch=oldFetch;}
});
