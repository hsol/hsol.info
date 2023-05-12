import pynecone

from app import components, styles
from app.components.badge import white_badge
from app.constants import GlobalStyle
from app.models.experience import Education


def EducationCard(educations: list[Education]) -> pynecone.Component:
    educations = list(sorted(educations, key=lambda e: e.when, reverse=True))
    return components.fullfill_card(
        "교육",
        pynecone.vstack(
            *(
                pynecone.hstack(
                    white_badge(education.when.year),
                    pynecone.text(education.title, size=".8em"),
                    padding_bottom=".5em",
                )
                for education in educations
            )
        ),
        background_attachment="fixed",
        background_position="center",
        background_repeat="no-repeat",
        background_size="cover",
        background_image=f"url(/bg/full_03.jpg)",
        **styles.background_darken(40),
        color=GlobalStyle.Palette.WHITE,
    )
