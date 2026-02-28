/**
 * ESP8266 D1 Mini — MFRC522 NFC Attendance Reader/Writer
 *
 * Fixed pin assignments (DO NOT CHANGE):
 *   D0  (GPIO16) = Buzzer
 *   D1  (GPIO5)  = MFRC522 RST
 *   D2  (GPIO4)  = MFRC522 SS (SPI CS)
 *   D4  (GPIO2)  = NeoPixel data
 *   D5  (GPIO14) = SPI CLK  (implicit via SPI.begin)
 *   D6  (GPIO12) = SPI MISO (implicit via SPI.begin)
 *   D7  (GPIO13) = SPI MOSI (implicit via SPI.begin)
 *
 * NeoPixel LED meanings:
 *   LED 0 — WiFi   : blue=connected | blinking-green=connecting | red=failed
 *   LED 1 — Mode   : blue=reader-ready | purple=writer-ready | red=HTTP error
 *   LED 2+3 — Op   : green=success | yellow=unknown card (404) | red=error/idle
 *
 * Modes (switchable from web config UI):
 *   reader — reads sector 1 block 4, POSTs {"employeeId":"..."} to endpoint
 *   writer — waits for card, writes pending employee ID string to sector 1 block 4
 *
 * Config stored in SPIFFS /config.json:
 *   ssid, password, apPassword, endpoint, jwtToken, mode, writePayload
 */

#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <Adafruit_NeoPixel.h>

// ─── Pin definitions (FIXED — do not change) ─────────────────────────────────
#define LED_PIN    D4   // NeoPixel data
#define LED_COUNT  4
#define RST_PIN    D1   // MFRC522 reset
#define SS_PIN     D2   // MFRC522 SPI chip-select
#define BUZZER_PIN D0   // Passive buzzer

// ─── Hardware objects ─────────────────────────────────────────────────────────
MFRC522 mfrc522(SS_PIN, RST_PIN);
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);
ESP8266WebServer server(80);

// ─── Config variables (loaded from / saved to SPIFFS) ────────────────────────
char ssid[64]          = "";
char wifiPassword[64]  = "";
char apPassword[64]    = "admin1234";
char endpoint[256]     = "";   // e.g. https://your-app.vercel.app/api/attendance
char jwtToken[512]     = "";   // static Bearer token
char mode[8]           = "reader";  // "reader" | "writer"
char writePayload[64]  = "";   // employee ID to write next (writer mode only)

// ─── Runtime state ───────────────────────────────────────────────────────────
bool writerArmed   = false;
int  lastHttpCode  = 0;
String lastCardId  = "";
String lastOpResult = "idle";

const char* CONFIG_PATH = "/config.json";

// ─── Colour helpers ──────────────────────────────────────────────────────────
#define COL_OFF    strip.Color(0,   0,   0  )
#define COL_RED    strip.Color(100, 0,   0  )
#define COL_GREEN  strip.Color(0,   100, 0  )
#define COL_BLUE   strip.Color(0,   0,   100)
#define COL_YELLOW strip.Color(100, 80,  0  )
#define COL_PURPLE strip.Color(80,  0,   100)

// ─── Function prototypes ─────────────────────────────────────────────────────
void loadConfig();
void saveConfig();
void connectToWiFi();
void fallbackToAPMode();
void startAPMode();
void setupWebServer();
void handleRoot();
void handleConfig();
void handleSave();
void handleWrite();
void setLED(int i, uint32_t c);
void setAllLEDs(uint32_t c);
void blinkLED(int i, uint32_t c, int ms);
void beep(int ms);
String readNFCString();
bool   writeNFCString(const String& data);
void   doReaderScan();
void   doWriterScan();

// =============================================================================
//  SETUP
// =============================================================================
void setup() {
  delay(500);

  // Pins — keep existing assignments, do not change
  pinMode(RST_PIN,    OUTPUT); digitalWrite(RST_PIN,    HIGH);
  pinMode(SS_PIN,     OUTPUT); digitalWrite(SS_PIN,     LOW );
  pinMode(BUZZER_PIN, OUTPUT); digitalWrite(BUZZER_PIN, LOW );

  Serial.begin(115200);
  SPI.begin();
  mfrc522.PCD_Init();

  strip.begin();
  strip.show();
  strip.setBrightness(30);
  setAllLEDs(COL_OFF);

  if (!SPIFFS.begin()) {
    Serial.println("[SPIFFS] Mount failed");
    setAllLEDs(COL_RED);
    return;
  }

  loadConfig();
  connectToWiFi();
  setupWebServer();
}

