import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const [roles] = await db.query('SELECT * FROM role')

        if (!roles) {
            return NextResponse.json({ message: 'ไม่พบข้อมูลตำแหน่ง' }, { status: 404 })
        }

        return NextResponse.json(roles)

    } catch (err) {
        return NextResponse.json({ message: 'เกิดข้อผิดพลาดในการโหลดข้อมูล' }, { status: 500 })
    }
}