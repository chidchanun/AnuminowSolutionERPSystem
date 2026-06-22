import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import {
    canExportActivity,
    formatFilterValue,
    getActionLabel,
    getActivityAuthUser,
    getActivityExportData,
    getActivityFilters,
} from '@/app/lib/activityExportData'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function setupSheet(sheet) {
    sheet.views = [
        {
            state: 'frozen',
            ySplit: 1,
        },
    ]

    sheet.getRow(1).font = {
        bold: true,
        color: {
            argb: 'FFFFFFFF',
        },
    }

    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
            argb: 'FF0F172A',
        },
    }

    sheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = {
                top: {
                    style: 'thin',
                    color: {
                        argb: 'FFE2E8F0',
                    },
                },
                left: {
                    style: 'thin',
                    color: {
                        argb: 'FFE2E8F0',
                    },
                },
                bottom: {
                    style: 'thin',
                    color: {
                        argb: 'FFE2E8F0',
                    },
                },
                right: {
                    style: 'thin',
                    color: {
                        argb: 'FFE2E8F0',
                    },
                },
            }

            cell.alignment = {
                vertical: 'top',
                wrapText: true,
            }
        })
    })
}

function addInfoSheet(workbook, data, user) {
    const sheet =
        workbook.addWorksheet('ข้อมูล Export')

    sheet.columns = [
        {
            header: 'หัวข้อ',
            key: 'label',
            width: 28,
        },
        {
            header: 'ข้อมูล',
            key: 'value',
            width: 55,
        },
    ]

    const filters =
        data.filters

    sheet.addRows([
        {
            label: 'ชื่อรายงาน',
            value: 'Activity Log',
        },
        {
            label: 'Export โดย',
            value: user.full_name,
        },
        {
            label: 'สิทธิ์',
            value: user.role_name || user.role,
        },
        {
            label: 'วันที่ Export',
            value: new Date(data.generated_at).toLocaleString('th-TH'),
        },
        {
            label: 'Action',
            value: formatFilterValue('action_type', filters.action_type),
        },
        {
            label: 'Project ID',
            value: formatFilterValue('project_id', filters.project_id),
        },
        {
            label: 'Task ID',
            value: formatFilterValue('task_id', filters.task_id),
        },
        {
            label: 'User ID',
            value: formatFilterValue('action_by', filters.action_by),
        },
        {
            label: 'From',
            value: filters.from || '-',
        },
        {
            label: 'To',
            value: filters.to || '-',
        },
        {
            label: 'จำนวนรายการ',
            value: data.activities.length,
        },
    ])

    setupSheet(sheet)
}

function addActivitySheet(workbook, rows) {
    const sheet =
        workbook.addWorksheet('Activity Log')

    sheet.columns = [
        {
            header: 'History ID',
            key: 'history_id',
            width: 12,
        },
        {
            header: 'วันที่',
            key: 'created_at',
            width: 22,
        },
        {
            header: 'Action',
            key: 'action_type',
            width: 18,
        },
        {
            header: 'รายละเอียด',
            key: 'description',
            width: 45,
        },
        {
            header: 'Target',
            key: 'target',
            width: 25,
        },
        {
            header: 'Old Value',
            key: 'old_value',
            width: 25,
        },
        {
            header: 'New Value',
            key: 'new_value',
            width: 25,
        },
        {
            header: 'Task',
            key: 'task',
            width: 40,
        },
        {
            header: 'Project',
            key: 'project',
            width: 40,
        },
        {
            header: 'ผู้กระทำ',
            key: 'action_by_name',
            width: 30,
        },
        {
            header: 'User ID',
            key: 'action_by',
            width: 18,
        },
    ]

    rows.forEach((row) => {
        sheet.addRow({
            history_id: row.history_id,
            created_at: row.created_at
                ? new Date(row.created_at).toLocaleString('th-TH')
                : '-',
            action_type: getActionLabel(row.action_type),
            description: row.description || '-',
            target: `${row.target_table || '-'}.${row.target_column || '-'}`,
            old_value: row.old_value || '-',
            new_value: row.new_value || '-',
            task: `#${row.task_id} ${row.task_name || '-'}`,
            project: row.project_id
                ? `#${row.project_id} ${row.project_name || '-'} (${row.project_code || '-'})`
                : '-',
            action_by_name: row.action_by_name || '-',
            action_by: row.action_by || '-',
        })
    })

    setupSheet(sheet)
}

export async function GET(request) {
    try {
        const user =
            await getActivityAuthUser(request)

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Unauthorized',
                },
                { status: 401 }
            )
        }

        if (!canExportActivity(user)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่มีสิทธิ์ Export Activity Log',
                },
                { status: 403 }
            )
        }

        const filters =
            getActivityFilters(request)

        const data =
            await getActivityExportData({
                user,
                filters,
            })

        const workbook =
            new ExcelJS.Workbook()

        workbook.creator = 'ERP System'
        workbook.created = new Date()

        addInfoSheet(workbook, data, user)
        addActivitySheet(workbook, data.activities)

        const buffer =
            await workbook.xlsx.writeBuffer()

        const fileName =
            `activity-log-${Date.now()}.xlsx`

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type':
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition':
                    `attachment; filename="${fileName}"`,
                'Cache-Control':
                    'no-store',
            },
        })
    } catch (error) {
        console.error('Export Activity Excel Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Export Activity Excel ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}