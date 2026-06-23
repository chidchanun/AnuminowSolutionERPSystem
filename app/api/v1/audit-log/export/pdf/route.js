import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { requirePermission } from '@/app/lib/permission'
import {
    formatAuditFilterValue,
    getAuditExportData,
    getAuditFilters,
} from '@/app/lib/auditExportData'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_MARGIN = 42

function createPdfBuffer(doc) {
    return new Promise((resolve, reject) => {
        const chunks = []

        doc.on('data', (chunk) => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)
    })
}

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
    if (value === null || value === undefined || value === '') {
        return '-'
    }

    return String(value)
}

function addTitle(doc, fontPath, user, data) {
    setupFont(doc, fontPath)
    doc
        .fontSize(20)
        .fillColor('#0f172a')
        .text('Audit Log', { align: 'center' })
    doc.moveDown(0.4)
    doc
        .fontSize(10)
        .fillColor('#475569')
        .text(
            `Export โดย: ${user.id} | วันที่: ${new Date(data.generated_at).toLocaleString('th-TH')}`,
            { align: 'center' }
        )
    doc.moveDown(0.8)
}

function addSectionTitle(doc, fontPath, text) {
    ensureSpace(doc, fontPath, 50)
    doc.moveDown(0.5).fontSize(14).fillColor('#0f172a').text(text)
    doc
        .moveTo(PAGE_MARGIN, doc.y + 4)
        .lineTo(doc.page.width - PAGE_MARGIN, doc.y + 4)
        .strokeColor('#cbd5e1')
        .stroke()
    doc.moveDown(0.8)
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
            .fontSize(8.5)
            .text(column.header, x + 5, y + 8, {
                width: column.width - 10,
                height: headerHeight - 8,
                ellipsis: true,
            })
        x += column.width
    })

    y += headerHeight

    if (!rows.length) {
        doc.rect(startX, y, tableWidth, rowHeight).fill('#f8fafc')
        doc.fillColor('#64748b').fontSize(9).text('ไม่มีข้อมูล', startX + 5, y + 8)
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
                    .fontSize(8.5)
                    .text(column.header, headerX + 5, y + 8, {
                        width: column.width - 10,
                        height: headerHeight - 8,
                        ellipsis: true,
                    })
                headerX += column.width
            })

            y += headerHeight
        }

        doc.rect(startX, y, tableWidth, rowHeight).fill(
            rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc'
        )

        x = startX

        columns.forEach((column) => {
            const value = column.render
                ? column.render(row)
                : row[column.key]

            doc
                .fillColor('#0f172a')
                .fontSize(7.8)
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

function addFilterTable(doc, fontPath, data) {
    const filters = data.filters

    drawTable(
        doc,
        fontPath,
        [
            { header: 'Filter', key: 'label', width: 160 },
            { header: 'Value', key: 'value', width: 350 },
        ],
        [
            { label: 'Search', value: formatAuditFilterValue(filters.search) },
            { label: 'Actor ID', value: formatAuditFilterValue(filters.actor_id) },
            { label: 'Action', value: formatAuditFilterValue(filters.action) },
            {
                label: 'Entity Type',
                value: formatAuditFilterValue(filters.entity_type),
            },
            { label: 'Entity ID', value: formatAuditFilterValue(filters.entity_id) },
            { label: 'From', value: formatAuditFilterValue(filters.from) },
            { label: 'To', value: formatAuditFilterValue(filters.to) },
            { label: 'จำนวนรายการ', value: data.logs.length },
        ],
        { rowHeight: 24 }
    )
}

function addAuditTable(doc, fontPath, rows) {
    drawTable(
        doc,
        fontPath,
        [
            {
                header: 'วันที่',
                key: 'created_at',
                width: 82,
                render: (row) =>
                    row.created_at
                        ? new Date(row.created_at).toLocaleString('th-TH')
                        : '-',
            },
            { header: 'Action', key: 'action', width: 90 },
            { header: 'Entity', key: 'entity_type', width: 78 },
            { header: 'Summary', key: 'summary', width: 145 },
            {
                header: 'Actor',
                key: 'actor_name',
                width: 115,
                render: (row) => row.actor_name || row.actor_id || '-',
            },
        ],
        rows.slice(0, 150),
        { rowHeight: 34 }
    )
}

export async function GET(request) {
    try {
        const auth = await requirePermission(request, 'audit.export')

        if (auth.response) return auth.response

        const fontPath = findReportFont()

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

        const data = await getAuditExportData({
            filters: getAuditFilters(request),
        })
        const doc = new PDFDocument({
            size: 'A4',
            margin: PAGE_MARGIN,
            autoFirstPage: false,
            font: fontPath,
        })
        const bufferPromise = createPdfBuffer(doc)

        doc.addPage()
        setupFont(doc, fontPath)
        addTitle(doc, fontPath, auth.user, data)
        addSectionTitle(doc, fontPath, 'ตัวกรอง')
        addFilterTable(doc, fontPath, data)
        addSectionTitle(doc, fontPath, 'รายการ Audit Log')
        addAuditTable(doc, fontPath, data.logs)
        doc.end()

        const buffer = await bufferPromise
        const fileName = `audit-log-${Date.now()}.pdf`

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('Export Audit PDF Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Export Audit PDF ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
