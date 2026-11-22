import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { createHash } from 'node:crypto';
const root=process.cwd(),base=join(root,'content','posts');
const files=readdirSync(base).filter(x=>x.endsWith('.md'));
const provinces=['กรุงเทพมหานคร','กรุงเทพฯ','อุบลราชธานี','ขอนแก่น','นครราชสีมา','อุดรธานี','นครสวรรค์','ชลบุรี','ระยอง','เชียงใหม่','เชียงราย','ศรีสะเกษ','ยะลา','ปัตตานี','สงขลา','ภูเก็ต','กระบี่','ตรัง','พัทลุง','สุราษฎร์ธานี','นครศรีธรรมราช','กาญจนบุรี','สุพรรณบุรี','สิงห์บุรี','สุโขทัย','กำแพงเพชร','สกลนคร','มหาสารคาม','อำนาจเจริญ','ยโสธร','ร้อยเอ็ด','กาฬสินธุ์','นครพนม','พิษณุโลก','เพชรบูรณ์','ปราจีนบุรี','จันทบุรี','ตราด','เพชรบุรี','ปทุมธานี','นนทบุรี','สมุทรปราการ','สมุทรสาคร','นครปฐม','ลำปาง','แพร่','น่าน','ลำพูน','พะเยา','หนองคาย','หนองบัวลำภู','เลย','บุรีรัมย์','สุรินทร์','อุตรดิตถ์','นครนายก','ชัยภูมิ','ชัยนาท','ลพบุรี','สระบุรี','อยุธยา','ราชบุรี','ตาก','อุทัยธานี','นครชัยศรี','หาดใหญ่','สุพรรณบ'];
const pRe=new RegExp(provinces.sort((a,b)=>b.length-a.length).join('|'),'g');
const records=files.map(file=>{
 const {data,content}=matter(readFileSync(join(base,file),'utf8'));
 const slug=String(data.slug||'');
 const prefix=slug.match(/^(services|locations|prices)-/)?.[1]||'flat';
 const title=String(data.title||'').trim();
 const plain=content.replace(/<[^>]+>/g,' ').replace(/https?:\/\/\S+/g,' ').replace(/[#*_`\[\]()]/g,' ').replace(/\s+/g,' ').trim();
 const normalized=plain.replace(pRe,'[จังหวัด]').replace(/[0-9]+/g,'#').trim();
 const titleKey=title.replace(pRe,'[จังหวัด]').replace(/\s+/g,' ').trim().toLowerCase();
 const textHash=createHash('sha256').update(normalized).digest('hex').slice(0,16);
 const reviewer=String(data.seo_reviewed_by||'').trim();
 const reviewedAt=String(data.seo_reviewed_at||'').trim();
 const evidence=String(data.seo_evidence||'').trim();
 const service=String(data.seo_service_verified||'').trim();
 const approved=data.seo_index===true && reviewer.length>=2
  && reviewedAt.length===10 && reviewedAt[4]==='-' && reviewedAt[7]==='-' && !Number.isNaN(Date.parse(reviewedAt))
  && evidence.length>=20 && service.length>=20;
 return{file,slug,prefix,title,titleKey,chars:plain.length,indexRequested:data.seo_index===true,indexable:approved,modified:data.modified||'',textHash,normalized};
});
const groups=new Map(),hashGroups=new Map();
for(const a of records){
 if(!groups.has(a.titleKey))groups.set(a.titleKey,[]);
 groups.get(a.titleKey).push(a);
 if(!hashGroups.has(a.textHash))hashGroups.set(a.textHash,[]);
 hashGroups.get(a.textHash).push(a);
}
const duplicateTitleGroups=[...groups.entries()].filter(([_,v])=>v.length>1).sort((a,b)=>b[1].length-a[1].length).slice(0,30).map(([title,v])=>({normalizedTitle:title,count:v.length,examples:v.slice(0,5).map(x=>x.slug)}));
const duplicateBodyGroups=[...hashGroups.entries()].filter(([_,v])=>v.length>1).sort((a,b)=>b[1].length-a[1].length).slice(0,30).map(([hash,v])=>({hash,count:v.length,examples:v.slice(0,5).map(x=>x.slug)}));
const charSet=(s)=>{const ret=new Set();for(let i=0;i<s.length-24;i+=10)ret.add(s.slice(i,i+24));return ret;};
const similar=[];
for(const [key,v] of groups){
 if(v.length<2||v.length>60)continue;
 const sample=v.slice(0,12);
 const sets=sample.map(x=>charSet(x.normalized.slice(0,1800)));
 for(let i=0;i<sample.length;i++)for(let j=i+1;j<sample.length;j++){
  if(sample[i].textHash===sample[j].textHash)continue;
  const first=sets[i],second=sets[j],small=first.size<second.size?first:second,large=first.size<second.size?second:first;
  if(!small.size)continue;
  let both=0;for(const token of small)if(large.has(token))both++;
  const overlap=both/Math.min(first.size,second.size);
  if(overlap>=0.65)similar.push({title:key,slug1:sample[i].slug,slug2:sample[j].slug,overlap:Number(overlap.toFixed(2))});
 }
}
similar.sort((a,b)=>b.overlap-a.overlap);
const byPrefix=Object.fromEntries(['flat','services','locations','prices'].map(p=>[p,records.filter(x=>x.prefix===p).length]));
const summary={generatedAt:new Date().toISOString(),total:records.length,indexRequested:records.filter(x=>x.indexRequested).length,indexable:records.filter(x=>x.indexable).length,noindex:records.filter(x=>!x.indexable).length,under800ThaiCharacters:records.filter(x=>x.chars<800).length,byPrefix};
console.log(JSON.stringify({summary,topSimilarTitles:duplicateTitleGroups,topIdenticalBodies:duplicateBodyGroups,nearDuplicatesForHumanReview:similar.slice(0,100),notes:['Thailand uses Thai script; character-length heuristics are not word counts.','Normalized overlap is a screening heuristic, not proof of doorway or spam.','Requested index is not approved index: reviewer, date, specific evidence, and geographic fulfillment must all be recorded.','Do not bulk-open seo_index; check GSC, real services, unique evidence and owner approval first.']},null,2));