// =============================================================================
//  MAIN LOOP
// =============================================================================
void loop() {
  server.handleClient();

  // Update WiFi LED — but do NOT block NFC scanning on WiFi status.
  // Reader mode will still read cards; it just won't POST if there is no
  // endpoint configured.  Writer mode works entirely offline.
  if (WiFi.status() != WL_CONNECTED) {
    setLED(0, COL_RED);
    // Attempt reconnection with retry limit before falling back to AP mode
    static unsigned long lastReconnect = 0;
    static bool reconnectInProgress = false;
    static int reconnectAttempts = 0;
    static const int MAX_RECONNECT_ATTEMPTS = 3;
    
    if (millis() - lastReconnect > 60000 && !reconnectInProgress) {
      lastReconnect = millis();
      reconnectInProgress = true;
      reconnectAttempts++;
      Serial.print("[WiFi] Reconnect attempt ");
      Serial.print(reconnectAttempts);
      Serial.print("/");
      Serial.print(MAX_RECONNECT_ATTEMPTS);
      Serial.println("...");
      WiFi.begin(ssid, wifiPassword);
    }
    
    // Check if reconnection completed (successfully or failed)
    if (reconnectInProgress) {
      if (WiFi.status() == WL_CONNECTED) {
        Serial.print("[WiFi] Reconnected, IP: ");
        Serial.println(WiFi.localIP());
        setLED(0, COL_BLUE);
        reconnectInProgress = false;
        reconnectAttempts = 0; // Reset counter on success
      } else if (millis() - lastReconnect > 25000) { // Give it 25 seconds total
        Serial.println("[WiFi] Reconnect failed");
        reconnectInProgress = false;
        
        // Check if we've exceeded max attempts, then fallback to AP mode
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          Serial.println("[WiFi] Max reconnect attempts reached, falling back to AP mode");
          reconnectAttempts = 0; // Reset for next cycle
          fallbackToAPMode();
        }
      }
    }
  } else {
    setLED(0, COL_BLUE);
  }

  if (strcmp(mode, "writer") == 0) {
    setLED(1, COL_PURPLE);
    doWriterScan();
  } else {
    setLED(1, COL_BLUE);
    doReaderScan();
  }
}

// =============================================================================
//  READER MODE — scan card → POST to endpoint
// =============================================================================
void doReaderScan() {
  setLED(2, COL_RED);
  setLED(3, COL_RED);

  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  String cardData = readNFCString();
  if (cardData == "") {
    Serial.println("[Reader] Empty card data");
    lastOpResult = "empty";
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    return;
  }

  cardData.trim();
  lastCardId = cardData;
  Serial.println("[Reader] Card: " + cardData);
  beep(80);

  // Build JSON body
  String body = "{\"employeeId\":\"" + cardData + "\"}";

  int httpCode = -1;

  if (strlen(endpoint) < 5) {
    // No backend configured — still give positive local feedback so you
    // can verify read/write works before setting up the server.
    Serial.println("[Reader] No endpoint — local read only");
    lastOpResult = "read-only";
    setLED(1, COL_BLUE);
    setLED(2, COL_GREEN);
    setLED(3, COL_GREEN);
    beep(100);
  } else {
    bool isHttps = String(endpoint).startsWith("https");

    if (isHttps) {
      BearSSL::WiFiClientSecure secureClient;
      secureClient.setInsecure();  // skip cert validation for device simplicity
      HTTPClient http;
      http.begin(secureClient, endpoint);
      http.addHeader("Content-Type",  "application/json");
      http.addHeader("Authorization", String("Bearer ") + jwtToken);
      httpCode = http.POST(body);
      lastHttpCode = httpCode;
      Serial.println("[Reader] HTTP " + String(httpCode));
      http.end();
    } else {
      WiFiClient plainClient;
      HTTPClient http;
      http.begin(plainClient, endpoint);
      http.addHeader("Content-Type",  "application/json");
      http.addHeader("Authorization", String("Bearer ") + jwtToken);
      httpCode = http.POST(body);
      lastHttpCode = httpCode;
      Serial.println("[Reader] HTTP " + String(httpCode));
      http.end();
    }

    if (httpCode == 200 || httpCode == 201) {
      lastOpResult = "success";
      setLED(1, COL_BLUE);
      setLED(2, COL_GREEN);
      setLED(3, COL_GREEN);
      beep(100);
    } else if (httpCode == 404) {
      lastOpResult = "unknown-card";
      setLED(1, COL_RED);
      setLED(2, COL_YELLOW);
      setLED(3, COL_YELLOW);
      beep(80); delay(150); beep(80);
    } else {
      lastOpResult = "error-" + String(httpCode);
      setLED(1, COL_RED);
      setLED(2, COL_RED);
      setLED(3, COL_RED);
      beep(80); delay(150); beep(80); delay(150); beep(80);
    }
  }

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(3000);  // debounce
}

