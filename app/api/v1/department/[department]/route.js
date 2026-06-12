import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request, { params }) {
    try {
        const { department } = await params
        const [rows] = await db.query('SELECT * FROM department WHERE department_name = ?', [department])
        const departmentData = rows[0] 
        if (!departmentData) {
            return NextResponse.json({ message: 'ไม่พบข้อมูลแผนก' }, { status: 404 })
        }

        const [roleRows] = await db.query(
            `
                SELECT 
                    r.role_id, 
                    r.role_name,
                    d.department_name
                FROM role r
                LEFT JOIN department d ON r.department_id = d.department_id
                WHERE d.department_id = ?
            `,
            [departmentData.department_id]
        )

        return NextResponse.json({ roles: roleRows, status: 200, message: 'ดึงข้อมูลตำแหน่งสำเร็จ' })
    } catch (error) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
    }
}