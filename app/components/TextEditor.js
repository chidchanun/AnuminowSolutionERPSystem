'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    FiBold,
    FiItalic,
    FiUnderline,
    FiList,
    FiAlignLeft,
    FiAlignCenter,
    FiAlignRight
} from 'react-icons/fi'

export default function TextEditor({
    value,
    onChange
}) {
    const editorRef = useRef(null)
    const lastHtmlRef = useRef('')
    const [editorState, setEditorState] = useState({
        bold: false,
        italic: false,
        underline: false,
        unorderedList: false,
        orderedList: false,
        justifyLeft: false,
        justifyCenter: false,
        justifyRight: false,
    })
    const [fontSize, setFontSizeState] = useState('16px')

    const updateToolbarState = useCallback(() => {
        const selection = window.getSelection()
        const editor = editorRef.current

        if (!selection || !editor) return

        const anchorNode = selection.anchorNode

        if (!anchorNode || !editor.contains(anchorNode)) return

        setEditorState({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),

            unorderedList:
                document.queryCommandState(
                    'insertUnorderedList'
                ),

            orderedList:
                document.queryCommandState(
                    'insertOrderedList'
                ),

            justifyLeft:
                document.queryCommandState(
                    'justifyLeft'
                ),

            justifyCenter:
                document.queryCommandState(
                    'justifyCenter'
                ),

            justifyRight:
                document.queryCommandState(
                    'justifyRight'
                ),
        })

        if (selection.rangeCount > 0) {
            const node =
                selection.anchorNode?.parentElement

            if (node) {
                const size =
                    window.getComputedStyle(node)
                        .fontSize

                setFontSizeState(size)
            }
        }
    }, [])

    const syncChange = useCallback(() => {
        const html = editorRef.current?.innerHTML || ''

        lastHtmlRef.current = html
        onChange(html)
    }, [onChange])

    const exec = (command, value = null) => {
        editorRef.current?.focus()

        document.execCommand(
            command,
            false,
            value
        )

        setTimeout(() => {
            updateToolbarState()
            syncChange()
        }, 0)
    }

    const setFontSize = (size) => {
        editorRef.current?.focus()

        document.execCommand(
            'styleWithCSS',
            false,
            true
        )

        const selection = window.getSelection()

        if (!selection.rangeCount) return

        const range = selection.getRangeAt(0)

        if (range.collapsed) return

        const span = document.createElement('span')

        span.style.fontSize = size

        try {
            range.surroundContents(span)
        } catch {
            const content =
                range.extractContents()

            span.appendChild(content)

            range.insertNode(span)
        }

        syncChange()

        updateToolbarState()
    }

    const handleInput = useCallback((event) => {
        const html = event.currentTarget.innerHTML

        lastHtmlRef.current = html
        onChange(html)
    }, [onChange])

    useEffect(() => {
        const editor = editorRef.current
        const nextValue = value || ''

        if (!editor || nextValue === lastHtmlRef.current) return

        if (document.activeElement === editor) return

        editor.innerHTML = nextValue
        lastHtmlRef.current = nextValue
    }, [value])

    useEffect(() => {
        document.addEventListener(
            'selectionchange',
            updateToolbarState
        )

        return () => {
            document.removeEventListener(
                'selectionchange',
                updateToolbarState
            )
        }
    }, [updateToolbarState])

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">

            {/* Toolbar */}

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-2 py-1 bg-slate-200 dark:bg-slate-950">

                <ToolbarButton
                    active={editorState.bold}
                    icon={FiBold}
                    onClick={() => exec('bold')}
                />

                <ToolbarButton
                    active={editorState.italic}
                    icon={FiItalic}
                    onClick={() => exec('italic')}
                />

                <ToolbarButton
                    active={editorState.underline}
                    icon={FiUnderline}
                    onClick={() => exec('underline')}
                />

                <div className="w-px h-6 bg-slate-300" />

                <ToolbarButton
                    active={editorState.unorderedList}
                    icon={FiList}
                    onClick={() =>
                        exec('insertUnorderedList')
                    }
                />

                <ToolbarButton
                    active={editorState.orderedList}
                    onClick={() =>
                        exec('insertOrderedList')
                    }
                >
                    1.
                </ToolbarButton>

                <div className="w-px h-6 bg-slate-300" />

                <ToolbarButton
                    active={editorState.justifyLeft}
                    icon={FiAlignLeft}
                    onClick={() =>
                        exec('justifyLeft')
                    }
                />

                <ToolbarButton
                    active={editorState.justifyCenter}
                    icon={FiAlignCenter}
                    onClick={() =>
                        exec('justifyCenter')
                    }
                />

                <ToolbarButton
                    active={editorState.justifyRight}
                    icon={FiAlignRight}
                    onClick={() =>
                        exec('justifyRight')
                    }
                />

                <div className="w-px h-6 bg-slate-300" />

                {/* Font Size */}

                <select
                    value={fontSize}
                    onChange={(e) =>
                        setFontSize(e.target.value)
                    }
                    className=' rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 px-4 py-3 pr-12 text-black dark:text-slate-100 outline-none appearance-none focus:border-sky-300 focus:dark:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
                >
                    <option value="12px">12px</option>
                    <option value="14px">14px</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="24px">24px</option>
                    <option value="32px">32px</option>
                    <option value="48px">48px</option>
                </select>

                {/* Color */}

                <input
                    type="color"
                    onChange={(e) =>
                        exec('foreColor', e.target.value)
                    }
                    className="h-9 w-9 cursor-pointer border rounded"
                />
            </div>

            {/* Editor */}

            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="
                    min-h-75
                    p-6
                    outline-none
                    leading-7
                    text-slate-900
                    dark:text-slate-100
                    bg-slate-200
                    dark:bg-slate-950

                    [&_ul]:list-disc
                    [&_ul]:pl-6

                    [&_ol]:list-decimal
                    [&_ol]:pl-6

                    [&_li]:my-1
                "
                onInput={handleInput}
            />
        </div>
    )
}

function ToolbarButton({
    active,
    icon: Icon,
    onClick,
    children
}) {
    return (
        <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className={`
                rounded-lg
                p-2
                transition
                cursor-pointer
                border
                ${active
                    ? 'bg-sky-500 text-white border-sky-500'
                    : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                }
            `}
        >
            {Icon ? (
                <Icon size={18} />
            ) : (
                children
            )}
        </button>
    )
}
