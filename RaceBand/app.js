/**
 * RaceBand — Kinetic Pacing Wearable Dashboard
 * Pure vanilla JS · Web Serial API · localStorage
 *
 * SERIAL PROTOCOL (match your firmware to these lines)
 * ----------------------------------------------------
 * Baud: 115200, newline-terminated lines (\n)
 *
 * INCOMING (device → browser), examples:
 *   PACE,8,30,8,45,12        → target 8:30, actual 8:45, cue count 12
 *   CUE,13                   → cue count only (updates tracker)
 *   RUN_START                → optional: marks active run
 *   RUN_END,8,30,8,52,15     → saves run: target min,sec, actual min,sec, total cues
 *   ACK,CFG                  → optional ack after config sent
 *   ACK,CAL                  → optional ack after calibrate
 *   ACK,SYNC                 → run data uploaded from device flash
 *   SYNC,NODATA              → nothing waiting to sync
 *   DBG,rawY,emaY,state,servoTarget → debug telemetry
 *   STATUS,CONFIG,READY      → all critical HW checks passed
 *   STATUS,CONFIG,FAIL,...   → MPU / SERVO / FLASH failed
 *   STATUS,HW,MPU,OK|FAIL    → hardware check detail
 *   MSG,...                  → human-readable status line
 *   ACK,CONFIG_READY         → config finalized on device
 *
 * OUTGOING (browser → device), examples:
 *   CFG,TARGET,8,30\n
 *   CFG,SPLIT,1,8,0\n        → mile 1 at 8:00
 *   CFG,BREAK,10,0\n
 *   CONFIG_FINALIZE\n        → run HW checks; ready for disconnect + run
 *   CALIBRATE\n
 *   SYNC_REQUEST\n           → read NVS and emit RUN_END if a run is pending
 *
 * Adjust parseSerialLine() if your MCU uses different keywords or field order.
 */

