import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const province = searchParams.get('province')

        if (!province) {
            return NextResponse.json({ error: 'โปรดกรอกจังหวัด' }, { status: 400 })
        }
        console.log(province)
        const [provinceData] = await db.query(
            "SELECT province_id, province_thai FROM province WHERE province_thai = ?",
            [province]
        )

        if (!provinceData) {
            return NextResponse.json({ error: 'ไม่พบจังหวัด' }, { status: 404 })
        }


        const provinceId = provinceData[0].province_id
        console.log(provinceId)
        const [districts] = await db.query(
            `
            SELECT 
                d.district_id,
                d.district_thai_short,
                d.district_eng_short
            FROM district d
            JOIN province p ON d.province_id = p.province_id
            WHERE p.province_id = ?
        `,
            [provinceId]
        )

        return NextResponse.json({ districts })
    } catch (error) {
        console.error('Error fetching districts:', error)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลอำเภอ' }, { status: 500 })
    }
}