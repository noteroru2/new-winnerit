import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
const dir=join(process.cwd(),'content','posts');
const bad=[],approved=[];
for(const file of readdirSync(dir).filter(x=>x.endsWith('.md'))){
 const {data}=matter(readFileSync(join(dir,file),'utf8'));
 if(data.seo_index!==true)continue;
 approved.push(file);
 const reviewer=String(data.seo_reviewed_by||'').trim();
 const reviewedAt=String(data.seo_reviewed_at||'').trim();
 const evidence=String(data.seo_evidence||'').trim();
 const serviceProof=String(data.seo_service_verified||'').trim();
 if(reviewer.length<2||!(reviewedAt.length === 10 && reviewedAt[4] === '-' && reviewedAt[7] === '-' && !Number.isNaN(Date.parse(reviewedAt)))||evidence.length<20||serviceProof.length<20)
   bad.push({file,slug:data.slug,missing:['seo_reviewed_by','seo_reviewed_at (YYYY-MM-DD)','seo_evidence (min 20 chars)','seo_service_verified (min 20 chars)']});
}
if(bad.length){
 console.error(JSON.stringify({passed:false,approvedPosts:approved.length,blocked:bad.slice(0,100)},null,2));
 process.exit(1);
}
console.log(JSON.stringify({passed:true,approvedPosts:approved.length,proofPolicy:'manual review with attribution required for seo_index:true'},null,2));
