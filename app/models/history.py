import json
from datetime import date
from functools import partial

import pynecone
from sqlmodel import Field, Relationship

from app.models.history_to_stack import PortfolioToStack


class Experience(pynecone.Model, table=True):
    when: date
    title: str
    category: str | None


class Education(pynecone.Model, table=True):
    when: date
    title: str


class Portfolio(pynecone.Model, table=True):
    when: date
    title: str
    sub_title: str
    description: str

    stacks: list["Stack"] = Relationship(
        back_populates="portfolios",
        link_model=PortfolioToStack,
    )

    class Config:
        json_dumps = partial(json.dumps, default=str)
