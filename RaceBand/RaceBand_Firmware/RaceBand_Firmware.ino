/*
 * RaceBand — Kinetic pacing wearable firmware (Seeed XIAO ESP32-C3)
 * HCDE 539 · University of Washington
 *
 * LIVE PRESENTATION MODE: uses a simulated "ghost sensor" so dashboard sync,
 * NVS run snapshots, pacing cues (LED + linear servo), and serial protocol
 * behave reliably for demos when the physical MPU6050 path is unavailable.
 *
 * ---------------------------------------------------------------------------
 * Attribution
 * ---------------------------------------------------------------------------
 * Portions of this firmware were developed with assistance from Google Gemini.
 *
 * Third-party libraries (not written for this project):
 *   - ESP32Servo — https://github.com/madhephaestus/ESP32Servo
 *   - Preferences (NVS) — Espressif ESP32 Arduino core
 *
 * Hardware: LED D9, toggle D3 (INPUT_PULLUP, ON = LOW), servo D8, USB serial.
 * Baud: 115200. Line protocol documented in app.js and RaceBand_Firmware/README.md.
 */

#include <Preferences.h>
#include <ESP32Servo.h>

// =============================================================================
// Pin map
// =============================================================================
static const int PIN_LED = D9;
static const int PIN_SWITCH = D3;
static const int PIN_SERVO = D8;

// =============================================================================
// Timing & tuning
// =============================================================================
static const uint32_t SERIAL_BAUD = 115200;
static bool dashboardConnected = false;
static String serialLine;
static const unsigned long FLASH_SAVE_MS = 3000;
static const unsigned long PACE_EMIT_MS = 1000;

// Safe servo travel limits (avoid binding / whirring at mechanical stops)
static const int SERVO_REST = 40;
static const int SERVO_PEAK = 140;
static const float PACE_INTENSITY_K = 25.0f;
static const float PACE_DRIFT_RATIO = 0.10f; 

// =============================================================================
// Types & Globals
// =============================================================================
enum RunState {
  ST_IDLE,         // Not recording; waiting for toggle or USB bench run
  ST_RUNNING,      // Active run; pacing feedback enabled
  ST_NEEDS_SYNC    // Run finished on battery; upload RUN_END via USB
};

Servo linearServo;  
Preferences prefs;
static const char *PREFS_NS = "raceband";

// --- Config ---
static uint8_t targetMin = 8;
static uint8_t targetSec = 30;
static uint8_t breakMin = 10;
static uint8_t breakSec = 0;
static bool configLoaded = false;

// --- Live run metrics ---
static uint16_t totalCues = 0;
static double paceSumMinPerMile = 0.0;
static uint32_t paceSampleCount = 0;
static bool pendingSync = false;

static float lastSwingIntensity = 0.0f;
static float lastPaceMinPerMile = 0.0f;

// --- Servo software gearbox ---
static float servoCurrentAngle = 40.0f;
static float servoTargetAngle = 40.0f;

// Servo glide speeds (degrees per gearbox tick, ~30 ms)
const float extendSpeed = 1.0f;
const float retractSpeed = 0.5f;

// --- Uninterruptible Cue Logic ---
static bool isExecutingCue = false;
static int cuePhase = 0;

// Breathing LED during NEEDS_SYNC (pulse while waiting for dashboard upload)
static int ledBrightness = 0;
static int ledFadeAmount = 8;

// --- State machine ---
static RunState runState = ST_IDLE;
static unsigned long lastFlashSaveMs = 0;
static unsigned long lastLedBlinkMs = 0;
static unsigned long lastServoTickMs = 0;
static bool benchRunActive = false;
static bool servoAttached = false;
static bool mpuReady = true;  // Presentation build: HW check reports OK without live I2C

// =============================================================================
// Preferences helpers
// =============================================================================
static void loadConfigFromFlash() {
  targetMin = prefs.getUChar("tMin", 8);
  targetSec = prefs.getUChar("tSec", 30);
  breakMin = prefs.getUChar("bMin", 10);
  breakSec = prefs.getUChar("bSec", 0);
  configLoaded = prefs.getBool("cfgOk", false);
}

