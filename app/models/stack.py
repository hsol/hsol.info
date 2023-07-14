import reflex
from sqlmodel import Field, Relationship

from app.models.history_to_stack import PortfolioToStack


class Stack(reflex.Model, table=True):
    parent_id: int = Field(default=None, foreign_key="stack.id")
    title: str

    portfolios: list["Portfolio"] = Relationship(
        back_populates="stacks",
        link_model=PortfolioToStack,
    )
