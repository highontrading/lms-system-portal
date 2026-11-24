"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { uploadFile, UploadFailed } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarButton({ label, active, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the text selection while clicking a toolbar button.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
        active && "bg-primary-soft text-primary-text hover:bg-primary-soft-hover hover:text-primary-text",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
}

function normalizeUrl(input: string) {
  const value = input.trim();
  if (!value) return "";
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(value)) return value;
  return `https://${value}`;
}

function Toolbar({ editor }: { editor: Editor }) {
  const [panel, setPanel] = useState<"link" | "image" | null>(null);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      h2: current.isActive("heading", { level: 2 }),
      h3: current.isActive("heading", { level: 3 }),
      bullet: current.isActive("bulletList"),
      ordered: current.isActive("orderedList"),
      quote: current.isActive("blockquote"),
      codeBlock: current.isActive("codeBlock"),
      link: current.isActive("link"),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });

  function openLink() {
    setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
    setPanel(panel === "link" ? null : "link");
  }

  function applyLink() {
    const href = normalizeUrl(url);
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setPanel(null);
  }

  function applyImage() {
    const src = normalizeUrl(url);
    if (!/^(https?:\/\/|\/)/i.test(src)) {
      toast.error("Enter a full image address starting with https://");
      return;
    }
    editor.chain().focus().setImage({ src }).run();
    setPanel(null);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const uploaded = await uploadFile(file, "media");
      editor.chain().focus().setImage({ src: uploaded.url, alt: file.name.replace(/\.[^.]+$/, "") }).run();
      setPanel(null);
    } catch (error) {
      toast.error(error instanceof UploadFailed ? error.message : "The image couldn't be uploaded.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="border-b border-border bg-subtle/70">
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1.5">
        <ToolbarButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={state.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          label="Heading"
          active={state.h2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          label="Subheading"
          active={state.h3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Bulleted list" active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={state.ordered}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton label="Quote" active={state.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Inline code" active={state.code} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code />
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          active={state.codeBlock}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <SquareCode />
        </ToolbarButton>
        <ToolbarButton label="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="Link" active={state.link || panel === "link"} onClick={openLink}>
          <Link2 />
        </ToolbarButton>
        <ToolbarButton
          label="Image"
          active={panel === "image"}
          onClick={() => {
            setUrl("");
            setPanel(panel === "image" ? null : "image");
          }}
        >
          <ImagePlus />
        </ToolbarButton>
        <span className="ml-auto flex items-center gap-0.5">
          <ToolbarButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 />
          </ToolbarButton>
          <ToolbarButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 />
          </ToolbarButton>
        </span>
      </div>

      {panel ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-2.5 py-2">
          <input
            autoFocus
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (panel === "link") applyLink();
                else applyImage();
              }
              if (event.key === "Escape") setPanel(null);
            }}
            placeholder={panel === "link" ? "https://example.com" : "Image address (https://…)"}
            aria-label={panel === "link" ? "Link address" : "Image address"}
            className="h-8.5 min-w-0 flex-1 basis-48 rounded-md border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/35"
          />
          <button
            type="button"
            onClick={panel === "link" ? applyLink : applyImage}
            className="h-8.5 rounded-md bg-primary px-3 text-[0.8125rem] font-medium text-primary-foreground hover:bg-primary-hover"
          >
            {panel === "link" ? "Apply" : "Insert"}
          </button>
          {panel === "link" && state.link ? (
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setPanel(null);
              }}
              className="h-8.5 rounded-md px-2.5 text-[0.8125rem] font-medium text-danger-text hover:bg-danger-soft"
            >
              Remove link
            </button>
          ) : null}
          {panel === "image" ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file);
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="h-8.5 rounded-md border border-border-strong bg-card px-3 text-[0.8125rem] font-medium hover:bg-muted disabled:opacity-60"
              >
                {uploading ? "Uploading…" : "Upload image"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Rich text editor used for product descriptions, lesson bodies, pages and announcements.
 * Emits HTML; the server sanitises it again before saving.
 */
export function RichTextEditor({ value, onChange, placeholder, minHeight = 180 }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const editor = useEditor({
    // Render on the client only, so server and browser markup never disagree.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: { rel: "noopener noreferrer" },
        },
      }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
    ],
    content: value || "",
    editorProps: {
      attributes: { class: "rich tiptap px-3.5 py-3", role: "textbox", "aria-multiline": "true" },
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(current.isEmpty ? "" : current.getHTML());
    },
  });

  // Follow value changes that come from outside (loading another record, a reset).
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if ((value || "") !== current) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="overflow-hidden rounded-md border border-input bg-card shadow-xs transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-3 focus-within:ring-ring/35">
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b border-border bg-subtle/70" />}
      <div
        className="max-h-[70vh] cursor-text overflow-y-auto"
        style={{ minHeight }}
        onClick={() => {
          if (editor && !editor.isFocused) editor.commands.focus();
        }}
      >
        <EditorContent editor={editor} style={{ minHeight }} className="[&>.tiptap]:min-h-[inherit]" />
      </div>
    </div>
  );
}
