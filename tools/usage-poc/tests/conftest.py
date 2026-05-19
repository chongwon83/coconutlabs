"""Put the usage-poc dir on sys.path so `coconut_collector` and the
`estimate_cost` shim import cleanly when pytest runs from anywhere.
"""

import sys
from pathlib import Path

_USAGE_POC = Path(__file__).parent.parent
if str(_USAGE_POC) not in sys.path:
    sys.path.insert(0, str(_USAGE_POC))
