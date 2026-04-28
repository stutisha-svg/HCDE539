#include <LiquidCrystal.h>

// ── Pin definitions ───────────────────────────────────────────────
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

const int BTN_THOUSANDS = 10;
const int BTN_HUNDREDS  = 7;
const int BTN_TENS      = 9;
const int BTN_ONES      = 8;
const int BUZZER_PIN    = 6;

const int BUTTONS[4]    = {BTN_THOUSANDS, BTN_HUNDREDS, BTN_TENS, BTN_ONES};

// ── Note frequencies ──────────────────────────────────────────────
#define NOTE_B3  247
#define NOTE_C4  262
#define NOTE_D4  294
#define NOTE_E4  330
#define NOTE_F4  349
#define NOTE_G4  392
#define NOTE_A4  440
#define NOTE_B4  494
#define NOTE_C5  523
#define NOTE_D5  587
#define NOTE_E5  659
#define NOTE_F5  698
#define NOTE_G5  784
#define NOTE_A5  880
#define NOTE_AS4 466
#define NOTE_DS4 311
#define NOTE_GS4 415
#define NOTE_CS5 554
#define NOTE_FS5 740
#define NOTE_E3  165
#define NOTE_G3  196
#define NOTE_A3  220
#define NOTE_AS3 233
#define NOTE_GS3 208
#define REST     0

// ── Pokemon theme melody ──────────────────────────────────────────
// Simplified iconic intro riff
int themeNotes[] = {
  NOTE_E4, NOTE_E4, REST, NOTE_E4, REST, NOTE_C4, NOTE_E4, REST,
  NOTE_G4, REST, REST, NOTE_G3,
  NOTE_C4, REST, NOTE_G3, REST, NOTE_E3,
  NOTE_A3, NOTE_B3, NOTE_AS3, NOTE_A3,
  NOTE_G3, NOTE_E4, NOTE_G4, NOTE_A4, NOTE_F4, NOTE_G4,
  REST, NOTE_E4, NOTE_C4, NOTE_D4, NOTE_B3
};
int themeDurations[] = {
  125,125,125,125,125,125,125,125,
  125,125,250,250,
  150,150,150,150,150,
  125,125,125,125,
  83,83,83,125,125,125,
  125,125,125,125,125
};
const int THEME_LEN = sizeof(themeNotes) / sizeof(themeNotes[0]);

// ── Type tunes (short 4-note motifs per type) ─────────────────────
// Fire
int fireNotes[]     = {NOTE_E5, NOTE_G5, NOTE_A5, NOTE_G5};
int fireDur[]       = {150, 100, 200, 300};
// Water
int waterNotes[]    = {NOTE_C5, NOTE_E5, NOTE_G5, NOTE_E5};
int waterDur[]      = {200, 150, 200, 400};
// Grass
int grassNotes[]    = {NOTE_G4, NOTE_B4, NOTE_D5, NOTE_G5};
int grassDur[]      = {150, 150, 150, 400};
// Electric
int electricNotes[] = {NOTE_E5, NOTE_E5, NOTE_G5, NOTE_E5};
int electricDur[]   = {80, 80, 150, 300};
// Rock
int rockNotes[]     = {NOTE_C4, NOTE_G4, NOTE_E4, NOTE_C5};
int rockDur[]       = {200, 200, 200, 400};
// Psychic
int psychicNotes[]  = {NOTE_A4, NOTE_CS5, NOTE_E5, NOTE_A5};
int psychicDur[]    = {200, 200, 200, 400};
// Default
int defaultNotes[]  = {NOTE_C5, NOTE_D5, NOTE_E5, NOTE_C5};
int defaultDur[]    = {150, 150, 150, 300};
const int MOTIF_LEN = 4;

// Win jingle (ascending fanfare)
int winNotes[]  = {NOTE_C4, NOTE_E4, NOTE_G4, NOTE_C5, NOTE_G4, NOTE_C5};
int winDur[]    = {125, 125, 125, 250, 125, 500};
const int WIN_LEN = 6;

// Lose jingle (descending sad)
int loseNotes[] = {NOTE_C5, NOTE_B4, NOTE_A4, NOTE_G4, NOTE_E4, NOTE_C4};
int loseDur[]   = {150, 150, 150, 150, 200, 500};
const int LOSE_LEN = 6;

// ── Game state ────────────────────────────────────────────────────
const int MAX_TRIES   = 3;
const int GOAL_COUNT  = 2;  // need 2 rock types