// =============================================================================
//  WRITER MODE — wait for card → write armed payload
// =============================================================================
void doWriterScan() {
  if (!writerArmed || strlen(writePayload) == 0) {
    setLED(2, COL_OFF);
    setLED(3, COL_OFF);
    delay(100);
    return;
  }

  // Pulse to signal ready-to-write
  setLED(2, COL_PURPLE);
  setLED(3, COL_PURPLE);

  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  Serial.println("[Writer] Card detected, writing: " + String(writePayload));
  beep(60);

  bool ok = writeNFCString(String(writePayload));

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  if (ok) {
    Serial.println("[Writer] Write successful");
    lastOpResult = "write-ok";
    setLED(2, COL_GREEN);
    setLED(3, COL_GREEN);
    beep(100);
    writerArmed = false;
    writePayload[0] = '\0';
    // Switch back to reader mode automatically after writing
    strncpy(mode, "reader", sizeof(mode));
    saveConfig();
  } else {
    Serial.println("[Writer] Write failed");
    lastOpResult = "write-fail";
    setLED(2, COL_RED);
    setLED(3, COL_RED);
    beep(80); delay(150); beep(80); delay(150); beep(80);
  }

  delay(3000);
}

// =============================================================================
//  NFC: READ sector 1 block 4 (16 bytes → trimmed String)
// =============================================================================
String readNFCString() {
  MFRC522::MIFARE_Key key;
  for (byte i = 0; i < 6; i++) key.keyByte[i] = 0xFF;

  byte block  = 4;  // sector 1, block 0
  byte buffer[18];
  byte size = sizeof(buffer);

  MFRC522::StatusCode status = mfrc522.PCD_Authenticate(
      MFRC522::PICC_CMD_MF_AUTH_KEY_A, block, &key, &mfrc522.uid);
  if (status != MFRC522::STATUS_OK) {
    Serial.print("[NFC] Auth failed: ");
    Serial.println(mfrc522.GetStatusCodeName(status));
    return "";
  }

  status = mfrc522.MIFARE_Read(block, buffer, &size);
  if (status != MFRC522::STATUS_OK) {
    Serial.print("[NFC] Read failed: ");
    Serial.println(mfrc522.GetStatusCodeName(status));
    return "";
  }

  String result = "";
  for (byte i = 0; i < 16; i++) {
    if (buffer[i] != 0x00) result += (char)buffer[i];
  }
  return result;
}

// =============================================================================
//  NFC: WRITE sector 1 block 4 (pad/truncate to 16 bytes)
// =============================================================================
bool writeNFCString(const String& data) {
  MFRC522::MIFARE_Key key;
  for (byte i = 0; i < 6; i++) key.keyByte[i] = 0xFF;

  byte block = 4;  // sector 1, block 0

  MFRC522::StatusCode status = mfrc522.PCD_Authenticate(
      MFRC522::PICC_CMD_MF_AUTH_KEY_A, block, &key, &mfrc522.uid);
  if (status != MFRC522::STATUS_OK) {
    Serial.print("[NFC] Write auth failed: ");
    Serial.println(mfrc522.GetStatusCodeName(status));
    return false;
  }

  byte writeBuffer[16];
  memset(writeBuffer, 0x00, 16);
  int len = min((int)data.length(), 16);
  for (int i = 0; i < len; i++) writeBuffer[i] = (byte)data[i];

  status = mfrc522.MIFARE_Write(block, writeBuffer, 16);
  if (status != MFRC522::STATUS_OK) {
    Serial.print("[NFC] Write failed: ");
    Serial.println(mfrc522.GetStatusCodeName(status));
    return false;
  }

  return true;
}