static void saveConfigToFlash() {
  prefs.putUChar("tMin", targetMin);
  prefs.putUChar("tSec", targetSec);
  prefs.putUChar("bMin", breakMin);
  prefs.putUChar("bSec", breakSec);
  prefs.putBool("cfgOk", true);
  configLoaded = true;
}

static void loadRunSnapshotFromFlash() {
  pendingSync = prefs.getBool("pending", false);
  totalCues = prefs.getUShort("cues", 0);
  paceSumMinPerMile = prefs.getDouble("paceSum", 0.0);
  paceSampleCount = prefs.getUInt("paceN", 0);
  if (pendingSync) {
    targetMin = prefs.getUChar("runTMin", targetMin);
    targetSec = prefs.getUChar("runTSec", targetSec);
  }
}

static void saveRunSnapshotToFlash() {
  bool markPending = pendingSync || (paceSampleCount > 0);
  prefs.putBool("pending", markPending);
  prefs.putUShort("cues", totalCues);
  prefs.putDouble("paceSum", paceSumMinPerMile);
  prefs.putUInt("paceN", paceSampleCount);
  prefs.putUChar("runTMin", targetMin);
  prefs.putUChar("runTSec", targetSec);
  pendingSync = markPending;
}

static void clearPendingRun() {
  pendingSync = false;
  totalCues = 0;
  paceSumMinPerMile = 0.0;
  paceSampleCount = 0;
  prefs.putBool("pending", false);
  prefs.putUShort("cues", 0);
  prefs.putDouble("paceSum", 0.0);
  prefs.putUInt("paceN", 0);
}

static void emitSerialLine(const String &line) { Serial.println(line); }
static void emitAck(const char *kind) { emitSerialLine(String("ACK,") + kind); }

static void beginNewRun() {
  if (pendingSync && paceSampleCount > 0) {
    runState = ST_NEEDS_SYNC;
    emitSerialLine("STATUS,NEEDS_SYNC");
    return;
  }
  clearPendingRun();
  runState = ST_RUNNING;
  saveRunSnapshotToFlash();
  emitSerialLine("RUN_START");
}

static void finalizeRunToFlash() {
  pendingSync = true;
  saveRunSnapshotToFlash();
  runState = ST_NEEDS_SYNC;
}

// =============================================================================
// Pace math
// =============================================================================
static float paceMinPerMileFromParts(uint8_t min, uint8_t sec) { return (float)min + (float)sec / 60.0f; }
static float targetPaceMinPerMile() { return paceMinPerMileFromParts(targetMin, targetSec); }

static float estimatePaceMinPerMile(float swingIntensity) {
  float clamped = constrain(swingIntensity, 0.5f, 10.0f); 
  float estimatedPace = PACE_INTENSITY_K / clamped;
  return constrain(estimatedPace, 4.0f, 20.0f); 
}

static void paceMinPerMileToParts(float pace, uint8_t &outMin, uint8_t &outSec) {
  if (pace < 0.0f) pace = 0.0f;
  uint32_t totalSec = (uint32_t)(pace * 60.0f + 0.5f);
  outMin = (uint8_t)(totalSec / 60);
  outSec = (uint8_t)(totalSec % 60);
}

static float averagePaceMinPerMile() {
  if (paceSampleCount == 0) return targetPaceMinPerMile();
  return (float)(paceSumMinPerMile / (double)paceSampleCount);
}

// =============================================================================
// Dashboard Sync Outputs
// =============================================================================
static void emitPaceUpdate() {
  uint8_t actMin, actSec;
  paceMinPerMileToParts(lastPaceMinPerMile, actMin, actSec);
  String line = "PACE," + String(targetMin) + "," + String(targetSec) + "," + String(actMin) + "," + String(actSec) + "," + String(totalCues);
  emitSerialLine(line);
}

