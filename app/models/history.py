import json
from datetime import date
from functools import partial

import reflex
from sqlmodel import Field, Relationship

from app.models.history_to_stack import PortfolioToStack


class Experience(reflex.Model, table=True):
    when: date
    title: str
    category: str | None


class Education(reflex.Model, table=True):
    when: date
    title: str


class Portfolio(reflex.Model, table=True):
    when: date
    title: str
    sub_title: str
    description: str

    stacks: list["Stack"] = Relationship(
        back_populates="portfolios",
        link_model=PortfolioToStack,
    )

    def json(self) -> str:
        """Convert the object to a json string.

        Returns:
            The object as a json string.
        """
        return json.dumps(self.dict(), default=str)
