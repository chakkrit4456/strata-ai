# Strata Automation

ระบบที่คิดหัวข้อ เขียนเนื้อหา และทำภาพประกอบเองทุกวัน สำหรับเพจ **Strata เว็บไซต์ ระบบBot Automation Software ครบวงจร**

- **เพจ**: โพสต์อัตโนมัติวันละ 2 โพสต์ (เช้า/เย็น) ผ่าน Facebook Graph API ซึ่งเป็นช่องทางทางการ
- **กลุ่ม**: Facebook ปิด Groups API ไปตั้งแต่ปี 2024 ระบบจึงเตรียมข้อความแยกให้แต่ละกลุ่ม (เขียนคนละแบบตามกฎกลุ่ม) พร้อมภาพและลิงก์โพสต์เพจ ไว้ใน Dashboard
  คุณกด "คัดลอกข้อความ", "เปิดกลุ่ม" แล้ววางโพสต์เอง โพสต์ละ 1–2 คลิก วิธีนี้บัญชีไม่เสี่ยงโดนแบน

## ระบบทำงานยังไง

| เวลา (ไทย) | งาน |
|---|---|
| 07:00 | `generate` วางแผนหมวดของวัน → AI ฟรี (Gemini → Groq → OpenRouter) เขียนแคปชันเพจ + ข้อความแยกทุกกลุ่ม → เรนเดอร์ภาพ → ตรวจคุณภาพ → แจ้ง Telegram |
| 09:20–09:40 (สุ่ม) | `publish morning` โพสต์ลงเพจ → ปล่อยข้อความของกลุ่มเข้าคิว |
| 19:20–19:40 (สุ่ม) | `publish evening` เหมือนรอบเช้า |

**การกันสแปมและกันเนื้อหามั่ว**
- ประมาณ 70% เป็นเนื้อหาให้ความรู้หรือสนุก (ทิป IT, มีมสายเดฟ, โพล, บทเรียนจากงานจริง) และ 30% เป็นโปรโมท (โชว์ผลงาน, แพ็กเกจ) โปรโมทไม่เกินวันละ 1 โพสต์ และไม่มีโพสต์โปรโมทติดกัน
- แต่ละกลุ่มตั้งได้ว่าโปรโมทได้เสมอ, ห้ามโปรโมท หรือโปรโมทได้เฉพาะบางวัน ถ้ากลุ่มห้ามขาย ระบบจะเขียนเวอร์ชันที่ให้ความรู้อย่างเดียวพร้อมภาพแบบไม่ขาย
- ข้อมูลที่ AI ใช้ได้มีแค่ใน `config/brand.yaml` ระบบตรวจทุกโพสต์ว่าราคาตรงกับแพ็กเกจจริง ไม่มีการแต่งรีวิวหรือจำนวนลูกค้า ไม่ซ้ำกับโพสต์ 60 รายการล่าสุด ข้อความแต่ละกลุ่มไม่ซ้ำกัน และมีแฮชแท็กไม่เกิน 3 อัน
  ถ้าไม่ผ่านจะให้ AI แก้ใหม่ (ลองได้สูงสุด 3 ครั้ง)
- ข้อความในกลุ่มที่ไม่ได้โพสต์ภายในวันนั้นจะหมดอายุ ไม่ทบไปวันถัดไป
- ค่าเริ่มต้นเปิด `REQUIRE_APPROVAL=true` ไว้ คือโพสต์เพจต้องกดอนุมัติใน Dashboard ก่อน (แนะนำช่วง 2 สัปดาห์แรก)

## ติดตั้งบนเซิร์ฟเวอร์ Debian 13

```bash
git clone <repo> /opt/strata-automation   # หรือคัดลอกโฟลเดอร์นี้ไป
cd /opt/strata-automation
sudo bash deploy/install.sh
sudo nano .env                     # ใส่คีย์ต่างๆ (ดูหัวข้อด้านล่าง)
sudo nano config/groups.yaml       # ใส่กลุ่มจริงและกฎของแต่ละกลุ่ม
sudo -u strata node --disable-warning=ExperimentalWarning src/cli.js check
sudo systemctl restart strata-web
```

ควรเปิด Dashboard ผ่าน HTTPS (เช่น Caddy หรือ nginx ทำ reverse proxy ไปที่พอร์ต 8787) แล้วตั้ง `PUBLIC_URL` ให้ตรงกับโดเมน
ปุ่มคัดลอกข้อความบนมือถือต้องใช้ HTTPS ถึงจะทำงานได้ดีที่สุด

### ค่าใน `.env`

