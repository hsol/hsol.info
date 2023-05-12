import pynecone


class Stack(pynecone.Model, table=True):
    parent_id: int | None
    title: str