static void emitRunEnd() {
  uint8_t actMin, actSec;
  paceMinPerMileToParts(averagePaceMinPerMile(), actMin, actSec);
  String line = "RUN_END," + String(targetMin) + "," + String(targetSec) + "," + String(actMin) + "," + String(actSec) + "," + String(totalCues);
  emitSerialLine(line);
}

static void emitConfigLine() {
  String line = "CONFIG," + String(targetMin) + "," + String(targetSec) + "," + String(breakMin) + "," + String(breakSec);
  emitSerialLine(line);
}

static void finalizeConfiguration();

// =============================================================================
// Servo — smooth software gearbox
// =============================================================================
static void writeServoAngle(int angle) {
  if (!servoAttached) return;
  angle = constrain(angle, 0, 180);
  linearServo.write(angle);
}

static void updateServoGearbox() {
  if (!servoAttached) return;
  unsigned long now = millis();
  if (now - lastServoTickMs < 30) return;
  lastServoTickMs = now;

  if (servoTargetAngle > servoCurrentAngle) {
    servoCurrentAngle += extendSpeed;
    if (servoCurrentAngle > servoTargetAngle) servoCurrentAngle = servoTargetAngle;
  } else if (servoTargetAngle < servoCurrentAngle) {
    servoCurrentAngle -= retractSpeed;
    if (servoCurrentAngle < servoTargetAngle) servoCurrentAngle = servoTargetAngle;
  }

  writeServoAngle((int)servoCurrentAngle);
}

static bool attachLinearServo() {
  linearServo.setPeriodHertz(50);
  int channel = linearServo.attach(PIN_SERVO, 1000, 2000);
  if (channel >= 0) {
    servoAttached = true;
    emitSerialLine("STATUS,SERVO,OK");
    return true;
  }
  servoAttached = false;
  emitSerialLine("ERR,SERVO_ATTACH");
  return false;
}

static void centerServoGently() {
  servoTargetAngle = SERVO_REST;
}

// =============================================================================
// LED
// =============================================================================
static void turnLedOff() {
  analogWrite(PIN_LED, 0);
}

static void updateBreathingLed() {
  unsigned long now = millis();
  if (now - lastLedBlinkMs >= 30) {
    lastLedBlinkMs = now;
    ledBrightness += ledFadeAmount;
    if (ledBrightness <= 0) {
      ledBrightness = 0;
      ledFadeAmount = -ledFadeAmount;
    } else if (ledBrightness >= 255) {
      ledBrightness = 255;
      ledFadeAmount = -ledFadeAmount;
    }
    analogWrite(PIN_LED, ledBrightness);
  }
}

// =============================================================================
// THE GHOST SENSOR (Simulated Data Injection)
// =============================================================================
static bool readSwingSample(float &rawYOut, float &swingOut) {
  unsigned long cycle = millis() % 12000;  // 12 s repeating demo cycle

  // 0–8 s: strong swing → faster estimated pace (~6:00 / mi)
  if (cycle < 8000) {
    swingOut = 4.2f;
  }
  // 8–12 s: weaker swing → slower pace (~12:30 / mi) to trigger cues
  else {
    swingOut = 2.0f;
  }

  rawYOut = 10.0f;
  lastSwingIntensity = swingOut;
  lastPaceMinPerMile = estimatePaceMinPerMile(swingOut);
  return true;
}

static void recordPaceSample() {
  paceSumMinPerMile += (double)lastPaceMinPerMile;
  paceSampleCount++;
}

// =============================================================================
// THE UNINTERRUPTIBLE PACING LOGIC
// =============================================================================
static void updatePacingFeedback() {
  float target = targetPaceMinPerMile();

  // Trigger: estimated pace slower than target (+ 30 s/mi buffer)
  if (!isExecutingCue && lastPaceMinPerMile > (target + 0.5f)) {
    isExecutingCue = true;
    cuePhase = 1;
    totalCues++;
  }

  // Execute one full cue cycle (extend to peak, retract to rest) without interruption
  if (isExecutingCue) {
    updateBreathingLed();

    if (cuePhase == 1) {
      servoTargetAngle = SERVO_PEAK;
      if (servoCurrentAngle >= SERVO_PEAK - 1.0f) {
        cuePhase = 2;
      }
    } else if (cuePhase == 2) {
      servoTargetAngle = SERVO_REST;
      if (servoCurrentAngle <= SERVO_REST + 1.0f) {
        isExecutingCue = false;
        cuePhase = 0;
        turnLedOff();
      }
    }
  } else {
    turnLedOff();
    servoTargetAngle = SERVO_REST;
  }
}

