"""Welcome to Pynecone! This file outlines the steps to create a basic app."""
import pynecone

from app import pages
from app.constants import GlobalStyle
from app.pages import BasePage
from app.states.base import BaseState

default_title = "임한솔 (About HansolLim)"
default_description = "#매_순간_스스로_발전하는_사람, #언어_가리지_않는_유연한_개발자, #사용자를_먼저_생각하는_메이커"
default_meta_list = [
    {"name": "msapplication-TileColor", "content": "#FFFFFF"},
    {
        "name": "msapplication-TileImage",
        "content": "/meta/ms-icon-144x144.png",
    },
    {"property": "og:title", "content": default_title},
    {"property": "og:type", "content": "article"},
    {"property": "og:url", "content": "https://hsol.info"},
    {
        "property": "og:description",
        "content": default_description,
    },
    {"property": "og:image", "content": "/meta/ms-icon-310x310.png"},
    {"property": "og:image:width", "content": "310"},
    {"property": "og:image:height", "content": "310"},
]

app = pynecone.App(
    state=BaseState,
    stylesheets=GlobalStyle.STYLE_SHEETS,
    style=GlobalStyle.STYLE,
)
for page in pages.__all__:  # type: type[BasePage]
    instance = page()
    page_options = instance.get_add_page_options()

    app.add_page(
        instance.get_component(),
        **{
            "route": page.route,
            "title": page.title or default_title,
            "description": page.description or default_description,
            "meta": default_meta_list,
            "on_load": instance.get_on_load_event_handler(),
            **instance.get_add_page_options(),
        },
    )
app.compile()
