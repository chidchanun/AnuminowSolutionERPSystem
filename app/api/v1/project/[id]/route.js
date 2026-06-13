import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

export async function GET(
    request,
    { params }
) {
    try {
        const { id } = await params

        const [projects] = await db.execute(
            `
            SELECT
                p.*,
                CONCAT(
                    u.first_name_th,
                    ' ',
                    u.last_name_th
                ) AS created_name
            FROM project p
            INNER JOIN user u
                ON p.created_by = u.id
            WHERE p.project_id = ?
            AND p.deleted_at IS NULL
            `,
            [id]
        )

        if (projects.length === 0) {
            return NextResponse.json(
                { message: 'Project not found' },
                { status: 404 }
            )
        }

        const [members] = await db.execute(
            `
            SELECT
                u.id,
                CONCAT(
                    u.first_name_th,
                    ' ',
                    u.last_name_th
                ) AS full_name,
                r.role_name,
                u.picture_path
            FROM project_member pm
            INNER JOIN user u
                ON pm.user_id = u.id
            INNER JOIN role r
                ON u.role_id = r.role_id
            WHERE pm.project_id = ?
            `,
            [id]
        )

        return NextResponse.json({
            project: projects[0],
            members
        })
    } catch (error) {
        console.error(error)

        return NextResponse.json(
            { message: 'Internal Server Error' },
            { status: 500 }
        )
    }
}

export async function PUT(
    request,
    { params }
) {
    try {


        const token = request.cookies.get('accessToken')?.value

        if (!token) {
            return NextResponse.json({message : 'โปรดเข้าสู่ระบบใหม่อีกครั้ง', status: 401})
        }

        const user = safeVerifyToken(token)
        if (!user) {
            return NextResponse.json({ message: 'โปรดเข้าสู่ระบบใหม่อีกครั้ง' }, { status: 401 })
        }

        if (
            !['Admin', 'Manager'].includes(
                user.permission_role
            )
        ) {
            return NextResponse.json(
                { message: 'Forbidden' },
                { status: 403 }
            )
        }

        const { id } = await params

        const body = await request.json()

        const {
            project_name,
            project_code,
            description,
            start_date,
            end_date,
            status
        } = body

        const [exists] = await db.execute(
            `
            SELECT project_id
            FROM project
            WHERE project_id = ?
            AND deleted_at IS NULL
            `,
            [id]
        )

        if (exists.length === 0) {
            return NextResponse.json(
                { message: 'Project not found' },
                { status: 404 }
            )
        }

        await db.execute(
            `
            UPDATE project
            SET
                project_name = ?,
                project_code = ?,
                description = ?,
                start_date = ?,
                end_date = ?,
                status = ?
            WHERE project_id = ?
            `,
            [
                project_name,
                project_code,
                description,
                start_date,
                end_date,
                status,
                id
            ]
        )

        return NextResponse.json({
            message: 'Project updated'
        })
    } catch (error) {
        console.error(error)

        return NextResponse.json(
            { message: 'Internal Server Error' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request,
    { params }
) {
    try {
        const user = await getCurrentUser()

        if (
            !['Admin', 'Manager'].includes(
                user.permission_role
            )
        ) {
            return NextResponse.json(
                { message: 'Forbidden' },
                { status: 403 }
            )
        }

        const { id } = await params

        await db.execute(
            `
                UPDATE project
                SET deleted_at = NOW()
                WHERE project_id = ?
            `,
            [id]
        )

        return NextResponse.json({
            message: 'Project deleted'
        })
    } catch (error) {
        console.error(error)

        return NextResponse.json(
            { message: 'Internal Server Error' },
            { status: 500 }
        )
    }
}