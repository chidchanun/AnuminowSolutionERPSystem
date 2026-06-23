import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    getAuthUserWithPermissions,
    hasTaskWideAccess,
} from '@/app/lib/permission'
import { createNotifications } from '@/app/lib/notification'
import { emitNotificationToUsers } from '@/app/lib/socketEmit'
import { writeAuditLog } from '@/app/lib/auditLog'

async function getAuthUser(request) {
    return getAuthUserWithPermissions(request)
}

async function canAccessTask(id, user) {
    if (!user?.id) {
        return false
    }

    if (hasTaskWideAccess(user)) {
        const [rows] = await db.execute(
            `
            SELECT task_id
            FROM task
            WHERE task_id = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [id]
        )

        return rows.length > 0
    }

    const [rows] = await db.execute(
        `
        SELECT
            t.task_id
        FROM task t
        INNER JOIN project p
            ON p.project_id = t.project_id
        LEFT JOIN project_member pm
            ON pm.project_id = p.project_id
            AND pm.user_id = ?
        LEFT JOIN task_assignment ta
            ON ta.task_id = t.task_id
            AND ta.user_id = ?
        WHERE t.task_id = ?
        AND t.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND (
            t.created_by = ?
            OR p.created_by = ?
            OR pm.user_id IS NOT NULL
            OR ta.user_id IS NOT NULL
        )
        LIMIT 1
        `,
        [
            user.id,
            user.id,
            id,
            user.id,
            user.id,
        ]
    )

    return rows.length > 0
}

export async function GET(request, { params }) {
    try {
        const user = await getAuthUser(request)

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Unauthorized',
                },
                {
                    status: 401,
                }
            )
        }

        const { id } = await params



        if (!id || !/^\d+$/.test(String(id))) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Task ID ไม่ถูกต้อง',
                },
                {
                    status: 400,
                }
            )
        }

        const hasAccess = await canAccessTask(id, user)

        if (!hasAccess) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่มีสิทธิ์เข้าถึง comment ของงานนี้',
                },
                {
                    status: 403,
                }
            )
        }

        const [comments] = await db.execute(
            `
            SELECT
                tc.comment_id,
                tc.parent_comment_id,
                tc.task_id,
                tc.user_id,
                tc.comment,
                tc.created_at,
                tc.updated_at,

                u.prefix,
                u.first_name_th,
                u.last_name_th,
                u.first_name_en,
                u.last_name_en,
                u.picture_path,

                CONCAT(u.first_name_th, ' ', u.last_name_th) AS user_full_name
            FROM task_comment tc
            INNER JOIN user u
                ON u.id = tc.user_id
            WHERE tc.task_id = ?
            AND tc.deleted_at IS NULL
            ORDER BY
                COALESCE(tc.parent_comment_id, tc.comment_id) ASC,
                tc.parent_comment_id IS NOT NULL ASC,
                tc.created_at ASC
            `,
            [id]
        )

        return NextResponse.json({
            success: true,
            comments,
            current_user_id: user.id,
            current_user_permissions: user.permissions || [],
        })
    } catch (error) {
        console.error('GET Task Comment Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลด comment ไม่สำเร็จ',
                error_detail: error.message,
            },
            {
                status: 500,
            }
        )
    }
}

export async function POST(request, { params }) {
    const connection = await db.getConnection()

    try {
        const { id } = await params
        const taskId = id

        const user = await getAuthUser(request)

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Unauthorized',
                },
                {
                    status: 401,
                }
            )
        }

        if (!taskId || !/^\d+$/.test(String(taskId))) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Task ID ไม่ถูกต้อง',
                },
                {
                    status: 400,
                }
            )
        }

        const body = await request.json()

        const comment = String(body.comment || '').trim()

        const parentCommentId =
            body.parent_comment_id
                ? String(body.parent_comment_id).trim()
                : null

        if (!comment) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณากรอก comment',
                },
                {
                    status: 400,
                }
            )
        }

        if (comment.length > 5000) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Comment ยาวเกินไป',
                },
                {
                    status: 400,
                }
            )
        }

        const hasAccess = await canAccessTask(taskId, user)

        if (!hasAccess) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่มีสิทธิ์เพิ่ม comment ในงานนี้',
                },
                {
                    status: 403,
                }
            )
        }

        if (
            parentCommentId &&
            !/^\d+$/.test(String(parentCommentId))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Parent Comment ID ไม่ถูกต้อง',
                },
                {
                    status: 400,
                }
            )
        }

        if (parentCommentId) {
            const [parentRows] = await db.execute(
                `
                SELECT
                    comment_id,
                    parent_comment_id
                FROM task_comment
                WHERE comment_id = ?
                AND task_id = ?
                AND deleted_at IS NULL
                LIMIT 1
                `,
                [
                    parentCommentId,
                    taskId,
                ]
            )

            const parentComment =
                parentRows[0]

            if (!parentComment) {
                return NextResponse.json(
                    {
                        success: false,
                        message: 'ไม่พบ comment หลัก',
                    },
                    {
                        status: 404,
                    }
                )
            }

            if (parentComment.parent_comment_id) {
                return NextResponse.json(
                    {
                        success: false,
                        message: 'ไม่สามารถ reply ซ้อน reply ได้',
                    },
                    {
                        status: 400,
                    }
                )
            }
        }

        await connection.beginTransaction()

        const [result] = await connection.execute(
            `
            INSERT INTO task_comment (
                parent_comment_id,
                task_id,
                user_id,
                comment
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                parentCommentId,
                taskId,
                user.id,
                comment,
            ]
        )

        const [taskRows] = await connection.execute(
            `
            SELECT
                task_id,
                task_name,
                created_by
            FROM task
            WHERE task_id = ?
            LIMIT 1
            `,
            [taskId]
        )

        const task = taskRows[0]

        const [targetRows] = await connection.execute(
            `
            SELECT DISTINCT user_id
            FROM (
                SELECT created_by AS user_id
                FROM task
                WHERE task_id = ?

                UNION

                SELECT user_id
                FROM task_assignment
                WHERE task_id = ?

                ${parentCommentId
                ? `
                        UNION

                        SELECT user_id
                        FROM task_comment
                        WHERE comment_id = ?
                        `
                : ''
            }
            ) targets
            WHERE user_id IS NOT NULL
            AND user_id <> ?
            `,
            parentCommentId
                ? [
                    taskId,
                    taskId,
                    parentCommentId,
                    user.id,
                ]
                : [
                    taskId,
                    taskId,
                    user.id,
                ]
        )
        const notificationTargetUserIds =
            targetRows.map((row) => row.user_id)

        await createNotifications({
            connection,
            userIds: targetRows.map((row) => row.user_id),
            type: parentCommentId
                ? 'task_reply'
                : 'task_comment',
            title: parentCommentId
                ? 'มีคนตอบกลับ comment'
                : 'มี comment ใหม่ในงาน',
            message: parentCommentId
                ? `มีคนตอบกลับในงาน: ${task.task_name}`
                : `มี comment ใหม่ในงาน: ${task.task_name}`,
            link: `/dashboard/task/${taskId}`,
            sourceTable: 'task_comment',
            sourceId: result.insertId,
            createdBy: user.id,
        })

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
            VALUES (?, 'task_comment', 'comment', 'comment', NULL, ?, ?, ?)
            `,
            [
                taskId,
                comment,
                parentCommentId
                    ? 'เพิ่ม reply ใน comment'
                    : 'เพิ่ม comment ในงาน',
                user.id,
            ]
        )

        await writeAuditLog({
            connection,
            actorId: user.id,
            action: parentCommentId ? 'task.reply.create' : 'task.comment.create',
            entityType: 'task_comment',
            entityId: result.insertId,
            summary: parentCommentId
                ? `Create reply on task ${taskId}`
                : `Create comment on task ${taskId}`,
            metadata: {
                task_id: taskId,
                parent_comment_id: parentCommentId,
            },
        })


        await connection.commit()

        await emitNotificationToUsers(notificationTargetUserIds)

        return NextResponse.json({
            success: true,
            message: parentCommentId
                ? 'เพิ่ม reply สำเร็จ'
                : 'เพิ่ม comment สำเร็จ',
            comment_id: result.insertId,
        })
    } catch (error) {
        await connection.rollback()

        console.error('POST Task Comment Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'เพิ่ม comment ไม่สำเร็จ',
                error_detail: error.message,
            },
            {
                status: 500,
            }
        )
    } finally {
        connection.release()
    }
}
