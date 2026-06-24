import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { requirePermission } from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'
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

function normalizeTextAlign(value) {
    return ['left', 'center', 'right'].includes(value)
        ? value
        : 'left'
}

function getIndentLevel(value) {
    const parsed = Number(value)

    if (!Number.isFinite(parsed)) {
        return 0
    }

    return Math.min(Math.max(Math.trunc(parsed), 0), 6)
}

function getBoundedNumber(value, fallback, min, max) {
    const parsed = Number(value)

    if (!Number.isFinite(parsed)) {
        return fallback
    }

    return Math.min(Math.max(Math.trunc(parsed), min), max)
}

function getRequiredColumns(field) {
    return Array.isArray(field?.requiredColumns)
        ? field.requiredColumns.filter(Boolean)
        : []
}

function getStaticTextFontSize(field) {
    return getBoundedNumber(field?.fontSize, 14, 8, 36)
}

function getStaticTextSpacing(field, key) {
    return getBoundedNumber(field?.[key], 0, 0, 80)
}

function getPdfTextBox(field, x, width) {
    const indent = getIndentLevel(field?.indentLevel) * 14
    const safeIndent = Math.min(indent, Math.max(width - 48, 0))

    return {
        x: x + safeIndent,
        width: width - safeIndent,
        align: normalizeTextAlign(field?.textAlign),
    }
}

