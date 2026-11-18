const CANONICAL_HOST = 'winnerit.in.th';
const ALLOWED_HOST = 'https://' + CANONICAL_HOST;
const LEGACY_PATHS = new Map([
  ['/buy-laptop', '/รับซื้อโน๊ตบุ๊ค/'],
  ['/buy-computer', '/รับซื้อคอมพิวเตอร์/'],
  ['/buy-macbook', '/รับซื้อmacbook/'],
  ['/buy-iphone', '/รับซื้อiphone/'],
  ['/buy-ipad', '/รับซื้อipad/'],
  ['/buy-camera', '/รับซื้อกล้อง/'],
  ['/buy-phone', '/รับซื้อมือถือ/'],
]);
function canonicalPath(pathname) {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (LEGACY_PATHS.has(trimmed)) return LEGACY_PATHS.get(trimmed);
  const flatLegacy = trimmed.match(/^\/(services|locations|prices)-(.+)$/);
  if (flatLegacy) return '/' + flatLegacy[1] + '/' + flatLegacy[2] + '/';
  const segment = trimmed.split('/').pop() ?? '';
  const isFile = segment.includes('.') || trimmed.startsWith('/.well-known/');
  if (trimmed !== '/' && !isFile) return trimmed + '/';
  return trimmed || '/';
}
const json = (value, status=200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
});
const clean = (x,max=160) => typeof x === 'string' ? x.trim().slice(0,max) : '';
const cleanDimension = (x,max=64) => clean(x,max).replace(/[^a-zA-Z0-9_./-]/g,'');
const sameOrigin = (request) => request.headers.get('Origin') === ALLOWED_HOST;
const enabled = (env) => Boolean(
  env.CONTACT_WEBHOOK_URL && /^https:\/\//.test(env.CONTACT_WEBHOOK_URL)
  && env.CONTACT_WEBHOOK_BEARER_TOKEN && env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY
);
const tooLarge = (request) => Number(request.headers.get('Content-Length') || 0) > 12000;
async function readJson(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json') || tooLarge(request)) return null;
  const raw = await request.text();
  if (raw.length > 12000) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
async function handleContact(request,env) {
  if (request.method !== 'POST') return json({error:'method_not_allowed'},405);
  if (!sameOrigin(request)) return json({error:'forbidden_origin'},403);
  if (!enabled(env)) return json({error:'contact_unavailable',line:'https://line.me/R/ti/p/@webuy'},503);
  const data = await readJson(request);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({error:'invalid_payload'},400);
  if (clean(data.companyWebsite,150)) return json({ok:true},200); // honeypot; do not forward
  const name=clean(data.name,90),email=clean(data.email,120),phone=clean(data.phone,30);
  const category=clean(data.category,50),message=clean(data.message,2500);
  const categories=new Set(['notebook','pc','macbook','iphone','ipad','camera','lot','other']);
  const validEmail=email.length<=120 && (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const validPhone=!phone || /^\+?[0-9\s\-()]{9,30}$/.test(phone);
  if(name.length<2 || !validEmail || !validPhone || (!email&&!phone)
    || !categories.has(category) || message.length<20 || data.consent!==true) {
    return json({error:'invalid_fields'},400);
  }
  const token=clean(data.turnstileToken,4000);
  if (!token) return json({error:'captcha_required'},400);
  let verification;
  try {
    const body = new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token});
    const resp=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body});
    verification=await resp.json();
  } catch {return json({error:'captcha_check_unavailable'},503);}
  if(!verification?.success || (verification.hostname && verification.hostname!==CANONICAL_HOST))
    return json({error:'captcha_failed'},403);
  const id=crypto.randomUUID();
  const entry={
    kind:'winnerit_contact', leadId:id, receivedAt:new Date().toISOString(),
    source:'winnerit.in.th',
    contact:{name,email,phone},
    category,message,
    attribution:{
      page:cleanDimension(data.page,150),
      utm_source:cleanDimension(data.utm_source,60),
      utm_medium:cleanDimension(data.utm_medium,60),
      utm_campaign:cleanDimension(data.utm_campaign,60),
    },
    consent:true,
  };
  try {
    const dest=await fetch(env.CONTACT_WEBHOOK_URL,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+env.CONTACT_WEBHOOK_BEARER_TOKEN,
        'X-WinnerIT-Source':'winnerit.in.th',
      },
      body:JSON.stringify(entry),
      signal:AbortSignal.timeout(8000),
    });
    if(!dest.ok) return json({error:'delivery_failed'},502);
  } catch {return json({error:'delivery_failed'},502);}
  try {env.SEO_EVENTS?.writeDataPoint({blobs:['contact_form_success',cleanDimension(data.page,150),'contact','form',category],doubles:[1]});} catch {}
  return json({ok:true,leadId:id});
}
async function handleEvent(request,env) {
  if(request.method!=='POST') return json({error:'method_not_allowed'},405);
  if(!sameOrigin(request)) return json({error:'forbidden_origin'},403);
  const data=await readJson(request);
  if(!data || !['line_click','phone_click'].includes(data.event)) return json({error:'invalid_event'},400);
  const path=cleanDimension(data.page,150),placement=cleanDimension(data.placement,60);
  const medium=cleanDimension(data.utm_medium,60),source=cleanDimension(data.utm_source,60);
  if(!path.startsWith('/')) return json({error:'invalid_path'},400);
  if(env.SEO_EVENTS) env.SEO_EVENTS.writeDataPoint({
    blobs:[data.event,path,placement,source,medium], doubles:[1],
  });
  return json({ok:true,recorded:Boolean(env.SEO_EVENTS)});
}
export default {
  async fetch(request,env) {
    const incoming = new URL(request.url);
    const target = new URL(incoming);
    target.protocol = 'https:';
    target.hostname = CANONICAL_HOST;
    target.port = '';
    if(incoming.pathname.startsWith('/api/')){
      if(target.toString()!==incoming.toString()) return Response.redirect(target.toString(),308);
      if(incoming.pathname==='/api/contact-config' && request.method==='GET')
        return json({enabled:enabled(env),siteKey:enabled(env)?env.TURNSTILE_SITE_KEY:null});
      if(incoming.pathname==='/api/contact') return handleContact(request,env);
      if(incoming.pathname==='/api/events') return handleEvent(request,env);
      return json({error:'not_found'},404);
    }
    target.pathname = canonicalPath(incoming.pathname);
    if(target.toString()!==incoming.toString()) return Response.redirect(target.toString(),308);
    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);
    headers.set('Strict-Transport-Security','max-age=31536000; includeSubDomains');
    headers.set('X-Content-Type-Options','nosniff');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  },
};
