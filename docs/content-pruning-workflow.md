# Content pruning workflow

บทความที่นำเข้าจำนวนมากจะเป็น `noindex, follow` และไม่อยู่ใน sitemap โดยค่าเริ่มต้น เพื่อลด index footprint โดยไม่ลบไฟล์หรือทำลาย URL เดิม

## วิธีคัดเลือกหน้าให้กลับมา index

1. Export ข้อมูล 16 เดือนล่าสุดจาก Google Search Console: URL, query, clicks, impressions, average position
2. แยกหน้าที่มี backlink หรือ referral traffic ออกมาก่อน
3. จัดกลุ่มหน้าที่ตอบ intent เดียวกัน แล้วเลือก URL หลักเพียงหนึ่งหน้า
4. หน้า URL หลักต้องผ่านการตรวจข้อเท็จจริง เพิ่มประสบการณ์/รูปจริง และแก้ title/H1 ไม่ให้ซ้ำ
5. เพิ่ม `seo_index: true` ใน frontmatter ของหน้าที่ผ่าน review
6. หน้าที่ซ้ำและไม่มีสัญญาณให้รวมเนื้อหาแล้วทำ 301 ไป URL หลัก; อย่าลบก่อนเตรียม redirect

รัน `npm run seo:audit-content` เพื่อตรวจจำนวนหน้า indexable, duplicate title, thin content และ publication burst ทุกครั้งก่อน build
