'use client';

import { useState, useRef, useEffect } from 'react';
import { OnboardingFormData } from '../OnboardingWizard';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useToastContext } from '@/components/ui/ToastProvider';
import { Upload, X, File, Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface DocumentUploadStepProps {
  formData: OnboardingFormData;
  updateFormData: (field: keyof OnboardingFormData, value: any) => void;
  applicationId?: string;
}

interface UploadedDocument {
  id: string;
  category: string;
  original_filename: string;
  storage_path: string;
  mime_type?: string;
}

interface UploadProgress {
  [key: string]: number;
}

const OPTIONAL_CATEGORIES = [
  {
    id: 'filed_accounts',
    label: 'Filed Accounts',
    helper: 'Your most recent accounts filed with Companies House',
  },
  {
    id: 'management_accounts',
    label: 'Management Accounts',
    helper: 'Recent management accounts if available',
  },
  {
    id: 'other',
    label: 'Other Documents',
    helper: 'Any other relevant documents',
  },
];

const ACCEPTED_FILE_TYPES = '.pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentUploadStep({ formData, updateFormData, applicationId }: DocumentUploadStepProps) {
  const { user } = useUserProfile();
  const supabase = getSupabaseClient();
  const toast = useToastContext();
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, UploadedDocument[]>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load existing documents if applicationId exists
  useEffect(() => {
    const loadDocuments = async () => {
      if (!applicationId) return;

      const { data: docs } = await supabase
        .from('documents')
        .select('id, category, original_filename, storage_path, mime_type')
        .eq('application_id', applicationId);

      if (docs) {
        const grouped: Record<string, UploadedDocument[]> = {};
        docs.forEach((doc) => {
          if (!grouped[doc.category]) {
            grouped[doc.category] = [];
          }
          grouped[doc.category].push(doc as UploadedDocument);
        });
        setUploadedDocs(grouped);
      }
    };

    loadDocuments();
  }, [applicationId, supabase]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileSelect = async (category: string, files: FileList | null) => {
    if (!files || files.length === 0 || !user || !applicationId) return;

    const filesArray = Array.from(files);
    
    // Validate file types and sizes
    for (const file of filesArray) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_FILE_TYPES.includes(ext)) {
        toast.error(`File ${file.name} is not a supported format. Accepted: PDF, PNG, JPG, JPEG, DOC, DOCX, XLS, XLSX`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File ${file.name} is too large. Maximum size is 10MB`);
        return;
      }
    }

    setUploading((prev) => ({ ...prev, [category]: true }));

    let successCount = 0;
    for (const file of filesArray) {
      try {
        const fileExt = file.name.split('.').pop();
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const path = `${user.id}/${applicationId}/${category}/${timestamp}_${randomId}.${fileExt}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('application-documents')
          .upload(path, file);

        if (uploadError) {
          toast.error(`Error uploading ${file.name}: ${uploadError.message}`);
          continue;
        }

        // Save document record
        const { data: docData, error: insertError } = await supabase
          .from('documents')
          .insert({
            application_id: applicationId,
            category: category,
            original_filename: file.name,
            storage_path: path,
            mime_type: file.type,
            uploaded_by: user.id,
          })
          .select('id, category, original_filename, storage_path, mime_type')
          .single();

        if (insertError) {
          toast.error(`Error saving document record for ${file.name}`);
          continue;
        }

        if (docData) {
          setUploadedDocs((prev) => ({
            ...prev,
            [category]: [...(prev[category] || []), docData as UploadedDocument],
          }));
          successCount++;
        }
      } catch (err) {
        console.error('Error uploading file:', err);
        toast.error(`Error uploading ${file.name}`);
      }
    }

    setUploading((prev) => ({ ...prev, [category]: false }));
    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? 's' : ''} uploaded successfully`);
    }
  };

  const handleDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    setDragOver(category);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    setDragOver(null);
    handleFileSelect(category, e.dataTransfer.files);
  };

  const handleDelete = async (category: string, docId: string, storagePath: string) => {
    if (!applicationId) return;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('application-documents')
      .remove([storagePath]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (dbError) {
      toast.error('Error deleting document');
      return;
    }

    setUploadedDocs((prev) => ({
      ...prev,
      [category]: (prev[category] || []).filter((doc) => doc.id !== docId),
    }));
    toast.success('Document removed');
  };

  const getBankStatementsCount = () => {
    return uploadedDocs['bank_statements']?.length || 0;
  };

  const bankStatements = uploadedDocs['bank_statements'] || [];
  const isUploadingBankStatements = uploading['bank_statements'];
  const isDragOverBankStatements = dragOver === 'bank_statements';

  return (
    <div className="space-y-6">
      {/* Primary: Bank Statements Section */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Upload your bank statements <span className="text-[var(--color-error)]">*</span>
          </label>
          <p className="text-xs text-slate-500">
            Please upload your last 6 months of business bank statements. PDF format preferred.
          </p>
        </div>

        {/* Large Drag and Drop Zone */}
        <div
          onDragOver={(e) => handleDragOver(e, 'bank_statements')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'bank_statements')}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragOverBankStatements
              ? 'border-[var(--color-accent)] bg-blue-50'
              : bankStatements.length > 0
              ? 'border-green-200 bg-green-50'
              : 'border-slate-300 bg-slate-50'
          }`}
        >
          {bankStatements.length > 0 ? (
            <div className="space-y-3">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
              <p className="text-sm font-medium text-green-900">
                {bankStatements.length} file{bankStatements.length !== 1 ? 's' : ''} uploaded
              </p>
            </div>
          ) : (
            <>
              <Upload className={`w-12 h-12 mx-auto mb-3 ${isDragOverBankStatements ? 'text-[var(--color-accent)]' : 'text-slate-400'}`} />
              <label className="cursor-pointer">
                <input
                  ref={(el) => (fileInputRefs.current['bank_statements'] = el)}
                  type="file"
                  multiple
                  onChange={(e) => handleFileSelect('bank_statements', e.target.files)}
                  className="hidden"
                  accept={ACCEPTED_FILE_TYPES}
                />
                <span className="text-slate-700 font-medium text-base block mb-1">
                  Drag and drop files here or{' '}
                  <span className="text-[var(--color-accent)] hover:underline">click to browse</span>
                </span>
                <p className="text-xs text-slate-500">
                  PDF, PNG, JPG, JPEG, DOC, DOCX, XLS, XLSX (Max 10MB per file)
                </p>
              </label>
            </>
          )}
        </div>

        {/* Upload Progress */}
        {isUploadingBankStatements && (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-blue-50 p-3 rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" />
            <span>Uploading files...</span>
          </div>
        )}

        {/* Uploaded Files List */}
        {bankStatements.length > 0 && (
          <div className="space-y-2 mt-3">
            {bankStatements.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200 shadow-sm"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {doc.original_filename}
                    </p>
                    {doc.mime_type && (
                      <p className="text-xs text-slate-500">
                        {doc.mime_type.split('/')[1]?.toUpperCase()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete('bank_statements', doc.id, doc.storage_path)}
                  className="ml-3 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Validation Message */}
        {bankStatements.length === 0 && !isUploadingBankStatements && (
          <p className="text-sm text-slate-500">
            At least one bank statement file is required to continue.
          </p>
        )}
      </div>

      {/* Optional Documents Section (Collapsed by default) */}
      <div className="border-t border-slate-200 pt-6">
        <button
          type="button"
          onClick={() => setShowOptional(!showOptional)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 rounded-lg transition-colors"
        >
          <div>
            <span className="text-sm font-medium text-slate-700">
              Have other documents ready? <span className="text-slate-500 font-normal">(Optional)</span>
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              You can always upload more documents later
            </p>
          </div>
          {showOptional ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showOptional && (
          <div className="mt-4 space-y-4">
            {OPTIONAL_CATEGORIES.map((category) => {
              const categoryDocs = uploadedDocs[category.id] || [];
              const isUploading = uploading[category.id];
              const isDragOver = dragOver === category.id;

              return (
                <div key={category.id} className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {category.label}
                    </label>
                    <p className="text-xs text-slate-500">{category.helper}</p>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={(e) => handleDragOver(e, category.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, category.id)}
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      isDragOver
                        ? 'border-[var(--color-accent)] bg-blue-50'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragOver ? 'text-[var(--color-accent)]' : 'text-slate-400'}`} />
                    <label className="cursor-pointer">
                      <input
                        ref={(el) => (fileInputRefs.current[category.id] = el)}
                        type="file"
                        multiple
                        onChange={(e) => handleFileSelect(category.id, e.target.files)}
                        className="hidden"
                        accept={ACCEPTED_FILE_TYPES}
                      />
                      <span className="text-slate-700 font-medium text-sm">
                        Drag and drop files here or{' '}
                        <span className="text-[var(--color-accent)] hover:underline">click to browse</span>
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        PDF, PNG, JPG, JPEG, DOC, DOCX, XLS, XLSX (Max 10MB per file)
                      </p>
                    </label>
                  </div>

                  {/* Upload Progress */}
                  {isUploading && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading...</span>
                    </div>
                  )}

                  {/* Uploaded Files List */}
                  {categoryDocs.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {categoryDocs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <File className="w-5 h-5 text-slate-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {doc.original_filename}
                              </p>
                              {doc.mime_type && (
                                <p className="text-xs text-slate-500">
                                  {doc.mime_type.split('/')[1]?.toUpperCase()}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(category.id, doc.id, doc.storage_path)}
                            className="ml-3 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                            title="Remove"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
