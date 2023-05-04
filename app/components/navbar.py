import pynecone

from app.constants import GlobalStyle


def navbar():
    return pynecone.box(
        pynecone.box(
            pynecone.image(src="favicon.ico", width="1.5em", height="1.5em"),
            width="100%",
            padding="1em",
            visible="hidden",
        ),
        pynecone.box(
            pynecone.link(
                pynecone.hstack(
                    pynecone.image(src="signature.png", width="1.5em", height="1.5em"),
                    pynecone.text(
                        "임한솔", color=GlobalStyle.Palette.BIRCH, padding_top="0.1em"
                    ),
                ),
                href="/",
            ),
            position="fixed",
            width="100%",
            top="0px",
            z_index="5",
            padding="1em",
            background_color=GlobalStyle.Palette.RAISIN,
        ),
    )
