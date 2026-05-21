#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

Adafruit_MPU6050 mpu;

// Pin Definitions matching your schematic
const int ledPin = D9;      
const int switchPin = D3; // Update this to wherever your switch is wired!  

// Pace Variables
float targetPace = 8.0; 
float targetIntensity = 0.0;

// Variables needed for a "non-blocking" blink
unsigned long previousMillis = 0;
const long blinkInterval = 500; // Blink speed (500ms on, 500ms off)
bool ledState = LOW;

void setup() {
  Serial.begin(115200);
  
  pinMode(ledPin, OUTPUT);
  pinMode(switchPin, INPUT_PULLUP); 

  if (!mpu.begin()) {
    Serial.println("MPU6050 connection failed. Check wiring.");
    while (1) { delay(10); }
  }
  
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  
  Serial.println("System Ready.");
  Serial.println("Type your target pace (e.g. 8.5) in the top bar and press Enter:");
  
  targetIntensity = 25.0 / targetPace; 
}

void loop() {
  // 1. Check for User Input
  if (Serial.available() > 0) {
    targetPace = Serial.parseFloat();
    
    while(Serial.available() > 0) {
      Serial.read();
    }
    
    Serial.print("New target pace set to: ");
    Serial.print(targetPace);
    Serial.println(" min/mile");
    
    targetIntensity = 25.0 / targetPace; 
  }

  // 2. Read Switch
  bool systemOn = (digitalRead(switchPin) == LOW); 

  // 3. Main Logic
  if (systemOn) {
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    float magnitude = sqrt(pow(a.acceleration.x, 2) + pow(a.acceleration.y, 2) + pow(a.acceleration.z, 2));
    float dynamicAccel = abs(magnitude - 9.81);

    // FEEDBACK LOGIC: Check if moving too slow
    if (dynamicAccel < targetIntensity) { 
      
      // Non-blocking blink
      unsigned long currentMillis = millis();
      if (currentMillis - previousMillis >= blinkInterval) {
        previousMillis = currentMillis; 
        ledState = !ledState; // Flip state
        digitalWrite(ledPin, ledState);
      }
      
    } else {
      // You are on pace or faster! Keep the LED off.
      digitalWrite(ledPin, LOW);
      ledState = LOW; 
    }
    
  } else {
    // System turned off
    digitalWrite(ledPin, LOW); 
    ledState = LOW;
  }
  
  // Notice: The delay(100) has been removed so the loop runs fast enough to catch the blink timing!
}