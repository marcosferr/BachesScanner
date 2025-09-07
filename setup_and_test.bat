@echo off
echo ===============================================
echo Road Damage Detection Server Setup and Test
echo ===============================================

if "%1"=="stop" goto :stop_server
if "%1"=="start" goto :start_server
if "%1"=="test" goto :test_server

:: Main setup and test
echo [INFO] Starting setup and test process...

:: Check if required files exist
echo [STEP] Checking required files...
if not exist "YOLOv8_Small_RDD.pt" (
    echo [ERROR] YOLOv8_Small_RDD.pt not found in current directory
    pause
    exit /b 1
)

if not exist "flask-server\app.py" (
    echo [ERROR] Flask server not found at flask-server\app.py
    pause
    exit /b 1
)

echo [INFO] All required files found

:: Setup Flask server
echo [STEP] Setting up Flask server...
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

echo [INFO] Server dependencies installed successfully

:: Start server
echo [STEP] Starting Flask server...
start /b python app.py > server.log 2>&1

:: Wait for server to start
echo [INFO] Waiting for server to initialize...
timeout /t 5 /nobreak > nul

cd ..

:: Test server
echo [STEP] Testing server endpoints...
echo [INFO] Running comprehensive server tests...
python test_server.py

:: Get local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

echo.
echo ================================================
echo Setup and Testing Completed!
echo ================================================
echo.
echo [INFO] Flask server is running at: http://%LOCAL_IP%:5000
echo.
echo API Endpoints:
echo   Health check: GET  http://%LOCAL_IP%:5000/
echo   Inference:    POST http://%LOCAL_IP%:5000/api/infer
echo   Save result:  POST http://%LOCAL_IP%:5000/api/detect
echo   Get history:  GET  http://%LOCAL_IP%:5000/api/detections
echo   Get stats:    GET  http://%LOCAL_IP%:5000/api/stats
echo.
echo [INFO] For mobile app configuration:
echo   Update API_BASE_URL in mobile-app\utils\ApiService.js
echo   Set it to: http://%LOCAL_IP%:5000/api
echo.
echo [INFO] To stop the server:
echo   Run: %0 stop
echo.
echo [INFO] To view server logs:
echo   Run: type flask-server\server.log

pause
exit /b 0

:stop_server
echo [STEP] Stopping Flask server...
taskkill /f /im python.exe /t > nul 2>&1
echo [INFO] Flask server stopped
exit /b 0

:start_server
echo [STEP] Starting Flask server...
cd flask-server
call venv\Scripts\activate.bat
start /b python app.py
cd ..
echo [INFO] Flask server started
exit /b 0

:test_server
echo [STEP] Testing server...
python test_server.py
exit /b 0
