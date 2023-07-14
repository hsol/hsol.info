import typing

import reflex


class BasePage:
    title: str | None = None
    description: str | None = None
    route: str | None = None

    state: typing.Type[reflex.State]

    def __init__(self, *args, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def get_component(self, *args, **kwargs) -> reflex.Component:
        raise NotImplementedError

    def get_add_page_options(self) -> dict:
        return {}

    def get_on_load_event_handler(self) -> typing.Callable[[], None] | None:
        return None
