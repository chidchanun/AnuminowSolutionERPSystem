import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import {
    canAccessReport,
    formatFilterValue,
    getPriorityLabel,
    getReportAuthUser,
    getReportExportData,
    getReportFilters,
    getReportTypeLabel,
    getStatusLabel,
} from '@/app/lib/reportExportData'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function toNumber(value) {
    return Number(value || 0)
}

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

    sheet.getRow(1).alignment = {
        vertical: 'middle',
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
        })
    })
}

function addInfoSheet(workbook, data, user) {
    const sheet =
        workbook.addWorksheet('ข้อมูลรายงาน')

    sheet.columns = [
        {
            header: 'หัวข้อ',
            key: 'label',
            width: 30,
        },
        {
            header: 'ข้อมูล',
            key: 'value',
            width: 50,
        },
    ]

    const filters =
        data.filters

    sheet.addRows([
        {
            label: 'ชื่อรายงาน',
            value: getReportTypeLabel(filters.report_type),
        },
        {
            label: 'Export โดย',
            value: user.full_name,
        },
        {
            label: 'ตำแหน่ง / สิทธิ์',
            value: user.role_name || user.role,
        },
        {
            label: 'วันที่ Export',
            value: new Date(data.generated_at).toLocaleString('th-TH'),
        },
        {
            label: 'Project ID',
            value: formatFilterValue('project_id', filters.project_id),
        },
        {
            label: 'Project Status',
            value: formatFilterValue('project_status', filters.project_status),
        },
        {
            label: 'Task Status',
            value: formatFilterValue('task_status', filters.task_status),
        },
        {
            label: 'Priority',
            value: formatFilterValue('priority', filters.priority),
        },
        {
            label: 'From',
            value: filters.from || '-',
        },
        {
            label: 'To',
            value: filters.to || '-',
        },
    ])

    setupSheet(sheet)
}

function addSummarySheet(workbook, data) {
    const sheet =
        workbook.addWorksheet('สรุปภาพรวม')

    sheet.columns = [
        {
            header: 'รายการ',
            key: 'metric',
            width: 35,
        },
        {
            header: 'จำนวน',
            key: 'value',
            width: 18,
        },
    ]

    const project =
        data.summary.project

    const task =
        data.summary.task

    sheet.addRows([
        {
            metric: 'โปรเจกต์ทั้งหมด',
            value: toNumber(project.total_projects),
        },
        {
            metric: 'โปรเจกต์วางแผน',
            value: toNumber(project.planning_projects),
        },
        {
            metric: 'โปรเจกต์กำลังดำเนินการ',
            value: toNumber(project.active_projects),
        },
        {
            metric: 'โปรเจกต์เสร็จสิ้น',
            value: toNumber(project.completed_projects),
        },
        {
            metric: 'โปรเจกต์ยกเลิก',
            value: toNumber(project.cancelled_projects),
        },
        {
            metric: 'โปรเจกต์เกินกำหนด',
            value: toNumber(project.overdue_projects),
        },
        {
            metric: 'งานทั้งหมด',
            value: toNumber(task.total_tasks),
        },
        {
            metric: 'Todo',
            value: toNumber(task.todo_tasks),
        },
        {
            metric: 'In Progress',
            value: toNumber(task.in_progress_tasks),
        },
        {
            metric: 'Review',
            value: toNumber(task.review_tasks),
        },
        {
            metric: 'Done',
            value: toNumber(task.done_tasks),
        },
        {
            metric: 'งานเกินกำหนด',
            value: toNumber(task.overdue_tasks),
        },
    ])

    setupSheet(sheet)
}

function addCountSheet({
    workbook,
    name,
    rows,
    labelKey,
}) {
    const sheet =
        workbook.addWorksheet(name)

    sheet.columns = [
        {
            header: 'รายการ',
            key: 'label',
            width: 30,
        },
        {
            header: 'จำนวน',
            key: 'count',
            width: 15,
        },
    ]

    rows.forEach((row) => {
        sheet.addRow({
            label:
                labelKey === 'priority'
                    ? getPriorityLabel(row[labelKey])
                    : getStatusLabel(row[labelKey]),
            count: toNumber(row.count),
        })
    })

    setupSheet(sheet)
}