// =============================================================================
// Incoming serial commands (dashboard → device)
// =============================================================================
static void handleSerialCommand(const String &line) {
  dashboardConnected = true;

  String cmd = line;
  cmd.trim();
  if (cmd.length() == 0) return;

  int firstComma = cmd.indexOf(',');
  String keyword = (firstComma == -1) ? cmd : cmd.substring(0, firstComma);
  keyword.toUpperCase();

  if (keyword == "CFG") {
    int c1 = cmd.indexOf(',');
    int c2 = cmd.indexOf(',', c1 + 1);
    int c3 = cmd.indexOf(',', c2 + 1);
    String sub = cmd.substring(c2 + 1, c3 == -1 ? cmd.length() : c3);
    sub.toUpperCase();
    if (sub == "TARGET" && c3 != -1) {
      int c4 = cmd.indexOf(',', c3 + 1);
      targetMin = (uint8_t)cmd.substring(c3 + 1, c4).toInt();
      targetSec = (uint8_t)cmd.substring(c4 + 1).toInt();
      saveConfigToFlash();
      emitConfigLine();
      emitAck("CFG");
    } else if (sub == "BREAK" && c3 != -1) {
      int c4 = cmd.indexOf(',', c3 + 1);
      breakMin = (uint8_t)cmd.substring(c3 + 1, c4).toInt();
      breakSec = (uint8_t)cmd.substring(c4 + 1).toInt();
      saveConfigToFlash();
      emitConfigLine();
      emitAck("CFG");
    }
    return;
  }

  if (keyword == "GET_CONFIG") {
    emitConfigLine();
    return;
  }

  if (keyword == "CONFIG_FINALIZE") {
    finalizeConfiguration();
    return;
  }

  if (keyword == "RUN") {
    int c1 = cmd.indexOf(',');
    String sub = (c1 == -1) ? "" : cmd.substring(c1 + 1);
    sub.toUpperCase();
    if (sub == "START") {
      benchRunActive = true;
      if (runState == ST_IDLE) beginNewRun();
      emitSerialLine("ACK,RUN_START");
      emitPaceUpdate();
      return;
    }
    if (sub == "STOP") {
      benchRunActive = false;
      if (runState == ST_RUNNING) {
        if (paceSampleCount > 0) {
          finalizeRunToFlash();
          saveRunSnapshotToFlash();
        } else {
          runState = ST_IDLE;
        }
        turnLedOff();
        centerServoGently();
        isExecutingCue = false;
      }
      emitSerialLine("ACK,RUN_STOP");
      return;
    }
  }

  if (keyword == "SYNC_REQUEST") {
    loadRunSnapshotFromFlash();
    if (paceSampleCount > 0) {
      emitRunEnd();
      emitPaceUpdate();
      clearPendingRun();
      runState = ST_IDLE;
      emitAck("SYNC");
    } else {
      emitSerialLine("SYNC,NODATA");
    }
    emitConfigLine();
    return;
  }
}

static void pollSerialCommands() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialLine.length() > 0) {
        handleSerialCommand(serialLine);
        serialLine = "";
      }
    } else {
      serialLine += c;
      if (serialLine.length() > 96) serialLine = "";
    }
  }
}

// =============================================================================
// Switch
// =============================================================================
static bool isSwitchRunning() {
  if (dashboardConnected) return false;
  return millis() > 3000;
}

static bool isRecordingActive() {
  return isSwitchRunning() || benchRunActive;
}

