# ERP System

ระบบ ERP บน Next.js สำหรับจัดการพนักงาน โปรเจกต์ งาน การลา สิทธิ์การใช้งาน Audit Log และเอกสาร Form ภายในองค์กร

## Requirements

- Node.js ที่รองรับ Next.js 16
- MySQL 8
- Font ภาษาไทยสำหรับ export PDF เช่น `public/fonts/Sarabun-Regular.ttf` หรือ `public/fonts/NotoSansThai-Regular.ttf`

## Setup

ติดตั้ง dependency:

```bash
npm install
```

เตรียม environment variables ใน `.env`:

```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database
JWT_SECRET=change_me
JWT_REFRESH_SECRET=change_me_too
CRON_SECRET=required_for_due_task
```

สร้าง/อัปเดตตารางและ permission หลัก:

```bash
npm run setup:audit-log
npm run setup:master-data
npm run setup:form
npm run seed:permissions
```

สร้าง admin เริ่มต้น ถ้ายังไม่มี:

```bash
npm run setup:admin-user
```

## Development

```bash
npm run dev
```

เปิด `http://localhost:3000`

## Test And Build

```bash
npm test
npm run lint
npm run build
```

## Permission Model

ระบบใช้ permission-based guard เป็นหลัก ทั้ง API และ page guard ควรอิง permission key ไม่ใช่ role ตรง ๆ

Permission สำคัญของ Form:

- `form.view` ดู template/submission/report
- `form.create` สร้าง template
- `form.update` แก้ template และ bump version
- `form.delete` archive/delete template
- `form.fill` submit เอกสาร
- `form.export` export PDF/summary
- `form.approve` approve/reject submission

หลังเพิ่ม permission ใหม่ ให้รัน:

```bash
npm run seed:permissions
```

## Form Workflow

Form Template มี `version` และเมื่อแก้ template ระบบจะเพิ่ม version อัตโนมัติ

เมื่อ submit เอกสาร ระบบจะ snapshot ข้อมูลเหล่านี้ลง `form_submission`:

- `template_version`
- `form_name_snapshot`
- `form_code_snapshot`
- `description_snapshot`
- `layout_snapshot_json`

ดังนั้น submission เก่าจะยังแสดง layout เดิม แม้ template ปัจจุบันถูกแก้ไขแล้ว

Submission workflow:

1. ผู้ใช้ส่งเอกสาร สถานะเริ่มต้นเป็น `submitted`
2. ผู้มี `form.approve` สามารถ `approve` หรือ `reject`
3. ระบบบล็อก self-approval
4. Reject ต้องมี comment
5. ทุกการเปลี่ยนสถานะถูกบันทึกใน `form_submission_history`
6. จุด submit, approve, reject, export PDF และ export summary ถูกเขียนเข้า Audit Log

## Form Validation

Validation เกิดฝั่ง API ตอน submit:

- Field ที่ `required` ต้องมีข้อมูล
- Checkbox ที่ `required` ต้องเลือกอย่างน้อย 1 ตัวเลือก
- Signature ที่ `required` ต้องมีชื่อผู้ลงนาม
- Table สามารถกำหนด `requiredColumns` ได้ และระบบจะตรวจเฉพาะแถวที่มีข้อมูล
- Static text ไม่ถูกนับเป็น input และไม่ถูก validate

## Form Report

หน้า Form dashboard แสดง:

- จำนวนเอกสาร submitted/approved/rejected/total
- เอกสารรออนุมัติ
- จำนวน active template
- จำนวนเอกสารที่ submit วันนี้
- Export summary CSV ผ่าน `/api/v1/form-submission/summary?format=csv`

## Deployment Notes

ก่อน deploy เครื่องใหม่ ให้รัน setup script ให้ครบ โดยเฉพาะ:

```bash
npm run setup:form
npm run seed:permissions
```

`CRON_SECRET` ต้องถูกตั้งค่าเสมอสำหรับ route notification/due-task เพื่อป้องกันการเรียก route จากภายนอกโดยไม่มี secret
