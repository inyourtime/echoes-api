# 🎵 Project: Music Life Timeline
**Concept:** *"บันทึกช่วงเวลาของชีวิตผ่านเสียงเพลง"* — เปลี่ยนการเก็บรายชื่อเพลงให้กลายเป็นไดอารี่ที่เล่าเรื่องราวว่าเพลงไหนเข้ามาในชีวิตเราตอนไหนและรู้สึกอย่างไร

---

## 1. Core Concept
แอปพลิเคชันแนว **Life Journaling** ที่ใช้เพลงเป็นตัวดำเนินเรื่อง (Music-Centric Timeline) เพื่อย้อนดูรสนิยมและการเติบโตของตัวเองในแต่ละช่วงเวลาผ่านบทเพลงที่ฟัง

## 2. Core Features

### 1️⃣ Quick Add Song
* **One-Tap Add:** ปุ่มเพิ่มเพลงด่วนที่กรอกข้อมูลน้อยที่สุด
* **Data Fields:** * Song Title & Artist
    * Note (Optional): บันทึกสั้นๆ เช่น "ฟังตอนเริ่มเรียน React"
    * Date: เลือกวันที่ได้ (Default เป็นวันนี้)
* **Spotify Search:** ค้นหาเพลงจาก Database ของ Spotify เพื่อดึงชื่อและปกอัลบั้มที่ถูกต้องมาใช้

### 2️⃣ Timeline View (Main Interface)
แสดงผลแบบ **Life Journal** เรียงลำดับเวลา (Reverse Chronological):
* **Yearly/Monthly Grouping:** แยกกลุ่มเพลงตามเดือนและปีชัดเจน
* **Scannable Layout:** เน้นดูง่ายเหมือน Timeline ของโซเชียลมีเดียแต่เป็นส่วนตัว

### 3️⃣ Song History & Context
* **Deep Dive:** กดที่เพลงเพื่อดูรายละเอียดเชิงลึก
* **First Listened Date:** วันแรกที่บันทึกเพลงนี้เข้าระบบ
* **Contextual Memory:** แสดง Note และบรรยากาศที่บันทึกไว้ ณ เวลานั้น

### 4️⃣ Mood Tagging
* **Personalized Tags:** เพิ่ม Tag ตามอารมณ์หรือกิจกรรม (เช่น `#sad`, `#study`, `#coding`, `#gym`)
* **Filtering:** เลือกดู Timeline เฉพาะช่วงที่เป็น Mood ใด Mood หนึ่งได้

### 5️⃣ Stats & Insights
สรุปภาพรวมทางสถิติในรูปแบบที่เข้าใจง่าย:
* **Most Saved Artist:** ใครคือศิลปินอันดับ 1 ในช่วงเวลานั้นๆ
* **Activity Heatmap:** เดือนไหนที่เราบันทึกเพลงใหม่เยอะที่สุด
* **Mood Analysis:** กราฟวงกลม (%) แบ่งตามอารมณ์เพลงที่บันทึก

---

## 3. Killer Features (High Value)

### 🎧 Spotify Integration
* **History Sync:** ดึงข้อมูลจาก *Recently Played* ใน Spotify แล้วให้ User เลือกคลิก "Save to Timeline" ได้โดยไม่ต้องพิมพ์เอง
* **Metadata Auto-fill:** ดึงข้อมูลแนวเพลงและรูปภาพโดยอัตโนมัติ

### 📈 Music Life Graph
* กราฟแท่งแสดงปริมาณเพลงใหม่ที่เพิ่มในแต่ละเดือน เพื่อดูความเคลื่อนไหวของชีวิต (Jan | ██ , Feb | ███)

### 🗺️ Memory Map
* **Geo-tagging:** บันทึกว่าเพลงนี้เราฟังที่ไหน (เช่น "ฟังตอนอยู่ญี่ปุ่น") และแสดงผลบนแผนที่โลก

---