import pynecone

from app import styles
from app.constants import GlobalStyle


def Footer() -> pynecone.Component:
    return pynecone.box(
        pynecone.vstack(
            pynecone.heading(
                '"사람을 얻는 자는 번창하고, 사람을 잃는 자는 망한다."',
                color=GlobalStyle.Palette.BIRCH,
                font_size=["0.8em", "1em", "1.8em"],
            ),
            pynecone.heading(
                "여기까지 보셨다면, 이제 저에게 연락해보세요!",
                font_size=["0.5em", "0.8em", "1em"],
                color=GlobalStyle.Palette.BIRCH + "80",
            ),
            padding="9rem 0",
        ),
        display="flex",
        justify_content="center",
        background_attachment="fixed",
        background_position="center",
        background_repeat="no-repeat",
        background_size="cover",
        background_image=f"url(/bg/full_04.jpg)",
        **styles.background_darken(40),
        padding="48px 24px",
    )