(function () {
  "use strict";

  // --------------------------------------------------------------------------
  // Constants
  // --------------------------------------------------------------------------

  const BAUD_RATE = 115200;
  const STORAGE_KEY = "raceband_run_history";
  const CONFIG_STORAGE_KEY = "raceband_last_config";
  const TEXT_ENCODER = new TextEncoder();
  const TEXT_DECODER = new TextDecoder();

  // --------------------------------------------------------------------------
  // Application state
  // --------------------------------------------------------------------------

  /** @type {SerialPort | null} */
  let serialPort = null;
  /** @type {ReadableStreamDefaultReader<Uint8Array> | null} */
  let serialReader = null;
  /** @type {WritableStreamDefaultWriter<Uint8Array> | null} */
  let serialWriter = null;
  let readLoopActive = false;
  let serialLineBuffer = "";
  /** @type {((result: { ok: boolean, failed?: string[], warnings?: string[] }) => void) | null} */
  let configFinalizeWaiter = null;
  /** @type {((result: { ok: boolean, runCount: number, noData?: boolean }) => void) | null} */
  let syncWaiter = null;
  let syncInProgress = false;
  let syncRunCount = 0;

  const currentRun = {
    targetPace: null,
    actualPace: null,
    cueCount: 0,
    isActive: false,
  };

  // --------------------------------------------------------------------------
  // DOM references
  // --------------------------------------------------------------------------

  const el = {
    btnConnect: document.getElementById("btn-connect"),
    btnDisconnect: document.getElementById("btn-disconnect"),
    connectionStatus: document.getElementById("connection-status"),
    dashTargetPace: document.getElementById("dash-target-pace"),
    dashActualPace: document.getElementById("dash-actual-pace"),
    dashPaceDelta: document.getElementById("dash-pace-delta"),
    dashRunStatus: document.getElementById("dash-run-status"),
    dashLastUpdated: document.getElementById("dash-last-updated"),
    configForm: document.getElementById("config-form"),
    targetMin: document.getElementById("target-min"),
    targetSec: document.getElementById("target-sec"),
    breakMin: document.getElementById("break-min"),
    breakSec: document.getElementById("break-sec"),
    splitsContainer: document.getElementById("splits-container"),
    btnAddSplit: document.getElementById("btn-add-split"),
    btnCalibrate: document.getElementById("btn-calibrate"),
    btnRunStart: document.getElementById("btn-run-start"),
    btnRunStop: document.getElementById("btn-run-stop"),
    configFeedback: document.getElementById("config-feedback"),
    cueCount: document.getElementById("cue-count"),
    motivationMessage: document.getElementById("motivation-message"),
    historyTbody: document.getElementById("history-tbody"),
    historyEmptyMsg: document.getElementById("history-empty-msg"),
    historyTable: document.querySelector(".history-table"),
    btnClearHistory: document.getElementById("btn-clear-history"),
    statusServo: document.getElementById("status-servo"),
    statusMpu: document.getElementById("status-mpu"),
    statusRunState: document.getElementById("status-run-state"),
    statusSwing: document.getElementById("status-swing"),
    statusSwitch: document.getElementById("status-switch"),
    statusBench: document.getElementById("status-bench"),
    serialLog: document.getElementById("serial-log"),
    btnClearLog: document.getElementById("btn-clear-log"),
  };

  const SERIAL_LOG_MAX_LINES = 80;
  const RUN_STATE_LABELS = {
    0: "Idle",
    1: "Recording",
    2: "Rest feedback",
    3: "Needs sync",
    4: "Kinetic cue",
  };

  // --------------------------------------------------------------------------
  // Pace helpers (min:sec display & comparison)
  // --------------------------------------------------------------------------

  /**
   * Format minutes + seconds as m:ss for display.
   * @param {number} min
   * @param {number} sec
   * @returns {string}
   */
  function formatPace(min, sec) {
    const m = Math.max(0, Math.floor(min));
    const s = Math.max(0, Math.floor(sec)) % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  /**
   * Parse "8:30" style string to total seconds per mile.
   * @param {string} paceStr
   * @returns {number|null}
   */
  function paceToSeconds(paceStr) {
    if (!paceStr || paceStr === "—:——") return null;
    const parts = paceStr.split(":");
    if (parts.length !== 2) return null;
    const min = parseInt(parts[0], 10);
    const sec = parseInt(parts[1], 10);
    if (Number.isNaN(min) || Number.isNaN(sec)) return null;
    return min * 60 + sec;
  }

  /**
   * Human-readable delta between target and actual (positive = slower than target).
   * @param {string} targetStr
   * @param {string} actualStr
   * @returns {string}
   */
  function paceDeltaLabel(targetStr, actualStr) {
    const t = paceToSeconds(targetStr);
    const a = paceToSeconds(actualStr);
    if (t === null || a === null) return "";
    const diff = a - t;
    if (diff === 0) return "On target pace";
    const abs = Math.abs(diff);
    const dm = Math.floor(abs / 60);
    const ds = abs % 60;
    const chunk = dm > 0 ? `${dm}m ${ds}s` : `${ds}s`;
    if (diff > 0) {
      el.dashPaceDelta.className = "stat-card__delta stat-card__delta--behind";
      return `${chunk} slower per mile`;
    }
    el.dashPaceDelta.className = "stat-card__delta stat-card__delta--ahead";
    return `${chunk} faster per mile`;
  }

  // --------------------------------------------------------------------------
  // Motivation copy from cue count
  // --------------------------------------------------------------------------

  /**
   * @param {number} cues
   * @returns {string}
   */
  function getMotivationMessage(cues) {
    if (!currentRun.isActive && cues === 0) {
      return "Connect your band and start a run to track cues.";
    }
    if (cues <= 3) return "Locked in! Your rhythm is dialed.";
    if (cues <= 10) return "Solid work — stay smooth and trust the band.";
    if (cues <= 25) return "Keep pushing, find your rhythm!";
    return "Every cue is a reset — breathe, shorten stride, re-lock pace.";
  }

  function updateCueDisplay(count) {
    currentRun.cueCount = count;
    el.cueCount.textContent = String(count);
    el.motivationMessage.textContent = getMotivationMessage(count);
  }

  // --------------------------------------------------------------------------
  // Dashboard UI
  // --------------------------------------------------------------------------

  function updateDashboard(targetMin, targetSec, actualMin, actualSec) {
    const targetStr = formatPace(targetMin, targetSec);
    const actualStr = formatPace(actualMin, actualSec);

    currentRun.targetPace = targetStr;
    currentRun.actualPace = actualStr;

    el.dashTargetPace.textContent = targetStr;
    el.dashActualPace.textContent = actualStr;
    el.dashPaceDelta.textContent = paceDeltaLabel(targetStr, actualStr);

    const now = new Date().toLocaleString();
    el.dashLastUpdated.textContent = `Last update: ${now}`;
  }

  function setRunStatus(active, label) {
    currentRun.isActive = active;
    el.dashRunStatus.textContent = label || (active ? "Run in progress" : "No active run");
  }

  // --------------------------------------------------------------------------
  // localStorage — run history
  // --------------------------------------------------------------------------

  /**
   * @returns {{ runs: Array<{ id: string, timestamp: string, targetPace: string, actualPace: string, totalCues: number }> }}
   */
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { runs: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.runs)) return { runs: [] };
      return parsed;
    } catch (err) {
      console.warn("Failed to load history:", err);
      return { runs: [] };
    }
  }

  function saveHistory(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * @param {{ targetPace: string, actualPace: string, totalCues: number }} run
   */
  function appendRunToHistory(run) {
    const data = loadHistory();
    const entry = {
      id: `run_${Date.now()}`,
      timestamp: new Date().toISOString(),
      targetPace: run.targetPace,
      actualPace: run.actualPace,
      totalCues: run.totalCues,
    };
    data.runs.unshift(entry);
    saveHistory(data);
    renderHistoryTable();
    restoreLatestRunToDashboard(entry);
  }

  function restoreLatestRunToDashboard(entry) {
    if (!entry) return;
    const [tMin, tSec] = entry.targetPace.split(":").map((v) => parseInt(v, 10));
    const [aMin, aSec] = entry.actualPace.split(":").map((v) => parseInt(v, 10));
    updateDashboard(tMin, tSec || 0, aMin, aSec || 0);
    updateCueDisplay(entry.totalCues);
    setRunStatus(false, "Last completed run");
  }

  function renderHistoryTable() {
    const data = loadHistory();
    el.historyTbody.innerHTML = "";

    if (data.runs.length === 0) {
      el.historyEmptyMsg.hidden = false;
      el.historyTable.removeAttribute("aria-hidden");
      return;
    }

    el.historyEmptyMsg.hidden = true;

    data.runs.forEach((run) => {
      const tr = document.createElement("tr");
      const displayTime = new Date(run.timestamp).toLocaleString();
      tr.innerHTML = `
        <td>${escapeHtml(displayTime)}</td>
        <td>${escapeHtml(run.targetPace)}</td>
        <td>${escapeHtml(run.actualPace)}</td>
        <td>${escapeHtml(String(run.totalCues))}</td>
      `;
      el.historyTbody.appendChild(tr);
    });
  }

  function clearHistory() {
    if (!confirm("Clear all saved runs from this browser?")) return;
    saveHistory({ runs: [] });
    renderHistoryTable();
    showFeedback("Run history cleared.", el.configFeedback);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --------------------------------------------------------------------------
  // Web Serial API — connection lifecycle
  // --------------------------------------------------------------------------

  function setConnectionUi(connected) {
    if (connected) {
      el.connectionStatus.className = "chip chip--connected";
      el.connectionStatus.innerHTML =
        '<span class="chip__dot" aria-hidden="true"></span> Connected';
      el.btnConnect.hidden = true;
      el.btnDisconnect.hidden = false;
    } else {
      el.connectionStatus.className = "chip chip--disconnected";
      el.connectionStatus.innerHTML =
        '<span class="chip__dot" aria-hidden="true"></span> Disconnected';
      el.btnConnect.hidden = false;
      el.btnDisconnect.hidden = true;
    }
  }

  async function connectSerial() {
    if (!("serial" in navigator)) {
      alert(
        "Web Serial is not supported in this browser. Use Chrome or Edge on desktop."
      );
      return;
    }

    try {
      serialPort = await navigator.serial.requestPort();
      await serialPort.open({ baudRate: BAUD_RATE });

      const { readable, writable } = serialPort;
      if (!readable || !writable) {
        throw new Error("Port missing readable/writable streams.");
      }

      serialReader = readable.getReader();
      serialWriter = writable.getWriter();
      readLoopActive = true;
      setConnectionUi(true);
      clearSerialLog();
      appendSerialLog("— Connected —");
      showFeedback("Connected at 115200 baud. Syncing run data…", el.configFeedback);

      readSerialLoop();
      const syncResult = await requestWearableSync();
      if (syncResult.runCount > 0) {
        showFeedback(
          `Synced ${syncResult.runCount} run ${syncResult.runCount === 1 ? "entry" : "entries"} from wearable.`,
          el.configFeedback
        );
      } else if (syncResult.noData) {
        showFeedback("No new run data found on wearable. Ready to configure.", el.configFeedback);
      }
    } catch (err) {
      if (err.name === "NotFoundError") {
        showFeedback("No port selected.", el.configFeedback);
      } else {
        console.error(err);
        showFeedback(`Connection failed: ${err.message}`, el.configFeedback);
      }
      await disconnectSerial(false);
    }
  }

  /**
   * @param {boolean} userInitiated
   */
  async function disconnectSerial(userInitiated = true) {
    readLoopActive = false;

    try {
      if (serialReader) {
        await serialReader.cancel();
        serialReader.releaseLock();
      }
    } catch (_) {
      /* ignore */
    }
    serialReader = null;

    try {
      if (serialWriter) {
        serialWriter.releaseLock();
      }
    } catch (_) {
      /* ignore */
    }
    serialWriter = null;

    try {
      if (serialPort && serialPort.readable?.locked) {
        /* reader cancel above should unlock */
      }
      if (serialPort) {
        await serialPort.close();
      }
    } catch (err) {
      console.warn("Close port:", err);
    }

    serialPort = null;
    serialLineBuffer = "";
    setConnectionUi(false);

    if (userInitiated) {
      showFeedback("Disconnected.", el.configFeedback);
    }
  }

  // --------------------------------------------------------------------------
  // Web Serial API — read loop & line assembly
  // --------------------------------------------------------------------------

  async function readSerialLoop() {
    while (readLoopActive && serialReader) {
      try {
        const { value, done } = await serialReader.read();
        if (done) break;
        if (!value) continue;

        // Decode raw bytes from MCU into text; buffer until full lines arrive
        const chunk = TEXT_DECODER.decode(value);
        serialLineBuffer += chunk;

        const lines = serialLineBuffer.split(/\r?\n/);
        serialLineBuffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) parseSerialLine(trimmed);
        }
      } catch (err) {
        if (readLoopActive) {
          console.error("Serial read error:", err);
          showFeedback(`Read error: ${err.message}`, el.configFeedback);
          await disconnectSerial(false);
        }
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Web Serial API — INCOMING line parser (customize for your firmware)
  // --------------------------------------------------------------------------

  /**
   * Main parser: split CSV-style lines from the wearable.
   * Extend the switch cases to match your microcontroller output.
   *
   * @param {string} line - One complete line, e.g. "PACE,8,30,8,45,12"
   */
  function parseSerialLine(line) {
    console.log("[Serial IN]", line);

    const parts = line.split(",").map((p) => p.trim());
    const cmd = (parts[0] || "").toUpperCase();
    const isDbg = cmd === "DBG";
    appendSerialLog(
      line,
      cmd === "ERR" ? "serial-log__line--err" : isDbg ? "serial-log__line--dbg" : ""
    );

    switch (cmd) {
      // PACE,<targetMin>,<targetSec>,<actualMin>,<actualSec>,<cueCount>
      case "PACE": {
        if (parts.length < 6) {
          console.warn("PACE line needs 6 fields:", line);
          return;
        }
        const targetMin = parseInt(parts[1], 10);
        const targetSec = parseInt(parts[2], 10);
        const actualMin = parseInt(parts[3], 10);
        const actualSec = parseInt(parts[4], 10);
        const cues = parseInt(parts[5], 10);

        updateDashboard(targetMin, targetSec, actualMin, actualSec);
        updateCueDisplay(Number.isNaN(cues) ? 0 : cues);
        setRunStatus(true, "Run in progress");
        break;
      }

      // CUE,<count> — lightweight cue-only updates
      case "CUE": {
        const cues = parseInt(parts[1], 10);
        if (!Number.isNaN(cues)) {
          updateCueDisplay(cues);
          setRunStatus(true, "Cue — correcting pace");
        }
        break;
      }

      case "RUN_START":
        updateCueDisplay(0);
        setRunStatus(true, "Run in progress");
        showFeedback("Run started.", el.configFeedback);
        break;

      // RUN_END,<targetMin>,<targetSec>,<actualMin>,<actualSec>,<totalCues>
      case "RUN_END": {
        if (parts.length < 6) {
          console.warn("RUN_END line needs 6 fields:", line);
          return;
        }
        const targetMin = parseInt(parts[1], 10);
        const targetSec = parseInt(parts[2], 10);
        const actualMin = parseInt(parts[3], 10);
        const actualSec = parseInt(parts[4], 10);
        const totalCues = parseInt(parts[5], 10);

        const targetPace = formatPace(targetMin, targetSec);
        const actualPace = formatPace(actualMin, actualSec);

        updateDashboard(targetMin, targetSec, actualMin, actualSec);
        updateCueDisplay(totalCues);
        setRunStatus(false, "Run complete");

        appendRunToHistory({
          targetPace,
          actualPace,
          totalCues: Number.isNaN(totalCues) ? 0 : totalCues,
        });
        if (syncInProgress) {
          syncRunCount += 1;
        }

        showFeedback("Run saved to history.", el.configFeedback);
        break;
      }

      case "ACK":
        if (parts[1] === "CFG") showFeedback("Wearable acknowledged config.", el.configFeedback);
        if (parts[1] === "CAL") showFeedback("Calibration acknowledged.", el.configFeedback);
        if (parts[1] === "SYNC") showFeedback("Run synced from wearable.", el.configFeedback);
        if (parts[1] === "RUN_START") showFeedback("Recording started on band.", el.configFeedback);
        if (parts[1] === "RUN_STOP") showFeedback("Run stopped and saved to band flash.", el.configFeedback);
        if (parts[1] === "CONFIG_READY") {
          showFeedback("Configuration received. Disconnect and ready for run.", el.configFeedback);
        }
        if (parts[1] === "SYNC" && syncWaiter) {
          syncWaiter({ ok: true, runCount: syncRunCount });
        }
        break;

      case "MSG":
        if (parts.length > 1) {
          const msg = parts.slice(1).join(",");
          showFeedback(msg, el.configFeedback);
        }
        break;

      case "SYNC":
        if (parts[1] === "NODATA") {
          showFeedback("No saved run on wearable to sync.", el.configFeedback);
          if (syncWaiter) {
            syncWaiter({ ok: true, runCount: syncRunCount, noData: true });
          }
        }
        break;

      case "STATUS":
        if (parts[1] === "NEEDS_SYNC") {
          showFeedback("Wearable has a run waiting — syncing…", el.configFeedback);
          setTelemetry(el.statusRunState, "Needs sync");
        }
        if (parts[1] === "CONFIG" && parts[2] === "READY") {
          setRunStatus(false, "Ready for run — disconnect USB");
          if (configFinalizeWaiter) {
            configFinalizeWaiter({ ok: true, warnings: [] });
          }
        }
        if (parts[1] === "CONFIG" && parts[2] === "FAIL") {
          const failed = parts.slice(3);
          showFeedback(
            `Hardware check failed: ${failed.join(", ") || "unknown"}`,
            el.configFeedback
          );
          if (configFinalizeWaiter) {
            configFinalizeWaiter({ ok: false, failed });
          }
        }
        if (parts[1] === "HW") {
          handleHardwareStatus(parts);
        }
        if (parts[1] === "MPU" && parts[2] === "WAIT") {
          showFeedback("MPU6050 not ready — check wiring; retrying…", el.configFeedback);
          setTelemetry(el.statusMpu, "Waiting…");
        }
        if (parts[1] === "MPU" && parts[2] === "OK") {
          showFeedback("MPU6050 connected.", el.configFeedback);
          setTelemetry(el.statusMpu, `OK @ 0x${parts[3] || "?"}`);
        }
        if (parts[1] === "SERVO") {
          if (parts[2] === "OK" || parts[2] === "LIB" || parts[2] === "LEDC") {
            setTelemetry(el.statusServo, "OK (D8)");
            showFeedback("Servo attached on D8.", el.configFeedback);
          } else if (parts[2] === "TEST" && parts[3] === "OK") {
            setTelemetry(el.statusServo, "Self-test OK");
            showFeedback("Calibration done — servo self-test ran.", el.configFeedback);
          } else if (parts[2] === "TEST" && parts[3] === "SKIP") {
            setTelemetry(el.statusServo, "Not attached");
            showFeedback("Calibration saved — servo not attached at boot.", el.configFeedback);
          }
        }
        if (parts[1] === "SW") {
          setTelemetry(el.statusSwitch, parts[2] === "1" ? "ON" : "OFF");
        }
        break;

      case "ERR":
        if (parts[1] === "MPU6050_INIT") {
          setTelemetry(el.statusMpu, "Init failed");
          showFeedback("MPU6050 init failed — check D4/D5 wiring.", el.configFeedback);
        }
        if (parts[1] === "SERVO_ATTACH") {
          setTelemetry(el.statusServo, "Attach failed");
          showFeedback("Servo attach failed on D8.", el.configFeedback);
        }
        break;

      case "READY":
        showFeedback("Wearable ready.", el.configFeedback);
        break;

      case "I2C":
        appendSerialLog(`I2C: ${parts.slice(1).join(",")}`, "serial-log__line--err");
        break;

      case "CONFIG": {
        if (parts.length < 5) break;
        const tMin = parseInt(parts[1], 10);
        const tSec = parseInt(parts[2], 10);
        const bMin = parseInt(parts[3], 10);
        const bSec = parseInt(parts[4], 10);
        applyConfigToForm(tMin, tSec, bMin, bSec);
        updateDashboard(tMin, tSec, tMin, tSec);
        saveConfigToBrowser(tMin, tSec, bMin, bSec);
        break;
      }

      case "DBG":
        console.debug("[RaceBand DBG]", parts.slice(1).join(","));
        updateDbgTelemetry(parts);
        break;

      default:
        console.warn("Unrecognized serial line:", line);
    }
  }

  // --------------------------------------------------------------------------
  // Web Serial API — OUTGOING commands to wearable
  // --------------------------------------------------------------------------

  /**
   * Write a newline-terminated command string to the MCU.
   * @param {string} command - Without trailing newline
   */
  async function sendSerialCommand(command) {
    if (!serialWriter) {
      showFeedback("Connect to the wearable first.", el.configFeedback);
      return false;
    }

    const payload = command.endsWith("\n") ? command : `${command}\n`;
    console.log("[Serial OUT]", payload.trim());

    try {
      await serialWriter.write(TEXT_ENCODER.encode(payload));
      return true;
    } catch (err) {
      console.error(err);
      showFeedback(`Send failed: ${err.message}`, el.configFeedback);
      return false;
    }
  }

  function handleHardwareStatus(parts) {
    const component = parts[2];
    const result = parts[3];
    if (component === "MPU") {
      setTelemetry(el.statusMpu, result === "OK" ? "OK" : "FAIL");
    }
    if (component === "SERVO") {
      setTelemetry(el.statusServo, result === "OK" ? "OK (D8)" : "FAIL");
    }
    if (component === "SWITCH") {
      setTelemetry(
        el.statusSwitch,
        result === "OK" ? "OFF (ready)" : "ON (turn off before run)"
      );
    }
    if (component === "BENCH") {
      setTelemetry(el.statusBench, result === "OK" ? "Off" : "Active (stop first)");
    }
    if (component === "SYNC" && result === "WARN") {
      setTelemetry(el.statusRunState, "Sync prior run first");
    }
  }

  function waitForConfigFinalize(timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        configFinalizeWaiter = null;
        reject(new Error("Hardware check timeout"));
      }, timeoutMs);
      configFinalizeWaiter = (result) => {
        clearTimeout(timer);
        configFinalizeWaiter = null;
        resolve(result);
      };
    });
  }

  function waitForSyncResult(timeoutMs = 7000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        syncWaiter = null;
        reject(new Error("Sync timeout"));
      }, timeoutMs);
      syncWaiter = (result) => {
        clearTimeout(timer);
        syncWaiter = null;
        resolve(result);
      };
    });
  }

  async function sendRunConfiguration(event) {
    event.preventDefault();

    if (!serialWriter) {
      showFeedback("Connect to the wearable first.", el.configFeedback);
      return;
    }

    const tMin = parseInt(el.targetMin.value, 10);
    const tSec = parseInt(el.targetSec.value, 10);
    if (Number.isNaN(tMin) || Number.isNaN(tSec)) {
      showFeedback("Enter a valid target pace.", el.configFeedback);
      return;
    }

    showFeedback("Checking for unsynced runs first…", el.configFeedback);
    try {
      const syncResult = await requestWearableSync();
      if (syncResult.runCount > 0) {
        showFeedback(
          `Synced ${syncResult.runCount} pending run ${syncResult.runCount === 1 ? "" : "s"}; now sending configuration…`,
          el.configFeedback
        );
      } else {
        showFeedback("Sending configuration…", el.configFeedback);
      }
    } catch (err) {
      console.warn(err);
      showFeedback("Sync check timed out; sending configuration anyway…", el.configFeedback);
    }

    const lines = [`CFG,TARGET,${tMin},${tSec}`];

    const splitRows = el.splitsContainer.querySelectorAll(".split-row");
    splitRows.forEach((row) => {
      const mile = row.querySelector("[data-split-mile]")?.value;
      const sMin = row.querySelector("[data-split-min]")?.value;
      const sSec = row.querySelector("[data-split-sec]")?.value;
      if (mile && sMin !== "" && sSec !== "") {
        lines.push(`CFG,SPLIT,${mile},${sMin},${sSec}`);
      }
    });

    const bMin = el.breakMin.value;
    const bSec = el.breakSec.value;
    if (bMin !== "" && bSec !== "") {
      lines.push(`CFG,BREAK,${bMin},${bSec}`);
    }

    for (const line of lines) {
      const ok = await sendSerialCommand(line);
      if (!ok) return;
    }

    updateDashboard(tMin, tSec, tMin, tSec);
    saveConfigToBrowser(
      tMin,
      tSec,
      parseInt(el.breakMin.value, 10) || 10,
      parseInt(el.breakSec.value, 10) || 0
    );

    showFeedback("Running hardware checks…", el.configFeedback);
    appendSerialLog("→ CONFIG_FINALIZE");

    const finalizePromise = waitForConfigFinalize();
    const sent = await sendSerialCommand("CONFIG_FINALIZE");
    if (!sent) return;

    try {
      const result = await finalizePromise;
      if (result.ok) {
        showFeedback(
          "Configuration received. Disconnect and ready for run.",
          el.configFeedback
        );
        setRunStatus(false, "Ready for run — disconnect USB, toggle ON");
        await new Promise((r) => setTimeout(r, 2500));
        await disconnectSerial(true);
      }
    } catch (err) {
      console.warn(err);
      showFeedback(
        "Hardware check timed out — see Serial log for STATUS,HW lines.",
        el.configFeedback
      );
    }
  }

  function saveConfigToBrowser(tMin, tSec, bMin, bSec) {
    localStorage.setItem(
      CONFIG_STORAGE_KEY,
      JSON.stringify({ targetMin: tMin, targetSec: tSec, breakMin: bMin, breakSec: bSec })
    );
  }

  function loadConfigFromBrowser() {
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (!raw) return;
      const c = JSON.parse(raw);
      applyConfigToForm(c.targetMin, c.targetSec, c.breakMin, c.breakSec);
      updateDashboard(c.targetMin, c.targetSec, c.targetMin, c.targetSec);
    } catch (e) {
      console.warn("Config load failed", e);
    }
  }

  function applyConfigToForm(tMin, tSec, bMin, bSec) {
    if (!Number.isNaN(tMin)) el.targetMin.value = tMin;
    if (!Number.isNaN(tSec)) el.targetSec.value = tSec;
    if (!Number.isNaN(bMin)) el.breakMin.value = bMin;
    if (!Number.isNaN(bSec)) el.breakSec.value = bSec;
  }

  async function startBenchRun() {
    await sendSerialCommand("RUN,START");
  }

  async function stopBenchRun() {
    await sendSerialCommand("RUN,STOP");
    await new Promise((r) => setTimeout(r, 400));
    await requestWearableSync();
  }

  async function sendCalibrate() {
    appendSerialLog("→ CALIBRATE");
    const ok = await sendSerialCommand("CALIBRATE");
    if (ok) showFeedback("Calibration sent — watch Serial log & Servo status.", el.configFeedback);
  }

  /** Ask ESP32 NVS for the last run (after USB reconnect / power-loss). */
  async function requestWearableSync() {
    if (!serialWriter) {
      return { ok: false, runCount: 0, noData: true };
    }
    syncInProgress = true;
    syncRunCount = 0;
    await new Promise((resolve) => setTimeout(resolve, 350));
    await sendSerialCommand("GET_CONFIG");

    const waiter = waitForSyncResult();
    const sent = await sendSerialCommand("SYNC_REQUEST");
    if (!sent) {
      syncInProgress = false;
      return { ok: false, runCount: 0, noData: true };
    }
    try {
      const result = await waiter;
      syncInProgress = false;
      return result;
    } catch (_) {
      // Retry once for slow boot/read loops.
      const retryWaiter = waitForSyncResult(6000);
      await sendSerialCommand("SYNC_REQUEST");
      try {
        const retryResult = await retryWaiter;
        syncInProgress = false;
        return retryResult;
      } catch (err) {
        syncInProgress = false;
        throw err;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Split pace UI (dynamic rows)
  // --------------------------------------------------------------------------

  let splitCounter = 0;

  function addSplitRow() {
    splitCounter += 1;
    const mile = splitCounter;

    const row = document.createElement("div");
    row.className = "split-row";
    row.innerHTML = `
      <span class="split-row__mile">Mile ${mile}</span>
      <label class="field">
        <span class="field__label">Min</span>
        <input type="number" data-split-min min="0" max="59" placeholder="8" />
      </label>
      <label class="field">
        <span class="field__label">Sec</span>
        <input type="number" data-split-sec min="0" max="59" placeholder="00" />
      </label>
      <input type="hidden" data-split-mile value="${mile}" />
      <button type="button" class="btn btn--outlined btn--compact btn-remove-split">
        <span class="btn__label">Remove</span>
      </button>
    `;

    row.querySelector(".btn-remove-split").addEventListener("click", () => {
      row.remove();
    });

    el.splitsContainer.appendChild(row);
  }

  // --------------------------------------------------------------------------
  // UI utilities
  // --------------------------------------------------------------------------

  function showFeedback(message, node) {
    node.textContent = message;
  }

  function appendSerialLog(line, cssClass) {
    if (!el.serialLog) return;
    const ts = new Date().toLocaleTimeString();
    const row = document.createElement("div");
    row.className = cssClass ? `serial-log__line ${cssClass}` : "serial-log__line";
    row.textContent = `${ts}  ${line}`;
    el.serialLog.appendChild(row);
    while (el.serialLog.childNodes.length > SERIAL_LOG_MAX_LINES) {
      el.serialLog.removeChild(el.serialLog.firstChild);
    }
    el.serialLog.scrollTop = el.serialLog.scrollHeight;
  }

  function clearSerialLog() {
    if (el.serialLog) el.serialLog.innerHTML = "";
  }

  function setTelemetry(field, text) {
    if (field) field.textContent = text;
  }

  function updateDbgTelemetry(parts) {
    if (parts.length < 8) return;
    const swing = parts[2];
    const stateCode = parseInt(parts[3], 10);
    const sw = parts[6];
    const bench = parts[7];
    setTelemetry(el.statusSwing, swing);
    setTelemetry(
      el.statusRunState,
      RUN_STATE_LABELS[stateCode] ?? `State ${stateCode}`
    );
    setTelemetry(el.statusSwitch, sw === "1" ? "ON" : "OFF");
    setTelemetry(el.statusBench, bench === "1" ? "Active" : "Off");
  }

  // --------------------------------------------------------------------------
  // Boot — wire events & hydrate from storage
  // --------------------------------------------------------------------------

  function init() {
    el.btnConnect.addEventListener("click", connectSerial);
    el.btnDisconnect.addEventListener("click", () => disconnectSerial(true));
    el.configForm.addEventListener("submit", sendRunConfiguration);
    el.btnCalibrate.addEventListener("click", sendCalibrate);
    el.btnRunStart.addEventListener("click", startBenchRun);
    el.btnRunStop.addEventListener("click", stopBenchRun);
    el.btnAddSplit.addEventListener("click", addSplitRow);
    loadConfigFromBrowser();
    el.btnClearHistory.addEventListener("click", clearHistory);
    el.btnClearLog.addEventListener("click", clearSerialLog);

    navigator.serial?.addEventListener("disconnect", () => {
      disconnectSerial(false);
      showFeedback("Device unplugged.", el.configFeedback);
    });

    renderHistoryTable();

    const data = loadHistory();
    if (data.runs.length > 0) {
      restoreLatestRunToDashboard(data.runs[0]);
    }

    setConnectionUi(false);
    updateCueDisplay(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
