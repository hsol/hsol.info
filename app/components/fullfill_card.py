import reflex

from app.constants import GlobalStyle
from app.styles import background_cover, background_white_pattern


def fullfill_card(*components, title: str = None, **kwargs):
    components = list(components)
    if isinstance(components[0], str):
        title = components.pop(0)

    if title is None:
        raise NotImplementedError

    if (
        "background_image" not in kwargs
        and "background_color" not in kwargs
        and "background" not in kwargs
    ):
        kwargs.update(
            **background_white_pattern(),
            **background_cover(),
        )

    return reflex.box(
        reflex.vstack(
            reflex.box(
                reflex.heading(title, margin_bottom="8px", size="lg"),
                reflex.vstack(
                    reflex.divider(
                        border_color=GlobalStyle.Palette.SIGNATURE,
                        margin_bottom="4px",
                        border_bottom_width="3px",
                    ),
                    reflex.divider(
                        border_color=GlobalStyle.Palette.SIGNATURE,
                        width="60%",
                        border_bottom_width="2px",
                    ),
                    justify_contents="center",
                ),
                margin_bottom="32px",
            ),
            *components,
            padding="48px 24px",
        ),
        **kwargs,
    )
