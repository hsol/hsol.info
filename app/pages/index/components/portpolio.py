import reflex

from app import components
from app.constants import GlobalStyle
from app.models.history import Portfolio
from app.pages.portfolio import PortfolioListPage


def PortfolioCard(portfolios: list[Portfolio]) -> reflex.Component:
    portfolios = sorted(portfolios, key=lambda p: p.when, reverse=True)

    return components.fullfill_card(
        "포트폴리오",
        reflex.box(
            reflex.hstack(
                *[
                    reflex.vstack(
                        reflex.heading(portfolio.title, font_size=["0.8em", "1em"]),
                        reflex.text(
                            portfolio.sub_title,
                            color=GlobalStyle.Palette.GRAY,
                            margin_top="0",
                            font_size=["0.6em", "0.8em"],
                        ),
                        reflex.hstack(
                            *[
                                reflex.badge(stack.title)
                                for stack in portfolio.stacks
                            ],
                            spacing="0.5em",
                        ),
                        reflex.code_block(
                            portfolio.description,
                            language="markdown",
                            width="100%",
                            wrap_long_lines=True,
                            font_size="0.8em",
                            height="10em",
                            overflow_x="hidden",
                        ),
                        align_items="flex-start",
                        background_color=GlobalStyle.Palette.WHITE,
                        box_shadow="0 2px 3px rgba(10, 10, 10, 0.1), 0 0 0 1px rgba(10, 10, 10, 0.1)",
                        padding="1em",
                        flex_basis=["100%", "100%", "60%", "33%"],
                        flex_shrink="0",
                    )
                    for portfolio in portfolios
                ],
                width="100%",
                overflow_x="scroll",
                align_items="baseline",
                padding="8px",
            ),
            reflex.link(
                reflex.tooltip(
                    reflex.flex(
                        reflex.icon(tag="arrow_forward", width="100%", height="100%"),
                        position="absolute",
                        top="calc(50% - 16px)",
                        right="8px",
                        align_items="center",
                        justify_contents="center",
                        padding="8px",
                        background_color=GlobalStyle.Palette.WHITE,
                        border="1px solid",
                        border_color=GlobalStyle.Palette.RAISIN,
                        width="32px",
                        height="32px",
                        cursor="pointer",
                    ),
                    label="우측으로 스크롤하여 보거나, 클릭하여 전체 포트폴리오 페이지로 이동합니다.",
                ),
                href=PortfolioListPage.route,
            ),
            width="100%",
            position="relative",
        ),
    )
