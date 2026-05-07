int ledPin = 9;      
int potPin = A0;     

int potValue = 0;    
int lastPotValue = 0; // Remembers the last knob position to detect movement
int brightness = 0;  

// --- Timer Variables ---
unsigned long lastInteractionTime = 0; // The stopwatch memory
const unsigned long idleThreshold = 300000; // 5 minutes (5 * 60 * 1000)
// TIP: Change 300000 to 5000 (5 seconds) to test it without waiting 5 minutes!

// --- Fading Variables ---
int fadeBrightness = 0;
int fadeAmount = 5; // How much the brightness changes each loop

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600); 
}

void loop() {
  potValue = analogRead(potPin);

  // 1. Detect Interaction: Did the knob move significantly?
  // Using abs() gives us the absolute difference, and > 2 ignores electrical noise
  if (abs(potValue - lastPotValue) > 2) {
    lastInteractionTime = millis(); // Reset the stopwatch!
    lastPotValue = potValue;        // Save the new position
  }

  // 2. Check the Stopwatch: Have we been idle for 5 minutes?
  if (millis() - lastInteractionTime >= idleThreshold) {
    
    // ==========================================
    // IDLE MODE: Fading Animation
    // ==========================================
    Serial.println("Status: Idle Mode - Fading");
    
    // Add the fade amount to the current brightness
    fadeBrightness = fadeBrightness + fadeAmount;

    // If we hit the absolute maximum (255) or minimum (0), reverse the math
    if (fadeBrightness <= 0 || fadeBrightness >= 255) {
      fadeAmount = -fadeAmount; 
    }
    
    analogWrite(ledPin, fadeBrightness);

  } else {
    
    // ==========================================
    // MANUAL MODE: Potentiometer Control
    // ==========================================
    brightness = map(potValue, 0, 1023, 0, 255);
    analogWrite(ledPin, brightness);

    Serial.print("Potentiometer: ");
    Serial.print(potValue);
    Serial.print(" -> LED PWM: ");
    Serial.println(brightness);

    if (potValue > 10) {
      Serial.println("Status: Lid open");
    } else {
      Serial.println("Status: Lid closed");
    }
  }

  // I reduced this from 100 to 30. A 30ms delay makes the fading 
  // animation look much smoother to the human eye!
  delay(30); 
}