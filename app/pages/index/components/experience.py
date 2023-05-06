import pynecone

from app import components, styles
from app.constants import GlobalStyle


def _card():
    return components.fullfill_card(
        "경험",
        pynecone.box(),
        background_attachment="fixed",
        background_position="center",
        background_repeat="no-repeat",
        background_size="cover",
        background_image=f"url(/bg/full_02.jpg)",
        **styles.background_darken(40),
        color=GlobalStyle.Palette.WHITE,
    )


def ExperienceCard() -> pynecone.Component:
    return _card()