// =============================================================================
//  WIFI
// =============================================================================
void connectToWiFi() {
  if (strlen(ssid) == 0) {
    Serial.println("[WiFi] No SSID — starting AP mode");
    fallbackToAPMode();
    return;
  }

  Serial.print("[WiFi] Connecting to: ");
  Serial.println(ssid);
  WiFi.begin(ssid, wifiPassword);

  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 20000) {
    blinkLED(0, COL_GREEN, 400);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] Connected, IP: ");
    Serial.println(WiFi.localIP());
    setLED(0, COL_BLUE);
  } else {
    Serial.println("[WiFi] Failed — falling back to AP mode");
    setLED(0, COL_RED);
    fallbackToAPMode();
  }
}

void startAPMode() {
  WiFi.mode(WIFI_AP);
  String apName = "NFC-Attendance-Config";
  if (strlen(apPassword) > 0) {
    WiFi.softAP(apName.c_str(), apPassword);
  } else {
    WiFi.softAP(apName.c_str());
  }
  Serial.print("[AP] SSID: ");  Serial.println(apName);
  Serial.print("[AP] IP:   ");  Serial.println(WiFi.softAPIP());
  setLED(0, COL_YELLOW);
  // setupWebServer() is called once in setup() — don't call it here again
}

void fallbackToAPMode() {
  startAPMode();
  // Return to main loop — server.handleClient() runs there continuously
  // NFC read/write still works in AP mode so the device is fully functional
}

// =============================================================================
//  WEB SERVER
// =============================================================================
void setupWebServer() {
  server.on("/",       HTTP_GET,  handleRoot);
  server.on("/config", HTTP_GET,  handleConfig);
  server.on("/save",   HTTP_POST, handleSave);
  server.on("/write",  HTTP_GET,  handleWrite);
  server.on("/write",  HTTP_POST, handleWrite);
  server.begin();
  Serial.println("[HTTP] Server started");
}

// ─── / — status dashboard ────────────────────────────────────────────────────
void handleRoot() {
  String currentMode = String(mode);
  String modeBadge = (currentMode == "writer")
    ? "<span style='background:#7c3aed;color:#fff;padding:2px 10px;border-radius:12px;font-size:13px'>Writer</span>"
    : "<span style='background:#2563eb;color:#fff;padding:2px 10px;border-radius:12px;font-size:13px'>Reader</span>";

  String wifiStatus = (WiFi.status() == WL_CONNECTED)
    ? "<span style='color:#16a34a'>&#9679; Connected (" + WiFi.localIP().toString() + ")</span>"
    : "<span style='color:#dc2626'>&#9679; Not connected</span>";

  String lastCardHtml = (lastCardId != "")
    ? "<code style='background:#f1f5f9;padding:2px 8px;border-radius:6px'>" + lastCardId + "</code>"
    : "<span style='color:#94a3b8'>none</span>";

  String resultHtml;
  if      (lastOpResult == "success")      resultHtml = "<span style='color:#16a34a'>&#10003; Success</span>";
  else if (lastOpResult == "unknown-card") resultHtml = "<span style='color:#d97706'>&#9888; Unknown card (404)</span>";
  else if (lastOpResult == "write-ok")     resultHtml = "<span style='color:#16a34a'>&#10003; Write OK</span>";
  else if (lastOpResult == "write-fail")   resultHtml = "<span style='color:#dc2626'>&#10007; Write failed</span>";
  else if (lastOpResult == "read-only")    resultHtml = "<span style='color:#16a34a'>&#10003; Card read (no endpoint)</span>";
  else if (lastOpResult == "idle")         resultHtml = "<span style='color:#94a3b8'>-</span>";
  else                                     resultHtml = "<span style='color:#dc2626'>" + lastOpResult + "</span>";

  String writerSection = "";
  if (currentMode == "writer") {
    String armed = writerArmed
      ? "&#128262; Ready to write <code>" + String(writePayload) + "</code> &mdash; tap a card now"
      : "No write operation armed.";
    writerSection =
      "<div style='margin-top:16px;padding:16px;background:#faf5ff;border:1px solid #d8b4fe;border-radius:10px'>"
      "<h3 style='margin:0 0 8px;color:#7c3aed'>Writer Mode</h3>"
      "<p style='margin:0 0 12px;font-size:13px;color:#6b7280'>" + armed + "</p>"
      "<a href='/write' style='display:inline-block;padding:8px 18px;background:#7c3aed;color:#fff;"
      "border-radius:8px;text-decoration:none;font-size:14px'>Write a Card</a>"
      "</div>";
  }

  String html = "<!DOCTYPE html><html lang='en'><head>"
    "<meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>NFC Attendance</title>"
    "<style>"
    "*{box-sizing:border-box}"
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
    "max-width:480px;margin:0 auto;padding:20px;background:#f8fafc;color:#1e293b}"
    "h1{font-size:20px;font-weight:700;margin:0 0 4px}"
    ".card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px}"
    ".row{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #f1f5f9}"
    ".row:last-child{border-bottom:none}"
    ".label{font-size:13px;color:#64748b}"
    ".btn{display:inline-block;padding:9px 20px;background:#fff;color:#2563eb;border:1px solid #2563eb;"
    "border-radius:8px;text-decoration:none;font-size:14px;margin-right:8px}"
    "</style></head><body>"
    "<div class='card'>"
    "<h1>NFC Attendance Reader</h1>"
    "<p style='font-size:12px;color:#94a3b8;margin:0 0 16px'>ESP8266 D1 Mini</p>"
    "<div class='row'><span class='label'>WiFi</span>" + wifiStatus + "</div>"
    "<div class='row'><span class='label'>Mode</span>" + modeBadge + "</div>"
    "<div class='row'><span class='label'>Last card</span>" + lastCardHtml + "</div>"
    "<div class='row'><span class='label'>Last result</span>" + resultHtml + "</div>"
    "</div>"
    + writerSection +
    "<div style='margin-top:16px'>"
    "<a class='btn' href='/config'>&#9881; Settings</a>"
    "<a class='btn' href='/'>&#8635; Refresh</a>"
    "</div>"
    "</body></html>";

  server.send(200, "text/html", html);
}

