from datetime import date

import pynecone
from sqlmodel import Field


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


class PortfolioToStack(pynecone.Model, table=True):
    portfolio_id: int = Field(foreign_key="portfolio.id")
    stack_id: int = Field(foreign_key="stack.id")
