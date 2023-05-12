from datetime import date

import pynecone


class Experience(pynecone.Model, table=True):
    when: date
    title: str
