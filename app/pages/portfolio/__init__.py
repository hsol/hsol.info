import pynecone

from app import components
from app.constants import GlobalStyle
from app.pages import BasePage
from app.styles import background_darken, background_cover


class PortfolioPage(BasePage):
    title = "포트폴리오 (About HansolLim)"
    route = "/portfolio"

    def get_component(self, *args, **kwargs) -> pynecone.Component:
        return components.page_container(
            components.navbar(overlap=False),
            pynecone.box(
                pynecone.heading("포트폴리오", size="lg", color=GlobalStyle.Palette.WHITE),
                pynecone.hstack(
                    pynecone.vstack(),
                    pynecone.box(),
                ),
                padding=["1em 8px", "3em 1em", "5em 2em"],
            ),
            background_image="url(/bg/full_03.jpg)",
            **background_darken(10),
            **background_cover(),
        )
