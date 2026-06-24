import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { createNotification } from '@/app/lib/notification'
import { emitNotificationToUsers } from '@/app/lib/socketEmit'

export async function POST(request) {
    const cronSecret =
        request.headers.get('x-cron-secret')

    if (!process.env.CRON_SECRET) {
        return NextResponse.json(
            {
                success: false,
                message: 'Cron secret is not configured',
            },
            {
                status: 500,
            }
        )
    }

    if (cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json(
            {
                success: false,
                message: 'Forbidden',
            },
            {
                status: 403,
            }
        )
    }

    try {
        const [rows] = await db.execute(
            `
            SELECT
                t.task_id,
                t.task_name,
                t.due_date,
                t.created_by,
                ta.user_id AS assignee_id
            FROM task t
            LEFT JOIN task_assignment ta
                ON ta.task_id = t.task_id
            WHERE t.deleted_at IS NULL
            AND t.status <> 'done'
            AND t.due_date IS NOT NULL
            AND t.due_date BETWEEN CURDATE()
                AND DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            `
        )

        let createdCount = 0

        const notificationTargetUserIds = []

        for (const row of rows) {
            const targetUserIds = [
                row.created_by,
                row.assignee_id,
            ].filter(Boolean)

            const uniqueUserIds = [
                ...new Set(
                    targetUserIds.map((id) => String(id))
                ),
            ]

            for (const userId of uniqueUserIds) {
                const result = await createNotification({
                    userId,
                    type: 'task_due_soon',
                    title: 'งานใกล้ครบกำหนด',
                    message: `งาน "${row.task_name}" ใกล้ครบกำหนด`,
                    link: `/dashboard/task/${row.task_id}`,
                    sourceTable: 'task',
                    sourceId: row.task_id,
                    uniqueKey: `task_due_soon:${row.task_id}:${row.due_date}:${userId}`,
                    createdBy: null,
                })

                if (result?.affectedRows > 0) {
                    createdCount += 1
                    notificationTargetUserIds.push(userId)
                }
            }
        }

        await emitNotificationToUsers(notificationTargetUserIds)

        return NextResponse.json({
            success: true,
            message: 'สร้าง notification งานใกล้ครบกำหนดสำเร็จ',
            created_count: createdCount,
            emitted_to: [
                ...new Set(notificationTargetUserIds),
            ],
        })
    } catch (error) {
        console.error('Due Task Notification Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'สร้าง notification งานใกล้ครบกำหนดไม่สำเร็จ',
                error_detail: error.message,
            },
            {
                status: 500,
            }
        )
    }
}
