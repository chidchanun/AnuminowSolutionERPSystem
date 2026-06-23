import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasProjectWideAccess,
    requirePermission,
} from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'

export async function GET(
    request,
    { params }
) {
    try {
        const { id } = await params

        const auth = await requirePermission(
            request,
            'project.view'
        )

        if (auth.response) return auth.response

        const user = auth.user
        const canViewAll = hasProjectWideAccess(user)

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
            AND (
                ? = 1
                OR p.created_by = ?
                OR EXISTS (
                    SELECT 1
                    FROM project_member pm_scope
                    WHERE pm_scope.project_id = p.project_id
                    AND pm_scope.user_id = ?
                )
                OR EXISTS (
                    SELECT 1
                    FROM task t_scope
                    INNER JOIN task_assignment ta_scope
                        ON t_scope.task_id = ta_scope.task_id
                    WHERE t_scope.project_id = p.project_id
                    AND ta_scope.user_id = ?
                    AND t_scope.deleted_at IS NULL
                )
            )
            `,
            [
                id,
                canViewAll ? 1 : 0,
                user.id,
                user.id,
                user.id,
            ]
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
        const auth = await requirePermission(
            request,
            'project.update'
        )

        if (auth.response) return auth.response

        const user = auth.user

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

            await writeAuditLog({
                connection,
                actorId: user.id,
                action: 'project.update',
                entityType: 'project',
                entityId: id,
                summary: `Update project ${project_name}`,
                metadata: {
                    project_code,
                    status,
                    member_ids: Array.isArray(member_ids)
                        ? member_ids
                        : [],
                },
            })

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
        const auth = await requirePermission(
            request,
            'project.delete'
        )

        if (auth.response) return auth.response

        const userId = auth.user.id

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

        await writeAuditLog({
            connection,
            actorId: userId,
            action: 'project.delete',
            entityType: 'project',
            entityId: projectId,
            summary: `Delete project ${project.project_name}`,
            metadata: {
                project_name: project.project_name,
            },
        })

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
