import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request) {
    try {
        // const token = request.cookies.get('token')?.value

        // if (!token) {
        //     return NextResponse.json({ message: 'โปรดเข้าสู่ระบบใหม่อีกครั้ง' }, { status: 401 })
        // }

        const [employee] = await db.query(
            `
                SELECT
                    u.id,
                    u.prefix,
                    u.first_name_th,
                    u.last_name_th,
                    u.first_name_en,
                    u.last_name_en,
                    u.email,
                    u.picture_path,

                    d.department_name,
                    r.role_name
                FROM user u
                JOIN department d ON u.department_id = d.department_id
                JOIN role r ON u.role_id = r.role_id
            `
        )

        if (!employee) {
            return NextResponse.json({ message: 'ไม่พบข้อมูลพนักงาน' }, { status: 404 })
        }

        return NextResponse.json({ employee })

    } catch (err) {
        return NextResponse.json({ message: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' }, { status: 500 })
    }
}