function addTaskSheet(workbook, rows, sheetName = 'รายการงาน') {
    const sheet =
        workbook.addWorksheet(sheetName)

    sheet.columns = [
        {
            header: 'Task ID',
            key: 'task_id',
            width: 12,
        },
        {
            header: 'ชื่องาน',
            key: 'task_name',
            width: 35,
        },
        {
            header: 'โปรเจกต์',
            key: 'project',
            width: 35,
        },
        {
            header: 'ผู้รับผิดชอบ',
            key: 'assignee_names',
            width: 35,
        },
        {
            header: 'Priority',
            key: 'priority',
            width: 15,
        },
        {
            header: 'Status',
            key: 'status',
            width: 18,
        },
        {
            header: 'วันเริ่มต้น',
            key: 'start_date',
            width: 18,
        },
        {
            header: 'กำหนดส่ง',
            key: 'due_date',
            width: 18,
        },
        {
            header: 'ผู้สร้าง',
            key: 'created_by_name',
            width: 25,
        },
    ]

    rows.forEach((row) => {
        sheet.addRow({
            task_id: row.task_id,
            task_name: row.task_name,
            project: `${row.project_name || '-'} (${row.project_code || '-'})`,
            assignee_names: row.assignee_names || '-',
            priority: getPriorityLabel(row.priority),
            status: getStatusLabel(row.status),
            start_date: row.start_date || '-',
            due_date: row.due_date || '-',
            created_by_name: row.created_by_name || '-',
        })
    })

    setupSheet(sheet)
}

function addProjectPerformanceSheet(workbook, rows) {
    const sheet =
        workbook.addWorksheet('ประสิทธิภาพโปรเจกต์')

    sheet.columns = [
        {
            header: 'Project ID',
            key: 'project_id',
            width: 12,
        },
        {
            header: 'ชื่อโปรเจกต์',
            key: 'project_name',
            width: 35,
        },
        {
            header: 'Code',
            key: 'project_code',
            width: 18,
        },
        {
            header: 'Status',
            key: 'status',
            width: 18,
        },
        {
            header: 'งานทั้งหมด',
            key: 'total_tasks',
            width: 15,
        },
        {
            header: 'เสร็จแล้ว',
            key: 'done_tasks',
            width: 15,
        },
        {
            header: 'ค้างอยู่',
            key: 'pending_tasks',
            width: 15,
        },
        {
            header: 'เกินกำหนด',
            key: 'overdue_tasks',
            width: 15,
        },
        {
            header: 'ความคืบหน้า %',
            key: 'progress_percent',
            width: 18,
        },
    ]

    rows.forEach((row) => {
        sheet.addRow({
            project_id: row.project_id,
            project_name: row.project_name,
            project_code: row.project_code,
            status: getStatusLabel(row.status),
            total_tasks: toNumber(row.total_tasks),
            done_tasks: toNumber(row.done_tasks),
            pending_tasks: toNumber(row.pending_tasks),
            overdue_tasks: toNumber(row.overdue_tasks),
            progress_percent: toNumber(row.progress_percent),
        })
    })

    setupSheet(sheet)
}

export async function GET(request) {
    try {
        const user =
            await getReportAuthUser(request)

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

        if (!canAccessReport(user)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่มีสิทธิ์ Export Report',
                },
                {
                    status: 403,
                }
            )
        }

        const filters =
            getReportFilters(request)

        const data =
            await getReportExportData(filters)

        const workbook =
            new ExcelJS.Workbook()

        workbook.creator = 'ERP System'
        workbook.created = new Date()

        addInfoSheet(workbook, data, user)

        if (filters.report_type === 'overview') {
            addSummarySheet(workbook, data)

            addCountSheet({
                workbook,
                name: 'สถานะโปรเจกต์',
                rows: data.charts.project_status,
                labelKey: 'status',
            })

            addCountSheet({
                workbook,
                name: 'สถานะงาน',
                rows: data.charts.task_status,
                labelKey: 'status',
            })

            addCountSheet({
                workbook,
                name: 'Priority งาน',
                rows: data.charts.task_priority,
                labelKey: 'priority',
            })

            addProjectPerformanceSheet(
                workbook,
                data.project_performance
            )

            addTaskSheet(
                workbook,
                data.overdue_tasks,
                'งานเกินกำหนด'
            )
        }

        if (filters.report_type === 'project') {
            addProjectPerformanceSheet(
                workbook,
                data.project_performance
            )

            addCountSheet({
                workbook,
                name: 'สถานะโปรเจกต์',
                rows: data.charts.project_status,
                labelKey: 'status',
            })
        }

        if (filters.report_type === 'task') {
            addTaskSheet(
                workbook,
                data.tasks,
                'รายการงาน'
            )

            addCountSheet({
                workbook,
                name: 'สถานะงาน',
                rows: data.charts.task_status,
                labelKey: 'status',
            })

            addCountSheet({
                workbook,
                name: 'Priority งาน',
                rows: data.charts.task_priority,
                labelKey: 'priority',
            })
        }

        if (filters.report_type === 'overdue') {
            addTaskSheet(
                workbook,
                data.overdue_tasks,
                'งานเกินกำหนด'
            )
        }

        const buffer =
            await workbook.xlsx.writeBuffer()

        const fileName =
            `report-${filters.report_type}-${Date.now()}.xlsx`

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
        console.error('Export Excel Report Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Export Excel ไม่สำเร็จ',
                error_detail: error.message,
            },
            {
                status: 500,
            }
        )
    }
}