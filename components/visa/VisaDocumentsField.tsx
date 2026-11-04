"use client";

import { useRef, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  ALLOWED_DOCUMENT_TYPES,
  VISA_DOCUMENTS_BUCKET,
  MAX_DOCUMENT_SIZE_BYTES,
} from "@/lib/storage";
import type { VisaDocument } from "@/lib/visa-types";
import type { VisaType } from "@/lib/visa-constants";
import { CloseIcon, FileIcon, UploadIcon } from "../Icons";
import { useLanguage } from "../LanguageProvider";

interface VisaDocumentsFieldProps {
  value: VisaDocument[];
  onChange: (documents: VisaDocument[]) => void;
  visaType: VisaType;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function VisaDocumentsField({
  value,
  onChange,
  visaType,
}: VisaDocumentsFieldProps) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    if (!isSupabaseConfigured()) {
      setError(t("step.documents.error.config"));
      return;
    }

    const files = Array.from(fileList);

    for (const file of files) {
      if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
        setError(t("step.documents.error.type", { name: file.name }));
        continue;
      }
      if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
        setError(t("step.documents.error.size", { name: file.name }));
        continue;
      }

      setUploading(true);
      try {
        const supabase = getSupabaseClient();
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(VISA_DOCUMENTS_BUCKET)
          .upload(path, file, { upsert: false });

        if (uploadError) {
          setError(
            t("step.documents.error.upload", {
              name: file.name,
              error: uploadError.message,
            })
          );
          continue;
        }

        const { data: publicUrlData } = supabase.storage
          .from(VISA_DOCUMENTS_BUCKET)
          .getPublicUrl(path);

        onChange([
          ...value,
          {
            name: file.name,
            path,
            url: publicUrlData.publicUrl,
            size: file.size,
          },
        ]);
      } catch (err) {
        setError(
          t("step.documents.error.upload", {
            name: file.name,
            error: err instanceof Error ? err.message : "",
          })
        );
      } finally {
        setUploading(false);
      }
    }
  }

  async function handleRemove(doc: VisaDocument) {
    setError(null);
    onChange(value.filter((d) => d.path !== doc.path));

    if (!isSupabaseConfigured()) return;
    try {
      const supabase = getSupabaseClient();
      await supabase.storage.from(VISA_DOCUMENTS_BUCKET).remove([doc.path]);
    } catch (err) {
      console.error("Impossible de supprimer le document dans Storage:", err);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
          {t("visa.step.documents.checklist.title")}
        </p>
        <p className="mt-1.5 text-sm text-neutral-700">
          {t(`visa.step.documents.checklist.${visaType}`)}
        </p>
        <p className="mt-1.5 text-xs text-neutral-500">
          {t("visa.step.documents.checklist.note")}
        </p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center transition hover:border-[#7a9a5a] disabled:opacity-60"
      >
        <UploadIcon className="h-5 w-5 text-[#7a9a5a]" />
        <span className="text-sm font-semibold text-neutral-900">
          {uploading
            ? t("step.documents.dropzone.uploading")
            : t("step.documents.dropzone.idle")}
        </span>
        <span className="text-xs text-neutral-400">
          {t("step.documents.dropzone.hint")}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />

      {error && <p className="text-sm text-red-500">{error}</p>}

      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((doc) => (
            <div
              key={doc.path}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5"
            >
              <FileIcon className="h-4 w-4 flex-shrink-0 text-neutral-400" />
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-neutral-800 hover:text-[#4a5f34]"
              >
                {doc.name}
              </a>
              <span className="flex-shrink-0 text-xs text-neutral-400">
                {formatSize(doc.size)}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(doc)}
                aria-label={t("step.documents.remove.aria", {
                  name: doc.name,
                })}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-red-500 transition hover:bg-red-50"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
