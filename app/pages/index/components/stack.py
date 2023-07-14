from itertools import groupby

import reflex

from app import components
from app.models.stack import Stack


def stack_column(stack_groups: dict, stack_node: Stack, **kwargs):
    return reflex.vstack(
        reflex.heading(stack_node.title, size="lg", margin_bottom="1em"),
        *(
            reflex.box(
                reflex.heading(sub_heading.title, size="md"),
                reflex.text(
                    ", ".join(
                        [item.title for item in stack_groups.get(sub_heading.id, [])]
                    )
                    + " ...",
                ),
                text_align="inherit",
            )
            for sub_heading in stack_groups.get(stack_node.id, [])
        ),
        flex_basis="0",
        flex_grow="1",
        flex_shrink="1",
        width="100%",
        **kwargs,
    )


def StackCard(stacks: list[Stack]) -> reflex.Component:
    stack_groups = {
        k: list(v)
        for k, v in groupby(
            sorted(stacks, key=lambda s: s.parent_id or 0), key=lambda s: s.parent_id
        )
    }

    root_nodes = stack_groups[None]
    if len(root_nodes) != 2:
        raise Exception("보유기술을 반드시 두가지 카테고리로 입력해주세요.")

    return components.fullfill_card(
        "보유기술",
        reflex.box(
            stack_column(
                stack_groups=stack_groups,
                stack_node=root_nodes[0],
                align_items="flex-end",
                text_align="right",
            ),
            reflex.box(
                reflex.text(
                    "AND",
                    color="#b5b5b5",
                    as_="b",
                    font_size="0.8em",
                    display=["none", "none", "block"],
                ),
                reflex.hstack(
                    reflex.divider(),
                    reflex.box(
                        reflex.text(
                            "AND",
                            color="#b5b5b5",
                            as_="b",
                            font_size="0.8em",
                        )
                    ),
                    reflex.divider(),
                    display=["flex", "flex", "none"],
                    margin="1em 0",
                ),
                padding="0.4em 0.8em",
                width=["100%", "100%", "auto"],
            ),
            stack_column(
                stack_groups=stack_groups,
                stack_node=root_nodes[1],
                align_items="flex-start",
            ),
            display="flex",
            flex_flow=["column nowrap", "column nowrap", "row nowrap"],
            align_items="flex-start",
            width="100%",
        ),
    )
