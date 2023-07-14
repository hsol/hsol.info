from functools import partial

import reflex

from app import components, styles
from app.components.badge import white_badge
from app.constants import GlobalStyle
from app.models.profile import Profile, ProfileTag


def Hero(
    profile: Profile, profile_tags: list[ProfileTag], hero_min_height: str
) -> reflex.Component:
    return components.hero(
        reflex.container(
            reflex.box(
                reflex.text("안녕하세요,", font_size=["1em", "1.5em", "2em"], as_="span"),
                reflex.html("<br/>", display=["inline", "inline", "none"]),
                reflex.text(
                    profile.name,
                    font_size=["1em", "1.5em", "2em"],
                    as_="span",
                    color=GlobalStyle.Palette.SIGNATURE,
                ),
                reflex.text("입니다.", font_size=["1em", "1.5em", "2em"], as_="span"),
                font_size="2em",
                font_weight="600",
                text_shadow="0 2px 2px rgba(0, 0, 0, 0.45)",
                margin_bottom="0.5em",
            ),
            reflex.box(
                *[
                    white_badge(
                        reflex.text("#" + profile_tag.text.replace(" ", "_")),
                        margin="0 0.3em 0.3em 0",
                    )
                    for profile_tag in profile_tags
                ]
            ),
            padding="24px 48px",
            max_width="none",
        ),
        padding="calc(66px + 10%) 0 10%",
        min_height=hero_min_height,
        transition_duration="0.6s",
        color=GlobalStyle.Palette.BIRCH,
        background_image=f"url(/bg/full_01.jpg)",
        **styles.background_darken(40),
    )