// ─── /config — settings form ─────────────────────────────────────────────────
void handleConfig() {
  String checkedReader = (strcmp(mode, "reader") == 0) ? " checked" : "";
  String checkedWriter = (strcmp(mode, "writer") == 0) ? " checked" : "";

  String html = "<!DOCTYPE html><html lang='en'><head>"
    "<meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>NFC — Settings</title>"
    "<style>"
    "*{box-sizing:border-box}"
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
    "max-width:480px;margin:0 auto;padding:20px;background:#f8fafc;color:#1e293b}"
    "h1{font-size:20px;font-weight:700;margin:0 0 20px}"
    ".card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px}"
    "h2{font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:0 0 14px}"
    "label{display:block;font-size:13px;color:#374151;margin-bottom:4px;margin-top:12px}"
    "input[type=text],input[type=password],input[type=url]{width:100%;padding:8px 12px;"
    "border:1px solid #d1d5db;border-radius:8px;font-size:14px;outline:none}"
    "input:focus{border-color:#2563eb;box-shadow:0 0 0 2px #bfdbfe}"
    ".radio-row{display:flex;gap:20px;margin-top:10px}"
    ".radio-row label{display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;font-size:14px}"
    "button{width:100%;padding:11px;background:#2563eb;color:#fff;border:none;border-radius:8px;"
    "font-size:15px;font-weight:600;cursor:pointer;margin-top:8px}"
    "button:hover{background:#1d4ed8}"
    "a{color:#2563eb;text-decoration:none;font-size:13px}"
    "</style></head><body>"
    "<h1>&#9881; Settings</h1>"
    "<form action='/save' method='POST'>"

    // WiFi section
    "<div class='card'>"
    "<h2>WiFi</h2>"
    "<label>SSID</label>"
    "<input type='text' name='ssid' value='" + String(ssid) + "' placeholder='Network name'>"
    "<label>Password</label>"
    "<input type='password' name='password' value='" + String(wifiPassword) + "'>"
    "<label>AP Password (hotspot when not connected)</label>"
    "<input type='text' name='apPassword' value='" + String(apPassword) + "'>"
    "</div>"

    // Backend section
    "<div class='card'>"
    "<h2>Backend</h2>"
    "<label>Endpoint URL</label>"
    "<input type='url' name='endpoint' value='" + String(endpoint) + "' "
    "placeholder='https://your-app.vercel.app/api/attendance'>"
    "<label>JWT Token (Bearer)</label>"
    "<input type='text' name='jwtToken' value='" + String(jwtToken) + "' placeholder='Paste token here'>"
    "</div>"

    // Mode section
    "<div class='card'>"
    "<h2>Operating Mode</h2>"
    "<p style='font-size:13px;color:#6b7280;margin:0 0 8px'>"
    "Reader scans cards and sends attendance to the backend.<br>"
    "Writer encodes an employee ID onto a blank card.</p>"
    "<div class='radio-row'>"
    "<label><input type='radio' name='mode' value='reader'" + checkedReader + "> Reader</label>"
    "<label><input type='radio' name='mode' value='writer'" + checkedWriter + "> Writer</label>"
    "</div>"
    "</div>"

    "<button type='submit'>Save &amp; Restart</button>"
    "</form>"
    "<p style='text-align:center;margin-top:14px'><a href='/'>&#8592; Back to status</a></p>"
    "</body></html>";

  server.send(200, "text/html", html);
}

