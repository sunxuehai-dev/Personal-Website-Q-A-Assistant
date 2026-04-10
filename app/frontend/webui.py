from __future__ import annotations

from pathlib import Path

import gradio as gr
import requests

from app.core.config import Settings


UPLOAD_EMPTY_MESSAGE = "请先选择 PDF 简历文件。"
UPLOAD_TYPE_MESSAGE = "当前只支持 PDF 简历。"
UPLOAD_SUCCESS_TEMPLATE = (
    "已完成灌库：{file_name}\n"
    "切分块数：{chunk_count}\n"
    "Collection：{collection_name}"
)
QUESTION_EMPTY_MESSAGE = "请输入问题。"
NO_RESUME_MESSAGE = "当前还没有简历，请先上传并灌库。"
TITLE_TEXT = "# Resume Assistant"
DESCRIPTION_TEXT = "上传你的 PDF 简历，构建知识库后进行问答。"
FILE_LABEL = "上传 PDF 简历"
UPLOAD_BUTTON_TEXT = "灌库"
UPLOAD_STATUS_LABEL = "灌库结果"
QUESTION_LABEL = "提问"
QUESTION_PLACEHOLDER = "例如：请介绍孙雪海的工作经历"
ASK_BUTTON_TEXT = "提问"
ANSWER_LABEL = "回答"
REFERENCES_LABEL = "检索片段"
REFERENCE_TEMPLATE = "[{index}] 文件: {source_file} | 页码: {page}\n{content}"
API_UNAVAILABLE_TEMPLATE = "后端 API 调用失败：{message}"


def _request_json(method: str, path: str, **kwargs) -> dict:
    url = f"{Settings.API_BASE_URL.rstrip('/')}{path}"
    response = requests.request(method=method, url=url, timeout=180, **kwargs)
    response.raise_for_status()
    return response.json()


def upload_resume(file_obj) -> str:
    if file_obj is None:
        return UPLOAD_EMPTY_MESSAGE

    source_path = Path(file_obj)
    if source_path.suffix.lower() != ".pdf":
        return UPLOAD_TYPE_MESSAGE

    try:
        with source_path.open("rb") as file_handle:
            result = _request_json(
                "POST",
                "/upload_resume",
                files={"file": (source_path.name, file_handle, "application/pdf")},
            )
    except requests.RequestException as exc:
        return API_UNAVAILABLE_TEMPLATE.format(message=str(exc))
    return UPLOAD_SUCCESS_TEMPLATE.format(**result)


def answer_question(question: str) -> tuple[str, str]:
    if not question or not question.strip():
        return "", QUESTION_EMPTY_MESSAGE

    try:
        response = _request_json("POST", "/chat", json={"question": question.strip()})
    except requests.HTTPError as exc:
        try:
            detail = exc.response.json().get("detail", str(exc))
        except ValueError:
            detail = str(exc)
        if "No self resume has been ingested yet." in detail:
            return "", NO_RESUME_MESSAGE
        return "", API_UNAVAILABLE_TEMPLATE.format(message=detail)
    except requests.RequestException as exc:
        return "", API_UNAVAILABLE_TEMPLATE.format(message=str(exc))

    references: list[str] = []
    for index, item in enumerate(response.get("references", []), start=1):
        references.append(
            REFERENCE_TEMPLATE.format(
                index=index,
                source_file=item.get("source_file"),
                page=item.get("page"),
                content=item.get("content"),
            )
        )
    return response.get("answer", ""), "\n\n".join(references)


def build_demo() -> gr.Blocks:
    with gr.Blocks(title="Resume Assistant") as demo:
        gr.Markdown(TITLE_TEXT)
        gr.Markdown(DESCRIPTION_TEXT)
        gr.Markdown(f"API Base URL: `{Settings.API_BASE_URL}`")

        with gr.Row():
            resume_file = gr.File(label=FILE_LABEL, file_types=[".pdf"], type="filepath")
            upload_button = gr.Button(UPLOAD_BUTTON_TEXT)

        upload_status = gr.Textbox(label=UPLOAD_STATUS_LABEL, lines=4)

        question = gr.Textbox(label=QUESTION_LABEL, placeholder=QUESTION_PLACEHOLDER)
        ask_button = gr.Button(ASK_BUTTON_TEXT)

        answer = gr.Textbox(label=ANSWER_LABEL, lines=10)
        references = gr.Textbox(label=REFERENCES_LABEL, lines=12)

        upload_button.click(upload_resume, inputs=[resume_file], outputs=[upload_status])
        ask_button.click(answer_question, inputs=[question], outputs=[answer, references])

    return demo


demo = build_demo()


if __name__ == "__main__":
    demo.launch(server_name=Settings.HOST, server_port=7864)
