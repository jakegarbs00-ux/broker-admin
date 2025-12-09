'use client';

import { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const DOCUMENT_BUCKET = 'application-documents';

type Application = {
  id: string;
  company_id: string;
  requested_amount: number;
  loan_type: string;
  urgency: string | null;
  purpose: string | null;
  stage: string;
  created_at: string;
  submitted_at: string | null;
};

type Document = {
  id: string;
  category: string;
  original_filename: string;
  created_at: string;
  storage_path: string;
};

const DOC_CATEGORIES = [
  { value: 'bank_statements', label: '6 months bank statements' },
  { value: 'management_accounts', label: 'Management accounts' },
  { value: 'cashflow_forecasts', label: 'Cashflow forecasts' },
  { value: 'other', label: 'Other' },
];

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const applicationId = params.id;
  const { user, loading } = useRequireAuth();
  const supabase = getSupabaseClient();

  const [app, setApp] = useState<Application | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingApp, setLoadingApp] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [docCategory, setDocCategory] = useState('bank_statements');

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoadError(null);

      // 1) Load the application itself (no joins)
      const { data: appData, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .maybeSingle();

      if (appError) {
        console.error('Error loading application', appError);
        setLoadError(appError.message);
      } else {
        setApp(appData as any);
      }

      // 2) Load documents for this application
      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select('id, category, original_filename, storage_path, created_at')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });

      if (docsError) {
        console.error('Error loading documents', docsError);
      } else if (docsData) {
        setDocuments(docsData as any);
      }

      setLoadingApp(false);
    };

    load();
  }, [user, supabase, applicationId]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(e.target.files);
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFiles || !user || !app) return;

    setUploading(true);
    const uploadedDocs: Document[] = [];

    try {
      for (const file of Array.from(selectedFiles)) {
        const path = `${user.id}/${app.id}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from(DOCUMENT_BUCKET)
          .upload(path, file);

        if (uploadError) {
          console.error('Upload error', uploadError);
          alert('Error uploading ' + file.name + ': ' + uploadError.message);
          continue;
        }

        const { data: docRow, error: insertError } = await supabase
          .from('documents')
          .insert({
            application_id: app.id,
            uploaded_by: user.id,
            category: docCategory,
            storage_path: path,
            original_filename: file.name,
            mime_type: file.type,
          })
          .select('id, category, original_filename, storage_path, created_at')
          .single();

        if (insertError) {
          console.error('Insert error', insertError);
          alert(
            'Error saving document metadata for ' +
              file.name +
              ': ' +
              insertError.message
          );
          continue;
        }

        uploadedDocs.push(docRow as any);
      }

      if (uploadedDocs.length > 0) {
        setDocuments((prev) => [...uploadedDocs, ...prev]);
      }

      setSelectedFiles(null);
      const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitApplication = async () => {
    if (!app) return;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('applications')
      .update({
        stage: 'submitted',
        submitted_at: now,
      })
      .eq('id', app.id);

    if (error) {
      alert('Error submitting application: ' + error.message);
      return;
    }

    setApp({ ...app, stage: 'submitted', submitted_at: now });
    alert('Application submitted!');
  };

  if (loading || loadingApp) return <p>Loading...</p>;
  if (!user) return null;

  if (loadError) {
    return (
      <main className="p-4">
        <h1 className="text-xl font-semibold mb-2">Error loading application</h1>
        <p className="text-red-600 text-sm">{loadError}</p>
      </main>
    );
  }

  if (!app) {
    return (
      <main className="p-4">
        <h1 className="text-xl font-semibold mb-2">Application not found</h1>
        <p className="text-sm text-gray-600">
          We couldn&apos;t find this application. It may belong to another user or have been
          deleted.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            £{app.requested_amount.toLocaleString()}
          </h1>
          <p className="text-sm text-gray-600">
            {app.loan_type} •{' '}
            <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium">
              {app.stage}
            </span>
          </p>
        </div>
        {app.stage === 'created' && (
          <button
            onClick={handleSubmitApplication}
            className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
          >
            Submit application
          </button>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Purpose & urgency</h2>
        <p className="text-gray-700 whitespace-pre-wrap">{app.purpose}</p>
        <p className="text-sm text-gray-600">
          Urgency:{' '}
          <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs">
            {app.urgency}
          </span>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Documents</h2>

        <form onSubmit={handleUpload} className="space-y-3 rounded-md border bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
              >
                {DOC_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Files</label>
              <input
                id="file-input"
                type="file"
                multiple
                onChange={handleFileChange}
                className="mt-1 w-full text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={uploading || !selectedFiles}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload documents'}
          </button>
        </form>

        {documents.length === 0 ? (
          <p className="text-sm text-gray-600">
            No documents uploaded yet. You can add documents at any time.
          </p>
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => {
              const { data } = supabase.storage
                .from(DOCUMENT_BUCKET)
                .getPublicUrl(d.storage_path);

              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-md border bg-white px-4 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{d.original_filename}</p>
                    <p className="text-xs text-gray-500">
                      {d.category} • {new Date(d.created_at).toLocaleString()}
                    </p>
                  </div>
                  <a
                    href={data.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
