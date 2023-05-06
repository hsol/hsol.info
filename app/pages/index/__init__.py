from functools import partial

import pynecone

from app import components, styles
from app.constants import GlobalStyle
from app.pages import BasePage
from app.pages.index.profile import profile_card
from app.states.base import BaseState


hero_badge_comp = partial(
    pynecone.box,
    align_items="center",
    background_color=GlobalStyle.Palette.BIRCH,
    border_radius="4px",
    color=GlobalStyle.Palette.FONT_COLOR,
    display="inline-flex",
    font_size="0.75rem",
    height="2em",
    justify_content="center",
    line_height="1.5",
    padding="0 0.75em",
    white_space="nowrap",
    margin="0 0.3em 0.3em 0",
    opacity="0.98",
)


class IndexState(BaseState):
    hero_min_height = 100

    def change_hero_height(self):
        self.hero_min_height = 30


class Index(BasePage):
    title = "임한솔 (About HansolLim)"
    route = "/"

    def get_component(self) -> pynecone.Component:
        return pynecone.box(
            components.navbar(),
            components.hero(
                pynecone.container(
                    pynecone.box(
                        pynecone.text("안녕하세요,", font_size=["1em", "2em"], as_="span"),
                        pynecone.html("<br/>", display=["inline", "inline", "none"]),
                        pynecone.text(
                            "임한솔",
                            font_size=["1em", "2em"],
                            as_="span",
                            color=GlobalStyle.Palette.SIGNATURE,
                        ),
                        pynecone.text("입니다.", font_size=["1em", "2em"], as_="span"),
                        font_size="2em",
                        font_weight="600",
                        text_shadow="0 2px 2px rgba(0, 0, 0, 0.45)",
                        margin_bottom="0.5em",
                    ),
                    pynecone.box(
                        *[
                            hero_badge_comp(pynecone.text(t))
                            for t in [
                                "#매_순간_스스로_발전하는_사람",
                                "#언어_가리지_않는_유연한_개발자",
                                "#사용자를_먼저_생각하는_메이커",
                            ]
                        ]
                    ),
                    padding="24px 48px",
                    max_width="none",
                ),
                padding="calc(66px + 10%) 0 10%",
                min_height=IndexState.hero_min_height + "vh",
                transition_duration="0.6s",
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
            min_width="375px",
            height="100vh",
            overflow_y="scroll",
            on_scroll=IndexState.change_hero_height,
        )
