'use client';

import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { tableToMarkdown } from '@/lib/articleTable';

// Lets an admin build a small data table (a box-office comparison, a cast
// list with roles, whatever a news article or review needs mid-paragraph)
// by filling in a grid instead of hand-typing "| Film | Gross |" pipe
// syntax -- which is what the content textarea otherwise expects (see
// lib/articleTable.ts's parseMarkdownTable). Produces the exact same
// plain-text block either way, so a table someone already typed by hand
// keeps working, and a table built here can still be hand-edited afterwards.
export default function TableBuilder({
  onInsert,
  onClose
}: {
  onInsert: (markdown: string) => void;
  onClose: () => void;
}) {
  const [headers, setHeaders] = useState<string[]>(['Film', 'Gross']);
  const [rows, setRows] = useState<string[][]>([
    ['', ''],
    ['', '']
  ]);

  function setHeader(i: number, value: string) {
    setHeaders((h) => h.map((v, idx) => (idx === i ? value : v)));
  }

  function setCell(rowIdx: number, colIdx: number, value: string) {
    setRows((rs) => rs.map((r, idx) => (idx === rowIdx ? r.map((v, ci) => (ci === colIdx ? value : v)) : r)));
  }

  function addColumn() {
    setHeaders((h) => [...h, `Column ${h.length + 1}`]);
    setRows((rs) => rs.map((r) => [...r, '']));
  }

  function removeColumn(i: number) {
    if (headers.length <= 2) return; // a table needs at least 2 columns to mean anything
    setHeaders((h) => h.filter((_, idx) => idx !== i));
    setRows((rs) => rs.map((r) => r.filter((_, idx) => idx !== i)));
  }

  function addRow() {
    setRows((rs) => [...rs, headers.map(() => '')]);
  }

  function removeRow(i: number) {
    if (rows.length <= 1) return;
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  function handleInsert() {
    onInsert(tableToMarkdown(headers, rows));
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative bg-surface border border-border rounded-2xl shadow-card w-full max-w-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-none">
            <h3 className="hdisplay text-base text-text">Insert table</h3>
            <button type="button" onClick={onClose} aria-label="Close" className="text-textFaint hover:text-text transition">
              <X size={18} />
            </button>
          </div>

          <div className="overflow-auto p-5 flex-1">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="p-1 align-bottom">
                      <div className="flex items-center gap-1">
                        <input
                          value={h}
                          onChange={(e) => setHeader(i, e.target.value)}
                          placeholder={`Column ${i + 1}`}
                          className="bg-bg rounded-lg px-3 py-2 text-xs font-semibold w-full min-w-[100px]"
                        />
                        <button
                          type="button"
                          onClick={() => removeColumn(i)}
                          disabled={headers.length <= 2}
                          aria-label="Remove column"
                          className="text-textFaint hover:text-red transition disabled:opacity-20 disabled:pointer-events-none flex-none"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="p-1 w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="p-1">
                        <input
                          value={cell}
                          onChange={(e) => setCell(ri, ci, e.target.value)}
                          placeholder="—"
                          className="bg-bg rounded-lg px-3 py-2 text-xs w-full min-w-[100px]"
                        />
                      </td>
                    ))}
                    <td className="p-1 w-8">
                      <button
                        type="button"
                        onClick={() => removeRow(ri)}
                        disabled={rows.length <= 1}
                        aria-label="Remove row"
                        className="text-textFaint hover:text-red transition disabled:opacity-20 disabled:pointer-events-none"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex gap-3 mt-3">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-goldBright hover:text-gold transition"
              >
                <Plus size={13} /> Row
              </button>
              <button
                type="button"
                onClick={addColumn}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-goldBright hover:text-gold transition"
              >
                <Plus size={13} /> Column
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 px-5 py-4 border-t border-border flex-none">
            <button type="button" onClick={onClose} className="text-xs font-semibold text-textFaint px-4 py-2.5">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsert}
              className="bg-gold text-white font-semibold rounded-lg px-6 py-2.5 text-sm"
            >
              Insert table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
