import reflex


class Profile(reflex.Model, table=True):
    name: str
    birthday: str
    email: str
    github: str
    linkedin: str
    blog: str


class ProfileTag(reflex.Model, table=True):
    text: str
