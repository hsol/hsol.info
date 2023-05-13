import pynecone
from sqlmodel import Field


class Stack(pynecone.Model, table=True):
    parent_id: int = Field(default=None, foreign_key="stack.id")
    title: str
