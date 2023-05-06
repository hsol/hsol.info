import pynecone

from app import components, styles
from app.constants import GlobalStyle
from app.pages import BasePage
from app.pages.index.profile import profile_card
from app.states.base import BaseState


class ScrollState(BaseState):
    def change_hero_height(self):
        print("hero")


class Index(BasePage):
    title = "임한솔 (About HansolLim)"
    route = "/"

    def get_component(self) -> pynecone.Component:
        return pynecone.box(
            components.navbar(),
            components.hero(
                pynecone.container(
                    pynecone.text(
                        "안녕하세요,", font_size=["1em", "1em", "2em"], as_="span"
                    ),
                    pynecone.html("<br/>", display=["inline", "none"]),
                    pynecone.text(
                        "임한솔입니다.", font_size=["1em", "1em", "2em"], as_="span"
                    ),
                    font_size="2em",
                    font_weight="600",
                    text_shadow="0 2px 2px rgba(0, 0, 0, 0.45)",
                    padding="24px 48px",
                ),
                color=GlobalStyle.Palette.BIRCH,
                background_image=f"url(/bg/full_01.jpg)",
                **styles.background_darken(40),
            ),
            profile_card(
                profile_image_path="/profile/바디프로필.jpg",
                items=[
                    ("이름", pynecone.text("임한솔")),
                    ("생일", pynecone.text("1996.05.20")),
                    (
                        "이메일",
                        pynecone.link(
                            pynecone.text("dev.hansollim@gmail.com"),
                            href="mailto:dev.hansollim@gmail.com",
                        ),
                    ),
                    pynecone.box(pynecone.divider(), padding="16px 0", width="100%"),
                    (
                        "Github",
                        pynecone.link(
                            pynecone.text("dev.hansollim@gmail.com"),
                            href="mailto:dev.hansollim@gmail.com",
                            is_external=True,
                        ),
                    ),
                    (
                        "링크드인",
                        pynecone.link(
                            pynecone.text("@devhansollim"),
                            href="https://www.linkedin.com/in/devhansollim/",
                            is_external=True,
                        ),
                    ),
                    (
                        "블로그",
                        pynecone.link(
                            pynecone.text("한솔닷컴"),
                            href="https://hsol.tistory.com",
                            is_external=True,
                        ),
                    ),
                ],
            ),
            on_scroll=ScrollState.change_hero_height,
            min_width="375px",
        )
