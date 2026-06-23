import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    getAuthUserWithPermissions,
    hasTaskWideAccess,
} from '@/app/lib/permission'


async function getAuthUser(request) {
    return getAuthUserWithPermissions(request)
}

async function getComment(commentId) {
    const [rows] = await db.execute(
        `
        SELECT
            comment_id,
            task_id,
            user_id,
            comment
        FROM task_comment
        WHERE comment_id = ?
        AND deleted_at IS NULL
        LIMIT 1
        `,
        [commentId]
    )

    return rows[0] || null
}

function canModifyComment(comment, user) {
    if (!comment || !user) {
        return false
    }

    if (hasTaskWideAccess(user)) {
        return true
    }

    return String(comment.user_id) === String(user.id)
}

export async function PUT(request, { params }) {
    const connection = await db.getConnection()

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

        const { commentId } = await params

        if (!commentId || !/^\d+$/.test(String(commentId))) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Comment ID ไม่ถูกต้อง',
                },
                {
                    status: 400,
                }
            )
        }

        const oldComment = await getComment(commentId)

        if (!oldComment) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบ comment',
                },
                {
                    status: 404,
                }
            )
        }

        if (!canModifyComment(oldComment, user)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่มีสิทธิ์แก้ไข comment นี้',
                },
                {
                    status: 403,
                }
            )
        }

        const body = await request.json()
        const newComment = String(body.comment || '').trim()

        if (!newComment) {
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

        if (newComment.length > 5000) {
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

        await connection.beginTransaction()

        await connection.execute(
            `
            UPDATE task_comment
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE comment_id = ?
            OR parent_comment_id = ?
            `,
            [
                commentId,
                commentId,
            ]
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
            VALUES (?, 'task_comment', 'comment', 'update', ?, ?, ?, ?)
            `,
            [
                oldComment.task_id,
                oldComment.comment,
                newComment,
                'แก้ไข comment',
                user.id,
            ]
        )

        await connection.commit()

        return NextResponse.json({
            success: true,
            message: 'แก้ไข comment สำเร็จ',
        })
    } catch (error) {
        await connection.rollback()

        console.error('PUT Task Comment Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'แก้ไข comment ไม่สำเร็จ',
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

export async function DELETE(request, { params }) {
    const connection = await db.getConnection()

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

        const { commentId } = await params

        if (!commentId || !/^\d+$/.test(String(commentId))) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Comment ID ไม่ถูกต้อง',
                },
                {
                    status: 400,
                }
            )
        }

        const comment = await getComment(commentId)

        if (!comment) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบ comment',
                },
                {
                    status: 404,
                }
            )
        }

        if (!canModifyComment(comment, user)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่มีสิทธิ์ลบ comment นี้',
                },
                {
                    status: 403,
                }
            )
        }

        await connection.beginTransaction()

        await connection.execute(
            `
            UPDATE task_comment
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE comment_id = ?
            `,
            [commentId]
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
            VALUES (?, 'task_comment', 'comment', 'delete', ?, NULL, ?, ?)
            `,
            [
                comment.task_id,
                comment.comment,
                'ลบ comment',
                user.id,
            ]
        )

        await connection.commit()

        return NextResponse.json({
            success: true,
            message: 'ลบ comment สำเร็จ',
        })
    } catch (error) {
        await connection.rollback()

        console.error('DELETE Task Comment Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ลบ comment ไม่สำเร็จ',
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