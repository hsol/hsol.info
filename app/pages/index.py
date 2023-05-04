import pynecone

from app import components, styles
from app.constants import GlobalStyle
from app.pages import BasePage


class Index(BasePage):
    route = "/"

    def get_component(self) -> pynecone.Component:
        return pynecone.box(
            components.navbar(),
            components.hero(
                pynecone.container(
                    pynecone.heading("안녕하세요, 임한솔입니다.", font_size="2em"),
                    font_size="2em",
                    font_weight="600",
                    text_shadow="0 2px 2px rgba(0, 0, 0, 0.45)",
                ),
                color=GlobalStyle.Palette.BIRCH,
                **styles.background_image("full_01.jpg"),
                **styles.background_darken(40),
            ),
        )