// ─── /save — POST: persist config and restart ────────────────────────────────
void handleSave() {
  if (server.hasArg("ssid"))       server.arg("ssid").toCharArray(ssid,          sizeof(ssid));
  if (server.hasArg("password"))   server.arg("password").toCharArray(wifiPassword, sizeof(wifiPassword));
  if (server.hasArg("apPassword")) server.arg("apPassword").toCharArray(apPassword, sizeof(apPassword));
  if (server.hasArg("endpoint"))   server.arg("endpoint").toCharArray(endpoint,  sizeof(endpoint));
  if (server.hasArg("jwtToken"))   server.arg("jwtToken").toCharArray(jwtToken,  sizeof(jwtToken));
  if (server.hasArg("mode"))       server.arg("mode").toCharArray(mode,          sizeof(mode));

  saveConfig();

  server.send(200, "text/html",
    "<!DOCTYPE html><html><head><meta charset='UTF-8'>"
    "<meta http-equiv='refresh' content='3;url=/'>"
    "<style>body{font-family:sans-serif;text-align:center;padding:40px;background:#f8fafc}</style>"
    "</head><body>"
    "<h2 style='color:#16a34a'>&#10003; Saved!</h2>"
    "<p>Restarting device&hellip;</p>"
    "</body></html>");
  delay(1500);
  ESP.restart();
}

// ─── /write — GET: arm-write form | POST: queue employee ID ──────────────────
void handleWrite() {
  if (strcmp(mode, "writer") != 0) {
    server.send(400, "text/html",
      "<p style='font-family:sans-serif;padding:20px;color:#dc2626'>"
      "Device is not in Writer mode. <a href='/config'>Go to Settings</a>.</p>");
    return;
  }

  if (server.method() == HTTP_POST && server.hasArg("employeeId")) {
    String id = server.arg("employeeId");
    id.trim();
    if (id.length() == 0 || id.length() > 16) {
      server.send(400, "text/html",
        "<p style='font-family:sans-serif;padding:20px;color:#dc2626'>"
        "Employee ID must be 1–16 characters. <a href='/write'>Back</a>.</p>");
      return;
    }
    id.toCharArray(writePayload, sizeof(writePayload));
    writerArmed = true;
    saveConfig();

    server.send(200, "text/html",
      "<!DOCTYPE html><html><head><meta charset='UTF-8'>"
      "<meta http-equiv='refresh' content='4;url=/'>"
      "<style>body{font-family:sans-serif;text-align:center;padding:40px;background:#f8fafc}</style>"
      "</head><body>"
      "<h2 style='color:#7c3aed'>&#128262; Ready to Write</h2>"
      "<p>Tap a blank MIFARE card now.</p>"
      "<p>Writing: <code style='background:#f3e8ff;padding:2px 8px;border-radius:4px'>"
      + String(writePayload) + "</code></p>"
      "<p><a href='/' style='color:#7c3aed'>Go to status</a></p>"
      "</body></html>");
    return;
  }

  // GET — show the form
  String html = "<!DOCTYPE html><html lang='en'><head>"
    "<meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
    "<title>NFC — Write Card</title>"
    "<style>"
    "*{box-sizing:border-box}"
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
    "max-width:480px;margin:0 auto;padding:20px;background:#f8fafc;color:#1e293b}"
    "h1{font-size:20px;margin:0 0 6px}"
    "p{font-size:13px;color:#6b7280;margin:0 0 16px}"
    ".card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px}"
    "label{display:block;font-size:13px;color:#374151;margin-bottom:6px}"
    "input[type=text]{width:100%;padding:8px 12px;border:1px solid #d1d5db;"
    "border-radius:8px;font-size:14px;outline:none}"
    "input:focus{border-color:#7c3aed;box-shadow:0 0 0 2px #ede9fe}"
    "button{width:100%;padding:11px;background:#7c3aed;color:#fff;border:none;"
    "border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;margin-top:12px}"
    "button:hover{background:#6d28d9}"
    "a{color:#2563eb;font-size:13px;text-decoration:none}"
    "</style></head><body>"
    "<h1>&#9997; Write NFC Card</h1>"
    "<p>Enter an employee ID (max 16 chars). After submitting, tap a blank MIFARE card to the reader.</p>"
    "<div class='card'>"
    "<form method='POST' action='/write'>"
    "<label for='eid'>Employee ID</label>"
    "<input id='eid' type='text' name='employeeId' maxlength='16' placeholder='e.g. EMP001' required"
    " autofocus>"
    "<button type='submit'>&#128262; Arm Write</button>"
    "</form>"
    "</div>"
    "<p style='margin-top:16px'><a href='/'>&#8592; Back to status</a></p>"
    "</body></html>";

  server.send(200, "text/html", html);
}

