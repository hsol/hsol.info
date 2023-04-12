from functools import partial

import pynecone


hero = partial(
    pynecone.hstack,
    max_height="100vh",
    background_color="green",
    padding="10% 0",
    justify_content="center",
)
