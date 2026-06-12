import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const tambon = searchParams.get('tambon')

        if (!tambon) {
            return NextResponse.json({ error: 'โปรดกรอกตำบล' }, { status: 400 })
        }

        const [tambonData] = await db.query(
            "SELECT tambon_id, tambon_thai_short FROM tambon WHERE tambon_thai_short = ?",
            [tambon]
        )

        if (!tambonData) {
            return NextResponse.json({ error: 'ไม่พบตำบล' }, { status: 404 })
        }

        const tambonId = tambonData[0].tambon_id

        const [postalData] = await db.query(
            `
                SELECT
                    p.province_thai,
                    p.district_thai_short,
                    p.tambon_thai_short,
                    p.post_code
                FROM postal p
                JOIN tambon t ON p.tambon_id = t.tambon_id
                WHERE t.tambon_id = ?
            `,
            [tambonId]
        )

        return NextResponse.json(postalData)

    } catch (error) {
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรหัสไปรษณีย์' }, { status: 500 })
    }
}