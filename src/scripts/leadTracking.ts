declare global {interface Window {dataLayer?: Record<string,unknown>[]}}
function normalized(value:string,length=64){return value.slice(0,length).replace(/[^a-zA-Z0-9_./-]/g,'');}
function track(event:'line_click'|'phone_click',placement:string){
  const url=new URL(window.location.href);
  const payload={
    event, page:window.location.pathname,placement:normalized(placement),
    utm_source:normalized(url.searchParams.get('utm_source')||''),
    utm_medium:normalized(url.searchParams.get('utm_medium')||''),
  };
  window.dataLayer?.push({event:'winnerit_'+event,...payload});
  if(navigator.sendBeacon){
    navigator.sendBeacon('/api/events',new Blob([JSON.stringify(payload)],{type:'application/json'}));
  }
}
document.addEventListener('click',(e)=>{
  const anchor=(e.target as HTMLElement|null)?.closest('a[href]') as HTMLAnchorElement|null;
  if(!anchor) return;
  const href=anchor.href;
  const placement=anchor.dataset.leadPlacement || 'site_link';
  if(href.startsWith('https://line.me/R/ti/p/@webuy'))track('line_click',placement);
  else if(href.startsWith('tel:'))track('phone_click',placement);
},{capture:true});
