import pynecone

from app import components, styles
from app.constants import GlobalStyle


def _card():
    return components.fullfill_card(
        "교육",
        pynecone.box(),
        background_attachment="fixed",
        background_position="center",
        background_repeat="no-repeat",
        background_size="cover",
        background_image=f"url(/bg/full_03.jpg)",
        **styles.background_darken(40),
        color=GlobalStyle.Palette.WHITE,
    )


def EducationCard() -> pynecone.Component:
    return _card()
