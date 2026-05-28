#include <Wire.h>

// Explicitly define your physical data lines
const int mySDA = D4;
const int mySCL = D5;

void setup() {
  Serial.begin(115200);
  
  // Wait a moment for the serial monitor to open
  delay(2000); 
  
  Serial.println("\nStarting Custom I2C Scanner...");
  Serial.print("Looking on SDA: D4 | SCL: D5");
  Serial.println("\n------------------------------");

  // Boot the I2C bus using your exact pins
  Wire.begin(mySDA, mySCL);
}

void loop() {
  byte error, address;
  int nDevices = 0;

  Serial.println("Scanning...");

  for(address = 1; address < 127; address++ ) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("SUCCESS! I2C device found at address 0x");
      if (address < 16) {
        Serial.print("0");
      }
      Serial.print(address, HEX);
      Serial.println(" !");
      nDevices++;
    }
    else if (error == 4) {
      Serial.print("Unknown error at address 0x");
      if (address < 16) {
        Serial.print("0");
      }
      Serial.println(address, HEX);
    }    
  }
  
  if (nDevices == 0) {
    Serial.println("No I2C devices found. Wires crossed or dead board.");
  } else {
    Serial.println("Scan complete.\n");
  }

  delay(5000); // Scan every 5 seconds
}