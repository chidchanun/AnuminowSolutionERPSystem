import { db } from '@/app/lib/db'
import { createNotifications } from '@/app/lib/notification'

function formatDate(value) {
    if (!value) return '-'

    return new Date(value).toLocaleDateString('th-TH', {
        dateStyle: 'medium',
    })
}

function getLeaveTypeLabel(type) {
    switch (type) {
        case 'sick':
            return 'ลาป่วย'
        case 'personal':
            return 'ลากิจ'
        case 'vacation':
            return 'ลาพักร้อน'
        case 'other':
            return 'อื่น ๆ'
        default:
            return type || '-'
    }
}

export async function getUserFullName(
    connection = db,
    userId
) {
    const [rows] = await connection.execute(
        `
        SELECT
            CONCAT(first_name_th, ' ', last_name_th) AS full_name
        FROM \`user\`
        WHERE id = ?
        LIMIT 1
        `,
        [userId]
    )

    return rows[0]?.full_name || userId
}

export async function getLeaveManagerUserIds(
    connection = db,
    excludeUserId = null
) {
    const values = []

    let excludeSql = ''

    if (excludeUserId) {
        excludeSql = 'AND u.id <> ?'
        values.push(excludeUserId)
    }

    const [rows] = await connection.execute(
        `
        SELECT
            u.id
        FROM \`user\` u
        INNER JOIN permission_role_map prm
            ON prm.permission_role_id = u.permission_role_id
        INNER JOIN permission p
            ON p.permission_id = prm.permission_id
        WHERE u.deleted_at IS NULL
        AND u.status = 'active'
        AND p.permission_key = 'leave.approve'
        ${excludeSql}
        `,
        values
    )

    return rows.map((row) => row.id)
}

export async function createLeaveSubmittedNotifications({
    connection = db,
    leaveId,
    requesterId,
    leaveType,
    startDate,
    endDate,
    createdBy,
}) {
    const requesterName =
        await getUserFullName(connection, requesterId)

    const managerUserIds =
        await getLeaveManagerUserIds(connection, requesterId)

    if (managerUserIds.length === 0) {
        return []
    }

    await createNotifications({
        connection,
        userIds: managerUserIds,
        type: 'leave_request',
        title: 'มีคำขอลาใหม่',
        message:
            `${requesterName} ส่งคำขอ${getLeaveTypeLabel(leaveType)} ` +
            `วันที่ ${formatDate(startDate)} - ${formatDate(endDate)}`,
        link: '/dashboard/leave',
        sourceTable: 'leave_request',
        sourceId: leaveId,
        createdBy,
        uniqueKeyPrefix: `leave_request:${leaveId}`,
    })

    return managerUserIds
}

export async function createLeaveResultNotification({
    connection = db,
    leaveId,
    requesterId,
    approverId,
    leaveType,
    startDate,
    endDate,
    status,
}) {
    if (!requesterId) return []

    const isApproved = status === 'approved'

    await createNotifications({
        connection,
        userIds: [requesterId],
        type: isApproved ? 'leave_approved' : 'leave_rejected',
        title: isApproved
            ? 'คำขอลาได้รับการอนุมัติ'
            : 'คำขอลาถูกปฏิเสธ',
        message:
            `คำขอ${getLeaveTypeLabel(leaveType)} ` +
            `วันที่ ${formatDate(startDate)} - ${formatDate(endDate)} ` +
            `${isApproved ? 'ได้รับการอนุมัติแล้ว' : 'ถูกปฏิเสธ'}`,
        link: '/dashboard/leave',
        sourceTable: 'leave_request',
        sourceId: leaveId,
        createdBy: approverId,
        uniqueKeyPrefix: `leave_result:${leaveId}:${status}`,
    })

    return [requesterId]
}
