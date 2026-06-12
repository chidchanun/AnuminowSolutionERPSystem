import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const [rows] = await db.query('SELECT * FROM department')
        return NextResponse.json({ departments: rows , status: 200 , message: 'ดึงข้อมูลแผนกสำเร็จ' })
    } catch (error) {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
    }
}