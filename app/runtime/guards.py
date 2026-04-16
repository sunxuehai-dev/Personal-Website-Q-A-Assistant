from __future__ import annotations

from contextlib import contextmanager
from threading import Lock, Semaphore


class BusyError(RuntimeError):
    """Raised when a protected runtime slot cannot be acquired."""


class UploadGuard:
    def __init__(self):
        self._lock = Lock()
        self._is_busy = False

    @contextmanager
    def acquire(self):
        acquired = self._lock.acquire(blocking=False)
        if not acquired:
            raise BusyError("Another upload ingestion is already in progress.")
        self._is_busy = True
        try:
            yield
        finally:
            self._is_busy = False
            self._lock.release()

    def snapshot(self) -> dict:
        return {
            "busy": self._is_busy,
        }


class ChatConcurrencyGuard:
    def __init__(self, max_concurrent: int = 2):
        self._semaphore = Semaphore(max_concurrent)
        self._lock = Lock()
        self._max_concurrent = max_concurrent
        self._active = 0

    @contextmanager
    def acquire(self):
        acquired = self._semaphore.acquire(blocking=False)
        if not acquired:
            raise BusyError("Chat capacity is temporarily full. Please retry shortly.")
        with self._lock:
            self._active += 1
        try:
            yield
        finally:
            with self._lock:
                self._active -= 1
            self._semaphore.release()

    def snapshot(self) -> dict:
        with self._lock:
            active = self._active
        return {
            "active": active,
            "max_concurrent": self._max_concurrent,
            "available": max(self._max_concurrent - active, 0),
            "busy": active >= self._max_concurrent,
        }


upload_guard = UploadGuard()
chat_guard = ChatConcurrencyGuard(max_concurrent=2)
