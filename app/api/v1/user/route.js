import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/app/lib/permission'

export async function GET(request) {
    try {
        const auth = await requireAnyPermission(request, [
            'employee.view',
            'project.create',
            'project.update',
            'task.create',
            'task.update',
        ])

        if (auth.response) return auth.response

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
            WHERE u.deleted_at IS NULL
            AND u.status = 'active'
            ORDER BY u.first_name_th ASC, u.last_name_th ASC
            
            `
        )
        return NextResponse.json({ message: 'ok', userData }, { status: 200 })
    } catch (e) {
        console.error('User list GET error:', e)
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
    }
}
