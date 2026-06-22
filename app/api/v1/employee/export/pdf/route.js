import { NextResponse } from 'next/server'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import {
    canExportEmployee,
    getEmployeeExportAuthUser,
    getEmployeeExportData,
    getEmployeeExportFilters,
    getEmployeeStatusLabel,
} from '@/app/lib/employeeExportData'

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

function ensureSpace(doc, fontPath, height = 70) {
    if (doc.y + height > doc.page.height - PAGE_MARGIN) {
        doc.addPage()
        setupFont(doc, fontPath)
    }
}

function drawRow(doc, fontPath, row, index) {
    ensureSpace(doc, fontPath, 74)

    const y = doc.y
    const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc'

    doc
        .rect(PAGE_MARGIN, y, doc.page.width - PAGE_MARGIN * 2, 64)
        .fill(bg)
        .strokeColor('#e2e8f0')
        .stroke()

    doc
        .fillColor('#0f172a')
        .fontSize(10)
        .text(
            `${row.id} · ${row.prefix || ''}${row.first_name_th || ''} ${row.last_name_th || ''}`,
            PAGE_MARGIN + 10,
            y + 8,
            {
                width: 260,
                ellipsis: true,
            }
        )

    doc
        .fillColor('#475569')
        .fontSize(8)
        .text(
            `${row.email || '-'} | ${row.department_name || '-'} | ${row.role_name || '-'}`,
            PAGE_MARGIN + 10,
            y + 28,
            {
                width: 360,
                ellipsis: true,
            }
        )

    doc
        .fillColor('#0f172a')
        .fontSize(8)
        .text(
            getEmployeeStatusLabel(row.status),
            PAGE_MARGIN + 410,
            y + 20,
            {
                width: 90,
                align: 'right',
            }
        )

    doc.y = y + 72
}

export async function GET(request) {
    try {
        const user = await getEmployeeExportAuthUser(request)

        if (!user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            )
        }

        if (!canExportEmployee(user)) {
            return NextResponse.json(
                { success: false, message: 'ไม่มีสิทธิ์ Export Employee' },
                { status: 403 }
            )
        }

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

        const filters = getEmployeeExportFilters(request)
        const data = await getEmployeeExportData(filters)

        const doc = new PDFDocument({
            size: 'A4',
            margin: PAGE_MARGIN,
            autoFirstPage: false,
            font: fontPath,
        })

        const bufferPromise = createPdfBuffer(doc)

        doc.addPage()
        setupFont(doc, fontPath)

        doc
            .fontSize(20)
            .fillColor('#0f172a')
            .text('Employee Report', {
                align: 'center',
            })

        doc.moveDown(0.4)

        doc
            .fontSize(10)
            .fillColor('#475569')
            .text(
                `Generated: ${new Date(data.generated_at).toLocaleString('th-TH')} | Total: ${data.employees.length}`,
                {
                    align: 'center',
                }
            )

        doc.moveDown(1)

        data.employees.slice(0, 250).forEach((employee, index) => {
            drawRow(doc, fontPath, employee, index)
        })

        doc.end()

        const buffer = await bufferPromise

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition':
                    `attachment; filename="employees-${Date.now()}.pdf"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('Export Employee PDF error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Export Employee PDF ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}