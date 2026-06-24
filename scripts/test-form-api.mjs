import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const formTemplateRouteSource = await readFile(
    new URL('../app/api/v1/form-template/route.js', import.meta.url),
    'utf8'
)
const formTemplateDetailRouteSource = await readFile(
    new URL('../app/api/v1/form-template/[id]/route.js', import.meta.url),
    'utf8'
)
const formSubmitRouteSource = await readFile(
    new URL('../app/api/v1/form-template/[id]/submit/route.js', import.meta.url),
    'utf8'
)
const formSubmissionRouteSource = await readFile(
    new URL('../app/api/v1/form-submission/route.js', import.meta.url),
    'utf8'
)
const formSubmissionDetailRouteSource = await readFile(
    new URL('../app/api/v1/form-submission/[id]/route.js', import.meta.url),
    'utf8'
)
const formSubmissionSummaryRouteSource = await readFile(
    new URL('../app/api/v1/form-submission/summary/route.js', import.meta.url),
    'utf8'
)

const mockState = {
    authUser: null,
    authResponse: null,
    requirePermissionCalls: [],
    executeQueue: [],
    executeCalls: [],
    auditLogCalls: [],
}

function resetMockState() {
    mockState.authUser = { id: 'U001', permissions: [] }
    mockState.authResponse = null
    mockState.requirePermissionCalls = []
    mockState.executeQueue = []
    mockState.executeCalls = []
    mockState.auditLogCalls = []
}

const mockDb = {
    async execute(sql, params = []) {
        mockState.executeCalls.push({ sql, params })

        if (mockState.executeQueue.length > 0) {
            return mockState.executeQueue.shift()
        }

        return [[]]
    },
}

function createJsonRequest(body) {
    return {
        async json() {
            return body
        },
    }
}

