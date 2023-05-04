from functools import partial

import pynecone


hero = partial(
    pynecone.hstack,
    max_height="100vh",
    padding="10% 0",
    justify_content="center",
    background_attachment="fixed",
    background_position="center",
    background_repeat="no-repeat",
    background_size="cover",
)
