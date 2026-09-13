from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class AppException(Exception):
    def __init__(self, message: str = "An application error occurred.") -> None:
        super().__init__(message)
        self.message = message


class NotFoundException(AppException):
    def __init__(self, message: str = "Requested resource was not found.") -> None:
        super().__init__(message)


class NotFoundError(AppException):
    def __init__(self, resource: str = "Resource", identifier: Any = None) -> None:
        msg = (
            f"{resource} with id '{identifier}' not found"
            if identifier is not None
            else f"{resource} not found"
        )
        super().__init__(msg)
        self.resource = resource
        self.identifier = identifier


class ConflictError(AppException):
    def __init__(self, message: str = "A conflict occurred.") -> None:
        super().__init__(message)


class BadRequestError(AppException):
    def __init__(self, message: str = "Bad request.") -> None:
        super().__init__(message)


class AuthorizationError(AppException):
    def __init__(self, message: str = "Access denied.") -> None:
        super().__init__(message)


class ServiceUnavailableError(AppException):
    def __init__(self, message: str = "Service unavailable.") -> None:
        super().__init__(message)


class DatabaseException(AppException):
    def __init__(self, message: str = "A database operation failed.") -> None:
        super().__init__(message)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotFoundException)
    async def not_found_exception_handler(
        request: Request, exc: NotFoundException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "detail": exc.message,
                "error": {
                    "code": "NOT_FOUND",
                    "message": exc.message,
                },
            },
        )

    @app.exception_handler(NotFoundError)
    async def not_found_error_handler(
        request: Request, exc: NotFoundError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={
                "detail": exc.message,
                "error": {
                    "code": "NOT_FOUND",
                    "message": exc.message,
                },
            },
        )

    @app.exception_handler(ConflictError)
    async def conflict_error_handler(
        request: Request, exc: ConflictError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": exc.message,
                "error": {
                    "code": "CONFLICT",
                    "message": exc.message,
                },
            },
        )

    @app.exception_handler(BadRequestError)
    async def bad_request_error_handler(
        request: Request, exc: BadRequestError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "detail": exc.message,
                "error": {
                    "code": "BAD_REQUEST",
                    "message": exc.message,
                },
            },
        )

    @app.exception_handler(AuthorizationError)
    async def authorization_error_handler(
        request: Request, exc: AuthorizationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "detail": exc.message,
                "error": {
                    "code": "FORBIDDEN",
                    "message": exc.message,
                },
            },
        )

    @app.exception_handler(ServiceUnavailableError)
    async def service_unavailable_error_handler(
        request: Request, exc: ServiceUnavailableError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": exc.message,
                "error": {
                    "code": "SERVICE_UNAVAILABLE",
                    "message": exc.message,
                },
            },
        )

    @app.exception_handler(DatabaseException)
    async def database_exception_handler(
        request: Request, exc: DatabaseException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "A database error occurred. Please try again later.",
                "error": {
                    "code": "DATABASE_ERROR",
                    "message": "A database error occurred. Please try again later.",
                },
            },
        )

    @app.exception_handler(AppException)
    async def app_exception_handler(
        request: Request, exc: AppException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "detail": exc.message,
                "error": {
                    "code": "APPLICATION_ERROR",
                    "message": exc.message,
                },
            },
        )

