import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import './tiptap-styles.css';

interface RichTextEditorProps {
    initialContent?: string;
    initialRows?: string[][];
    onChange: (html: string) => void;
    isEditable?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialContent, initialRows, onChange, isEditable = true }) => {
    // Convert basic rows array to HTML table if present
    const defaultTableHtml = initialRows && initialRows.length > 0
        ? `<table><tbody>${ 
        initialRows.map((row, i) =>
            `<tr>${ 
            row.map(cell => (i === 0 ? `<th><p>${cell}</p></th>` : `<td><p>${cell}</p></td>`)).join('') 
            }</tr>`
        ).join('') 
        }</tbody></table>`
        : '';

    const editor = useEditor({
        extensions: [
            StarterKit,
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: defaultTableHtml || initialContent || '<p>Start typing...</p>',
        editable: isEditable,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    return (
        <div className="tiptap-container rounded-lg border border-slate-200 overflow-hidden shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
            {isEditable && editor && (
                <div className="flex flex-wrap gap-2 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 tiptap-toolbar">
                    <button
                        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                        className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        Insert Table
                    </button>
                    <button
                        onClick={() => editor.chain().focus().addColumnBefore().run()}
                        disabled={!editor.can().addColumnBefore()}
                        className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                        Add Column
                    </button>
                    <button
                        onClick={() => editor.chain().focus().addRowAfter().run()}
                        disabled={!editor.can().addRowAfter()}
                        className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                        Add Row
                    </button>
                    <button
                        onClick={() => editor.chain().focus().deleteTable().run()}
                        disabled={!editor.can().deleteTable()}
                        className="px-3 py-1.5 text-sm font-medium rounded-md hover:bg-red-100 text-red-600 dark:hover:bg-red-900/30 dark:text-red-400 transition-colors disabled:opacity-50"
                    >
                        Delete Table
                    </button>
                </div>
            )}
            <div className="p-4 tiptap-content prose dark:prose-invert max-w-none">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

export default RichTextEditor;