| ค่า | ได้มาจาก |
|---|---|
| `GEMINI_API_KEY` | ฟรีที่ https://aistudio.google.com/apikey (ตัวหลัก เขียนไทยดีที่สุด) |
| `GROQ_API_KEY` | ฟรีที่ https://console.groq.com/keys (ตัวสำรอง) |
| `OPENROUTER_API_KEY` | ฟรีที่ https://openrouter.ai/keys ใช้โมเดลที่ลงท้าย `:free` (ตัวสำรองสุดท้าย) |
| `FB_PAGE_TOKEN` | Page access token แบบไม่หมดอายุ (ดูขั้นตอนด้านล่าง) |
| `DASHBOARD_PASSWORD`, `SESSION_SECRET` | ตั้งเอง ใช้ค่าที่สุ่มยาวๆ |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | (ไม่บังคับ) สร้าง bot ผ่าน @BotFather แล้วส่งข้อความหา bot 1 ครั้ง ค่อยดู chat id |

### ขอ Page access token

1. ไปที่ https://developers.facebook.com/apps → สร้างแอป ประเภท **Business**
2. เปิด **Graph API Explorer** เลือกแอปที่สร้าง แล้วกด "Get User Access Token" ขอสิทธิ์
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
3. แปลงเป็น long-lived user token ด้วย **Access Token Debugger** → "Extend Access Token"
4. ใน Explorer ใช้ token จากข้อ 3 เรียก `GET /me/accounts` แล้วคัดลอก `access_token` ของเพจ Strata
   Page token ที่ได้จาก long-lived user token จะไม่หมดอายุ
5. ใส่ใน `.env` แล้วทดสอบ:
   ```bash
   npm run check                  # ต้องเห็น ✓ token เป็นของ "Strata ..."
   npm run preview && node src/cli.js publish --test   # โพสต์ภาพทดสอบแบบไม่เผยแพร่
   ```

แอปอยู่ในโหมด Development ได้ เพราะคุณเป็นแอดมินของเพจเอง

## คำสั่ง

```bash
npm run check                                  # ตรวจการตั้งค่า + token
npm run preview                                # เรนเดอร์ภาพตัวอย่างทุกเทมเพลต → out/preview/
npm run generate -- --dry --date 2026-10-24    # ลองสร้างคอนเทนต์จริงด้วย AI แต่ไม่บันทึก/ไม่โพสต์ → out/<date>/index.html
npm run generate                               # สร้างของวันนี้ (timer เรียกให้ทุกเช้า)
npm run publish:slot -- morning                # โพสต์รอบเช้าทันที
npm run serve                                  # เปิด Dashboard
npm test                                       # unit tests
```

## ปรับแต่ง

- `config/brand.yaml` ข้อมูลบริการ ราคา ผลงาน และน้ำเสียงของแบรนด์ (เปลี่ยนราคาที่นี่ที่เดียว)
- `config/pillars.yaml` หมวดเนื้อหา น้ำหนัก และสัดส่วนโปรโมท
- `config/groups.yaml` รายชื่อกลุ่ม กฎ และวันที่โปรโมทได้
- `src/image/template.html` หน้าตาภาพ (1080×1350) มี 5 เลย์เอาต์: tip, showcase, package, fun, question
- `BG_IMAGE_DIR` โฟลเดอร์ภาพพื้นหลังที่ไม่มีตัวอักษร (เช่น ภาพ abstract ที่สร้างจาก AI) ระบบจะสุ่มมาใช้แบบจางๆ
- เวลาโพสต์: แก้ `deploy/systemd/strata-publish-*.timer` แล้วรัน `sudo bash deploy/install.sh` ใหม่

## ข้อควรรู้

- **อย่าเพิ่มกลุ่มทีละเยอะๆ** เริ่มจาก 3–5 กลุ่มที่เป็นสมาชิกอยู่แล้ว อ่านกฎทุกกลุ่ม และตอบคอมเมนต์ด้วยตัวเอง
  Facebook ดูว่าโพสต์ในกลุ่มได้รับการตอบรับดีแค่ไหน มากกว่าดูว่าโพสต์ถี่แค่ไหน
- ถ้ากลุ่มไหนแอดมินไม่อนุมัติโพสต์หรือมีคนรายงาน ให้ตั้ง `promo: never` หรือ `enabled: false`
- AI ใช้แบบฟรีทั้งหมด ระบบเรียกประมาณวันละ 2–6 ครั้ง จึงอยู่ในโควตาฟรีของทุกเจ้า ใส่คีย์อย่างน้อย 1 เจ้าก็ใช้ได้ ใส่ครบ 3 เจ้าจะทนกว่า
  ถ้าเจ้าแรกโควตาหมด ล่ม หรือเขียนแล้วไม่ผ่านการตรวจ 2 ครั้ง ระบบจะสลับไปเจ้าถัดไปเอง ลำดับตั้งได้ที่ `AI_PROVIDERS`
- Gemini แบบฟรีอาจนำข้อมูลที่ส่งไปใช้ปรับปรุงโมเดล ข้อมูลที่ระบบส่งมีแค่ข้อมูลบริการที่เปิดเผยบนเพจอยู่แล้ว
- โควตาและรายชื่อโมเดลฟรีเปลี่ยนได้ ถ้า `npm run check` ขึ้นว่าโมเดลไม่มี ให้เปลี่ยนชื่อใน `*_MODEL`
