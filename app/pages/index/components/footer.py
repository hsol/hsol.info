import reflex

from app import styles
from app.constants import GlobalStyle


def Footer() -> reflex.Component:
    return reflex.box(
        reflex.vstack(
            reflex.vstack(
                reflex.heading(
                    '"사람을 얻는 자는 번창하고, 사람을 잃는 자는 망한다."',
                    color=GlobalStyle.Palette.BIRCH,
                    font_size=["0.9em", "1em", "1.6em", "1.9em", "2.5em"],
                    text_align="center",
                ),
                reflex.heading(
                    "여기까지 보셨다면, 이제 저에게 연락해보세요!",
                    font_size=["0.8em", "1em", "1.2em", "1.8em"],
                    color=GlobalStyle.Palette.BIRCH + "80",
                    text_align="center",
                ),
                padding="10vw 24px 5vw 24px",
            ),
            reflex.html(
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
                min_height="10vw",
            ),
        ),
        display="flex",
        justify_content="center",
        background_image=f"url(/bg/full_04.jpg)",
        **styles.background_darken(40),
        **styles.background_cover(),
    )
