import operator
from itertools import groupby

import reflex

from app import components, styles
from app.constants import GlobalStyle
from app.models.history import Experience


def ExperienceCard(experiences: list[Experience]) -> reflex.Component:
    experience_groups = groupby(
        sorted(experiences, key=lambda ex: ex.when, reverse=True),
        key=lambda ex: ex.when.year,
    )

    return components.fullfill_card(
        "경험",
        reflex.vstack(
            *[
                reflex.vstack(
                    reflex.heading(str(when), size="lg"),
                    reflex.vstack(
                        *[
                            reflex.text(ex.title, text_align="center")
                            for ex in list(exs)
                        ]
                    ),
                    padding="16px",
                )
                for when, exs in experience_groups
            ]
        ),
        background_image=f"url(/bg/full_02.jpg)",
        **styles.background_darken(40),
        **styles.background_cover(),
        color=GlobalStyle.Palette.WHITE,
    )
