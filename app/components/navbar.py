import pynecone

from app.constants import GlobalStyle


def _navbar_content(phantom: bool = False):
    return pynecone.box(
        pynecone.link(
            pynecone.hstack(
                pynecone.image(src="signature.png", width="1.5em", height="1.5em"),
                pynecone.text(
                    "임한솔",
                    color=GlobalStyle.Palette.BIRCH,
                    font_size="1.5em",
                    margin_top="0.08em !important",
                ),
                justify_contents="center",
            ),
            href="/",
            _hover=dict(
                text_decoration="none",
            ),
        ),
        position="fixed" if not phantom else "relative",
        visibility="hidden" if phantom else "visible",
        width="100%",
        top="0px",
        z_index="5",
        padding="1em",
        background_color=f"{GlobalStyle.Palette.RAISIN}80",
    )


def navbar(overlap: bool = True):
    return pynecone.box(
        _navbar_content(),
        pynecone.cond(
            not overlap,
            _navbar_content(phantom=True),
        ),
    )
