import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
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

const PAGE_MARGIN = 42

function toNumber(value) {
    return Number(value || 0)
}

function createPdfBuffer(doc) {
    return new Promise((resolve, reject) => {
        const chunks = []

        doc.on('data', (chunk) => {
            chunks.push(chunk)
        })

        doc.on('end', () => {
            resolve(Buffer.concat(chunks))
        })

        doc.on('error', reject)
    })
}

function findReportFont() {
    const candidates = [
        path.join(
            process.cwd(),
            'public',
            'fonts',
            'Sarabun-Regular.ttf'
        ),
        path.join(
            process.cwd(),
            'public',
            'fonts',
            'NotoSansThai-Regular.ttf'
        ),
        path.join(
            process.cwd(),
            'public',
            'fonts',
            'THSarabunNew.ttf'
        ),
        'C:\\Windows\\Fonts\\tahoma.ttf',
        'C:\\Windows\\Fonts\\arial.ttf',
        '/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]

    return candidates.find((fontPath) =>
        fs.existsSync(fontPath)
    )
}

function setupFont(doc, fontPath) {
    doc.registerFont('reportFont', fontPath)
    doc.font('reportFont')
}

function ensureSpace(doc, fontPath, height = 80) {
    const bottom =
        doc.page.height - PAGE_MARGIN

    if (doc.y + height > bottom) {
        doc.addPage()
        setupFont(doc, fontPath)
    }
}

function textValue(value) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return '-'
    }

    return String(value)
}

function addTitle(doc, fontPath, title, user, data) {
    setupFont(doc, fontPath)

    doc
        .fontSize(20)
        .fillColor('#0f172a')
        .text(title, {
            align: 'center',
        })

    doc.moveDown(0.4)

    doc
        .fontSize(10)
        .fillColor('#475569')
        .text(
            `Export โดย: ${user.full_name} | วันที่: ${new Date(data.generated_at).toLocaleString('th-TH')}`,
            {
                align: 'center',
            }
        )

    doc.moveDown(0.8)
}

function addSectionTitle(doc, fontPath, text) {
    ensureSpace(doc, fontPath, 50)

    doc
        .moveDown(0.5)
        .fontSize(14)
        .fillColor('#0f172a')
        .text(text)

    doc
        .moveTo(PAGE_MARGIN, doc.y + 4)
        .lineTo(
            doc.page.width - PAGE_MARGIN,
            doc.y + 4
        )
        .strokeColor('#cbd5e1')
        .stroke()

    doc.moveDown(0.8)
}

function drawTable(doc, fontPath, columns, rows, options = {}) {
    const rowHeight =
        options.rowHeight || 26

    const headerHeight =
        options.headerHeight || 28

    const startX =
        PAGE_MARGIN

    const tableWidth =
        columns.reduce(
            (sum, column) => sum + column.width,
            0
        )

    ensureSpace(
        doc,
        fontPath,
        headerHeight + rowHeight
    )

    let y =
        doc.y

    doc
        .rect(startX, y, tableWidth, headerHeight)
        .fill('#0f172a')

    let x =
        startX

    columns.forEach((column) => {
        doc
            .fillColor('#ffffff')
            .fontSize(9)
            .text(
                column.header,
                x + 5,
                y + 8,
                {
                    width: column.width - 10,
                    height: headerHeight - 8,
                    ellipsis: true,
                }
            )

        x += column.width
    })

    y += headerHeight

    if (!rows.length) {
        ensureSpace(doc, fontPath, rowHeight)

        doc
            .rect(startX, y, tableWidth, rowHeight)
            .fill('#f8fafc')
            .strokeColor('#e2e8f0')
            .stroke()

        doc
            .fillColor('#64748b')
            .fontSize(9)
            .text(
                'ไม่มีข้อมูล',
                startX + 5,
                y + 8,
                {
                    width: tableWidth - 10,
                }
            )

        doc.y = y + rowHeight + 8
        return
    }

    rows.forEach((row, rowIndex) => {
        ensureSpace(
            doc,
            fontPath,
            rowHeight + 10
        )

        if (
            doc.y + rowHeight >
            doc.page.height - PAGE_MARGIN
        ) {
            doc.addPage()
            setupFont(doc, fontPath)
            y = doc.y

            doc
                .rect(startX, y, tableWidth, headerHeight)
                .fill('#0f172a')

            let headerX =
                startX

            columns.forEach((column) => {
                doc
                    .fillColor('#ffffff')
                    .fontSize(9)
                    .text(
                        column.header,
                        headerX + 5,
                        y + 8,
                        {
                            width: column.width - 10,
                            height: headerHeight - 8,
                            ellipsis: true,
                        }
                    )

                headerX += column.width
            })

            y += headerHeight
        }

        const bg =
            rowIndex % 2 === 0
                ? '#ffffff'
                : '#f8fafc'

        doc
            .rect(startX, y, tableWidth, rowHeight)
            .fill(bg)

        doc
            .rect(startX, y, tableWidth, rowHeight)
            .strokeColor('#e2e8f0')
            .stroke()

        x = startX

        columns.forEach((column) => {
            const raw =
                column.render
                    ? column.render(row)
                    : row[column.key]

            doc
                .fillColor('#0f172a')
                .fontSize(8.5)
                .text(
                    textValue(raw),
                    x + 5,
                    y + 7,
                    {
                        width: column.width - 10,
                        height: rowHeight - 6,
                        ellipsis: true,
                    }
                )

            x += column.width
        })

        y += rowHeight
        doc.y = y
    })

    doc.moveDown(0.8)
}

