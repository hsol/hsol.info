from functools import partial

import reflex

from app.styles import background_cover

hero = partial(
    reflex.hstack,
    max_height="100vh",
    padding="10% 0",
    justify_content="center",
    **background_cover(),
)
