import reflex
from sqlmodel import Field


class PortfolioToStack(reflex.Model, table=True):
    portfolio_id: int = Field(foreign_key="portfolio.id", primary_key=True)
    stack_id: int = Field(foreign_key="stack.id", primary_key=True)
