import json
from itertools import groupby

import pynecone
from sqlalchemy.orm import joinedload, load_only

from app import components
from app.constants import GlobalStyle
from app.models.history import Portfolio
from app.pages import BasePage
from app.states.base import BaseState
from app.styles import (
    background_darken,
    background_cover,
    background_white_pattern,
    card_shadow,
)
from app.utils import replace_dynamic_route_args


class PortfolioListState(BaseState):
    @pynecone.var
    def portfolio_id_map(self) -> dict[int, dict]:
        with pynecone.session() as session:
            portfolio_qs = (
                session.query(Portfolio).options(joinedload(Portfolio.stacks)).all()
            )
            return {
                str(p.id): {**json.loads(p.json()), "year": p.when.year}
                for p in portfolio_qs
            }

    @pynecone.var
    def portfolio_groups(self) -> list[list[dict]]:
        _groupby = [
            (year, list(group))
            for year, group in groupby(
                sorted(
                    self.portfolio_id_map.values(),
                    key=lambda p: p["when"],
                    reverse=True,
                ),
                key=lambda p: p["year"],
            )
        ]
        return [group for _, group in _groupby]

    @pynecone.var
    def current_portfolio(self) -> dict:
        return self.portfolio_id_map.get(self.portfolio_id, {})

    def on_portfolio_link_click(self):
        self.parent_state.dirty_substates.add(self.get_name())
        self.parent_state.mark_dirty()

        self.computed_vars["current_portfolio"].mark_dirty(self)


class PortfolioListPage(BasePage):
    title = "포트폴리오 (About HansolLim)"
    route = "/portfolio/[portfolio_id]"

    state = PortfolioListState

    def get_component(self, *args, **kwargs) -> pynecone.Component:
        return components.page_container(
            components.navbar(overlap=False),
            pynecone.box(
                pynecone.heading(
                    "포트폴리오",
                    size="2xl",
                    color=GlobalStyle.Palette.WHITE,
                    margin_bottom="1em",
                ),
                pynecone.stack(
                    pynecone.vstack(
                        pynecone.foreach(
                            self.state.portfolio_groups,
                            lambda portfolio_group, idx: pynecone.vstack(
                                pynecone.heading(
                                    portfolio_group[0]["year"],
                                    size="md",
                                    position="sticky",
                                    top="0",
                                    background_color=GlobalStyle.Palette.WHITE,
                                ),
                                pynecone.list(
                                    pynecone.foreach(
                                        portfolio_group,
                                        lambda portfolio: pynecone.list_item(
                                            pynecone.text(portfolio["title"]),
                                            pynecone.box(
                                                pynecone.icon(
                                                    tag="chevron_down",
                                                    display=[
                                                        "block",
                                                        "block",
                                                        "none",
                                                    ],
                                                ),
                                                pynecone.icon(
                                                    tag="chevron_right",
                                                    display=[
                                                        "none",
                                                        "none",
                                                        "block",
                                                    ],
                                                ),
                                                position="absolute",
                                                right="8px",
                                                top="calc(50% - 8px)",
                                            ),
                                            pynecone.link(
                                                href=replace_dynamic_route_args(
                                                    route=PortfolioListPage.route,
                                                    portfolio_id=portfolio["id"].to(
                                                        str
                                                    ),
                                                ),
                                                position="absolute",
                                                top="0",
                                                left="0",
                                                width="100%",
                                                height="100%",
                                                on_mouse_down=self.state.on_portfolio_link_click,
                                                on_mouse_up=self.state.on_portfolio_link_click,
                                            ),
                                            width="100%",
                                            padding="8px 1em",
                                            margin_bottom="8px",
                                            **card_shadow(),
                                            _hover=dict(
                                                cursor="pointer",
                                                **background_darken(10),
                                            ),
                                            position="relative",
                                        ),
                                    ),
                                    width="100%",
                                    align_items="start",
                                ),
                                width="100%",
                                align_items="start",
                                gap="16px",
                            ),
                        ),
                        width=["100%", "100%", "40%"],
                        height=["40vh", "40vh", "auto"],
                        overflow_y="auto",
                        padding="0 0.5em",
                        min_width="300px",
                        align_items="start",
                        gap="2em",
                    ),
                    pynecone.vstack(
                        pynecone.vstack(
                            pynecone.heading(
                                self.state.current_portfolio["title"], size="xl"
                            ),
                            pynecone.text(
                                self.state.current_portfolio["sub_title"],
                                size="1em",
                                color=GlobalStyle.Palette.GRAY,
                            ),
                            margin_bottom="2em",
                            align_items="baseline",
                        ),
                        pynecone.code(
                            self.state.current_portfolio["description"],
                            padding="1em",
                        ),
                        width="100%",
                        align_items="baseline",
                        padding=["2em", "2em", "0 2em"],
                        background_color=[
                            GlobalStyle.Palette.WHITE,
                            GlobalStyle.Palette.WHITE,
                            "transparent",
                        ],
                    ),
                    flex_direction=["column", "column", "row"],
                    padding="2em 1em",
                    border_radius="4px",
                    align_items="start",
                    **background_white_pattern(),
                    **background_cover(),
                ),
                padding=["2em 8px", "3em 1em", "5em 2em"],
            ),
            background_image="url(/bg/full_03.jpg)",
            **background_darken(10),
            **background_cover(),
        )