int  triesLeft        = MAX_TRIES;
int  rockCaught       = 0;
bool gameActive       = false;
bool waitingForResult = false;

// Per-try storage
struct TryResult {
  char name[20];
  char type[20];
  char stat[24];   // e.g. "ATK:150"
  bool isRock;
  bool received;
};
TryResult tries[MAX_TRIES];
int currentTry = 0;

// ── Input state ───────────────────────────────────────────────────
int  digits[4]           = {0, 0, 0, 0};
unsigned long lastPress[4]   = {0, 0, 0, 0};
bool lastState[4]            = {HIGH, HIGH, HIGH, HIGH};
const unsigned long DEBOUNCE = 200;

bool digitChanged            = false;  // flag: show ID, not countdown
unsigned long lastDigitTime  = 0;
const unsigned long ID_SHOW_MS   = 3000; // show ID for 3s after last press
bool countingDown            = false;
unsigned long countdownStart = 0;

// ── Display state ─────────────────────────────────────────────────
byte customChars[8][8];
int  charsReceived   = 0;
char scrollStr[60]   = "";
int  scrollOffset    = 0;
unsigned long lastScroll = 0;
const unsigned long SCROLL_MS = 350;

char currentType[20] = "";   // used for type tune selection

// ── State machine ─────────────────────────────────────────────────
enum State {
  INTRO,          // show game rules, play theme
  INPUTTING,      // digit entry
  SHOWING_ID,     // show ID for 3s before sending
  SENDING,        // transmit to Python
  RECEIVING,      // wait for sprite data
  SHOWING_RESULT, // display art + scroll name/type/stat
  GAME_OVER       // win or lose screen
};
State state = INTRO;

// ── Theme playback (non-blocking) ────────────────────────────────
int  themeIndex      = 0;
unsigned long noteStart  = 0;
bool themeRunning    = false;
bool themeDone       = false;

void startTheme() {
  themeIndex   = 0;
  themeRunning = true;
  themeDone    = false;
  noteStart    = millis();
  tone(BUZZER_PIN, themeNotes[0], themeDurations[0]);
}

void stopTheme() {
  themeRunning = false;
  noTone(BUZZER_PIN);
}

void tickTheme() {
  if (!themeRunning) return;
  unsigned long now = millis();
  int dur = themeDurations[themeIndex];
  if (now - noteStart >= (unsigned long)dur + 30) {
    themeIndex++;
    if (themeIndex >= THEME_LEN) {
      themeIndex   = 0;   // loop
    }
    noteStart = now;
    if (themeNotes[themeIndex] == REST) {
      noTone(BUZZER_PIN);
    } else {
      tone(BUZZER_PIN, themeNotes[themeIndex], themeDurations[themeIndex]);
    }
  }
}

// ── Blocking melody player (for short motifs) ─────────────────────
void playMelody(int* notes, int* durs, int len) {
  for (int i = 0; i < len; i++) {
    if (notes[i] == REST) {
      noTone(BUZZER_PIN);
    } else {
      tone(BUZZER_PIN, notes[i], durs[i]);
    }
    delay(durs[i] + 30);
  }
  noTone(BUZZER_PIN);
}

void playTypeTune(const char* type) {
  if      (strstr(type, "Fire"))     playMelody(fireNotes,     fireDur,     MOTIF_LEN);
  else if (strstr(type, "Water"))    playMelody(waterNotes,    waterDur,    MOTIF_LEN);
  else if (strstr(type, "Grass"))    playMelody(grassNotes,    grassDur,    MOTIF_LEN);
  else if (strstr(type, "Electric")) playMelody(electricNotes, electricDur, MOTIF_LEN);
  else if (strstr(type, "Rock"))     playMelody(rockNotes,     rockDur,     MOTIF_LEN);
  else if (strstr(type, "Psychic"))  playMelody(psychicNotes,  psychicDur,  MOTIF_LEN);
  else                               playMelody(defaultNotes,  defaultDur,  MOTIF_LEN);
}

// ── Setup ─────────────────────────────────────────────────────────
void setup() {
  Serial.begin(9600);
  lcd.begin(16, 2);
  pinMode(BUZZER_PIN, OUTPUT);
  for (int i = 0; i < 4; i++) pinMode(BUTTONS[i], INPUT_PULLUP);

  showIntro();
  startTheme();
  state = INTRO;
}

