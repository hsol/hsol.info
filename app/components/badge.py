from functools import partial

import pynecone

from app.constants import GlobalStyle

white_badge = partial(
    pynecone.box,
    align_items="center",
    background_color=GlobalStyle.Palette.BIRCH,
    border_radius="4px",
    color=GlobalStyle.Palette.FONT_COLOR,
    display="inline-flex",
    font_size="0.75rem",
    height="2em",
    justify_content="center",
    line_height="1.5",
    padding="0 0.75em",
    white_space="nowrap",
    opacity="0.98",
)
