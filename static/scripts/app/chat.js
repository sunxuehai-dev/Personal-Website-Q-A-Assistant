import { askQuestion, startChatStream } from "./api.js";
import { sessionId, appState } from "./state.js";
import { appendMessage, createTypewriter, getMessageBody, refreshStatusView, renderAnswerMeta } from "./ui.js";

export async function streamQuestion(question, targetNode) {
    const response = await startChatStream(question, appState.hasUploadedDocs, sessionId);
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalMeta = null;
    const typewriter = createTypewriter(getMessageBody(targetNode));

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) {
                continue;
            }

            const payload = JSON.parse(line.slice(5).trim());
            if (payload.type === "token") {
                typewriter.push(payload.content || "");
            } else if (payload.type === "replace") {
                typewriter.replace(payload.content || "");
            } else if (payload.type === "meta") {
                finalMeta = payload;
            }
        }
    }

    await typewriter.waitForIdle();
    typewriter.setFinalText(typewriter.getText());
    renderAnswerMeta(targetNode, finalMeta);
}

export async function handleChatSubmit(question) {
    appState.isSending = true;
    appState.lastSessionResetAt = null;
    refreshStatusView();

    appendMessage("user", question);
    const assistantNode = appendMessage("assistant", "");

    try {
        await streamQuestion(question, assistantNode);
    } catch (error) {
        try {
            const payload = await askQuestion(question, appState.hasUploadedDocs, sessionId);
            getMessageBody(assistantNode).textContent = payload.answer;
            renderAnswerMeta(assistantNode, payload);
        } catch (fallbackError) {
            getMessageBody(assistantNode).textContent = `请求失败：${fallbackError.message}`;
        }
    } finally {
        appState.isSending = false;
        refreshStatusView();
    }
}
