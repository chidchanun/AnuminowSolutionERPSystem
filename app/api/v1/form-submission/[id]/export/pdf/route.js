import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { requirePermission } from '@/app/lib/permission'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_MARGIN = 42
const FIELD_GAP = 12

function safeJson(value, fallback = {}) {
    if (!value) return fallback
    if (typeof value === 'object') return value

    try {
        return JSON.parse(value)
    } catch {
        return fallback
    }
}

function splitFieldsByPage(fields = []) {
    const pages = [[]]

    fields.forEach((field) => {
        if (field.type === 'page_break') {
            pages.push([])
            return
        }

        pages[pages.length - 1].push(field)
    })

    return pages
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

function sanitizeFilename(value) {
    return String(value || 'form-submission')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '-')
}

function getFieldValue(data, field) {
    const value = data?.[field.id]

    if (value === undefined || value === null || value === '') {
        return '-'
    }

    if (Array.isArray(value)) {
        return value.length ? value.join(', ') : '-'
    }

    return String(value)
}

function formatDateTime(value) {
    if (!value) return '-'

    try {
        return new Date(value).toLocaleString('th-TH', {
            dateStyle: 'medium',
            timeStyle: 'short',
        })
    } catch {
        return String(value)
    }
}

function measureFieldHeight(field) {
    const options = Array.isArray(field.options) ? field.options : []

    switch (field.type) {
        case 'textarea':
            return 96
        case 'radio':
        case 'checkbox':
            return Math.max(58, 30 + options.length * 18)
        case 'signature':
            return 82
        default:
            return 58
    }
}

function ensureSpace(doc, fontPath, y, requiredHeight) {
    const maxY = doc.page.height - PAGE_MARGIN

    if (y + requiredHeight <= maxY) {
        return y
    }

    doc.addPage()
    setupFont(doc, fontPath)

    return PAGE_MARGIN
}

function drawHeader(doc, submission) {
    doc
        .fontSize(20)
        .fillColor('#0f172a')
        .text(submission.form_name || 'แบบฟอร์ม', PAGE_MARGIN, PAGE_MARGIN, {
            align: 'center',
        })

    doc.moveDown(0.4)

    doc
        .fontSize(9)
        .fillColor('#475569')
        .text(`เลขที่เอกสาร: ${submission.submission_no}`, {
            align: 'center',
        })

    doc
        .fontSize(9)
        .fillColor('#475569')
        .text(`ผู้ส่ง: ${submission.submitted_by_name || submission.submitted_by} | วันที่ส่ง: ${formatDateTime(submission.submitted_at)}`, {
            align: 'center',
        })

    return doc.y + 18
}

function drawBox(doc, x, y, width, height, color = '#cbd5e1') {
    doc
        .roundedRect(x, y, width, height, 6)
        .strokeColor(color)
        .lineWidth(0.7)
        .stroke()
}

function drawCheckMark(doc, x, y) {
    doc
        .fontSize(9)
        .fillColor('#0f172a')
        .text('✓', x + 2, y - 2, {
            width: 12,
            height: 12,
        })
}

function drawField(doc, field, data, x, y, width, height) {
    const label = `${field.label || 'Field'}${field.required ? ' *' : ''}`
    const value = getFieldValue(data, field)
    const options = Array.isArray(field.options) ? field.options : []

    doc
        .fontSize(9.5)
        .fillColor('#0f172a')
        .text(label, x, y, {
            width,
            height: 16,
            ellipsis: true,
        })

    const contentY = y + 20

    if (['text', 'date', 'select'].includes(field.type)) {
        doc
            .moveTo(x, contentY + 22)
            .lineTo(x + width, contentY + 22)
            .strokeColor('#94a3b8')
            .lineWidth(0.7)
            .stroke()

        doc
            .fontSize(9)
            .fillColor('#111827')
            .text(value, x + 2, contentY + 5, {
                width: width - 4,
                height: 20,
                ellipsis: true,
            })

        return
    }

    if (field.type === 'textarea') {
        drawBox(doc, x, contentY, width, height - 24)

        doc
            .fontSize(8.5)
            .fillColor('#111827')
            .text(value, x + 8, contentY + 8, {
                width: width - 16,
                height: height - 38,
                ellipsis: true,
            })

        return
    }

    if (field.type === 'radio') {
        options.forEach((option, index) => {
            const optionY = contentY + index * 18
            const checked = value === option

            doc
                .circle(x + 6, optionY + 6, 5)
                .strokeColor('#64748b')
                .lineWidth(0.7)
                .stroke()

            if (checked) {
                doc
                    .circle(x + 6, optionY + 6, 2.5)
                    .fillColor('#0f172a')
                    .fill()
            }

            doc
                .fontSize(8.5)
                .fillColor('#111827')
                .text(option, x + 18, optionY, {
                    width: width - 20,
                    height: 16,
                    ellipsis: true,
                })
        })

        return
    }

    if (field.type === 'checkbox') {
        const currentValue = Array.isArray(data?.[field.id])
            ? data[field.id]
            : []

        options.forEach((option, index) => {
            const optionY = contentY + index * 18
            const checked = currentValue.includes(option)

            doc
                .rect(x, optionY + 1, 11, 11)
                .strokeColor('#64748b')
                .lineWidth(0.7)
                .stroke()

            if (checked) {
                drawCheckMark(doc, x, optionY + 1)
            }

            doc
                .fontSize(8.5)
                .fillColor('#111827')
                .text(option, x + 18, optionY, {
                    width: width - 20,
                    height: 16,
                    ellipsis: true,
                })
        })

        return
    }

    if (field.type === 'signature') {
        doc
            .fontSize(10)
            .fillColor('#111827')
            .text(value === '-' ? '' : value, x, contentY + 22, {
                width,
                align: 'center',
            })

        doc
            .moveTo(x + 20, contentY + 48)
            .lineTo(x + width - 20, contentY + 48)
            .strokeColor('#64748b')
            .lineWidth(0.7)
            .stroke()

        doc
            .fontSize(8)
            .fillColor('#64748b')
            .text('ลงชื่อ / Signature', x, contentY + 54, {
                width,
                align: 'center',
            })
    }
}

