type TurnstileClient = { render:(element:HTMLElement,options:{sitekey:string,callback:(token:string)=>void})=>string;reset:(id?:string)=>void };
declare global { interface Window { turnstile?: TurnstileClient; dataLayer?: Record<string,unknown>[] } }
const form=document.querySelector<HTMLFormElement>('#winner-contact');
const message=document.querySelector<HTMLElement>('#form-status');
const offline=document.querySelector<HTMLElement>('#form-offline');
const widget=document.querySelector<HTMLElement>('#winner-turnstile');
const submit=document.querySelector<HTMLButtonElement>('#winner-submit');
function status(text:string){if(message)message.textContent=text;}
if(form && offline && widget && submit){
  let captchaToken='';
  let widgetId:string|undefined;
  fetch('/api/contact-config',{headers:{Accept:'application/json'},cache:'no-store'})
    .then(async(r)=>r.ok?await r.json():{enabled:false})
    .then(async(c)=>{
      if(!c?.enabled || !c.siteKey) return;
      await new Promise<void>((resolve,reject)=>{
        const s=document.createElement('script');
        s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async=true;
        s.onload=()=>resolve();
        s.onerror=()=>reject(new Error('challenge_unavailable'));
        document.head.appendChild(s);
      });
      if(!window.turnstile) return;
      widgetId=window.turnstile.render(widget,{sitekey:c.siteKey,callback:(value:string)=>{captchaToken=value;}});
      form.hidden=false;
      offline.hidden=true;
    }).catch(()=>{offline.hidden=false;});
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const fields=new FormData(form);
    const phone=String(fields.get('phone')||'').trim(),email=String(fields.get('email')||'').trim();
    if(!form.checkValidity()){form.reportValidity();return;}
    if(!phone&&!email){status('กรุณากรอกเบอร์โทรหรืออีเมลอย่างน้อยหนึ่งช่อง');return;}
    if(!captchaToken){status('กรุณาผ่านการตรวจสอบความปลอดภัยก่อนส่ง');return;}
    const params=new URLSearchParams(window.location.search);
    const payload={
      name:fields.get('name'),phone,email,category:fields.get('category'),message:fields.get('message'),
      consent:fields.get('consent')==='on',companyWebsite:fields.get('companyWebsite'),
      turnstileToken:captchaToken,page:window.location.pathname,
      utm_source:params.get('utm_source')||'',utm_medium:params.get('utm_medium')||'',
      utm_campaign:params.get('utm_campaign')||'',
    };
    submit.disabled=true;status('กำลังส่งข้อมูล...');
    try{
      const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const result=await response.json();
      if(!response.ok||!result.ok) throw new Error('send_failed');
      status('ส่งข้อมูลสำเร็จ หมายเลขอ้างอิง: '+result.leadId+' กรุณาจดเลขนี้ไว้สำหรับติดตามกับทีมงาน');
      form.reset();captchaToken='';window.turnstile?.reset(widgetId);
      window.dataLayer?.push({event:'winnerit_form_success',category:payload.category,page:window.location.pathname});
    }catch{
      status('ไม่สามารถส่งแบบฟอร์มได้ในขณะนี้ กรุณาทัก LINE @WEBUY โดยตรงเพื่อไม่ให้ข้อมูลตกหล่น');
      window.turnstile?.reset(widgetId);captchaToken='';
    }finally{submit.disabled=false;}
  });
}

// LINE Official Account fallback: no PII is posted to this website.
// The user reviews and explicitly sends the prefilled message from LINE.
const lineIntake=document.querySelector<HTMLFormElement>('#winner-line-intake');
const lineStatus=document.querySelector<HTMLElement>('#winner-line-intake-status');
lineIntake?.addEventListener('submit',e=>{
  e.preventDefault();
  if(!lineIntake.checkValidity()){lineIntake.reportValidity();return;}
  const fields=new FormData(lineIntake);
  const name=String(fields.get('name')||'').trim().slice(0,60);
  const category=String(fields.get('category')||'').trim().slice(0,40);
  const details=String(fields.get('details')||'').trim().slice(0,450);
  const province=String(fields.get('province')||'').trim().slice(0,80);
  if(details.length<10 || !category)return;
  const message=[
    'สวัสดีครับ/ค่ะ ต้องการประเมินราคาสินค้าไอทีผ่าน Winner IT',
    name?'ชื่อผู้ติดต่อ: '+name:'',
    'ประเภท: '+category,
    'รายละเอียด: '+details,
    province?'จังหวัด: '+province:'',
    'หากมีรูปเครื่องจะส่งเพิ่มในแชท',
  ].filter(Boolean).join('\n');
  const url='https://line.me/R/oaMessage/%40webuy/?'+encodeURIComponent(message);
  // A direct synchronous click avoids popup blockers. LINE does not send automatically.
  window.open(url,'_blank','noopener,noreferrer');
  if(lineStatus)lineStatus.textContent='เปิดแชท LINE แล้ว กรุณาตรวจสอบข้อความและกดส่งใน LINE เพื่อให้ทีมงานได้รับข้อมูล';
  window.dataLayer?.push({event:'winnerit_line_intake_open',category,page:window.location.pathname});
});
