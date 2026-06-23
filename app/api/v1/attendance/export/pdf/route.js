import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import {
    canExportAttendance,
    getAttendanceExportAuthUser,
    getAttendanceExportData,
    getAttendanceExportFilters,
    getAttendanceStatusLabel,
} from '@/app/lib/attendanceExportData'
import { requirePermission } from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_MARGIN = 42

function findReportFont() {
    const candidates = [
        path.join(process.cwd(), 'public', 'fonts', 'Sarabun-Regular.ttf'),
        path.join(process.cwd(), 'public', 'fonts', 'NotoSansThai-Regular.ttf'),
        path.join(process.cwd(), 'public', 'fonts', 'THSarabunNew.ttf'),
        'C:\\Windows\\Fonts\\tahoma.ttf',
        'C:\\Windows\\Fonts\\arial.ttf',
        '/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]

    return candidates.find((fontPath) => fs.existsSync(fontPath))
}

function createPdfBuffer(doc) {
    return new Promise((resolve, reject) => {
        const chunks = []

        doc.on('data', (chunk) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)
    })
}

function setupFont(doc, fontPath) {
    doc.registerFont('reportFont', fontPath)
    doc.font('reportFont')
}

function ensureSpace(doc, fontPath, height = 80) {
    if (doc.y + height > doc.page.height - PAGE_MARGIN) {
        doc.addPage()
        setupFont(doc, fontPath)
    }
}

function textValue(value) {
    if (value === null || value === undefined || value === '') return '-'
    return String(value)
}

function drawTable(doc, fontPath, columns, rows, options = {}) {
    const rowHeight = options.rowHeight || 28
    const headerHeight = options.headerHeight || 28

    const startX = PAGE_MARGIN
    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0)

    ensureSpace(doc, fontPath, headerHeight + rowHeight)

    let y = doc.y

    doc.rect(startX, y, tableWidth, headerHeight).fill('#0f172a')

    let x = startX

    columns.forEach((column) => {
        doc
            .fillColor('#ffffff')
            .fontSize(8)
            .text(column.header, x + 5, y + 8, {
                width: column.width - 10,
                height: headerHeight - 8,
                ellipsis: true,
            })

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
            .text('ไม่มีข้อมูล', startX + 5, y + 8, {
                width: tableWidth - 10,
            })

        doc.y = y + rowHeight + 8
        return
    }

    rows.forEach((row, rowIndex) => {
        if (y + rowHeight > doc.page.height - PAGE_MARGIN) {
            doc.addPage()
            setupFont(doc, fontPath)

            y = doc.y

            doc.rect(startX, y, tableWidth, headerHeight).fill('#0f172a')

            let headerX = startX

            columns.forEach((column) => {
                doc
                    .fillColor('#ffffff')
                    .fontSize(8)
                    .text(column.header, headerX + 5, y + 8, {
                        width: column.width - 10,
                        height: headerHeight - 8,
                        ellipsis: true,
                    })

                headerX += column.width
            })

            y += headerHeight
        }

        const bg = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc'

        doc.rect(startX, y, tableWidth, rowHeight).fill(bg)
        doc.rect(startX, y, tableWidth, rowHeight).strokeColor('#e2e8f0').stroke()

        x = startX

        columns.forEach((column) => {
            const value = column.render ? column.render(row) : row[column.key]

            doc
                .fillColor('#0f172a')
                .fontSize(7.2)
                .text(textValue(value), x + 5, y + 7, {
                    width: column.width - 10,
                    height: rowHeight - 6,
                    ellipsis: true,
                })

            x += column.width
        })

        y += rowHeight
        doc.y = y
    })

    doc.moveDown(0.8)
}

function addTitle(doc, fontPath, data) {
    setupFont(doc, fontPath)

    doc
        .fontSize(20)
        .fillColor('#0f172a')
        .text('Attendance Report', {
            align: 'center',
        })

    doc.moveDown(0.4)

    doc
        .fontSize(10)
        .fillColor('#475569')
        .text(
            `ช่วงวันที่: ${data.filters.from} ถึง ${data.filters.to} | จำนวน: ${data.attendance.length} รายการ`,
            {
                align: 'center',
            }
        )

    doc.moveDown(0.8)
}

function addSummary(doc, fontPath, data) {
    drawTable(
        doc,
        fontPath,
        [
            { header: 'สถานะ', key: 'label', width: 160 },
            { header: 'จำนวน', key: 'value', width: 90 },
        ],
        [
            { label: 'มาทำงาน', value: data.summary.present },
            { label: 'มาสาย', value: data.summary.late },
            { label: 'ขาดงาน', value: data.summary.absent },
            { label: 'ลา', value: data.summary.leave },
        ],
        {
            rowHeight: 24,
        }
    )
}

function addAttendanceTable(doc, fontPath, rows) {
    drawTable(
        doc,
        fontPath,
        [
            {
                header: 'วันที่',
                key: 'work_date',
                width: 62,
                render: (row) =>
                    row.work_date
                        ? new Date(row.work_date).toLocaleDateString('th-TH')
                        : '-',
            },
            {
                header: 'พนักงาน',
                key: 'full_name_th',
                width: 110,
            },
            {
                header: 'แผนก',
                key: 'department_name',
                width: 75,
            },
            {
                header: 'ตำแหน่ง',
                key: 'role_name',
                width: 75,
            },
            {
                header: 'สถานะ',
                key: 'status',
                width: 60,
                render: (row) => getAttendanceStatusLabel(row.status),
            },
            {
                header: 'เข้า',
                key: 'check_in_time',
                width: 42,
            },
            {
                header: 'ออก',
                key: 'check_out_time',
                width: 42,
            },
            {
                header: 'หมายเหตุ',
                key: 'note',
                width: 82,
            },
        ],
        rows.slice(0, 250),
        {
            rowHeight: 30,
        }
    )
}

export async function GET(request) {
    try {


        const auth = await requirePermission(
            request,
            'attendance.export'
        )

        if (auth.response) return auth.response

        const user = auth.user


        const fontPath = findReportFont()

        if (!fontPath) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบไฟล์ฟอนต์สำหรับสร้าง PDF',
                    error_detail:
                        'กรุณาวาง Sarabun-Regular.ttf หรือ NotoSansThai-Regular.ttf ไว้ใน public/fonts',
                },
                { status: 500 }
            )
        }

        const filters = getAttendanceExportFilters(request)
        const data = await getAttendanceExportData(filters)

        const doc = new PDFDocument({
            size: 'A4',
            margin: PAGE_MARGIN,
            autoFirstPage: false,
            font: fontPath,
        })

        const bufferPromise = createPdfBuffer(doc)

        doc.addPage()
        setupFont(doc, fontPath)

        addTitle(doc, fontPath, data)

        doc
            .fontSize(14)
            .fillColor('#0f172a')
            .text('สรุป Attendance')

        doc.moveDown(0.5)
        addSummary(doc, fontPath, data)

        doc
            .fontSize(14)
            .fillColor('#0f172a')
            .text('รายการ Attendance')

        doc.moveDown(0.5)
        addAttendanceTable(doc, fontPath, data.attendance)

        doc.end()

        const buffer = await bufferPromise

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition':
                    `attachment; filename="attendance-${Date.now()}.pdf"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('Export Attendance PDF Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Export Attendance PDF ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}