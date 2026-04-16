function getOrCreateSessionId() {
    const storageKey = "resume_assistant_session_id";
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
        return existing;
    }

    const generated = window.crypto?.randomUUID?.() || `session-${Date.now()}`;
    window.localStorage.setItem(storageKey, generated);
    return generated;
}

export const sessionId = getOrCreateSessionId();

export const appState = {
    hasUploadedDocs: false,
    activeUploadFile: null,
    runtimeChat: null,
    runtimeUpload: null,
    isSending: false,
    isUploading: false,
    lastSessionResetAt: null,
};