function measureFieldHeight(field) {
    const options = Array.isArray(field.options) ? field.options : []

    switch (field.type) {
        case 'static_text':
            return Math.max(
                36,
                getStaticTextSpacing(field, 'spaceBefore') +
                    getStaticTextSpacing(field, 'spaceAfter') +
                    getStaticTextFontSize(field) * 3
            )
        case 'table':
            return Math.max(78, 34 + (Number(field.rows) || 3) * 22)
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
    const columns = Array.isArray(field.columns) && field.columns.length
        ? field.columns
        : ['รายการ']
    const requiredColumns = getRequiredColumns(field)
    const textBox = getPdfTextBox(field, x, width)
    const isStaticText = field.type === 'static_text'

    if (!isStaticText) {
        doc
            .fontSize(9.5)
            .fillColor('#0f172a')
            .text(label, textBox.x, y, {
                width: textBox.width,
                height: 16,
                align: textBox.align,
                ellipsis: true,
            })
    }

    const contentY = isStaticText ? y : y + 20

    if (isStaticText) {
        const staticText = field.content || field.label || '-'
        const staticY = contentY + getStaticTextSpacing(field, 'spaceBefore')
        const textOptions = {
            width: textBox.width,
            height:
                height -
                getStaticTextSpacing(field, 'spaceBefore') -
                getStaticTextSpacing(field, 'spaceAfter'),
            align: textBox.align,
            underline: Boolean(field.underline),
            ellipsis: true,
        }

        doc
            .fontSize(getStaticTextFontSize(field))
            .fillColor('#111827')
            .text(staticText, textBox.x, staticY, textOptions)

        if (field.bold) {
            doc.text(staticText, textBox.x + 0.25, staticY, textOptions)
        }

        return
    }

    if (['text', 'date', 'select'].includes(field.type)) {
        doc
            .moveTo(textBox.x, contentY + 22)
            .lineTo(textBox.x + textBox.width, contentY + 22)
            .strokeColor('#94a3b8')
            .lineWidth(0.7)
            .stroke()

        doc
            .fontSize(9)
            .fillColor('#111827')
            .text(value, textBox.x + 2, contentY + 5, {
                width: textBox.width - 4,
                height: 20,
                align: textBox.align,
                ellipsis: true,
            })

        return
    }

    if (field.type === 'textarea') {
        drawBox(doc, textBox.x, contentY, textBox.width, height - 24)

        doc
            .fontSize(8.5)
            .fillColor('#111827')
            .text(value, textBox.x + 8, contentY + 8, {
                width: textBox.width - 16,
                height: height - 38,
                align: textBox.align,
                ellipsis: true,
            })

        return
    }

    if (field.type === 'table') {
        const rowCount = Number(field.rows) || 3
        const tableRows = Array.isArray(data?.[field.id])
            ? data[field.id]
            : []
        const headerHeight = 18
        const rowHeight = 22
        const tableHeight = headerHeight + rowCount * rowHeight
        const columnWidth = textBox.width / columns.length

        drawBox(doc, textBox.x, contentY, textBox.width, tableHeight)

        columns.forEach((column, index) => {
            const colX = textBox.x + index * columnWidth
            const headerLabel = requiredColumns.includes(column)
                ? `${column} *`
                : column

            doc
                .rect(colX, contentY, columnWidth, headerHeight)
                .fillAndStroke('#f1f5f9', '#cbd5e1')

            doc
                .fontSize(7.5)
                .fillColor('#0f172a')
                .text(headerLabel, colX + 3, contentY + 4, {
                    width: columnWidth - 6,
                    height: headerHeight - 4,
                    align: textBox.align,
                    ellipsis: true,
                })
        })

        Array.from({ length: rowCount }).forEach((_, rowIndex) => {
            const rowY = contentY + headerHeight + rowIndex * rowHeight

            columns.forEach((column, colIndex) => {
                const colX = textBox.x + colIndex * columnWidth
                const cellValue = tableRows[rowIndex]?.[column] || ''

                doc
                    .rect(colX, rowY, columnWidth, rowHeight)
                    .strokeColor('#cbd5e1')
                    .lineWidth(0.5)
                    .stroke()

                doc
                    .fontSize(7.5)
                    .fillColor('#111827')
                    .text(cellValue || '-', colX + 3, rowY + 5, {
                        width: columnWidth - 6,
                        height: rowHeight - 6,
                        align: textBox.align,
                        ellipsis: true,
                    })
            })
        })

        return
    }

    if (field.type === 'radio') {
        options.forEach((option, index) => {
            const optionY = contentY + index * 18
            const checked = value === option
            const markerX =
                textBox.align === 'right'
                    ? textBox.x + textBox.width - 12
                    : textBox.x
            const textX =
                textBox.align === 'right'
                    ? textBox.x
                    : textBox.x + 18
            const textWidth =
                textBox.align === 'right'
                    ? textBox.width - 18
                    : textBox.width - 20

            doc
                .circle(markerX + 6, optionY + 6, 5)
                .strokeColor('#64748b')
                .lineWidth(0.7)
                .stroke()

            if (checked) {
                doc
                    .circle(markerX + 6, optionY + 6, 2.5)
                    .fillColor('#0f172a')
                    .fill()
            }

            doc
                .fontSize(8.5)
                .fillColor('#111827')
                .text(option, textX, optionY, {
                    width: textWidth,
                    height: 16,
                    align: textBox.align,
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
            const markerX =
                textBox.align === 'right'
                    ? textBox.x + textBox.width - 11
                    : textBox.x
            const textX =
                textBox.align === 'right'
                    ? textBox.x
                    : textBox.x + 18
            const textWidth =
                textBox.align === 'right'
                    ? textBox.width - 18
                    : textBox.width - 20

            doc
                .rect(markerX, optionY + 1, 11, 11)
                .strokeColor('#64748b')
                .lineWidth(0.7)
                .stroke()

            if (checked) {
                drawCheckMark(doc, markerX, optionY + 1)
            }

            doc
                .fontSize(8.5)
                .fillColor('#111827')
                .text(option, textX, optionY, {
                    width: textWidth,
                    height: 16,
                    align: textBox.align,
                    ellipsis: true,
                })
        })

        return
    }

    if (field.type === 'signature') {
        doc
            .fontSize(10)
            .fillColor('#111827')
            .text(value === '-' ? '' : value, textBox.x, contentY + 22, {
                width: textBox.width,
                align: textBox.align,
            })

        doc
            .moveTo(textBox.x + 20, contentY + 48)
            .lineTo(textBox.x + textBox.width - 20, contentY + 48)
            .strokeColor('#64748b')
            .lineWidth(0.7)
            .stroke()

        doc
            .fontSize(8)
            .fillColor('#64748b')
            .text('ลงชื่อ / Signature', textBox.x, contentY + 54, {
                width: textBox.width,
                align: textBox.align,
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
            fs.template_version,
            fs.status,
            fs.submitted_by,
            fs.submitted_at,
            fs.decided_by,
            fs.decided_at,
            fs.decision_comment,

            COALESCE(fs.form_name_snapshot, ft.form_name) AS form_name,
            COALESCE(fs.form_code_snapshot, ft.form_code) AS form_code,
            COALESCE(fs.description_snapshot, ft.description) AS description,
            COALESCE(fs.layout_snapshot_json, ft.layout_json) AS layout_json,

            CONCAT(u.first_name_th, ' ', u.last_name_th) AS submitted_by_name,
            CONCAT(du.first_name_th, ' ', du.last_name_th) AS decided_by_name
        FROM form_submission fs
        INNER JOIN form_template ft
            ON ft.form_template_id = fs.form_template_id
        INNER JOIN \`user\` u
            ON u.id = fs.submitted_by
        LEFT JOIN \`user\` du
            ON du.id = fs.decided_by
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

        const user = auth.user
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

        await writeAuditLog({
            actorId: user.id,
            action: 'form_submission.export_pdf',
            entityType: 'form_submission',
            entityId: submissionId,
            summary: `Export form submission ${submission.submission_no}`,
            metadata: {
                form_submission_id: submissionId,
                form_template_id: submission.form_template_id,
                submission_no: submission.submission_no,
                form_name: submission.form_name,
            },
        })

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