function addFilterTable(doc, fontPath, data) {
    const filters =
        data.filters

    const rows = [
        {
            label: 'ประเภท Report',
            value: getReportTypeLabel(filters.report_type),
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
    ]

    drawTable(
        doc,
        fontPath,
        [
            {
                header: 'Filter',
                key: 'label',
                width: 160,
            },
            {
                header: 'Value',
                key: 'value',
                width: 350,
            },
        ],
        rows,
        {
            rowHeight: 24,
        }
    )
}

function addSummaryTable(doc, fontPath, data) {
    const project =
        data.summary.project

    const task =
        data.summary.task

    const rows = [
        {
            metric: 'โปรเจกต์ทั้งหมด',
            value: toNumber(project.total_projects),
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
    ]

    drawTable(
        doc,
        fontPath,
        [
            {
                header: 'รายการ',
                key: 'metric',
                width: 360,
            },
            {
                header: 'จำนวน',
                key: 'value',
                width: 150,
            },
        ],
        rows
    )
}

function addCountTable(doc, fontPath, title, rows, labelKey) {
    addSectionTitle(doc, fontPath, title)

    drawTable(
        doc,
        fontPath,
        [
            {
                header: 'รายการ',
                key: 'label',
                width: 360,
                render: (row) =>
                    labelKey === 'priority'
                        ? getPriorityLabel(row[labelKey])
                        : getStatusLabel(row[labelKey]),
            },
            {
                header: 'จำนวน',
                key: 'count',
                width: 150,
                render: (row) =>
                    toNumber(row.count),
            },
        ],
        rows
    )
}

function addTaskTable(doc, fontPath, title, rows) {
    addSectionTitle(doc, fontPath, title)

    drawTable(
        doc,
        fontPath,
        [
            {
                header: 'ID',
                key: 'task_id',
                width: 35,
            },
            {
                header: 'ชื่องาน',
                key: 'task_name',
                width: 120,
            },
            {
                header: 'โปรเจกต์',
                key: 'project_name',
                width: 100,
            },
            {
                header: 'ผู้รับผิดชอบ',
                key: 'assignee_names',
                width: 105,
            },
            {
                header: 'Priority',
                key: 'priority',
                width: 65,
                render: (row) =>
                    getPriorityLabel(row.priority),
            },
            {
                header: 'Status',
                key: 'status',
                width: 65,
                render: (row) =>
                    getStatusLabel(row.status),
            },
            {
                header: 'Due',
                key: 'due_date',
                width: 65,
            },
        ],
        rows.slice(0, 80),
        {
            rowHeight: 30,
        }
    )
}

function addProjectTable(doc, fontPath, rows) {
    addSectionTitle(doc, fontPath, 'ประสิทธิภาพโปรเจกต์')

    drawTable(
        doc,
        fontPath,
        [
            {
                header: 'ID',
                key: 'project_id',
                width: 35,
            },
            {
                header: 'โปรเจกต์',
                key: 'project_name',
                width: 150,
            },
            {
                header: 'Code',
                key: 'project_code',
                width: 70,
            },
            {
                header: 'Status',
                key: 'status',
                width: 80,
                render: (row) =>
                    getStatusLabel(row.status),
            },
            {
                header: 'Tasks',
                key: 'total_tasks',
                width: 55,
                render: (row) =>
                    toNumber(row.total_tasks),
            },
            {
                header: 'Done',
                key: 'done_tasks',
                width: 55,
                render: (row) =>
                    toNumber(row.done_tasks),
            },
            {
                header: 'Late',
                key: 'overdue_tasks',
                width: 55,
                render: (row) =>
                    toNumber(row.overdue_tasks),
            },
            {
                header: '%',
                key: 'progress_percent',
                width: 60,
                render: (row) =>
                    `${toNumber(row.progress_percent)}%`,
            },
        ],
        rows.slice(0, 80),
        {
            rowHeight: 30,
        }
    )
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

        const fontPath =
            findReportFont()

        if (!fontPath) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบไฟล์ฟอนต์สำหรับสร้าง PDF',
                    error_detail:
                        'กรุณาวางไฟล์ Sarabun-Regular.ttf หรือ NotoSansThai-Regular.ttf ไว้ใน public/fonts',
                },
                {
                    status: 500,
                }
            )
        }

        const filters =
            getReportFilters(request)

        const data =
            await getReportExportData(filters)

        const doc =
            new PDFDocument({
                size: 'A4',
                margin: PAGE_MARGIN,
                autoFirstPage: false,
                font: fontPath,
            })

        const bufferPromise =
            createPdfBuffer(doc)

        doc.addPage()
        setupFont(doc, fontPath)

        addTitle(
            doc,
            fontPath,
            getReportTypeLabel(filters.report_type),
            user,
            data
        )

        addSectionTitle(doc, fontPath, 'ตัวกรองรายงาน')
        addFilterTable(doc, fontPath, data)

        if (filters.report_type === 'overview') {
            addSectionTitle(doc, fontPath, 'สรุปภาพรวม')
            addSummaryTable(doc, fontPath, data)

            addCountTable(
                doc,
                fontPath,
                'สถานะโปรเจกต์',
                data.charts.project_status,
                'status'
            )

            addCountTable(
                doc,
                fontPath,
                'สถานะงาน',
                data.charts.task_status,
                'status'
            )

            addCountTable(
                doc,
                fontPath,
                'Priority งาน',
                data.charts.task_priority,
                'priority'
            )

            addProjectTable(
                doc,
                fontPath,
                data.project_performance
            )

            addTaskTable(
                doc,
                fontPath,
                'งานเกินกำหนด',
                data.overdue_tasks
            )
        }

        if (filters.report_type === 'project') {
            addProjectTable(
                doc,
                fontPath,
                data.project_performance
            )

            addCountTable(
                doc,
                fontPath,
                'สถานะโปรเจกต์',
                data.charts.project_status,
                'status'
            )
        }

        if (filters.report_type === 'task') {
            addTaskTable(
                doc,
                fontPath,
                'รายการงาน',
                data.tasks
            )

            addCountTable(
                doc,
                fontPath,
                'สถานะงาน',
                data.charts.task_status,
                'status'
            )

            addCountTable(
                doc,
                fontPath,
                'Priority งาน',
                data.charts.task_priority,
                'priority'
            )
        }

        if (filters.report_type === 'overdue') {
            addTaskTable(
                doc,
                fontPath,
                'งานเกินกำหนด',
                data.overdue_tasks
            )
        }

        doc.end()

        const buffer =
            await bufferPromise

        const fileName =
            `report-${filters.report_type}-${Date.now()}.pdf`

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type':
                    'application/pdf',
                'Content-Disposition':
                    `attachment; filename="${fileName}"`,
                'Cache-Control':
                    'no-store',
            },
        })
    } catch (error) {
        console.error('Export PDF Report Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Export PDF ไม่สำเร็จ',
                error_detail: error.message,
            },
            {
                status: 500,
            }
        )
    }
}