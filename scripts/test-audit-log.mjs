import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const auditLogSource = await readFile(
    new URL('../app/lib/auditLog.js', import.meta.url),
    'utf8'
)

const mockState = {
    executeCalls: [],
    executeError: null,
}

function resetMockState() {
    mockState.executeCalls = []
    mockState.executeError = null
}

const mockDb = {
    async execute(sql, params = []) {
        mockState.executeCalls.push({ sql, params })

        if (mockState.executeError) {
            throw mockState.executeError
        }

        return [{ affectedRows: 1 }]
    },
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

async function loadAuditLogModule() {
    const vmModule = new vm.SourceTextModule(auditLogSource, {
        identifier: 'app/lib/auditLog.js',
    })

    await vmModule.link(async (specifier) => {
        if (specifier === '@/app/lib/db') {
            return createMockModule(specifier, {
                db: mockDb,
            })
        }

        throw new Error(`Unexpected import: ${specifier}`)
    })

    await vmModule.evaluate()

    return vmModule.namespace
}

const auditLog = await loadAuditLogModule()

test('writeAuditLog inserts an audit row with normalized metadata', async () => {
    resetMockState()

    const ok = await auditLog.writeAuditLog({
        actorId: 'U001',
        action: 'project.create',
        entityType: 'project',
        entityId: 42,
        summary: 'Create project',
        metadata: {
            project_code: 'P-001',
        },
    })

    assert.equal(ok, true)
    assert.equal(mockState.executeCalls.length, 1)
    assert.equal(mockState.executeCalls[0].sql.includes('INSERT INTO audit_log'), true)
    assert.deepEqual(mockState.executeCalls[0].params, [
        'U001',
        'project.create',
        'project',
        '42',
        'Create project',
        JSON.stringify({
            project_code: 'P-001',
        }),
    ])
})

test('writeAuditLog returns false when required fields are missing', async () => {
    resetMockState()

    const ok = await auditLog.writeAuditLog({
        entityType: 'project',
    })

    assert.equal(ok, false)
    assert.equal(mockState.executeCalls.length, 0)
})

test('writeAuditLog throws missing required fields in strict mode', async () => {
    resetMockState()

    await assert.rejects(
        auditLog.writeAuditLog({
            entityType: 'project',
            strict: true,
        }),
        /requires action and entityType/
    )
})

test('writeAuditLog swallows database errors by default', async () => {
    resetMockState()
    mockState.executeError = new Error('table missing')
    const originalWarn = console.warn
    const warnCalls = []

    console.warn = (...args) => warnCalls.push(args)

    try {
        const ok = await auditLog.writeAuditLog({
            actorId: 'U001',
            action: 'project.delete',
            entityType: 'project',
            entityId: 42,
        })

        assert.equal(ok, false)
        assert.equal(warnCalls.length, 1)
    } finally {
        console.warn = originalWarn
    }
})

test('writeAuditLog throws database errors in strict mode', async () => {
    resetMockState()
    mockState.executeError = new Error('database failed')

    await assert.rejects(
        auditLog.writeAuditLog({
            actorId: 'U001',
            action: 'project.delete',
            entityType: 'project',
            entityId: 42,
            strict: true,
        }),
        /database failed/
    )
})
