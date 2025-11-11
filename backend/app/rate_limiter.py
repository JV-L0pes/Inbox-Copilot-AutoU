from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from typing import Deque, Dict

from fastapi import Depends, HTTPException, Request, status

from .config import Settings, get_settings


class InMemoryRateLimiter:
    def __init__(self, limit: int, window: timedelta) -> None:
        self.limit = limit
        self.window = window
        self._entries: Dict[str, Deque[datetime]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def assert_within_limit(self, identity: str) -> None:
        if self.limit <= 0:
            return

        async with self._lock:
            now = datetime.now(UTC)
            window_start = now - self.window
            timestamps = self._entries[identity]

            while timestamps and timestamps[0] <= window_start:
                timestamps.popleft()

            if len(timestamps) >= self.limit:
                retry_after = (self.window - (now - timestamps[0])).total_seconds()
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Limite temporário de requisições excedido. Aguarde alguns instantes e tente novamente.",
                    headers={"Retry-After": f"{int(retry_after) + 1}"},
                )

            timestamps.append(now)


_limiter: InMemoryRateLimiter | None = None


def get_rate_limiter(settings: Settings = Depends(get_settings)) -> InMemoryRateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = InMemoryRateLimiter(
            limit=settings.rate_limit_requests,
            window=timedelta(seconds=settings.rate_limit_window_seconds),
        )
    return _limiter


async def rate_limit(request: Request, limiter: InMemoryRateLimiter = Depends(get_rate_limiter)) -> None:
    client = request.client.host if request.client else "anonymous"
    await limiter.assert_within_limit(client)

