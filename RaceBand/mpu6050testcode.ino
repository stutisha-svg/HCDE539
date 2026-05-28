/*
 * RaceBand — MPU6050 + LED bench test (HCDE 539)
 * Prints accelerometer values every 15 s; blinks LED every 500 ms (non-blocking).
 *
 * Third-party: Adafruit MPU6050, Adafruit Unified Sensor, Arduino Wire.
 */

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

Adafruit_MPU6050 mpu;

// Pin Definitions
const int ledPin = D9;

// Timing variables for Task 1: Sensor Reading (15 seconds)
unsigned long previousSensorMillis = 0;
const long sensorInterval = 15000; 

// Timing variables for Task 2: LED Blinking (500 milliseconds)
unsigned long previousBlinkMillis = 0;
const long blinkInterval = 500; 
bool ledState = LOW;

void setup() {
  Serial.begin(115200);
  pinMode(ledPin, OUTPUT);

  // Give the serial monitor a moment to catch up
  delay(2000); 
  Serial.println("--- STARTING DUAL-TIMER TEST ---");

  // Initialize Sensor
  if (!mpu.begin()) {
    Serial.println("MPU6050 connection failed. Check wiring.");
    while (1) { delay(10); } // Stop here if sensor fails
  }
  
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  Serial.println("MPU6050 Initialized successfully.");
  Serial.println("LED should be blinking. First sensor reading in 15 seconds...");
}

void loop() {
  // Get the current "clock time" of the microcontroller
  unsigned long currentMillis = millis();

  // ---------------------------------------------------------
  // TASK 1: Print MPU6050 values every 15 seconds
  // ---------------------------------------------------------
  if (currentMillis - previousSensorMillis >= sensorInterval) {
    previousSensorMillis = currentMillis; // Reset the 15-second timer

    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    Serial.println("\n--- 15 Second Update ---");
    Serial.print("Accel X: "); Serial.print(a.acceleration.x);
    Serial.print(" | Y: "); Serial.print(a.acceleration.y);
    Serial.print(" | Z: "); Serial.print(a.acceleration.z);
    Serial.println(" m/s^2");
  }

  // ---------------------------------------------------------
  // TASK 2: Blink the LED continuously
  // ---------------------------------------------------------
  if (currentMillis - previousBlinkMillis >= blinkInterval) {
    previousBlinkMillis = currentMillis; // Reset the 500ms timer
    
    ledState = !ledState; // Flip the state
    digitalWrite(ledPin, ledState);
  }
}