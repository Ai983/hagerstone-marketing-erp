"use client"

import { useEffect, useState } from "react"
import { Extension } from "@tiptap/core"
import Color from "@tiptap/extension-color"
import FontFamily from "@tiptap/extension-font-family"
import Highlight from "@tiptap/extension-highlight"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import { TextStyle } from "@tiptap/extension-text-style"
import Underline from "@tiptap/extension-underline"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react"

import { cn } from "@/lib/utils"

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
})

const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32]

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Write your email...",
}: RichTextEditorProps) {
  const [linkUrl, setLinkUrl] = useState("")
  const [isLinkOpen, setIsLinkOpen] = useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {},
        orderedList: {},
        bold: {},
        italic: {},
        strike: {},
      }),
      Underline,
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "min-h-[200px] focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (!editor || editor.getHTML() === content) return
    editor.commands.setContent(content || "")
  }, [content, editor])

  if (!editor) return null

  const buttonClass = (active = false) =>
    cn(
      "flex size-8 items-center justify-center rounded-md bg-transparent text-[#9090A8] transition hover:bg-[#2A2A3C] hover:text-[#F0F0FA]",
      active && "bg-[#3B82F6] text-white hover:bg-[#3B82F6] hover:text-white"
    )

  const Divider = () => <span className="mx-1 h-8 w-px bg-[#2A2A3C]" />

  const applyLink = () => {
    const url = linkUrl.trim()
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      setIsLinkOpen(false)
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
    setIsLinkOpen(false)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 rounded-t-lg border border-[#2A2A3C] bg-[#1A1A24] px-3 py-2">
        <button type="button" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} className={buttonClass(editor.isActive("bold"))}>
          <Bold className="size-4" />
        </button>
        <button type="button" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} className={buttonClass(editor.isActive("italic"))}>
          <Italic className="size-4" />
        </button>
        <button type="button" title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} className={buttonClass(editor.isActive("underline"))}>
          <UnderlineIcon className="size-4" />
        </button>
        <button type="button" title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} className={buttonClass(editor.isActive("strike"))}>
          <Strikethrough className="size-4" />
        </button>
        <Divider />
        {[1, 2, 3].map((level) => (
          <button
            key={level}
            type="button"
            title={`Heading ${level}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
            className={cn(buttonClass(editor.isActive("heading", { level })), "text-xs font-bold")}
          >
            H{level}
          </button>
        ))}
        <button type="button" title="Normal text" onClick={() => editor.chain().focus().setParagraph().run()} className={buttonClass(editor.isActive("paragraph"))}>
          <Pilcrow className="size-4" />
        </button>
        <Divider />
        <select
          title="Font size"
          defaultValue=""
          onChange={(e) => {
            const size = e.target.value
            if (size) editor.chain().focus().setMark("textStyle", { fontSize: `${size}px` }).run()
          }}
          className="h-8 rounded-md border border-[#2A2A3C] bg-[#111118] px-2 text-xs text-[#F0F0FA] outline-none"
        >
          <option value="">Size</option>
          {fontSizes.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1 border-x border-[#2A2A3C] bg-[#1A1A24] px-3 pb-2">
        <button type="button" title="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={buttonClass(editor.isActive({ textAlign: "left" }))}>
          <AlignLeft className="size-4" />
        </button>
        <button type="button" title="Align center" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={buttonClass(editor.isActive({ textAlign: "center" }))}>
          <AlignCenter className="size-4" />
        </button>
        <button type="button" title="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={buttonClass(editor.isActive({ textAlign: "right" }))}>
          <AlignRight className="size-4" />
        </button>
        <Divider />
        <button type="button" title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} className={buttonClass(editor.isActive("bulletList"))}>
          <List className="size-4" />
        </button>
        <button type="button" title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={buttonClass(editor.isActive("orderedList"))}>
          <ListOrdered className="size-4" />
        </button>
        <Divider />
        <div className="relative">
          <button
            type="button"
            title="Link"
            onClick={() => {
              setLinkUrl(editor.getAttributes("link").href ?? "")
              setIsLinkOpen((open) => !open)
            }}
            className={buttonClass(editor.isActive("link"))}
          >
            <Link2 className="size-4" />
          </button>
          {isLinkOpen && (
            <div className="absolute left-0 top-9 z-20 w-64 rounded-lg border border-[#2A2A3C] bg-[#111118] p-2 shadow-xl">
              <input
                autoFocus
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyLink()
                  if (e.key === "Escape") setIsLinkOpen(false)
                }}
                placeholder="https://example.com"
                className="h-9 w-full rounded-md border border-[#2A2A3C] bg-[#1F1F2E] px-2 text-sm text-[#F0F0FA] outline-none focus:border-[#3B82F6]"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsLinkOpen(false)} className="rounded-md px-2 py-1 text-xs text-[#9090A8] hover:text-[#F0F0FA]">
                  Cancel
                </button>
                <button type="button" onClick={applyLink} className="rounded-md bg-[#3B82F6] px-2 py-1 text-xs font-medium text-white">
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
        <button type="button" title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={buttonClass()}>
          <Minus className="size-4" />
        </button>
        <Divider />
        <label className={cn(buttonClass(), "relative cursor-pointer")} title="Text color">
          <span className="sr-only">Text color</span>
          <span className="h-4 w-4 rounded-sm border border-[#9090A8]" />
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
        </label>
        <label className={cn(buttonClass(), "relative cursor-pointer")} title="Highlight color">
          <span className="sr-only">Highlight color</span>
          <Highlighter className="size-4" />
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()} />
        </label>
        <Divider />
        <button type="button" title="Undo" onClick={() => editor.chain().focus().undo().run()} className={buttonClass()}>
          <Undo2 className="size-4" />
        </button>
        <button type="button" title="Redo" onClick={() => editor.chain().focus().redo().run()} className={buttonClass()}>
          <Redo2 className="size-4" />
        </button>
      </div>

      <div className="rounded-b-lg border border-t-0 border-[#2A2A3C] bg-[#1F1F2E] p-4 text-[15px] leading-[1.7] text-[#F0F0FA]">
        <EditorContent
          editor={editor}
          className="font-[family-name:var(--font-dm-sans),Arial,sans-serif] [&_.ProseMirror:focus]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child:before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child:before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child:before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child:before]:text-[#5A5A72] [&_.ProseMirror_p.is-editor-empty:first-child:before]:content-[attr(data-placeholder)]"
        />
      </div>
    </div>
  )
}
