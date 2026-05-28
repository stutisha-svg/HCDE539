# RaceBand Firmware (XIAO ESP32-C3)

## Attribution

| Component | Credit |
|-----------|--------|
| `RaceBand_Firmware.ino` | Portions developed with assistance from **Google Gemini** |
| `racebandapp.html`, `app.js` | Developed with assistance from **Cursor** |
| `mpu6050testcode.ino`, `shaketestcode1.ino`, `i2cscannercode/` | Bench tests (no AI attribution required) |
| Libraries | **ESP32Servo**, **Preferences** (Espressif); **Adafruit MPU6050** / **Unified Sensor** (bench sketches only) |

Before uploading firmware: **Sketch → Auto Format** in the Arduino IDE.

## Arduino IDE setup

1. **Board:** `XIAO_ESP32C3` under *esp32 by Espressif Systems*
2. **Libraries:** `Wire`, `Adafruit MPU6050`, `Adafruit Unified Sensor`, `ESP32Servo`
3. Open `RaceBand_Firmware.ino`
4. **Sketch → Auto Format** before uploading
5. Upload with the band on **USB power** (toggle may be open)

## Run workflow

1. Plug in USB → connect dashboard → set target + break pace → **Send Configuration**
2. Band runs **hardware checks** (MPU, servo, flash) → **Configuration received. Disconnect and ready for run.**
3. Dashboard auto-disconnects → unplug USB → toggle **ON** → run on battery
4. Toggle **OFF** after run → plug USB → **Connect** to sync history

**Important:** With only USB connected and the toggle **OFF**, the band does not record — use the USB test buttons or flip the toggle ON.

## Servo (D8)

Uses **ESP32Servo** the same way as the bench test: `linearServo.attach(D8)` and **1° every 20 ms** (no manual timer allocation or LEDC fallback).

## Troubleshooting

### `ERR,SERVO_ATTACH`
- Re-upload RaceBand firmware (must use simple `attach(D8)` build).
- Confirm the standalone servo test sketch still works on D8.

### `ERR,MPU6050_INIT`
- Firmware now uses **`D4` / `D5`** (not raw GPIO 4/5). Re-upload the latest sketch.
- Close the **Arduino Serial Monitor** before using the web dashboard (only one app can use the USB port).
- On connect you should see `READY,RaceBand` and optionally `I2C,FOUND,68`. If you see `I2C,NONE`, check SDA→D4, SCL→D5, 3.3V, GND.

### Dashboard won’t connect
- Use Chrome or Edge, serve the page from `http://localhost` (not `file://`).
- Close Serial Monitor, unplug/replug USB, click **Connect to Wearable** again.

## Serial protocol

Documented in `app.js` and the header comment of `RaceBand_Firmware.ino`.
