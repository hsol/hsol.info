import operator
from itertools import groupby

import pynecone

from app import components, styles
from app.constants import GlobalStyle
from app.models.history import Experience


def ExperienceCard(experiences: list[Experience]) -> pynecone.Component:
    experience_groups = groupby(
        sorted(experiences, key=lambda ex: ex.when, reverse=True),
        key=lambda ex: ex.when.year,
    )

    return components.fullfill_card(
        "경험",
        pynecone.vstack(
            *[
                pynecone.vstack(
                    pynecone.heading(str(when), size="lg"),
                    pynecone.vstack(*[pynecone.text(ex.title) for ex in list(exs)]),
                    padding="16px",
                )
                for when, exs in experience_groups
            ]
        ),
        background_attachment="fixed",
        background_position="center",
        background_repeat="no-repeat",
        background_size="cover",
        background_image=f"url(/bg/full_02.jpg)",
        **styles.background_darken(40),
        color=GlobalStyle.Palette.WHITE,
    )
