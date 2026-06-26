# Form Manual QA Flow

ใช้ checklist นี้หลัง deploy หรือหลังรัน `npm run setup:form` / `npm run seed:permissions` บน DB จริง

## Test Users

- Admin A: มี `form.fill`, `form.view`, `form.export`, `form.approve`
- Admin B: มี `form.view`, `form.export`, `form.approve`

## Flow

1. Login เป็น Admin A
2. เปิด `/dashboard/form`
3. เลือก template ที่เป็น `active`
4. Submit เอกสารใหม่
5. ตรวจว่า Admin B ได้ notification
6. กด notification ของ Admin B แล้วต้องเปิด `/dashboard/form/submission/{id}`
7. Admin B กด Approve พร้อม comment
8. ตรวจว่า Admin A ได้ notification ผลการอนุมัติ
9. เปิด Audit Log แล้วตรวจ action:
   - `form_submission.create`
   - `form_submission.approve`
10. ทำซ้ำอีก submission แล้วให้ Admin B กด Reject พร้อม comment
11. ตรวจว่า Admin A ได้ notification ผลการ reject
12. เปิด Audit Log แล้วตรวจ action:
   - `form_submission.reject`
13. Login เป็น Admin A แล้วพยายาม approve เอกสารที่ Admin A submit เอง
14. ต้องได้ error self-approval และสถานะต้องไม่เปลี่ยน
15. แก้ template เดิม เช่น เปลี่ยน layout หรือ static text
16. กลับไปเปิด submission เก่า
17. Layout ของ submission เก่าต้องยังเป็น snapshot เดิม
18. Export PDF จาก submission เก่า
19. PDF ต้องใช้ layout snapshot เดิม
20. เปิด `/dashboard/form/inbox`
21. ตรวจแท็บ:
   - รอฉันอนุมัติ
   - เอกสารที่ฉันส่ง
   - อนุมัติแล้ว / ถูกปฏิเสธ

## Template Lifecycle

1. Duplicate template จากหน้า `/dashboard/form`
2. Template ใหม่ต้องเป็น `draft`
3. Archive template
4. Filter `Archived` ต้องเห็น template ที่ถูก archive
5. Restore template
6. Template ต้องกลับมาอยู่ใน list ปกติ

## Deploy Notes

- `npm test` ต้องผ่านก่อน restart service
- `npm run seed:permissions` รันใน deploy ได้
- `npm run setup:form` ให้รันผ่าน manual workflow dispatch พร้อม `run_form_setup=true` เท่านั้น เมื่อจะปรับ schema DB จริง