function drawFields(doc, fontPath, fields, data, startY) {
    const pageWidth = doc.page.width
    const contentWidth = pageWidth - PAGE_MARGIN * 2
    const halfWidth = (contentWidth - FIELD_GAP) / 2

    let y = startY
    let halfRow = []

    const flushHalfRow = () => {
        if (halfRow.length === 0) return

        const rowHeight = Math.max(
            ...halfRow.map((item) => measureFieldHeight(item.field))
        )

        y = ensureSpace(doc, fontPath, y, rowHeight + 8)

        halfRow.forEach((item, index) => {
            const x = PAGE_MARGIN + index * (halfWidth + FIELD_GAP)

            drawField(
                doc,
                item.field,
                data,
                x,
                y,
                halfWidth,
                rowHeight
            )
        })

        y += rowHeight + FIELD_GAP
        halfRow = []
    }

    fields.forEach((field) => {
        const isHalf = field.width === 'half'

        if (!isHalf) {
            flushHalfRow()

            const fieldHeight = measureFieldHeight(field)
            y = ensureSpace(doc, fontPath, y, fieldHeight + 8)

            drawField(
                doc,
                field,
                data,
                PAGE_MARGIN,
                y,
                contentWidth,
                fieldHeight
            )

            y += fieldHeight + FIELD_GAP
            return
        }

        halfRow.push({ field })

        if (halfRow.length === 2) {
            flushHalfRow()
        }
    })

    flushHalfRow()

    return y
}

async function getSubmission(submissionId) {
    const [rows] = await db.execute(
        `
        SELECT
            fs.form_submission_id,
            fs.form_template_id,
            fs.submission_no,
            fs.data_json,
            fs.status,
            fs.submitted_by,
            fs.submitted_at,

            ft.form_name,
            ft.form_code,
            ft.description,
            ft.layout_json,

            CONCAT(u.first_name_th, ' ', u.last_name_th) AS submitted_by_name
        FROM form_submission fs
        INNER JOIN form_template ft
            ON ft.form_template_id = fs.form_template_id
        INNER JOIN \`user\` u
            ON u.id = fs.submitted_by
        WHERE fs.form_submission_id = ?
        AND fs.deleted_at IS NULL
        LIMIT 1
        `,
        [submissionId]
    )

    return rows[0] || null
}

export async function GET(request, context) {
    try {
        const auth = await requirePermission(request, 'form.export')
        if (auth.response) return auth.response

        const { id } = await context.params
        const submissionId = Number(id)

        if (!submissionId) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'form_submission_id ไม่ถูกต้อง',
                },
                { status: 400 }
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

        const submission = await getSubmission(submissionId)

        if (!submission) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบเอกสาร',
                },
                { status: 404 }
            )
        }

        const layout = safeJson(submission.layout_json, {})
        const dataJson = safeJson(submission.data_json, {})
        const fields = Array.isArray(layout.fields) ? layout.fields : []

        const doc = new PDFDocument({
            size: 'A4',
            margin: PAGE_MARGIN,
            autoFirstPage: false,
            font: fontPath,
        })

        const bufferPromise = createPdfBuffer(doc)

        const pages = splitFieldsByPage(fields)

        pages.forEach((pageFields, pageIndex) => {
            doc.addPage()
            setupFont(doc, fontPath)

            const startY = drawHeader(doc, {
                ...submission,
                submission_no: `${submission.submission_no} | หน้า ${pageIndex + 1}`,
            })

            drawFields(
                doc,
                fontPath,
                pageFields,
                dataJson,
                startY
            )
        })

        doc.end()

        const buffer = await bufferPromise
        const filename = `${sanitizeFilename(submission.submission_no)}.pdf`

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('Form PDF Export Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Export PDF ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}