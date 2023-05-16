from functools import partial

import pynecone
from sqlalchemy.orm import joinedload

from app import components
from app.constants import GlobalStyle
from app.models.history import Experience, Education, Portfolio
from app.models.profile import Profile, ProfileTag
from app.models.stack import Stack
from app.pages import BasePage
from app.pages.index.components.education import EducationCard
from app.pages.index.components.experience import ExperienceCard
from app.pages.index.components.footer import Footer
from app.pages.index.components.hero import Hero
from app.pages.index.components.portpolio import PortfolioCard
from app.pages.index.components.profile import _card, ProfileCard
from app.pages.index.components.stack import StackCard
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

            experiences = session.query(Experience).all()
            stacks = session.query(Stack).all()
            educations = session.query(Education).all()
            portfolios = (
                session.query(Portfolio).options(joinedload(Portfolio.stacks)).all()
            )

        return pynecone.box(
            components.navbar(),
            Hero(
                profile=profile_model,
                profile_tags=profile_tags,
                hero_min_height=str(IndexState.hero_min_height + "vh"),
            ),
            ProfileCard(profile=profile_model),
            ExperienceCard(experiences=experiences),
            StackCard(stacks=stacks),
            EducationCard(educations=educations),
            PortfolioCard(portfolios=portfolios),
            Footer(),
            min_width="375px",
            height="100vh",
            overflow_y="scroll",
            on_scroll=IndexState.change_hero_height,
        )
