from typing import Any

from fastapi import HTTPException


def api_error(status_code: int, code: str, **params: Any) -> HTTPException:
    """Raise HTTPException with a stable machine-readable error code for i18n on the client."""
    detail: dict[str, Any] = {"code": code}
    if params:
        detail["params"] = {k: str(v) for k, v in params.items()}
    return HTTPException(status_code=status_code, detail=detail)
