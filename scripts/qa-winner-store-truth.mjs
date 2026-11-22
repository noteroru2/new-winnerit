import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const business = read('src/config/business.ts');
const layout = read('src/layouts/Layout.astro');
const home = read('src/pages/index.astro');
const about = read('src/pages/about.astro');
const contact = read('src/pages/contact.astro');
const astro = read('astro.config.mjs');

assert(business.includes('openingDays: [] as string[]'), 'Weekday schedule is not yet verified');
assert(layout.includes('business.openingDays.length ?'), 'OpeningHoursSpecification must be conditional');
assert(home.includes('ส่งข้อมูลประเมินทาง LINE ได้ตลอด'), 'True LINE intake missing');
assert(home.includes('เวลาหน้าร้าน · ตรวจสอบวันเปิดก่อนเดินทาง'), 'Store schedule correction missing');
for(const old of ['เปิดรับซื้อทุกวัน','เปิดให้บริการทุกวัน','ให้บริการทุกพื้นที่','ประเมินราคาฟรี จ่ายเงินทันที บริการทั่วประเทศ']) assert(!home.includes(old),'Unverified claim in home: '+old);
assert(about.includes('ขั้นตอนตรวจสอบชัดเจน'), 'About conditional steps missing');
assert(contact.includes('ไม่ได้ส่งข้อมูลเข้าระบบโดยอัตโนมัติ'), 'Mailto form limitation missing');
assert(astro.includes('data.seo_index !== true'), 'Inherited 4,031-post quarantine gate removed');
console.log('PASS: truthful storefront hours, conditional intake, mailto disclaimer, existing post quarantine');
