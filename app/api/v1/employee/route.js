import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const auth = await requirePermission(
            request,
            'employee.view'
        )

        if (auth.response) return auth.response

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
                u.phone,
                u.picture_path,
                u.status,
                u.permission_role_id,

                d.department_id,
                d.department_name,

                r.role_id,
                r.role_name,

                upr.permission_role_name
            FROM \`user\` u
            JOIN department d
                ON u.department_id = d.department_id
            JOIN role r
                ON u.role_id = r.role_id
            JOIN user_permission_role upr
                ON upr.permission_role_id = u.permission_role_id
            WHERE u.deleted_at IS NULL
            ORDER BY u.created_at DESC
            `
        )

        return NextResponse.json({
            success: true,
            employee,
        })
    } catch (err) {
        console.error('GET employee error:', err)

        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการโหลดข้อมูล',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? err.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}