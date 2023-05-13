import pynecone

from app import components
from app.constants import GlobalStyle
from app.models.history import Portfolio


def PortfolioCard(portfolios: list[Portfolio]) -> pynecone.Component:
    portfolios = sorted(portfolios, key=lambda p: p.when, reverse=True)
    print(portfolios)

    return components.fullfill_card(
        "포트폴리오",
        pynecone.responsive_grid(
            *[
                pynecone.vstack(
                    pynecone.heading(portfolio.title, font_size=["0.8em", "1em"]),
                    pynecone.text(
                        portfolio.sub_title,
                        color=GlobalStyle.Palette.GRAY,
                        margin_top="0",
                        font_size=["0.6em", "0.8em"],
                    ),
                    pynecone.hstack(
                        *[pynecone.badge(stack.title) for stack in portfolio.stacks],
                        spacing="0.5em",
                    ),
                    align_items="flex-start",
                    background_color=GlobalStyle.Palette.WHITE,
                    box_shadow="0 2px 3px rgba(10, 10, 10, 0.1), 0 0 0 1px rgba(10, 10, 10, 0.1)",
                    padding="1em",
                )
                for portfolio in portfolios
            ],
            width="100%",
            columns=[1, 2, 3],
            gap="8px",
        ),
    )
