import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const excelRouteSource = await readFile(
    new URL('../app/api/v1/audit-log/export/excel/route.js', import.meta.url),
    'utf8'
)
const pdfRouteSource = await readFile(
    new URL('../app/api/v1/audit-log/export/pdf/route.js', import.meta.url),
    'utf8'
)

const sampleLogs = [
    {
        audit_id: 1,
        actor_id: 'U001',
        action: 'task.create',
        entity_type: 'task',
        entity_id: 'T001',
        summary: 'Create task',
        metadata: { task_id: 1 },
        created_at: '2026-06-23 10:00:00',
        actor_name: 'Admin User',
        actor_email: 'admin@example.com',
    },
]

const mockState = {
    authUser: null,
    authResponse: null,
    exportFilters: null,
    requirePermissionCalls: [],
    exportDataCalls: [],
}

function resetMockState() {
    mockState.authUser = { id: 'U001', permissions: ['audit.export'] }
    mockState.authResponse = null
    mockState.exportFilters = { action: 'task.create', entity_type: 'task' }
    mockState.requirePermissionCalls = []
    mockState.exportDataCalls = []
}

function createDownloadResponse(body, init = {}) {
    return {
        body,
        status: init.status || 200,
        headers: init.headers || {},
    }
}

async function createMockModule(identifier, exports) {
    const vmModule = new vm.SyntheticModule(
        Object.keys(exports),
        function initialize() {
            for (const [key, value] of Object.entries(exports)) {
                this.setExport(key, value)
            }
        },
        { identifier }
    )

    await vmModule.link(() => {
        throw new Error(`Unexpected nested import in ${identifier}`)
    })
    await vmModule.evaluate()

    return vmModule
}

class MockSheet {
    constructor(name) {
        this.name = name
        this.rows = []
        this.views = []
        this.columns = []
    }

    getRow() {
        return {
            font: null,
            fill: null,
        }
    }

    addRows(rows) {
        this.rows.push(...rows)
    }

    addRow(row) {
        this.rows.push(row)
    }

    eachRow(callback) {
        this.rows.forEach((row) => {
            callback({
                eachCell(cellCallback) {
                    Object.values(row).forEach((value) => {
                        cellCallback({
                            value,
                            border: null,
                            alignment: null,
                        })
                    })
                },
            })
        })
    }
}

class MockWorkbook {
    constructor() {
        this.sheets = []
        this.creator = null
        this.created = null
        this.xlsx = {
            writeBuffer: async () => Buffer.from('xlsx-data'),
        }
    }

    addWorksheet(name) {
        const sheet = new MockSheet(name)
        this.sheets.push(sheet)
        return sheet
    }
}

class MockPDFDocument {
    constructor() {
        this.listeners = {}
        this.y = 42
        this.page = {
            width: 595,
            height: 842,
        }
    }

    on(eventName, callback) {
        this.listeners[eventName] = callback
        return this
    }

    registerFont() {
        return this
    }

    font() {
        return this
    }

    addPage() {
        this.y = 42
        return this
    }

    fontSize() {
        return this
    }

    fillColor() {
        return this
    }

    text() {
        this.y += 14
        return this
    }

    moveDown(amount = 1) {
        this.y += amount * 12
        return this
    }

    moveTo() {
        return this
    }

    lineTo() {
        return this
    }

    strokeColor() {
        return this
    }

    stroke() {
        return this
    }

    rect() {
        return this
    }

    fill() {
        return this
    }

    end() {
        this.listeners.data?.(Buffer.from('pdf-data'))
        this.listeners.end?.()
    }
}

