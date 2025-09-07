@echo off
echo ===================================
echo Road Damage Detection System Setup
echo ===================================

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed. Please install Python 3.8 or higher.
    pause
    exit /b 1
) else (
    echo [INFO] Python found
)

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js 16 or higher.
    pause
    exit /b 1
) else (
    echo [INFO] Node.js found
)

:: Check if Expo CLI is installed
expo --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Expo CLI not found. Installing...
    npm install -g expo-cli
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Expo CLI
        pause
        exit /b 1
    )
) else (
    echo [INFO] Expo CLI found
)

:: Setup Flask server
echo [INFO] Setting up Flask server...
cd flask-server

:: Create virtual environment if it doesn't exist
if not exist "venv" (
    echo [INFO] Creating Python virtual environment...
    python -m venv venv
)

:: Activate virtual environment
echo [INFO] Activating virtual environment...
call venv\Scripts\activate.bat

:: Install requirements
echo [INFO] Installing Python dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Python dependencies
    pause
    exit /b 1
)

cd ..

:: Setup mobile app
echo [INFO] Setting up mobile app...
cd mobile-app

:: Install npm dependencies
echo [INFO] Installing npm dependencies...
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install npm dependencies
    pause
    exit /b 1
)

cd ..

:: Get local IP address (simplified for Windows)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

echo.
echo ======================================
echo Setup completed successfully!
echo ======================================
echo.
echo [INFO] Next steps:
echo 1. Update the server URL in mobile-app\utils\ApiService.js
echo    Replace 'YOUR_SERVER_IP' with: %LOCAL_IP%
echo.
echo 2. Start the Flask server:
echo    cd flask-server
echo    venv\Scripts\activate.bat
echo    python app.py
echo.
echo 3. Start the mobile app (in a new terminal):
echo    cd mobile-app
echo    expo start
echo.
echo [WARNING] Don't forget to update the API_BASE_URL in ApiService.js!
echo Set it to: http://%LOCAL_IP%:5000/api

pause
