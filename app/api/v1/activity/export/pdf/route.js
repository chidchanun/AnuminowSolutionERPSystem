import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import {
    canExportActivity,
    formatFilterValue,
    getActionLabel,
    getActivityAuthUser,
    getActivityExportData,
    getActivityFilters,
} from '@/app/lib/activityExportData'

import { requirePermission } from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_MARGIN = 42

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

function addTitle(doc, fontPath, user, data) {
    setupFont(doc, fontPath)

    doc
        .fontSize(20)
        .fillColor('#0f172a')
        .text('Activity Log', {
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
        options.rowHeight || 28

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

    let y = doc.y

    doc
        .rect(startX, y, tableWidth, headerHeight)
        .fill('#0f172a')

    let x = startX

    columns.forEach((column) => {
        doc
            .fillColor('#ffffff')
            .fontSize(8.5)
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
        if (
            y + rowHeight >
            doc.page.height - PAGE_MARGIN
        ) {
            doc.addPage()
            setupFont(doc, fontPath)

            y = doc.y

            doc
                .rect(startX, y, tableWidth, headerHeight)
                .fill('#0f172a')

            let headerX = startX

            columns.forEach((column) => {
                doc
                    .fillColor('#ffffff')
                    .fontSize(8.5)
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
            const value =
                column.render
                    ? column.render(row)
                    : row[column.key]

            doc
                .fillColor('#0f172a')
                .fontSize(7.8)
                .text(
                    textValue(value),
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

function addActivityTable(doc, fontPath, rows) {
    drawTable(
        doc,
        fontPath,
        [
            {
                header: 'วันที่',
                key: 'created_at',
                width: 80,
                render: (row) =>
                    row.created_at
                        ? new Date(row.created_at).toLocaleString('th-TH')
                        : '-',
            },
            {
                header: 'Action',
                key: 'action_type',
                width: 62,
                render: (row) =>
                    getActionLabel(row.action_type),
            },
            {
                header: 'รายละเอียด',
                key: 'description',
                width: 140,
            },
            {
                header: 'Task',
                key: 'task_name',
                width: 95,
                render: (row) =>
                    `#${row.task_id} ${row.task_name || '-'}`,
            },
            {
                header: 'Project',
                key: 'project_name',
                width: 95,
            },
            {
                header: 'ผู้กระทำ',
                key: 'action_by_name',
                width: 78,
            },
        ],
        rows.slice(0, 120),
        {
            rowHeight: 34,
        }
    )
}

export async function GET(request) {
    try {
        const auth = await requirePermission(
            request,
            'activity.export'
        )

        if (auth.response) return auth.response

        const user = auth.user
        
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
                { status: 500 }
            )
        }

        const filters =
            getActivityFilters(request)

        const data =
            await getActivityExportData({
                user,
                filters,
            })

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

        addTitle(doc, fontPath, user, data)

        addSectionTitle(doc, fontPath, 'ตัวกรอง')
        addFilterTable(doc, fontPath, data)

        addSectionTitle(doc, fontPath, 'รายการ Activity')
        addActivityTable(doc, fontPath, data.activities)

        doc.end()

        const buffer =
            await bufferPromise

        const fileName =
            `activity-log-${Date.now()}.pdf`

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
        console.error('Export Activity PDF Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Export Activity PDF ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}