// ── Main loop ─────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();
  tickTheme();

  switch (state) {

    case INTRO:
      // Wait for any button press to start
      for (int i = 0; i < 4; i++) {
        if (digitalRead(BUTTONS[i]) == LOW) {
          delay(200);
          stopTheme();
          startGame();
          return;
        }
      }
      break;

    case INPUTTING:
      handleButtons(now);
      break;

    case SHOWING_ID: {
      handleButtons(now);   // still allow changes, resets timer
      unsigned long elapsed = now - lastDigitTime;
      long remaining = (long)(ID_SHOW_MS - elapsed);

      // Show ID and countdown on second row
      lcd.setCursor(0, 0);
      lcd.print("Pokemon  ID:    ");
      lcd.setCursor(3, 1);
      lcd.print(digits[0]);
      lcd.print(digits[1]);
      lcd.print(digits[2]);
      lcd.print(digits[3]);
      lcd.print(" send:");
      lcd.print(max(1L, remaining / 1000 + 1));
      lcd.print("s ");

      if (remaining <= 0) {
        state = SENDING;
      }
      break;
    }

    case SENDING:
      stopTheme();
      sendID();
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Fetching...     ");
      lcd.setCursor(0, 1);
      lcd.print("Try ");
      lcd.print(currentTry + 1);
      lcd.print("/");
      lcd.print(MAX_TRIES);
      lcd.print("          ");
      state = RECEIVING;
      break;

    case RECEIVING:
      readSerial();
      break;

    case SHOWING_RESULT:
      if (now - lastScroll > SCROLL_MS) {
        lastScroll = now;
        scrollTicker();
      }
      // Any button = next try or game over
      for (int i = 0; i < 4; i++) {
        if (digitalRead(BUTTONS[i]) == LOW) {
          delay(200);
          nextTry();
          return;
        }
      }
      break;

    case GAME_OVER:
      // Any button restarts
      for (int i = 0; i < 4; i++) {
        if (digitalRead(BUTTONS[i]) == LOW) {
          delay(200);
          resetGame();
          return;
        }
      }
      break;
  }
}

// ── Game logic ────────────────────────────────────────────────────

void showIntro() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Catch 2 ROCK    ");
  lcd.setCursor(0, 1);
  lcd.print("Pokemon! 3 tries");
}

void startGame() {
  triesLeft  = MAX_TRIES;
  rockCaught = 0;
  currentTry = 0;
  for (int i = 0; i < MAX_TRIES; i++) tries[i].received = false;
  resetDigits();
  showTryPrompt();
  startTheme();
  state = INPUTTING;
}

void showTryPrompt() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Try ");
  lcd.print(currentTry + 1);
  lcd.print("/");
  lcd.print(MAX_TRIES);
  lcd.print(" Rock:");
  lcd.print(rockCaught);
  lcd.print("/");
  lcd.print(GOAL_COUNT);
  lcd.print("  ");
  lcd.setCursor(0, 1);
  lcd.print("Enter ID: 0000  ");
}

void nextTry() {
  currentTry++;

  // Check win condition
  if (rockCaught >= GOAL_COUNT) {
    showGameOver(true);
    return;
  }

  // Check lose condition
  if (currentTry >= MAX_TRIES) {
    showGameOver(false);
    return;
  }

  // Continue
  resetDigits();
  showTryPrompt();
  startTheme();
  state = INPUTTING;
}

void showGameOver(bool won) {
  stopTheme();
  lcd.clear();
  if (won) {
    lcd.setCursor(0, 0);
    lcd.print("You WIN!        ");
    lcd.setCursor(0, 1);
    lcd.print("Great Trainer!  ");
    playMelody(winNotes, winDur, WIN_LEN);
  } else {
    lcd.setCursor(0, 0);
    lcd.print("You LOSE...     ");
    lcd.setCursor(0, 1);
    lcd.print("Rock:"); lcd.print(rockCaught);
    lcd.print("/"); lcd.print(GOAL_COUNT);
    lcd.print("        ");
    playMelody(loseNotes, loseDur, LOSE_LEN);
  }
  lcd.setCursor(0, 1);
  if (won) lcd.print("Btn to restart  ");
  else     lcd.print("Try again? Btn  ");
  state = GAME_OVER;
}

void resetGame() {
  resetDigits();
  showIntro();
  startTheme();
  state = INTRO;
}

// ── Input ─────────────────────────────────────────────────────────

