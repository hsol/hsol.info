from functools import partial

import pynecone

from app.styles import background_cover

hero = partial(
    pynecone.hstack,
    max_height="100vh",
    padding="10% 0",
    justify_content="center",
    **background_cover(),
)