// =============================================================================
//  CONFIG — load / save SPIFFS
// =============================================================================
void loadConfig() {
  if (!SPIFFS.exists(CONFIG_PATH)) {
    Serial.println("[Config] No config file, using defaults");
    return;
  }

  File f = SPIFFS.open(CONFIG_PATH, "r");
  if (!f) { Serial.println("[Config] Open failed"); return; }

  size_t sz = f.size();
  std::unique_ptr<char[]> buf(new char[sz + 1]);
  f.readBytes(buf.get(), sz);
  buf[sz] = '\0';
  f.close();

  StaticJsonDocument<1024> json;
  if (deserializeJson(json, buf.get())) {
    Serial.println("[Config] Parse error");
    return;
  }

  if (json["ssid"])         strlcpy(ssid,          json["ssid"],         sizeof(ssid));
  if (json["password"])     strlcpy(wifiPassword,   json["password"],     sizeof(wifiPassword));
  if (json["apPassword"])   strlcpy(apPassword,     json["apPassword"],   sizeof(apPassword));
  if (json["endpoint"])     strlcpy(endpoint,       json["endpoint"],     sizeof(endpoint));
  if (json["jwtToken"])     strlcpy(jwtToken,       json["jwtToken"],     sizeof(jwtToken));
  if (json["mode"])         strlcpy(mode,           json["mode"],         sizeof(mode));
  if (json["writePayload"]) strlcpy(writePayload,   json["writePayload"], sizeof(writePayload));

  Serial.println("[Config] Loaded OK");
}

void saveConfig() {
  StaticJsonDocument<1024> json;
  json["ssid"]         = ssid;
  json["password"]     = wifiPassword;
  json["apPassword"]   = apPassword;
  json["endpoint"]     = endpoint;
  json["jwtToken"]     = jwtToken;
  json["mode"]         = mode;
  json["writePayload"] = writePayload;

  File f = SPIFFS.open(CONFIG_PATH, "w");
  if (!f) { Serial.println("[Config] Write failed"); return; }
  serializeJson(json, f);
  f.close();
  Serial.println("[Config] Saved");
}

// =============================================================================
//  LED & BUZZER helpers
// =============================================================================
void setLED(int i, uint32_t c) {
  strip.setPixelColor(i, c);
  strip.show();
}

void setAllLEDs(uint32_t c) {
  for (int i = 0; i < LED_COUNT; i++) strip.setPixelColor(i, c);
  strip.show();
}

void blinkLED(int i, uint32_t c, int ms) {
  setLED(i, c);  delay(ms);
  setLED(i, 0);  delay(ms);
}

void beep(int ms) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(ms);
  digitalWrite(BUZZER_PIN, LOW);
}
