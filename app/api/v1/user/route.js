import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const [userData] = await db.execute(
            `SELECT 
                u.id,
                u.first_name_th,
                u.last_name_th,
                u.first_name_en,
                u.last_name_en,
                u.picture_path,

                d.department_name,
                r.role_name

            FROM user u
            LEFT JOIN department d ON u.department_id = d.department_id
            LEFT JOIN role r ON u.role_id = r.role_id
            
            `
        )
        return NextResponse.json({ message: 'ok', userData }, { status: 200 })
    } catch (e) {
        console.log(e)
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
    }
}