import pynecone

from app.constants import GlobalStyle


def navbar():
    return pynecone.box(
        pynecone.box(
            pynecone.link(
                pynecone.image(src="favicon.ico", width="1.5em", height="1.5em"),
                href="/",
            ),
            width="100%",
            padding="1em",
            visible="hidden",
        ),
        pynecone.box(
            pynecone.link(
                pynecone.image(src="signature.png", width="1.5em", height="1.5em"),
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
