import pynecone

from app.constants import GlobalStyle
from app.pages.portfolio import PortfolioListPage


def _navbar_content(phantom: bool = False):
    return pynecone.hstack(
        pynecone.link(
            pynecone.hstack(
                pynecone.image(src="/signature.png", width="1.5em", height="1.5em"),
                pynecone.text(
                    "임한솔",
                    color=GlobalStyle.Palette.BIRCH,
                    font_size="1.5em",
                ),
                justify_content="center",
                white_space="nowrap",
            ),
            href="/",
            _hover=dict(
                text_decoration="none",
            ),
        ),
        pynecone.hstack(
            pynecone.link(
                pynecone.badge("포트폴리오", padding="0.5em 1em"),
                href=PortfolioListPage.route,
            ),
            pynecone.link(
                pynecone.badge("블로그(외부링크)", padding="0.5em 1em"),
                href="https://hsol.tistory.com",
                is_external=True,
            ),
            justify_content="end",
            width="100%",
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
