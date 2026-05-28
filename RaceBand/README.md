# RaceBand — Kinetic Pacing Wearable

HCDE 539 · University of Washington

Web dashboard + ESP32-C3 firmware for a wearable pacing band (LED + linear servo cues).

## Project files

| File / folder | Purpose |
|---------------|---------|
| `racebandapp.html` | Dashboard UI (open via local server) |
| `app.js` | Web Serial logic, config, run history |
| `style.css` | Dashboard styles |
| `RaceBand_Firmware/` | Production Arduino sketch |
| `mpu6050testcode.ino`, `shaketestcode1.ino`, `i2cscannercode/` | Hardware bench tests |

## Attribution

| Component | Credit |
|-----------|--------|
| `RaceBand_Firmware/RaceBand_Firmware.ino` | Portions developed with assistance from **Google Gemini** |
| `racebandapp.html`, `app.js` | Developed with assistance from **Cursor** |
| Bench test `.ino` files | Course prototypes (no AI attribution) |
| Third-party | **ESP32Servo**, **Preferences** (Espressif); **Adafruit** libraries (tests); **Google Fonts** (UI) |

## Run the dashboard

1. Serve this folder over HTTP (not `file://`), e.g. `python -m http.server 8080` from `RaceBand/`.
2. Open `http://localhost:8080/racebandapp.html` in **Chrome or Edge** on desktop.
3. Connect USB, click **Connect to Wearable**.

See `RaceBand_Firmware/README.md` for upload and run workflow.
