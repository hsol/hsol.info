import pynecone

from app import styles
from app.constants import GlobalStyle


def Footer() -> pynecone.Component:
    return pynecone.box(
        pynecone.vstack(
            pynecone.vstack(
                pynecone.heading(
                    '"사람을 얻는 자는 번창하고, 사람을 잃는 자는 망한다."',
                    color=GlobalStyle.Palette.BIRCH,
                    font_size=["0.8em", "1em", "1.8em", "2em", "2.5em"],
                ),
                pynecone.heading(
                    "여기까지 보셨다면, 이제 저에게 연락해보세요!",
                    font_size=["0.5em", "0.8em", "1em", "1.2em", "1.8em"],
                    color=GlobalStyle.Palette.BIRCH + "80",
                ),
                padding="10vw 24px 16px 24px",
            ),
            pynecone.html(
                """
                <script src='https://utteranc.es/client.js'
                        repo='hsol/hsol.github.io'
                        issue-number='3'
                        theme='github-light'
                        crossorigin='anonymous'
                        async>
                </script>
                """,
                width="100%",
            ),
        ),
        display="flex",
        justify_content="center",
        background_attachment="fixed",
        background_position="center",
        background_repeat="no-repeat",
        background_size="cover",
        background_image=f"url(/bg/full_04.jpg)",
        **styles.background_darken(40),
    )
