from functools import partial

import pynecone

from app import components, styles
from app.constants import GlobalStyle
from app.models.profile import Profile, ProfileTag

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


def Hero(
    profile: Profile, profile_tags: list[ProfileTag], hero_min_height: str
) -> pynecone.Component:
    return components.hero(
        pynecone.container(
            pynecone.box(
                pynecone.text("안녕하세요,", font_size=["1em", "2em"], as_="span"),
                pynecone.html("<br/>", display=["inline", "inline", "none"]),
                pynecone.text(
                    profile.name,
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
                    hero_badge_comp(
                        pynecone.text("#" + profile_tag.text.replace(" ", "_"))
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
