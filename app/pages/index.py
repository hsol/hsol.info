import pynecone

from app.pages import BasePage
from pcconfig import config

docs_url = "https://pynecone.io/docs/getting-started/introduction"
filename = f"{config.app_name}/{config.app_name}.py"


class Index(BasePage):
    route = "/"

    def get_component(self) -> pynecone.Component:
        return pynecone.center(
            pynecone.vstack(
                pynecone.heading("Welcome to Pynecone!", font_size="2em"),
                pynecone.box(
                    "Get started by editing ", pynecone.code(filename, font_size="1em")
                ),
                pynecone.link(
                    "Check out our docs!",
                    href=docs_url,
                    border="0.1em solid",
                    padding="0.5em",
                    border_radius="0.5em",
                    _hover={
                        "color": "rgb(107,99,246)",
                    },
                ),
                spacing="1.5em",
                font_size="2em",
            ),
            padding_top="10%",
        )
