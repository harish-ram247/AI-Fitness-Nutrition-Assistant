from sqlalchemy.ext.asyncio import AsyncSession


class BaseRepository:
    """Base repository establishing database session injection and architecture boundary

    for domain-specific repositories. Subclasses encapsulate database access logic.
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
