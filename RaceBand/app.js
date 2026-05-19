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
 *
 * OUTGOING (browser → device), examples:
 *   CFG,TARGET,8,30\n
 *   CFG,SPLIT,1,8,0\n        → mile 1 at 8:00
 *   CFG,BREAK,10,0\n
 *   CALIBRATE\n
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
    configFeedback: document.getElementById("config-feedback"),
    cueCount: document.getElementById("cue-count"),
    motivationMessage: document.getElementById("motivation-message"),
    historyTbody: document.getElementById("history-tbody"),
    historyEmptyMsg: document.getElementById("history-empty-msg"),
    historyTable: document.querySelector(".history-table"),
    btnClearHistory: document.getElementById("btn-clear-history"),
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
      showFeedback("Connected at 115200 baud.", el.configFeedback);

      readSerialLoop();
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
        if (!Number.isNaN(cues)) updateCueDisplay(cues);
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

        showFeedback("Run saved to history.", el.configFeedback);
        break;
      }

      case "ACK":
        if (parts[1] === "CFG") showFeedback("Wearable acknowledged config.", el.configFeedback);
        if (parts[1] === "CAL") showFeedback("Calibration acknowledged.", el.configFeedback);
        break;

      default:
        // Unknown line — log for debugging while tuning firmware
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

  async function sendRunConfiguration(event) {
    event.preventDefault();

    const tMin = parseInt(el.targetMin.value, 10);
    const tSec = parseInt(el.targetSec.value, 10);
    if (Number.isNaN(tMin) || Number.isNaN(tSec)) {
      showFeedback("Enter a valid target pace.", el.configFeedback);
      return;
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
    showFeedback("Configuration sent to wearable.", el.configFeedback);
  }

  async function sendCalibrate() {
    const ok = await sendSerialCommand("CALIBRATE");
    if (ok) showFeedback("Calibration command sent.", el.configFeedback);
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

  // --------------------------------------------------------------------------
  // Boot — wire events & hydrate from storage
  // --------------------------------------------------------------------------

  function init() {
    el.btnConnect.addEventListener("click", connectSerial);
    el.btnDisconnect.addEventListener("click", () => disconnectSerial(true));
    el.configForm.addEventListener("submit", sendRunConfiguration);
    el.btnCalibrate.addEventListener("click", sendCalibrate);
    el.btnAddSplit.addEventListener("click", addSplitRow);
    el.btnClearHistory.addEventListener("click", clearHistory);

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
