import pynecone


class Profile(pynecone.Model, table=True):
    name: str
    birthday: str
    email: str
    github: str
    linkedin: str
    blog: str


class ProfileTag(pynecone.Model, table=True):
    text: str