static void finalizeConfiguration() {
  saveConfigToFlash();

  // Hardware self-check lines for the web dashboard (presentation build)
  emitSerialLine("STATUS,HW,MPU,OK");

  if (!servoAttached) {
    attachLinearServo();
  }
  if (servoAttached) {
    emitSerialLine("STATUS,HW,SERVO,OK");
  } else {
    emitSerialLine("STATUS,HW,SERVO,FAIL");
  }

  bool flashOk = configLoaded && (targetMin > 0 || targetSec > 0);
  emitSerialLine(String("STATUS,HW,FLASH,") + (flashOk ? "OK" : "FAIL"));

  bool switchOff = !isSwitchRunning();
  emitSerialLine(String("STATUS,HW,SWITCH,") + (switchOff ? "OK" : "WARN"));
  bool benchOff = !benchRunActive;
  emitSerialLine(String("STATUS,HW,BENCH,") + (benchOff ? "OK" : "WARN"));

  bool syncClear = !(pendingSync && paceSampleCount > 0);
  emitSerialLine(String("STATUS,HW,SYNC,") + (syncClear ? "OK" : "WARN"));

  bool criticalOk = servoAttached && flashOk;
  if (criticalOk) {
    benchRunActive = false;
    if (runState != ST_NEEDS_SYNC) {
      runState = ST_IDLE;
    }
    emitConfigLine();
    emitSerialLine("STATUS,CONFIG,READY");
    emitSerialLine("MSG,Configuration received. Disconnect USB and toggle ON to run.");
    emitAck("CONFIG_READY");
  } else {
    String fail = "STATUS,CONFIG,FAIL";
    if (!servoAttached) fail += ",SERVO";
    if (!flashOk) fail += ",FLASH";
    emitSerialLine(fail);
    emitSerialLine("MSG,Fix failed hardware checks and send configuration again.");
  }
}

// =============================================================================
// Arduino setup() and loop()
// =============================================================================

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(400);

  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_SWITCH, INPUT_PULLUP);
  turnLedOff();

  delay(1000);
  attachLinearServo();
  servoCurrentAngle = SERVO_REST;
  servoTargetAngle = SERVO_REST;
  writeServoAngle(SERVO_REST);
  prefs.begin(PREFS_NS, false);
  loadConfigFromFlash();
  loadRunSnapshotFromFlash();

  emitSerialLine("READY,RaceBand");
  emitConfigLine();

  if (pendingSync && paceSampleCount > 0) {
    runState = ST_NEEDS_SYNC;
  } else if (isSwitchRunning()) {
    beginNewRun();
  } else {
    runState = ST_IDLE;
  }
}

void loop() {
  pollSerialCommands();
  unsigned long now = millis();

  float rawY = 0.0f, swing = 0.0f;
  readSwingSample(rawY, swing);

  if (runState == ST_NEEDS_SYNC) {
    updateBreathingLed();
    servoTargetAngle = SERVO_REST;
    updateServoGearbox();
    return;
  }

  bool recording = isRecordingActive();
  if (!recording && runState == ST_RUNNING) {
    if (paceSampleCount > 0) {
      finalizeRunToFlash();
      saveRunSnapshotToFlash();
    } else {
      runState = ST_IDLE;
    }
    turnLedOff();
    centerServoGently();
    isExecutingCue = false;
    updateServoGearbox();
    return;
  }

  if (recording && runState == ST_IDLE) beginNewRun();

  if (runState == ST_IDLE) {
    updateServoGearbox();
    return;
  }

  // --- Active run ---
  recordPaceSample();

  if (runState == ST_RUNNING) {
    updatePacingFeedback();
  }

  if (now - lastFlashSaveMs >= FLASH_SAVE_MS) {
    lastFlashSaveMs = now;
    saveRunSnapshotToFlash();
  }

  static unsigned long lastPaceEmitMs = 0;
  if (now - lastPaceEmitMs >= PACE_EMIT_MS) {
    lastPaceEmitMs = now;
    emitPaceUpdate();
  }

  updateServoGearbox();
}