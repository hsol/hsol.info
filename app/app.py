"""Welcome to Pynecone! This file outlines the steps to create a basic app."""
from app import pages
from app.constants import GlobalStyle
from app.states.base import BaseState
import pynecone


def get_route_pages() -> list[str, type[pages.BasePage]]:
    return {page.route: page for page in pages.__all__}.items()


app = pynecone.App(
    state=BaseState,
    stylesheets=GlobalStyle.STYLE_SHEETS,
    style=GlobalStyle.STYLE,
)
for route, page in get_route_pages():
    instance: pages.BasePage = page()
    app.add_page(
        instance.get_component(),
        **{
            **instance.get_add_page_options(),
            "route": route,
            "on_load": instance.get_on_load_event_handler(),
        },
    )
app.compile()
