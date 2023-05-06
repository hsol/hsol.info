"""Welcome to Pynecone! This file outlines the steps to create a basic app."""
from app import pages
from app.constants import GlobalStyle
from app.states.base import BaseState
import pynecone


default_title = "임한솔 (About HansolLim)"
app = pynecone.App(
    state=BaseState,
    stylesheets=GlobalStyle.STYLE_SHEETS,
    style=GlobalStyle.STYLE,
)
for page in pages.__all__:
    instance: pages.BasePage = page()
    app.add_page(
        instance.get_component(),
        **{
            **instance.get_add_page_options(),
            "title": page.title or default_title,
            "route": page.route,
            "on_load": instance.get_on_load_event_handler(),
        },
    )
app.compile()
