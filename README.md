# Assignment #1: Drone API Server (Node.js & Express.js)

REST API Server พัฒนาด้วย **Node.js** และ **Express.js** สำหรับเชื่อมต่อและจัดการข้อมูลโดรนจาก **Drone Config Server** และ **Drone Log Server (PocketBase)** ตามข้อกำหนดของ Assignment #1

## คุณสมบัติและ Endpoints

1. **`GET /configs/{droneId}`**
   - ดึงข้อมูลการตั้งค่าของโดรนตาม `droneId` จาก Drone Config Server
   - ส่งกลับเป็น JSON เฉพาะฟิลด์ `drone_id`, `drone_name`, `light`, `country`, `weight`
   - ตัวอย่างผลลัพธ์:
     ```json
     {
       "drone_id": 67010210,
       "drone_name": "Cyd",
       "light": "on",
       "country": "Pakistan",
       "weight": 150
     }
     ```

2. **`GET /status/{droneId}`**
   - ดึงสถานะของโดรนตาม `droneId` จาก Drone Config Server
   - ส่งกลับเป็น JSON เฉพาะฟิลด์ `condition`
   - ตัวอย่างผลลัพธ์:
     ```json
     {
       "condition": "bad"
     }
     ```

3. **`GET /logs/{droneId}`** *(รองรับ Pagination)*
   - ดึงประวัติ Log อุณหภูมิของโดรนตาม `droneId` จาก Drone Log Server
   - เรียงลำดับจากเวลา `created` ล่าสุดขึ้นก่อน (`-created`) และจำกัดจำนวนผลลัพธ์เริ่มต้นที่ 12 รายการต่อหน้า
   - รองรับ Query Parameters สำหรับ Pagination: `?page=1&perPage=12` พร้อมส่งค่าจำนวนหน้าทั้งหมดกลับทาง Response Headers (`X-Page`, `X-Per-Page`, `X-Total-Items`, `X-Total-Pages`)
   - ส่งกลับเป็น JSON Array เฉพาะฟิลด์ `drone_id`, `drone_name`, `created`, `country`, `celsius`

4. **`POST /logs`**
   - รับข้อมูล JSON จาก Request Body และบันทึก Log ใหม่ลงใน Drone Log Server
   - ส่งข้อมูลไปยัง Drone Log Server เฉพาะฟิลด์ `drone_id`, `drone_name`, `country`, `celsius`

---

## วิธีการติดตั้งและรันโปรเจกต์ (Local Development)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables (`.env`)
คัดลอกไฟล์ `.env.example` ไปเป็น `.env` แล้วใส่ค่าตัวแปรสภาพแวดล้อมให้ครบถ้วน:
```bash
cp .env.example .env
```
ตัวอย่างเนื้อหาในไฟล์ `.env`:
```env
PORT=4000
CONFIG_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
LOG_URL=https://app-tracking.pockethost.io/api/collections/drone_logs/records
LOG_API_TOKEN=your_bearer_token_here
```
> **หมายเหตุ:** ไฟล์ `.env` และ `.env.local` ถูกตั้งค่าให้อยู่ใน `.gitignore` แล้วเพื่อป้องกันไม่ให้ข้อมูล API Token รั่วไหลขึ้น GitHub

### 3. รันเซิร์ฟเวอร์
```bash
# โหมดปกติ
npm start

# โหมดพัฒนา (Auto-reload)
npm run dev
```
เซิร์ฟเวอร์จะทำงานที่ `http://localhost:4000`

---

## วิธีการ Deploy ขึ้น Cloud (Vercel)

1. อัปโหลดโค้ดขึ้น GitHub Repository (ตรวจสอบว่าไม่มีไฟล์ `.env` ติดไปด้วย)
2. ไปที่ [Vercel Dashboard](https://vercel.com/) กด **Add New... -> Project** และเลือก Repository นี้
3. ในส่วน **Environment Variables** ให้เพิ่มค่าต่อไปนี้:
   - `CONFIG_URL`
   - `LOG_URL`
   - `LOG_API_TOKEN`
4. กด **Deploy** (ไฟล์ `vercel.json` ในโปรเจกต์ตั้งค่า Serverless Routing ไว้เรียบร้อยแล้ว)