function createContext(id) {
    return {
        params: {
            id: String(id),
        },
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

async function loadRouteModule(source, identifier) {
    const moduleCache = new Map()

    async function linker(specifier) {
        if (moduleCache.has(specifier)) {
            return moduleCache.get(specifier)
        }

        let vmModule

        if (specifier === 'next/server') {
            class MockNextResponse {
                constructor(body, init = {}) {
                    this.body = body
                    this.status = init.status || 200
                    this.headers = init.headers || {}
                }

                static json(body, init = {}) {
                    return {
                        body,
                        status: init.status || 200,
                        headers: init.headers || {},
                    }
                }
            }

            vmModule = await createMockModule(specifier, {
                NextResponse: MockNextResponse,
            })
        } else if (specifier === '@/app/lib/db') {
            vmModule = await createMockModule(specifier, {
                db: mockDb,
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
        } else if (specifier === '@/app/lib/auditLog') {
            vmModule = await createMockModule(specifier, {
                async writeAuditLog(payload) {
                    mockState.auditLogCalls.push(payload)
                    return true
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

const formTemplateRoute = await loadRouteModule(
    formTemplateRouteSource,
    'app/api/v1/form-template/route.js'
)
const formTemplateDetailRoute = await loadRouteModule(
    formTemplateDetailRouteSource,
    'app/api/v1/form-template/[id]/route.js'
)
const formSubmitRoute = await loadRouteModule(
    formSubmitRouteSource,
    'app/api/v1/form-template/[id]/submit/route.js'
)
const formSubmissionRoute = await loadRouteModule(
    formSubmissionRouteSource,
    'app/api/v1/form-submission/route.js'
)
const formSubmissionDetailRoute = await loadRouteModule(
    formSubmissionDetailRouteSource,
    'app/api/v1/form-submission/[id]/route.js'
)
const formSubmissionSummaryRoute = await loadRouteModule(
    formSubmissionSummaryRouteSource,
    'app/api/v1/form-submission/summary/route.js'
)

test('POST /api/v1/form-template requires form.create and writes audit log', async () => {
    resetMockState()
    mockState.executeQueue.push([[]], [{ insertId: 22 }])

    const response = await formTemplateRoute.POST(createJsonRequest({
        form_name: 'Purchase Request',
        form_code: 'PR',
        description: 'Request approval',
        orientation: 'portrait',
        status: 'active',
        layout_json: {
            fields: [
                { id: 'field_1', type: 'text', label: 'Title' },
            ],
        },
    }))

    assert.equal(response.status, 201)
    assert.deepEqual(mockState.requirePermissionCalls, ['form.create'])
    assert.equal(mockState.executeCalls[0].sql.includes('WHERE form_code = ?'), true)
    assert.deepEqual(mockState.auditLogCalls[0], {
        actorId: 'U001',
        action: 'form_template.create',
        entityType: 'form_template',
        entityId: 22,
        summary: 'Create form template Purchase Request',
        metadata: {
            form_template_id: 22,
            form_name: 'Purchase Request',
            form_code: 'PR',
            status: 'active',
            orientation: 'portrait',
            field_count: 1,
        },
    })
})

test('PUT /api/v1/form-template/:id requires form.update and writes audit log', async () => {
    resetMockState()
    mockState.executeQueue.push([[]], [{ affectedRows: 1 }])

    const response = await formTemplateDetailRoute.PUT(
        createJsonRequest({
            form_name: 'Purchase Request',
            form_code: 'PR',
            description: 'Updated',
            orientation: 'landscape',
            status: 'draft',
            layout_json: {
                fields: [
                    { id: 'field_1', type: 'text', label: 'Title' },
                    { id: 'field_2', type: 'date', label: 'Date' },
                ],
            },
        }),
        createContext(22)
    )

    assert.equal(response.status, 200)
    assert.deepEqual(mockState.requirePermissionCalls, ['form.update'])
    assert.deepEqual(mockState.auditLogCalls[0], {
        actorId: 'U001',
        action: 'form_template.update',
        entityType: 'form_template',
        entityId: 22,
        summary: 'Update form template Purchase Request',
        metadata: {
            form_template_id: 22,
            form_name: 'Purchase Request',
            form_code: 'PR',
            status: 'draft',
            orientation: 'landscape',
            version_bumped: true,
            field_count: 2,
        },
    })
})

test('DELETE /api/v1/form-template/:id requires form.delete and writes audit log', async () => {
    resetMockState()
    mockState.executeQueue.push([{ affectedRows: 1 }])

    const response = await formTemplateDetailRoute.DELETE(
        createJsonRequest({}),
        createContext(22)
    )

    assert.equal(response.status, 200)
    assert.deepEqual(mockState.requirePermissionCalls, ['form.delete'])
    assert.deepEqual(mockState.auditLogCalls[0], {
        actorId: 'U001',
        action: 'form_template.delete',
        entityType: 'form_template',
        entityId: 22,
        summary: 'Delete form template 22',
        metadata: {
            form_template_id: 22,
        },
    })
})

test('POST /api/v1/form-template/:id/submit requires form.fill and writes audit log', async () => {
    resetMockState()
    mockState.executeQueue.push(
        [[
            {
                form_template_id: 22,
                form_name: 'Purchase Request',
                form_code: 'PR',
                description: 'Request approval',
                layout_json: JSON.stringify({
                    fields: [
                        {
                            id: 'name',
                            type: 'text',
                            label: 'Name',
                            required: true,
                        },
                    ],
                }),
                version: 3,
                status: 'active',
            },
        ]],
        [{ insertId: 55 }]
    )

    const response = await formSubmitRoute.POST(
        createJsonRequest({
            data_json: {
                name: 'Jane',
            },
        }),
        createContext(22)
    )

    assert.equal(response.status, 201)
    assert.deepEqual(mockState.requirePermissionCalls, ['form.fill'])
    assert.equal(mockState.auditLogCalls[0].actorId, 'U001')
    assert.equal(mockState.auditLogCalls[0].action, 'form_submission.create')
    assert.equal(mockState.auditLogCalls[0].entityType, 'form_submission')
    assert.equal(mockState.auditLogCalls[0].entityId, 55)
    assert.equal(mockState.auditLogCalls[0].metadata.form_template_id, 22)
    assert.equal(mockState.auditLogCalls[0].metadata.form_submission_id, 55)

    const insertCall = mockState.executeCalls.find((call) =>
        call.sql.includes('INSERT INTO form_submission')
    )
    assert.equal(insertCall.sql.includes('layout_snapshot_json'), true)
    assert.equal(insertCall.params[3], 3)
    assert.equal(insertCall.params[4], 'Purchase Request')
    assert.equal(insertCall.params[5], 'PR')
    assert.equal(insertCall.params[6], 'Request approval')

    const historyCall = mockState.executeCalls.find((call) =>
        call.sql.includes('INSERT INTO form_submission_history')
    )
    assert.deepEqual(historyCall.params, [55, 'U001'])
})

test('POST /api/v1/form-template/:id/submit ignores static text fields during validation', async () => {
    resetMockState()
    mockState.executeQueue.push(
        [[
            {
                form_template_id: 22,
                form_name: 'Notice Form',
                form_code: 'NOTICE',
                description: null,
                layout_json: JSON.stringify({
                    fields: [
                        {
                            id: 'notice',
                            type: 'static_text',
                            label: 'Notice',
                            content: 'Read this before submitting.',
                            required: true,
                        },
                    ],
                }),
                version: 1,
                status: 'active',
            },
        ]],
        [{ insertId: 56 }]
    )

    const response = await formSubmitRoute.POST(
        createJsonRequest({
            data_json: {},
        }),
        createContext(22)
    )

    assert.equal(response.status, 201)
    assert.equal(response.body.form_submission_id, 56)
    assert.equal(mockState.auditLogCalls[0].action, 'form_submission.create')
})

test('POST /api/v1/form-template/:id/submit validates checkbox table and signature fields', async () => {
    resetMockState()
    mockState.executeQueue.push(
        [[
            {
                form_template_id: 22,
                form_name: 'Validation Form',
                form_code: 'VAL',
                description: null,
                layout_json: JSON.stringify({
                    fields: [
                        {
                            id: 'choices',
                            type: 'checkbox',
                            label: 'Choices',
                            required: true,
                        },
                        {
                            id: 'lines',
                            type: 'table',
                            label: 'Lines',
                            requiredColumns: ['Amount'],
                        },
                        {
                            id: 'sign',
                            type: 'signature',
                            label: 'Signature',
                            required: true,
                        },
                    ],
                }),
                version: 1,
                status: 'active',
            },
        ]]
    )

    const response = await formSubmitRoute.POST(
        createJsonRequest({
            data_json: {
                choices: [],
                lines: [{ Item: 'Paper' }],
                sign: '',
            },
        }),
        createContext(22)
    )

    assert.equal(response.status, 400)
    assert.equal(response.body.message.includes('Choices'), true)
    assert.equal(response.body.message.includes('Amount'), true)
    assert.equal(response.body.message.includes('Signature'), true)
    assert.equal(mockState.auditLogCalls.length, 0)
})

test('GET /api/v1/form-submission applies filters and pagination', async () => {
    resetMockState()
    mockState.executeQueue.push(
        [[{ total: 7 }]],
        [[
            {
                form_submission_id: 55,
                submission_no: 'FORM-55',
                status: 'submitted',
                form_name: 'Purchase Request',
                submitted_by_name: 'Admin User',
            },
        ]]
    )

    const response = await formSubmissionRoute.GET({
        url: 'http://localhost/api/v1/form-submission?search=PR&status=submitted&from=2026-06-01&to=2026-06-30&page=2&limit=5',
    })

    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.deepEqual(mockState.requirePermissionCalls, ['form.view'])
    assert.deepEqual(mockState.executeCalls[0].params, [
        'submitted',
        '2026-06-01',
        '2026-06-30',
        '%PR%',
        '%PR%',
        '%PR%',
        '%PR%',
        '%PR%',
    ])
    assert.equal(mockState.executeCalls[1].sql.includes('LIMIT 5'), true)
    assert.equal(mockState.executeCalls[1].sql.includes('OFFSET 5'), true)
    assert.deepEqual(response.body.pagination, {
        page: 2,
        limit: 5,
        total: 7,
        total_pages: 2,
    })
})

test('GET /api/v1/form-submission/:id returns snapshot layout and status history', async () => {
    resetMockState()
    mockState.executeQueue.push(
        [[
            {
                form_submission_id: 55,
                form_template_id: 22,
                submission_no: 'FORM-55',
                data_json: JSON.stringify({ name: 'Jane' }),
                template_version: 3,
                status: 'submitted',
                submitted_by: 'U001',
                submitted_at: '2026-06-24 09:00:00',
                decided_by: null,
                decided_at: null,
                decision_comment: null,
                form_name: 'Purchase Request Snapshot',
                form_code: 'PR',
                description: 'Snapshot description',
                layout_json: JSON.stringify({
                    fields: [{ id: 'name', type: 'text', label: 'Name' }],
                }),
                submitted_by_name: 'Jane User',
                decided_by_name: null,
            },
        ]],
        [[
            {
                history_id: 1,
                from_status: null,
                to_status: 'submitted',
                action: 'submit',
                comment: null,
                changed_by: 'U001',
                created_at: '2026-06-24 09:00:00',
                changed_by_name: 'Jane User',
            },
        ]]
    )

    const response = await formSubmissionDetailRoute.GET(
        {},
        createContext(55)
    )

    assert.equal(response.status, 200)
    assert.deepEqual(mockState.requirePermissionCalls, ['form.view'])
    assert.equal(response.body.submission.form_name, 'Purchase Request Snapshot')
    assert.equal(response.body.submission.template_version, 3)
    assert.deepEqual(response.body.submission.data_json, { name: 'Jane' })
    assert.equal(response.body.submission.layout_json.fields[0].label, 'Name')
    assert.equal(response.body.submission.history.length, 1)
})

test('PATCH /api/v1/form-submission/:id approves submission and writes audit log', async () => {
    resetMockState()
    mockState.authUser = { id: 'U002', permissions: ['form.approve'] }
    mockState.executeQueue.push(
        [[
            {
                form_submission_id: 55,
                form_template_id: 22,
                submission_no: 'FORM-55',
                status: 'submitted',
                submitted_by: 'U001',
            },
        ]],
        [{ affectedRows: 1 }],
        [[]]
    )

    const response = await formSubmissionDetailRoute.PATCH(
        createJsonRequest({
            action: 'approve',
            comment: 'Looks good',
        }),
        createContext(55)
    )

    assert.equal(response.status, 200)
    assert.equal(response.body.status, 'approved')
    assert.deepEqual(mockState.requirePermissionCalls, ['form.approve'])
    assert.equal(mockState.executeCalls[1].params[0], 'approved')
    assert.equal(mockState.executeCalls[1].params[1], 'U002')
    assert.equal(mockState.executeCalls[2].params[3], 'approve')
    assert.equal(mockState.auditLogCalls[0].action, 'form_submission.approve')
    assert.equal(mockState.auditLogCalls[0].metadata.to_status, 'approved')
})

test('PATCH /api/v1/form-submission/:id blocks self approval', async () => {
    resetMockState()
    mockState.authUser = { id: 'U001', permissions: ['form.approve'] }
    mockState.executeQueue.push(
        [[
            {
                form_submission_id: 55,
                form_template_id: 22,
                submission_no: 'FORM-55',
                status: 'submitted',
                submitted_by: 'U001',
            },
        ]]
    )

    const response = await formSubmissionDetailRoute.PATCH(
        createJsonRequest({
            action: 'approve',
            comment: '',
        }),
        createContext(55)
    )

    assert.equal(response.status, 403)
    assert.equal(mockState.executeCalls.length, 1)
    assert.equal(mockState.auditLogCalls.length, 0)
})

test('GET /api/v1/form-submission/summary returns dashboard data', async () => {
    resetMockState()
    mockState.executeQueue.push(
        [[
            {
                total_submissions: 4,
                submitted: 1,
                approved: 2,
                rejected: 1,
                cancelled: 0,
                today_submissions: 1,
            },
        ]],
        [[
            {
                total_templates: 3,
                active_templates: 2,
            },
        ]],
        [[
            {
                form_submission_id: 55,
                submission_no: 'FORM-55',
                status: 'submitted',
                form_name: 'Purchase Request',
                form_code: 'PR',
                submitted_by: 'U001',
                submitted_by_name: 'Jane User',
            },
        ]]
    )

    const response = await formSubmissionSummaryRoute.GET({
        url: 'http://localhost/api/v1/form-submission/summary',
    })

    assert.equal(response.status, 200)
    assert.deepEqual(mockState.requirePermissionCalls, ['form.view'])
    assert.deepEqual(response.body.summary, {
        total_submissions: 4,
        submitted: 1,
        approved: 2,
        rejected: 1,
        cancelled: 0,
        today_submissions: 1,
        total_templates: 3,
        active_templates: 2,
    })
    assert.equal(response.body.pending_submissions.length, 1)
})

test('GET /api/v1/form-submission/summary CSV requires form.export and audits export', async () => {
    resetMockState()
    mockState.executeQueue.push(
        [[
            {
                total_submissions: 1,
                submitted: 1,
                approved: 0,
                rejected: 0,
                cancelled: 0,
                today_submissions: 1,
            },
        ]],
        [[
            {
                total_templates: 1,
                active_templates: 1,
            },
        ]],
        [[
            {
                form_submission_id: 55,
                submission_no: 'FORM-55',
                status: 'submitted',
                form_name: 'Purchase Request',
                form_code: 'PR',
                submitted_by: 'U001',
                submitted_by_name: 'Jane User',
                submitted_at: '2026-06-24 09:00:00',
            },
        ]]
    )

    const response = await formSubmissionSummaryRoute.GET({
        url: 'http://localhost/api/v1/form-submission/summary?format=csv',
    })

    assert.equal(response.status, 200)
    assert.deepEqual(mockState.requirePermissionCalls, ['form.export'])
    assert.equal(response.headers['Content-Type'], 'text/csv; charset=utf-8')
    assert.equal(response.body.includes('total_submissions,1'), true)
    assert.equal(response.body.includes('FORM-55'), true)
    assert.equal(mockState.auditLogCalls[0].action, 'form_submission.export_summary')
})
