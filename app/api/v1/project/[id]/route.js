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
            return NextResponse.json({ message: 'โปรดเข้าสู่ระบบใหม่อีกครั้ง', status: 401 })
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
            status,
            member_ids
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

        const connection = await db.getConnection()

        try {

            await connection.beginTransaction()

            await connection.execute(
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

            await connection.execute(
                `
                    DELETE FROM project_member
                    WHERE project_id = ?
                `,
                [id]
            )

            if (
                Array.isArray(member_ids) &&
                member_ids.length > 0
            ) {

                const values = member_ids.map(
                    (userId) => [id, userId]
                )

                await connection.query(
                    `
                        INSERT INTO project_member
                        (
                            project_id,
                            user_id
                        )
                        VALUES ?
                    `,
                    [values]
                )
            }

            await connection.commit()

        } catch (error) {

            await connection.rollback()
            throw error

        } finally {

            connection.release()

        }

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

export async function DELETE(request, context) {
    let connection

    try {
        const { id } = await context.params

        if (!id || !/^\d+$/.test(String(id))) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Project ID ไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const projectId = Number(id)

        const accessToken =
            request.cookies.get('accessToken')?.value

        if (!accessToken) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
                },
                { status: 401 }
            )
        }

        const payload = await safeVerifyToken(accessToken)

        if (!payload?.id) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Token ไม่ถูกต้อง',
                },
                { status: 401 }
            )
        }

        const userId = payload.id
        const role = payload.permission_role || 'Employee'

        if (!['Admin', 'Manager'].includes(role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'คุณไม่มีสิทธิ์ลบโปรเจกต์',
                },
                { status: 403 }
            )
        }

        const [projectRows] = await db.execute(
            `
            SELECT
                project_id,
                project_name,
                created_by
            FROM project
            WHERE project_id = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [projectId]
        )

        const project = projectRows[0]

        if (!project) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบโปรเจกต์ที่ต้องการลบ',
                },
                { status: 404 }
            )
        }

        connection = await db.getConnection()
        await connection.beginTransaction()

        await connection.execute(
            `
            UPDATE project
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE project_id = ?
            AND deleted_at IS NULL
            `,
            [projectId]
        )

        await connection.execute(
            `
            INSERT INTO task_history (
                task_id,
                target_table,
                target_column,
                action_type,
                old_value,
                new_value,
                description,
                action_by
            )
            SELECT
                t.task_id,
                'project',
                'deleted_at',
                'delete',
                NULL,
                'deleted',
                ?,
                ?
            FROM task t
            WHERE t.project_id = ?
            AND t.deleted_at IS NULL
            `,
            [
                `ลบโปรเจกต์ "${project.project_name}"`,
                userId,
                projectId,
            ]
        )

        await connection.commit()

        return NextResponse.json({
            success: true,
            message: 'ลบโปรเจกต์สำเร็จ',
            project_id: projectId,
        })
    } catch (error) {
        if (connection) {
            await connection.rollback()
        }

        console.error('Delete project error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ลบโปรเจกต์ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    } finally {
        if (connection) {
            connection.release()
        }
    }
}