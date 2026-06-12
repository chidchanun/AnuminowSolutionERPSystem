import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import bcrypt from 'bcrypt'

export async function POST(request) {
    try {

        const token = request.cookies.get('accessToken')?.value
        if (!token) {
            return NextResponse.json({ message: 'โปรดเข้าสู่ระบบก่อน' }, { status: 401 })
        }

        

        // อ่านข้อมูล JSON payload จาก request
        const body = await request.json()
        const { prefix, first_name_th, last_name_th, first_name_en, last_name_en, phone, password, password_confirmed, department_id, role_id, picture_data } = body

        // ตรวจสอบข้อมูลฟอร์มหลักให้ครบถ้วนก่อน
        if (!prefix || !first_name_th || !last_name_th || !first_name_en || !last_name_en || !phone || !password || !password_confirmed || !department_id || !role_id) {
            return NextResponse.json({ message: 'โปรดกรอกข้อมูลให้ครบถ้วน' }, { status: 401 })
        }

        // ตรวจสอบว่ารหัสผ่านและยืนยันรหัสผ่านตรงกัน
        if (password !== password_confirmed) {
            return NextResponse.json({ message: 'รหัสผ่านไม่ตรงกัน' }, { status: 400 })
        }

        // ดึงข้อมูลแผนกจากฐานข้อมูลเพื่อตรวจสอบและใช้ department_code ในการสร้าง user id
        const [departmentRows] = await db.query(`SELECT * FROM department WHERE department_id = ?`, [department_id])
        const departmentData = departmentRows[0]

        if (!departmentData) {
            return NextResponse.json({ message: 'ไม่พบข้อมูลแผนก' }, { status: 404 })
        }

        // ดึงข้อมูลตำแหน่งจากฐานข้อมูลเพื่อตรวจสอบว่า role_id ถูกต้อง
        const [roleRows] = await db.query(`SELECT * FROM role WHERE role_id = ?`, [role_id])
        const roleData = roleRows[0]

        if (!roleData) {
            return NextResponse.json({ message: 'ไม่พบข้อมูลตำแหน่ง' }, { status: 404 })
        }

        // สร้าง email อัตโนมัติจากชื่อภาษาอังกฤษ
        const email = `${first_name_en.toLowerCase()}.${last_name_en.toLowerCase()}@gmail.com`

        // คำนวณปี พ.ศ. และใช้เพียง 2 หลักสุดท้ายสำหรับรหัสผู้ใช้
        const CurrentYearTh = new Date().getFullYear() + 543
        const YearTh = CurrentYearTh.toString().slice(-2)

        // นับจำนวนผู้ใช้งานในแผนกเดียวกัน เพื่อสร้างเลขลำดับถัดไป
        const [countRows] = await db.query("SELECT COUNT(*) AS count FROM `user` WHERE department_id = ?", [department_id])
        const existingCount = countRows[0]?.count ?? 0
        const nextCount = existingCount + 1
        const userCountPadded = String(nextCount).padStart(4, '0')

        // แฮชรหัสผ่านก่อนบันทึกลงฐานข้อมูล
        const passwordHash = await bcrypt.hash(password, 10)

        // สร้าง user id แบบ ปี2หลัก + department_code + เลขลำดับ 4 หลัก
        const CreateUserId = `${YearTh}${departmentData.department_code}${userCountPadded}`

        let picture_path = null
        if (picture_data) {
            const match = picture_data.match(/^data:(image\/[^;]+);base64,(.+)$/)
            if (!match) {
                return NextResponse.json({ message: 'ข้อมูลรูปภาพไม่ถูกต้อง' }, { status: 400 })
            }

            const mimeType = match[1]
            const base64Data = match[2]
            const extension = mimeType.split('/')[1].replace('jpeg', 'jpg')
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'employees')
            await fs.mkdir(uploadDir, { recursive: true })

            const fileName = `${CreateUserId}.${extension}`
            const filePath = path.join(uploadDir, fileName)
            await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'))
            picture_path = `/uploads/employees/${fileName}`
        }

        // บันทึกผู้ใช้ใหม่ลงตาราง user
        await db.query(
            `INSERT INTO user (id, prefix, first_name_th, last_name_th, first_name_en, last_name_en, email, phone, password_hash, department_id, role_id, picture_path, permission_role_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
            [CreateUserId, prefix, first_name_th, last_name_th, first_name_en, last_name_en, email, phone, passwordHash, department_id, role_id, picture_path, 4]
        )

        // ส่ง response ยืนยันว่าผู้ใช้ถูกสร้างเรียบร้อยแล้ว
        return NextResponse.json({ message: 'รหัสผู้ใช้สร้างแล้ว' }, { status: 200 })
    } catch (e) {
        console.log(e)
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
    }
}