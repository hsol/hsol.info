from functools import partial

import pynecone

from app import components
from app.constants import GlobalStyle
from app.models.profile import Profile, ProfileTag
from app.pages import BasePage
from app.pages.index.components.hero import Hero
from app.pages.index.components.profile import profile_card, ProfileCard
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

    def get_component(self, *args, **kwargs) -> pynecone.Component:
        with pynecone.session() as session:
            profiles = session.query(Profile).all()
            if not profiles:
                return pynecone.box()

            profile_model = profiles[0]
            profile_tags = session.query(ProfileTag).all()

        return pynecone.box(
            components.navbar(),
            Hero(
                profile=profile_model,
                profile_tags=profile_tags,
                hero_min_height=str(IndexState.hero_min_height + "vh"),
            ),
            ProfileCard(profile=profile_model),
            min_width="375px",
            height="100vh",
            overflow_y="scroll",
            on_scroll=IndexState.change_hero_height,
        )
