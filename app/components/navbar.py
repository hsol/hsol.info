import pynecone

from app.constants import GlobalStyle


def navbar():
    return pynecone.box(
        pynecone.box(
            pynecone.link(
                pynecone.hstack(
                    pynecone.image(src="signature.png", width="1.5em", height="1.5em"),
                    pynecone.text(
                        "임한솔",
                        color=GlobalStyle.Palette.BIRCH,
                        font_size="1.5em",
                        margin_top="-0.08em !important",
                    ),
                    justify_contents="center",
                ),
                href="/",
                _hover=dict(
                    text_decoration="none",
                ),
            ),
            position="fixed",
            width="100%",
            top="0px",
            z_index="5",
            padding="1em",
            background_color=f"{GlobalStyle.Palette.RAISIN}80",
        ),
    )
