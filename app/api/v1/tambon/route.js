import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const district = searchParams.get('district')

        if (!district) {
            return NextResponse.json({ error: 'โปรดกรอกอำเภอ' }, { status: 400 })
        }

        const [districtData] = await db.query(
            "SELECT district_id, district_thai_short FROM district WHERE district_thai_short = ?",
            [district]
        )

        if (!districtData) {
            return NextResponse.json({ error: 'ไม่พบอำเภอ' }, { status: 404 })
        }
        const districtId = districtData[0].district_id
        const [tambons] = await db.query(
            `
                SELECT 
                    t.tambon_id,
                    t.tambon_thai_short,
                    t.tambon_eng_short
                FROM tambon t
                JOIN district d ON t.district_id = d.district_id
                WHERE d.district_id = ?
            `,
            [districtId]
        )

        return NextResponse.json(tambons)

    } catch (error) {
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลตำบล' }, { status: 500 })
    }
}