void handleButtons(unsigned long now) {
  for (int i = 0; i < 4; i++) {
    bool s = digitalRead(BUTTONS[i]);
    if (s == LOW && lastState[i] == HIGH) {
      if (now - lastPress[i] > DEBOUNCE) {
        digits[i]     = (digits[i] + 1) % 10;
        lastPress[i]  = now;
        lastDigitTime = now;   // reset 3s timer
        state         = SHOWING_ID;
        stopTheme();
        showCurrentID();
      }
    }
    lastState[i] = s;
  }
}

void showCurrentID() {
  lcd.setCursor(0, 0);
  lcd.print("Pokemon  ID:    ");
  lcd.setCursor(3, 1);
  lcd.print(digits[0]);
  lcd.print(digits[1]);
  lcd.print(digits[2]);
  lcd.print(digits[3]);
  lcd.print("          ");
}

void resetDigits() {
  for (int i = 0; i < 4; i++) digits[i] = 0;
  charsReceived = 0;
  scrollStr[0]  = '\0';
  scrollOffset  = 0;
}

void sendID() {
  char buf[6];
  snprintf(buf, sizeof(buf), "%d%d%d%d",
           digits[0], digits[1], digits[2], digits[3]);
  Serial.println(buf);
}

// ── Serial receive ────────────────────────────────────────────────

void readSerial() {
  while (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();

    if (line.startsWith("NAME:")) {
      line.substring(5).toCharArray(tries[currentTry].name, 20);

    } else if (line.startsWith("TYPE:")) {
      line.substring(5).toCharArray(tries[currentTry].type, 20);
      line.substring(5).toCharArray(currentType, 20);

      // Check if rock type
      tries[currentTry].isRock = (line.indexOf("Rock") >= 0);
      if (tries[currentTry].isRock) rockCaught++;

    } else if (line.startsWith("STAT:")) {
      line.substring(5).toCharArray(tries[currentTry].stat, 24);

    } else if (line.startsWith("CHAR:")) {
      int secondColon = line.indexOf(':', 5);
      int charIndex   = line.substring(5, secondColon).toInt();
      String byteStr  = line.substring(secondColon + 1);
      for (int b = 0; b < 8; b++) {
        int comma = byteStr.indexOf(',');
        String val = (comma == -1) ? byteStr : byteStr.substring(0, comma);
        customChars[charIndex][b] = (byte)val.toInt();
        if (comma != -1) byteStr = byteStr.substring(comma + 1);
      }
      charsReceived++;

    } else if (line == "DONE") {
      tries[currentTry].received = true;
      for (int i = 0; i < 8; i++) lcd.createChar(i, customChars[i]);
      renderSprite();
      buildScrollStr();
      scrollOffset = 0;
      lastScroll   = millis();
      playTypeTune(currentType);
      state = SHOWING_RESULT;

    } else if (line.startsWith("ERROR:")) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Not found!      ");
      lcd.setCursor(0, 1);
      lcd.print("Press btn retry ");
      state = SHOWING_RESULT;   // button press moves to nextTry
    }
  }
}

// ── Display ───────────────────────────────────────────────────────

void renderSprite() {
  lcd.clear();
  lcd.setCursor(0, 0);
  for (int i = 0; i < 4; i++) lcd.write(byte(i));
  lcd.setCursor(0, 1);
  for (int i = 4; i < 8; i++) lcd.write(byte(i));
}

void buildScrollStr() {
  // Format: "BULBASAUR  Grass/Poison  ATK:49  ID:1   "
  char idStr[8];
  snprintf(idStr, sizeof(idStr), "ID:%d",
           digits[0]*1000 + digits[1]*100 + digits[2]*10 + digits[3]);
  snprintf(scrollStr, sizeof(scrollStr), "%s  %s  %s  %s     ",
           tries[currentTry].name,
           tries[currentTry].type,
           tries[currentTry].stat,
           idStr);
}

void scrollTicker() {
  int len = strlen(scrollStr);
  if (len == 0) return;
  lcd.setCursor(5, 0);
  for (int i = 0; i < 11; i++) {
    lcd.write(scrollStr[(scrollOffset + i) % len]);
  }
  // Row 1: rock progress
  lcd.setCursor(5, 1);
  lcd.print("Rock:");
  lcd.print(rockCaught);
  lcd.print("/");
  lcd.print(GOAL_COUNT);
  lcd.print("    ");
  scrollOffset = (scrollOffset + 1) % len;
}