async function loadRouteModule(source, identifier) {
    const moduleCache = new Map()

    async function linker(specifier) {
        if (moduleCache.has(specifier)) {
            return moduleCache.get(specifier)
        }

        let vmModule

        if (specifier === 'next/server') {
            vmModule = await createMockModule(specifier, {
                NextResponse: Object.assign(createDownloadResponse, {
                    json(body, init = {}) {
                        return {
                            body,
                            status: init.status || 200,
                        }
                    },
                }),
            })
        } else if (specifier === '@/app/lib/permission') {
            vmModule = await createMockModule(specifier, {
                async requirePermission(_request, permissionKey) {
                    mockState.requirePermissionCalls.push(permissionKey)

                    return {
                        user: mockState.authUser,
                        response: mockState.authResponse,
                    }
                },
            })
        } else if (specifier === '@/app/lib/auditExportData') {
            vmModule = await createMockModule(specifier, {
                formatAuditFilterValue(value) {
                    return value || '-'
                },
                formatMetadata(value) {
                    return JSON.stringify(value || {})
                },
                getAuditFilters() {
                    return mockState.exportFilters
                },
                async getAuditExportData(payload) {
                    mockState.exportDataCalls.push(payload)

                    return {
                        generated_at: '2026-06-23T10:00:00.000Z',
                        filters: payload.filters,
                        logs: sampleLogs,
                    }
                },
            })
        } else if (specifier === 'exceljs') {
            vmModule = await createMockModule(specifier, {
                default: {
                    Workbook: MockWorkbook,
                },
            })
        } else if (specifier === 'pdfkit') {
            vmModule = await createMockModule(specifier, {
                default: MockPDFDocument,
            })
        } else if (specifier === 'fs') {
            vmModule = await createMockModule(specifier, {
                default: {
                    existsSync: () => true,
                },
            })
        } else if (specifier === 'path') {
            vmModule = await createMockModule(specifier, {
                default: {
                    join: (...parts) => parts.join('/'),
                },
            })
        } else {
            throw new Error(`Unexpected import: ${specifier}`)
        }

        moduleCache.set(specifier, vmModule)
        return vmModule
    }

    const vmModule = new vm.SourceTextModule(source, { identifier })

    await vmModule.link(linker)
    await vmModule.evaluate()

    return vmModule.namespace
}

const excelRoute = await loadRouteModule(
    excelRouteSource,
    'app/api/v1/audit-log/export/excel/route.js'
)
const pdfRoute = await loadRouteModule(
    pdfRouteSource,
    'app/api/v1/audit-log/export/pdf/route.js'
)

test('GET /api/v1/audit-log/export/excel requires audit.export', async () => {
    resetMockState()
    mockState.authResponse = {
        body: {
            success: false,
        },
        status: 403,
    }

    const response = await excelRoute.GET({
        url: 'http://localhost/api/v1/audit-log/export/excel',
    })

    assert.equal(response.status, 403)
    assert.deepEqual(mockState.requirePermissionCalls, ['audit.export'])
    assert.equal(mockState.exportDataCalls.length, 0)
})

test('GET /api/v1/audit-log/export/excel returns workbook download', async () => {
    resetMockState()

    const response = await excelRoute.GET({
        url: 'http://localhost/api/v1/audit-log/export/excel?action=task.create',
    })

    assert.equal(response.status, 200)
    assert.equal(
        response.headers['Content-Type'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    assert.match(
        response.headers['Content-Disposition'],
        /^attachment; filename="audit-log-\d+\.xlsx"$/
    )
    assert.deepEqual(mockState.requirePermissionCalls, ['audit.export'])
    assert.deepEqual(mockState.exportDataCalls, [
        {
            filters: mockState.exportFilters,
        },
    ])
    assert.equal(Buffer.isBuffer(response.body), true)
})

test('GET /api/v1/audit-log/export/pdf returns pdf download', async () => {
    resetMockState()

    const response = await pdfRoute.GET({
        url: 'http://localhost/api/v1/audit-log/export/pdf?action=task.create',
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers['Content-Type'], 'application/pdf')
    assert.match(
        response.headers['Content-Disposition'],
        /^attachment; filename="audit-log-\d+\.pdf"$/
    )
    assert.deepEqual(mockState.requirePermissionCalls, ['audit.export'])
    assert.deepEqual(mockState.exportDataCalls, [
        {
            filters: mockState.exportFilters,
        },
    ])
    assert.equal(Buffer.isBuffer(response.body), true)
})
