# Black Desert Online - [Party] Harmony Draught - Edania Calculator

เครื่องคำนวณต้นทุนการคราฟต์ **[Party] Harmony Draught - Edania** ([ปาร์ตี้] น้ำยาอีดาเนียแห่งความกลมกลืน) แบบเจาะลึก
- คำนวณค่า **Alchemy Mastery & Alchemy Level** ตามตารางทางการของ BDO Codex / Incendar ส่งผลต่อจำนวนผลผลิตเฉลี่ย (Proc Yield 2.50x - 3.25x) และลดต้นทุนวัตถุดิบจริง
- แตกสูตร Recursive Tree ถึงวัตถุดิบดิบ (Herbs, Saps, Bloods, Mushrooms, Powders, Reagents, Oils)
- รวมกลุ่ม Fruit ทั้งหมดเป็น Fruit of Nature และ Trace ทั้งหมดเป็น Trace of Nature
- คำนวณภาษีตลาดจริง (Value Pack +30%, Rich Merchant's Ring +5%)
- ระบบจัดการของในคลัง (Inventory Tracker) พร้อมคำนวณยอดเงินที่ต้องซื้อเพิ่มจริง
- ดึงราคาตลาดสดผ่าน Arsha.io API
- รองรับทั้งบน GitHub Pages, Vercel และ Localhost (.bat)

## วิธีติดตั้งและใช้งานบน GitHub Pages
1. นำไฟล์ทั้งหมดในโฟลเดอร์นี้ (`index.html`, `style.css`, `app.js`) ขึ้น GitHub Repository
2. ไปที่ **Settings** > **Pages**
3. ที่หัวข้อ **Branch** เลือก `main` หรือ `master` แล้วกด **Save**
4. รอประมาณ 1 นาที จะได้ลิงก์เว็บไซต์พร้อมใช้งาน เช่น `https://<username>.github.io/<repo-name>/`
