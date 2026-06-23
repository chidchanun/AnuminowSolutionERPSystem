import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requirePermission } from '@/app/lib/permission'
import {
    formatAuditFilterValue,
    formatMetadata,
    getAuditExportData,
    getAuditFilters,
} from '@/app/lib/auditExportData'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function setupSheet(sheet) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.getRow(1).font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
    }
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0F172A' },
    }

    sheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            }
            cell.alignment = {
                vertical: 'top',
                wrapText: true,
            }
        })
    })
}

function addInfoSheet(workbook, data, user) {
    const sheet = workbook.addWorksheet('Export Info')
    const filters = data.filters

    sheet.columns = [
        { header: 'หัวข้อ', key: 'label', width: 28 },
        { header: 'ข้อมูล', key: 'value', width: 60 },
    ]

    sheet.addRows([
        { label: 'ชื่อรายงาน', value: 'Audit Log' },
        { label: 'Export โดย', value: user.id },
        {
            label: 'วันที่ Export',
            value: new Date(data.generated_at).toLocaleString('th-TH'),
        },
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
    ])

    setupSheet(sheet)
}

function addAuditSheet(workbook, rows) {
    const sheet = workbook.addWorksheet('Audit Log')

    sheet.columns = [
        { header: 'Audit ID', key: 'audit_id', width: 12 },
        { header: 'วันที่', key: 'created_at', width: 22 },
        { header: 'Action', key: 'action', width: 28 },
        { header: 'Entity Type', key: 'entity_type', width: 20 },
        { header: 'Entity ID', key: 'entity_id', width: 18 },
        { header: 'Summary', key: 'summary', width: 45 },
        { header: 'Metadata', key: 'metadata', width: 55 },
        { header: 'Actor', key: 'actor_name', width: 30 },
        { header: 'Actor ID', key: 'actor_id', width: 18 },
        { header: 'Actor Email', key: 'actor_email', width: 35 },
    ]

    rows.forEach((row) => {
        sheet.addRow({
            audit_id: row.audit_id,
            created_at: row.created_at
                ? new Date(row.created_at).toLocaleString('th-TH')
                : '-',
            action: row.action,
            entity_type: row.entity_type,
            entity_id: row.entity_id || '-',
            summary: row.summary || '-',
            metadata: formatMetadata(row.metadata),
            actor_name: row.actor_name || '-',
            actor_id: row.actor_id || '-',
            actor_email: row.actor_email || '-',
        })
    })

    setupSheet(sheet)
}

export async function GET(request) {
    try {
        const auth = await requirePermission(request, 'audit.export')

        if (auth.response) return auth.response

        const data = await getAuditExportData({
            filters: getAuditFilters(request),
        })
        const workbook = new ExcelJS.Workbook()

        workbook.creator = 'ERP System'
        workbook.created = new Date()

        addInfoSheet(workbook, data, auth.user)
        addAuditSheet(workbook, data.logs)

        const buffer = await workbook.xlsx.writeBuffer()
        const fileName = `audit-log-${Date.now()}.xlsx`

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type':
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('Export Audit Excel Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'Export Audit Excel ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
