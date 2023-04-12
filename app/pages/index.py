import pynecone

from app import components
from app.pages import BasePage
from pcconfig import config

docs_url = "https://pynecone.io/docs/getting-started/introduction"
filename = f"{config.app_name}/{config.app_name}.py"


class Index(BasePage):
    route = "/"

    def get_component(self) -> pynecone.Component:
        return pynecone.box(
            components.navbar(),
            components.hero(
                pynecone.container(
                    pynecone.heading("안녕하세요, 임한솔입니다.", font_size="2em"),
                    font_size="2em",
                ),
                background_image="url(/bg/full_01.jpg)",
            ),
        )
