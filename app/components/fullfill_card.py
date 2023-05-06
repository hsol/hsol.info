import pynecone

from app.constants import GlobalStyle


def fullfill_card(*components, title: str = None):
    components = list(components)
    if isinstance(components[0], str):
        title = components.pop(0)

    if title is None:
        raise NotImplementedError

    return pynecone.box(
        pynecone.vstack(
            pynecone.box(
                pynecone.heading(title, margin_bottom="8px", size="lg"),
                pynecone.vstack(
                    pynecone.divider(
                        border_color=GlobalStyle.Palette.SIGNATURE,
                        margin_bottom="4px",
                        border_bottom_width="3px",
                    ),
                    pynecone.divider(
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
        background_image="url(/bg/white_pattern.jpg)",
        background_blend_mode="soft-light",
        background_color=GlobalStyle.Palette.WHITE + "90",
        background_position="center",
        background_repeat="no-repeat",
        background_size="cover",
    )
