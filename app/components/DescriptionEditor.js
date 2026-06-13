'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'

export default function DescriptionEditor({
    value,
    onChange,
}) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextStyle,
            Color,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
        ],
        content: value,
        onUpdate({ editor }) {
            onChange(editor.getHTML())
        },
    })

    if (!editor) return null

    return (
        <div className="border rounded-xl">

            <div className="flex gap-2 p-2 border-b flex-wrap">

                <button
                    type="button"
                    onClick={() =>
                        editor.chain().focus().toggleBold().run()
                    }
                >
                    B
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor.chain().focus().toggleItalic().run()
                    }
                >
                    I
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor.chain().focus().toggleUnderline().run()
                    }
                >
                    U
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor.chain().focus().toggleBulletList().run()
                    }
                >
                    • List
                </button>

            </div>

            <EditorContent
                editor={editor}
                className="p-4 min-h-62.5"
            />

        </div>
    )
}