import reflex

from app import components, styles
from app.components.badge import white_badge
from app.constants import GlobalStyle
from app.models.history import Education


def EducationCard(educations: list[Education]) -> reflex.Component:
    educations = list(sorted(educations, key=lambda e: e.when, reverse=True))
    return components.fullfill_card(
        "교육",
        reflex.vstack(
            *(
                reflex.hstack(
                    white_badge(education.when.year),
                    reflex.text(education.title, size=".8em"),
                    padding_bottom=".5em",
                )
                for education in educations
            )
        ),
        background_image=f"url(/bg/full_03.jpg)",
        **styles.background_darken(40),
        **styles.background_cover(),
        color=GlobalStyle.Palette.WHITE,
    )
