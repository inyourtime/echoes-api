# 🎵 Project: Music Life Timeline
**Concept:** *"บันทึกช่วงเวลาของชีวิตผ่านเสียงเพลง"* — เปลี่ยนการเก็บรายชื่อเพลงให้กลายเป็นไดอารี่ที่เล่าเรื่องราวว่าเพลงไหนเข้ามาในชีวิตเราตอนไหนและรู้สึกอย่างไร

---

## 1. Core Concept
แอปพลิเคชันแนว **Life Journaling** ที่ใช้เพลงเป็นตัวดำเนินเรื่อง (Music-Centric Timeline) เพื่อย้อนดูรสนิยมและการเติบโตของตัวเองในแต่ละช่วงเวลาผ่านบทเพลงที่ฟัง

## 2. Core Features

### 1️⃣ Quick Add Song
* **One-Tap Add:** ปุ่มเพิ่มเพลงด่วนที่กรอกข้อมูลน้อยที่สุด
* **Data Fields:**
    * Song Title & Artist
    * Note (Optional): บันทึกสั้นๆ เช่น "ฟังตอนเริ่มเรียน React"
    * Date: เลือกวันที่ได้ (Default เป็นวันนี้)
    * Tag (Optional): แท็กเพื่อจัดกลุ่มเพลง เช่น `#sad`, `#study`, `#coding`, `#gym`
    * YouTube URL (Optional): ลิงก์ไปยังเพลงบน YouTube สำหรับฟังย้อนหลัง
* **Track Search:** ค้นหาเพลงจาก Apple Music API เพื่อดึงข้อมูล Title & Artist มา auto-fill

### 2️⃣ Timeline View (Main Interface)
แสดงผลแบบ **Life Journal** เรียงลำดับเวลา (Reverse Chronological):
* **Yearly/Monthly Grouping:** แยกกลุ่มเพลงตามเดือนและปีชัดเจน
* **Scannable Layout:** เน้นดูง่ายเหมือน Timeline ของโซเชียลมีเดียแต่เป็นส่วนตัว (infinite scroll)
* **Filtering:** เลือกดู Timeline เฉพาะช่วงที่เป็น Mood ใด Mood หนึ่งได้ (เช่น #sad, #study)

### 3️⃣ Song History & Context
* **Deep Dive:** กดที่เพลงเพื่อดูรายละเอียดเชิงลึก
* **First Listened Date:** วันแรกที่บันทึกเพลงนี้เข้าระบบ
* **Contextual Memory:** แสดง Note และบรรยากาศที่บันทึกไว้ ณ เวลานั้น
* **Tags:** แสดง Tag ที่บันทึกไว้
* **Streaming Links:** แสดงลิงก์ YouTube สำหรับฟังย้อนหลัง
* **Edit/Delete:** แก้ไขหรือลบเพลงที่บันทึกไว้

### 4️⃣ Mood Tagging
* **Personalized Tags:** เพิ่ม Tag ตามอารมณ์หรือกิจกรรม (เช่น `#sad`, `#study`, `#coding`, `#gym`)
* **Tags Management:** จัดการ Tags ที่สร้างขึ้นเองได้ (เพิ่ม, ลบ, แก้ไข)
* **Color Coding:** แต่ละ Tag มีสีประจำตัวเพื่อความสวยงาม

## 3. Authentication & Privacy
* **Email & Password:** ใช้ Email & Password สำหรับการเข้าสู่ระบบ (ต้องการการยืนยันทางอีเมล)
* **OAuth 2.0:** ใช้ Google OAuth สำหรับการเข้าสู่ระบบ
* **JWT Tokens:** ใช้ JWT tokens สำหรับการยืนยันตัวตน
* **Login Page:** หน้าเข้าสู่ระบบที่สวยงามและใช้งานง่าย
* **Register Page:** หน้าลงทะเบียนที่สวยงามและใช้งานง่าย (email, password, name)

## 4. Responsive Design
* **Mobile-First:** ออกแบบให้ใช้งานได้ดีทั้งบนมือถือและแท็บเล็ต
* **Desktop Support:** รองรับการใช้งานบนคอมพิวเตอร์ด้วย
* **Touch-Friendly:** ปุ่มและอินเตอร์เฟซที่ใช้งานง่ายบนมือถือ

## 5. Progressive Web App (PWA)
* **Installable:** สามารถติดตั้งเป็นแอปบนมือถือได้
* **Service Worker:** ใช้ Service Worker สำหรับ caching
