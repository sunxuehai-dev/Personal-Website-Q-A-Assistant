export type SiteProfile = {
  name: string;
  title: string;
  tagline: string;
  location: string;
  email: string;
  phone: string;
};

export type ExperienceItem = {
  period: string;
  company: string;
  role: string;
  summary: string;
};

export type ProjectItem = {
  name: string;
  stack: string;
  description: string;
};

export type SiteContent = {
  profile: SiteProfile;
  experience: ExperienceItem[];
  projects: ProjectItem[];
  skills: string[];
};

export type ChatReference = {
  source_kind: string;
  source_file: string | null;
  page: string | number | null;
  content: string;
  doc_type: string | null;
  retrieval_method: string;
  score: number;
};

export type ChatResponse = {
  answer: string;
  references: ChatReference[];
  source_badge: string;
  used_local_context: boolean;
  used_web_search: boolean;
  retried: boolean;
};

export type UploadStatus = {
  has_uploaded_docs: boolean;
  file_count: number;
  files: string[];
  active_file: string | null;
};

export type RuntimeStatus = {
  chat: {
    active: number;
    max_concurrent: number;
    available: number;
    busy: boolean;
  };
  upload: {
    busy: boolean;
  };
};

export type ApiErrorPayload = {
  detail?: string;
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
    status_code?: number;
  };
};
