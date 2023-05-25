from functools import partial

import pynecone

page_container = partial(
    pynecone.box,
    min_width="375px",
    height="100vh",
    overflow_y="scroll",
)
