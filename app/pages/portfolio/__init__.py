import json
from asyncio import sleep
from itertools import groupby

import reflex
import typing
from sqlalchemy.orm import joinedload

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
    @reflex.var
    def portfolio_id_map(self) -> dict[int, dict]:
        with reflex.session() as session:
            portfolio_qs = (
                session.query(Portfolio).options(joinedload(Portfolio.stacks)).all()
            )
            return {
                str(p.id): {
                    **json.loads(p.json()),
                    "year": p.when.year,
                    "stacks": [json.loads(s.json()) for s in p.stacks],
                }
                for p in portfolio_qs
            }

    @reflex.var
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

    @reflex.var
    def current_portfolio(self) -> dict:
        return self.portfolio_id_map.get(self.portfolio_id, {})

    @reflex.var
    def current_portfolio_stacks(self) -> list[dict]:
        return self.portfolio_id_map.get(self.portfolio_id, {}).get("stacks")

    @reflex.var
    def is_detail(self) -> bool:
        return self.portfolio_id != ""

    async def sync_state(self):
        for _ in range(2):
            await sleep(0.1)
            self.parent_state.dirty_substates.add(self.get_name())
            self.parent_state.mark_dirty()

            self.computed_vars["current_portfolio"].mark_dirty(self)
            self.computed_vars["current_portfolio_stacks"].mark_dirty(self)

    async def on_load(self):
        await sleep(0.3)
        await self.sync_state()


class PortfolioDetailPage(BasePage):
    title = "포트폴리오 (About HansolLim)"
    route = "/portfolio/[portfolio_id]"

    state = PortfolioListState

    def get_on_load_event_handler(self) -> typing.Callable[[], None] | None:
        return self.state.on_load

    def get_component(self, *args, **kwargs) -> reflex.Component:
        return components.page_container(
            components.navbar(overlap=False),
            reflex.box(
                reflex.heading(
                    "포트폴리오",
                    size="2xl",
                    color=GlobalStyle.Palette.WHITE,
                    margin_bottom="1em",
                ),
                reflex.stack(
                    reflex.vstack(
                        reflex.foreach(
                            self.state.portfolio_groups,
                            lambda portfolio_group, idx: reflex.vstack(
                                reflex.heading(
                                    portfolio_group[0]["year"],
                                    size="md",
                                    position="sticky",
                                    top="0",
                                    background_color=GlobalStyle.Palette.WHITE,
                                ),
                                reflex.list(
                                    reflex.foreach(
                                        portfolio_group,
                                        lambda portfolio: reflex.list_item(
                                            reflex.text(portfolio["title"]),
                                            reflex.box(
                                                reflex.icon(
                                                    tag="chevron_down",
                                                    display=[
                                                        "block",
                                                        "block",
                                                        "none",
                                                    ],
                                                ),
                                                reflex.icon(
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
                                            reflex.link(
                                                reflex.Box(),
                                                href=replace_dynamic_route_args(
                                                    route=PortfolioDetailPage.route,
                                                    portfolio_id=portfolio["id"].to(
                                                        str
                                                    ),
                                                ),
                                                position="absolute",
                                                top="0",
                                                left="0",
                                                width="100%",
                                                height="100%",
                                                on_mouse_down=self.state.sync_state,
                                                on_mouse_up=self.state.sync_state,
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
                    reflex.vstack(
                        reflex.cond(
                            self.state.is_detail,
                            reflex.box(
                                reflex.vstack(
                                    reflex.heading(
                                        self.state.current_portfolio["title"],
                                        size="xl",
                                    ),
                                    reflex.text(
                                        self.state.current_portfolio["sub_title"],
                                        size="1em",
                                        color=GlobalStyle.Palette.GRAY,
                                    ),
                                    reflex.hstack(
                                        reflex.foreach(
                                            self.state.current_portfolio_stacks,
                                            lambda stack: reflex.badge(stack["title"]),
                                        ),
                                        spacing="0.5em",
                                    ),
                                    margin_bottom="2em",
                                    align_items="baseline",
                                ),
                                reflex.code(
                                    self.state.current_portfolio["description"],
                                    padding="1em",
                                ),
                            ),
                            reflex.box(reflex.text("포트폴리오 항목들을 눌러 내용을 확인해주세요.")),
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


class PortfolioListPage(PortfolioDetailPage):
    route = "/portfolio"
